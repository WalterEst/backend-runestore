import { ValueTransformer } from 'typeorm';

/**
 * Los montos son DECIMAL(10,0) en MySQL (CLP no usa decimales).
 * mysql2 devuelve DECIMAL como string por defecto; esto lo mapea a
 * number entero en TypeScript, nunca a float (regla del CLAUDE.md).
 */
export const moneyTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? value : parseInt(value, 10),
};
