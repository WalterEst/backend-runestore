import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * El secreto TOTP es un credential compartido (no un hash): a diferencia de una password,
 * hay que poder recuperarlo en claro para verificar el código en cada login, así que un
 * hash no sirve — se cifra con AES-256-GCM en vez de guardarlo en texto plano en la BD.
 * TOTP_ENCRYPTION_KEY: 64 caracteres hex (32 bytes) — generar con `openssl rand -hex 32`.
 */
const ALGORITMO = 'aes-256-gcm';

function obtenerClave(): Buffer {
  const clave = process.env.TOTP_ENCRYPTION_KEY;
  if (!clave || clave.length !== 64) {
    throw new Error(
      'TOTP_ENCRYPTION_KEY no está configurada (debe ser hex de 64 caracteres / 32 bytes)',
    );
  }
  return Buffer.from(clave, 'hex');
}

/** Formato guardado: iv:authTag:ciphertext, todo en hex, separado por ":" */
export function cifrarTotpSecret(secretoPlano: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITMO, obtenerClave(), iv);
  const cifrado = Buffer.concat([
    cipher.update(secretoPlano, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${cifrado.toString('hex')}`;
}

export function descifrarTotpSecret(valorCifrado: string): string {
  const [ivHex, authTagHex, cifradoHex] = valorCifrado.split(':');
  if (!ivHex || !authTagHex || !cifradoHex) {
    throw new Error('Formato de secreto TOTP cifrado inválido');
  }
  const decipher = createDecipheriv(
    ALGORITMO,
    obtenerClave(),
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const descifrado = Buffer.concat([
    decipher.update(Buffer.from(cifradoHex, 'hex')),
    decipher.final(),
  ]);
  return descifrado.toString('utf8');
}
