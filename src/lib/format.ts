export function money(value: number) {
  return `$${value.toFixed(value >= 1 ? 2 : 5)}`;
}
