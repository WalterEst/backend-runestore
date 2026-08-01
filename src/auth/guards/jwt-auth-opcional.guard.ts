import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { JwtPayload } from '../types';

/**
 * Igual que JwtAuthGuard pero nunca rechaza la request: si hay un access token
 * válido adjunta req.user, si no lo hay (o es inválido) sigue como invitado.
 * Para endpoints que sirven tanto a usuarios logueados como a invitados
 * (ej: carrito, checkout).
 */
@Injectable()
export class JwtAuthOpcionalGuard extends AuthGuard('jwt') {
  handleRequest<T = JwtPayload>(_err: unknown, user: T | false): T | undefined {
    return user ? user : undefined;
  }
}
