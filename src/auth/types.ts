/** Payload del access token: solo lo mínimo, es público (Base64, no cifrado) — ver CLAUDE.md */
export interface JwtPayload {
  sub: number;
  rol: string;
}

/** Payload del refresh token: incluye jti para poder detectar reuso tras rotación */
export interface JwtRefreshPayload extends JwtPayload {
  jti: string;
}

export interface RequestConUsuario extends Request {
  user: JwtPayload;
}
