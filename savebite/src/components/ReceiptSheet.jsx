import { Share, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Btn, Row, Sheet } from "./fin";
import { formatNaira } from "../lib/mockData";
import { longDate, timeOf, txMeta, normalizeTx } from "../lib/txView";

// Bottom sheet receipt for one wallet transaction
export default function ReceiptSheet({ tx: rawTx, onClose }) {
  // Always work with a normalized object (or null when the sheet is closed)
  const tx = normalizeTx(rawTx);
  const meta = txMeta(tx); // never throws, returns defaults for null
  const d = tx?.details || {};
  const status = tx?.status || "success";

  const rows = tx
    ? [
        ["Status", status === "success" ? "Successful" : status === "pending" ? "Pending" : "Failed"],
        ["Date", `${longDate(tx.timestamp)} · ${timeOf(tx.timestamp)}`],
        d.number && ["Number", String(d.number)],
        d.account_number && ["Account", String(d.account_number)],
        d.plan && ["Plan", String(d.plan)],
        d.penalty ? ["Early withdrawal fee", formatNaira(d.penalty)] : null,
        d.interest ? ["Interest", formatNaira(d.interest)] : null,
        d.narration && ["Note", String(d.narration)],
        tx.reference && ["Reference", String(tx.reference)],
      ].filter(Boolean)
    : [];

  const share = () => {
    if (!tx) return;
    Share.share({
      message: `SaveBite receipt\n${meta.title}\n${meta.credit ? "+" : "-"}${formatNaira(tx.amount)}\n${rows
        .map((r) => `${r[0]}: ${r[1]}`)
        .join("\n")}`,
    });
  };

  return (
    <Sheet visible={!!tx} onClose={onClose}>
      {tx ? (
        <>
          <View className="items-center pb-3">
            <View style={{ backgroundColor: meta.tint }} className="h-14 w-14 items-center justify-center rounded-full">
              <Ionicons name={meta.icon} size={26} color={meta.color} />
            </View>
            <Text className="mt-3 text-base font-semibold text-gray-700">{meta.title}</Text>
            <Text className={`mt-1 text-3xl font-extrabold ${status === "failed" ? "text-gray-400 line-through" : "text-gray-900"}`}>
              {meta.credit ? "+" : "-"}{formatNaira(tx.amount)}
            </Text>
          </View>
          <View className="rounded-2xl bg-cream px-4 py-2">
            {rows.map((r) => <Row key={r[0]} label={r[0]} value={r[1]} />)}
          </View>
          <View className="mt-4"><Btn label="Share receipt" icon="share-outline" variant="ghost" onPress={share} /></View>
        </>
      ) : null}
    </Sheet>
  );
}