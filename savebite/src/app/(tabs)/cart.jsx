import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import QtyStepper from "../../components/QtyStepper";
import { useCart } from "../../context/CartContext";
import { api } from "../../lib/api";
import { formatNaira } from "../../lib/mockData";

const addrText = (a) => [a.line1, a.lga, a.state].filter(Boolean).join(", ");
const inputClass = "mb-3 rounded-2xl bg-white px-4 py-3.5 text-base text-gray-900";

function Section({ title, children }) {
  return (
    <View className="mt-6 px-6">
      <Text className="mb-3 text-lg font-extrabold text-gray-900">{title}</Text>
      {children}
    </View>
  );
}

function Segment({ options, value, onChange }) {
  return (
    <View className="flex-row rounded-2xl bg-gray-100 p-1">
      {options.map((o) => (
        <Pressable key={o.id} onPress={() => onChange(o.id)} className={`flex-1 items-center rounded-xl py-2.5 ${value === o.id ? "bg-white" : ""}`}>
          <Text className={`text-sm font-semibold ${value === o.id ? "text-brand" : "text-gray-500"}`}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function CartLine({ item, onQty }) {
  const out = item.unavailable;
  return (
    <View className="mb-3 rounded-3xl bg-white p-3">
      <View className="flex-row">
        {item.image ? (
          <Image source={{ uri: item.image }} className="h-20 w-20 rounded-2xl bg-gray-200" />
        ) : (
          <View className="h-20 w-20 items-center justify-center rounded-2xl bg-brand-tint"><Text style={{ fontSize: 32 }}>🛒</Text></View>
        )}
        <View className="ml-3 flex-1">
          <Text numberOfLines={2} className="text-sm font-semibold text-gray-900">{item.name}</Text>
          {item.variety?.name ? <Text className="text-xs text-gray-500">{item.variety.name}</Text> : null}
          <Text className="mt-1 text-base font-extrabold text-gray-900">{formatNaira(item.price)}</Text>
          <View className="mt-2 flex-row items-center">
            {out ? (
              <Pressable onPress={() => onQty(0)}><Text className="text-sm font-bold text-red-600">Out of stock · Remove</Text></Pressable>
            ) : (
              <View style={{ width: 112 }}>
                <QtyStepper small qty={item.quantity} max={item.stockQuantity ?? 99} onChange={onQty} />
              </View>
            )}
            <View className="flex-1" />
            <Text className="text-sm font-bold text-gray-700">{formatNaira(item.price * item.quantity)}</Text>
          </View>
        </View>
      </View>
      {item.priceChanged && !out ? (
        <Pressable onPress={() => onQty(item.quantity)} className="mt-3 flex-row items-center rounded-2xl bg-amber-50 px-3 py-2">
          <Ionicons name="alert-circle" size={16} color="#D97706" />
          <Text className="ml-2 flex-1 text-xs text-amber-800">Price is now {formatNaira(item.currentPrice)}.</Text>
          <Text className="text-xs font-bold text-brand">Update</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function Cart() {
  const router = useRouter();
  const { cart, items, itemCount, total, loading, setLineQty, clear, updateOptions, refresh } = useCart();
  const [addresses, setAddresses] = useState([]);
  const [agentName, setAgentName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadAddresses = useCallback(
    () => api("/users/me/addresses", { auth: true }).then((r) => setAddresses(r.addresses ?? [])).catch(() => {}),
    []
  );
  useFocusEffect(useCallback(() => { refresh(); loadAddresses(); }, [refresh, loadAddresses]));

  useEffect(() => {
    setAgentName(cart.pickup?.agentName ?? "");
    setAgentPhone(cart.pickup?.agentPhone ?? "");
  }, [cart.pickup?.agentName, cart.pickup?.agentPhone]);

  const guard = (fn) => async (...a) => {
    try { await fn(...a); } catch (e) { Alert.alert("Couldn't save", e?.message || "Please try again."); }
  };
  const setFulfillment = guard((v) => updateOptions({ fulfillmentType: v }));
  const setPayment = guard((v) => updateOptions({ paymentMethod: v }));
  const pickAddress = guard((a) => updateOptions({ delivery: { address: addrText(a) } }));
  const setPickupBy = guard((v) => updateOptions({ pickup: { pickedUpBy: v } }));
  const saveAgent = guard(() => updateOptions({ pickup: { pickedUpBy: "agent", agentName, agentPhone } }));

  const delivery = cart.fulfillmentType !== "pickup";
  const agent = cart.pickup?.pickedUpBy === "agent";

  const checkout = () => {
    const problems = [];
    if (items.some((i) => i.unavailable)) problems.push("Remove the items that are out of stock.");
    if (delivery && !cart.delivery?.address) problems.push("Choose a delivery address.");
    if (!delivery && agent && !(cart.pickup?.agentName && cart.pickup?.agentPhone)) problems.push("Save your pickup agent's name and phone.");
    if (problems.length) return Alert.alert("Almost there", problems.join("\n"));
    Alert.alert("Ready to order", "Your cart is valid. Placing the order and payment is the next step to build.");
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-cream">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} tintColor="#F97316" />}
      >
        <View className="flex-row items-end justify-between px-6 pb-2 pt-2">
          <View>
            <Text className="text-2xl font-extrabold text-gray-900">Cart</Text>
            <Text className="text-sm text-gray-500">{itemCount} item{itemCount === 1 ? "" : "s"}</Text>
          </View>
          {items.length ? (
            <Pressable onPress={() => Alert.alert("Clear cart?", undefined, [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive", onPress: clear }])} hitSlop={8}>
              <Text className="text-sm font-semibold text-red-600">Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {!items.length ? (
          loading ? (
            <ActivityIndicator color="#F97316" style={{ marginTop: 60 }} />
          ) : (
            <View className="items-center px-10 py-20">
              <Text style={{ fontSize: 48 }}>🛒</Text>
              <Text className="mt-3 text-base font-semibold text-gray-900">Your cart is empty</Text>
              <Text className="mt-1 text-center text-sm text-gray-500">Add food from the home screen and it will show up here.</Text>
              <Pressable onPress={() => router.push("/home")} className="mt-5 rounded-full bg-brand px-6 py-3">
                <Text className="text-sm font-bold text-white">Browse food</Text>
              </Pressable>
            </View>
          )
        ) : (
          <>
            <View className="mt-3 px-6">
              {items.map((i) => (
                <CartLine key={i._id} item={i} onQty={(n) => setLineQty(i, n)} />
              ))}
            </View>

            <Section title="How do you want it?">
              <Segment value={cart.fulfillmentType} onChange={setFulfillment} options={[{ id: "delivery", label: "Delivery" }, { id: "pickup", label: "Pickup" }]} />

              {delivery ? (
                <View className="mt-4">
                  {addresses.map((a) => {
                    const on = cart.delivery?.address === addrText(a);
                    return (
                      <Pressable key={a._id} onPress={() => pickAddress(a)} className={`mb-2 flex-row items-center rounded-2xl border-2 bg-white p-3 ${on ? "border-brand" : "border-transparent"}`}>
                        <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? "#F97316" : "#9CA3AF"} />
                        <View className="ml-3 flex-1">
                          <Text className="text-sm font-bold text-gray-900">{a.label}{a.isDefault ? " · Default" : ""}</Text>
                          <Text className="text-xs text-gray-500">{addrText(a)}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                  <Pressable onPress={() => router.push("/account/addresses")} className="flex-row items-center py-2">
                    <Ionicons name="add-circle-outline" size={18} color="#F97316" />
                    <Text className="ml-1.5 text-sm font-bold text-brand">{addresses.length ? "Add or edit addresses" : "Add a delivery address"}</Text>
                  </Pressable>
                </View>
              ) : (
                <View className="mt-4">
                  <Segment value={agent ? "agent" : "self"} onChange={setPickupBy} options={[{ id: "self", label: "I'll pick it up" }, { id: "agent", label: "Someone else will" }]} />
                  {agent ? (
                    <View className="mt-3">
                      <TextInput value={agentName} onChangeText={setAgentName} placeholder="Agent's full name" placeholderTextColor="#9CA3AF" className={inputClass} />
                      <TextInput value={agentPhone} onChangeText={setAgentPhone} placeholder="Agent's phone number" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" className={inputClass} />
                      <Pressable onPress={saveAgent} disabled={!agentName.trim() || !agentPhone.trim()} className={`items-center rounded-full py-3 ${agentName.trim() && agentPhone.trim() ? "bg-brand" : "bg-gray-300"}`}>
                        <Text className="text-sm font-bold text-white">Save agent details</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              )}
            </Section>

            <Section title="Payment">
              <Segment
                value={cart.paymentMethod}
                onChange={setPayment}
                options={[{ id: "online", label: "Pay now" }, { id: "on_delivery", label: delivery ? "Pay on delivery" : "Pay at pickup" }]}
              />
            </Section>

            <View className="mx-6 mt-6 rounded-3xl bg-white p-5">
              <View className="flex-row justify-between">
                <Text className="text-sm text-gray-500">Subtotal ({itemCount})</Text>
                <Text className="text-sm font-semibold text-gray-900">{formatNaira(total)}</Text>
              </View>
              <View className="mt-2 flex-row justify-between border-t border-gray-100 pt-3">
                <Text className="text-base font-extrabold text-gray-900">Total</Text>
                <Text className="text-base font-extrabold text-gray-900">{formatNaira(total)}</Text>
              </View>
              <Pressable onPress={checkout} className="mt-4 items-center rounded-2xl bg-brand py-4">
                <Text className="text-base font-extrabold text-white">Checkout</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
