/** Converts an integer paise amount into a formatted rupee string.
 * Omits trailing .00 on exact rupee values for clean dashboard display,
 * while preserving decimals if cents exist (e.g. 25000 -> "₹250", 25050 -> "₹250.50").
 */
export function formatPaise(
  paise: number,
  currency: string = "INR",
  options?: { alwaysShowDecimals?: boolean }
): string {
  const rupees = paise / 100;
  const hasDecimals = paise % 100 !== 0;
  const fractionDigits = (options?.alwaysShowDecimals || hasDecimals) ? 2 : 0;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/** Converts a rupee input (e.g. from a text field, "250" or "250.50") into integer paise. */
export function rupeesToPaise(value: string | number): number {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}
