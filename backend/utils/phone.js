// 0803 123 4567 | 2348031234567 | +234 803 123 4567  ->  +2348031234567
export const normalizePhone = (value) => {
  if (!value) return value;
  const d = String(value).replace(/[\s-]/g, "");
  if (d.startsWith("+234")) return d;
  if (d.startsWith("234")) return `+${d}`;
  if (d.startsWith("0")) return `+234${d.slice(1)}`;
  return d;
};

export const isNigerianPhone = (value) =>
  /^\+234[789][01]\d{8}$/.test(normalizePhone(value) || "");
