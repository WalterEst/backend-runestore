/** neto = ROUND(total / 1.19); iva = total − neto — ver CLAUDE.md */
export function calcularNetoIva(total: number): { neto: number; iva: number } {
  const neto = Math.round(total / 1.19);
  return { neto, iva: total - neto };
}
