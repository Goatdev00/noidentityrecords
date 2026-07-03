/** 80000 → "80.000 COP" (COP has no decimals; es-CO uses dot thousands). */
export function formatCOP(amount: number): string {
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(amount)} COP`
}
