/** Payload del access token: solo lo mínimo, es público (Base64, no cifrado) — ver CLAUDE.md */
export interface JwtPayload {
  sub: number;
  rol: string;
}

/** Payload del refresh token: incluye jti para poder detectar reuso tras rotación */
export interface JwtRefreshPayload extends JwtPayload {
  jti: string;
}

/**
 * Token de vida corta (5 min) emitido cuando la contraseña es válida pero el usuario tiene
 * 2FA activado: todavía NO es una sesión — solo habilita el segundo paso (POST /auth/2fa/verificar-login).
 */
export interface JwtDosFaPendientePayload {
  sub: number;
  tipo: '2fa_pendiente';
}

export interface RequestConUsuario extends Request {
  user: JwtPayload;
}
