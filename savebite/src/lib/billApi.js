
import { api } from "./api";

// One reference per purchase attempt. If the network drops and the app retries with the
// SAME reference, the server returns the first result instead of charging twice.
export const newReference = () =>
  `sb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const getInfo = () => api("/bills/info", { auth: true });
export const getDataPlans = (network) =>
  api(`/bills/data-plans?network=${encodeURIComponent(network)}`, { auth: true });
export const getTvPackages = (provider) =>
  api(`/bills/tv-packages?provider=${encodeURIComponent(provider)}`, { auth: true });
export const validateCustomer = (body) => api("/bills/validate", { method: "POST", auth: true, body });
export const purchase = (body) => api("/bills/purchase", { method: "POST", auth: true, body });
EOF

cat > src/components/Sheet.jsx << 'EOF'
import { Modal, Pressable, Text, View } from "react-native";

// Bottom sheet: tap outside to close.
export default function Sheet({ visible, onClose, title, children }) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable className="max-h-[85%] rounded-t-3xl bg-white px-6 pb-8 pt-3" onPress={() => {}}>
          <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-gray-200" />
          {title ? <Text className="mb-3 text-xl font-extrabold text-gray-900">{title}</Text> : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
