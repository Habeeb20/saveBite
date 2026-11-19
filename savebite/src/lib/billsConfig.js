
export const SERVICES = [
  { id: "airtime", label: "Airtime", icon: "call-outline", color: "#F97316", tint: "#FFEDD5" },
  { id: "data", label: "Data", icon: "wifi-outline", color: "#2563EB", tint: "#DBEAFE" },
  { id: "electricity", label: "Electricity", icon: "flash-outline", color: "#CA8A04", tint: "#FEF9C3" },
  { id: "tv", label: "TV", icon: "tv-outline", color: "#7C3AED", tint: "#EDE9FE" },
];
export const serviceMeta = (id) => SERVICES.find((s) => s.id === id);

export const NETWORKS = [
  { id: "mtn", name: "MTN", bg: "#FACC15", fg: "#1F2937" },
  { id: "airtel", name: "Airtel", bg: "#EF4444", fg: "#FFFFFF" },
  { id: "glo", name: "Glo", bg: "#22C55E", fg: "#FFFFFF" },
  { id: "9mobile", name: "9mobile", bg: "#15803D", fg: "#FFFFFF" },
];

export const DISCOS = [
  { id: "ikeja-electric", name: "Ikeja Electric" },
  { id: "eko-electric", name: "Eko Electric" },
  { id: "abuja-electric", name: "Abuja Electric" },
  { id: "ibadan-electric", name: "Ibadan Electric" },
  { id: "enugu-electric", name: "Enugu Electric" },
  { id: "port-harcourt-electric", name: "Port Harcourt Electric" },
  { id: "kano-electric", name: "Kano Electric" },
  { id: "kaduna-electric", name: "Kaduna Electric" },
  { id: "jos-electric", name: "Jos Electric" },
  { id: "benin-electric", name: "Benin Electric" },
  { id: "yola-electric", name: "Yola Electric" },
  { id: "aba-power", name: "Aba Power" },
];

export const TV_PROVIDERS = [
  { id: "dstv", name: "DStv", bg: "#2563EB", fg: "#FFFFFF" },
  { id: "gotv", name: "GOtv", bg: "#16A34A", fg: "#FFFFFF" },
  { id: "startimes", name: "StarTimes", bg: "#F97316", fg: "#FFFFFF" },
  { id: "showmax", name: "Showmax", bg: "#DC2626", fg: "#FFFFFF" },
];

export const AIRTIME_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];
export const POWER_AMOUNTS = [1000, 2000, 5000, 10000]

