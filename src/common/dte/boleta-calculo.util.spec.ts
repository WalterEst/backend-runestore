import { calcularNetoIva } from './boleta-calculo.util';

describe('calcularNetoIva', () => {
  it('neto = ROUND(total / 1.19); iva = total - neto', () => {
    expect(calcularNetoIva(19990)).toEqual({ neto: 16798, iva: 3192 });
    expect(calcularNetoIva(1190)).toEqual({ neto: 1000, iva: 190 });
  });

  it('neto + iva siempre reconstruye el total exacto (sin perder $1 por redondeo)', () => {
    for (const total of [1000, 4999, 19990, 35000, 123456]) {
      const { neto, iva } = calcularNetoIva(total);
      expect(neto + iva).toBe(total);
    }
  });
});
