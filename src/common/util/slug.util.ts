/** "Polera Naruto Rojo #2026!" -> "polera-naruto-rojo-2026" - sin tildes, minusculas, solo [a-z0-9-] */
export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}
