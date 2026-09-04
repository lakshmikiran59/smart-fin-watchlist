/** Formats a number as an Indian Rupee amount, e.g. 214.9 -> "₹214.90". */
export function formatINR(value: number): string {
  if (Number.isNaN(value)) return '₹0.00';
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
