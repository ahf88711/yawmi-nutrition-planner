export function displayNumber(v, key) {
  return (
    Math.abs(v) < (key === "calories" ? 0.5 : 0.05) ? 0 : v
  ).toLocaleString("en-US", {
    maximumFractionDigits: key === "calories" ? 0 : 1,
    useGrouping: false,
  });
}
export function displayDifference(v, key) {
  const limit = key === "calories" ? 0.5 : 0.05;
  return Math.abs(v) > 0 && Math.abs(v) < limit
    ? `${v < 0 ? "−" : "+"}<${key === "calories" ? "0.5" : "0.1"}`
    : `${v > 0 ? "+" : ""}${displayNumber(v, key)}`;
}
