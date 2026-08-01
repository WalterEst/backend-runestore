import { slugify } from './slug.util';

describe('slugify', () => {
  it('convierte a minúsculas y reemplaza espacios por guiones', () => {
    expect(slugify('Polera Oversize Katana Roja')).toBe(
      'polera-oversize-katana-roja',
    );
  });

  it('quita tildes y eñes', () => {
    expect(slugify('Único Ñandú #2026')).toBe('unico-nandu-2026');
  });

  it('colapsa símbolos y espacios repetidos en un solo guion', () => {
    expect(slugify('  Cyber Oni L/S Tee — Edición!! ')).toBe(
      'cyber-oni-l-s-tee-edicion',
    );
  });

  it('no deja guiones al inicio ni al final', () => {
    expect(slugify('-- Bomber Jacket --')).toBe('bomber-jacket');
  });
});
