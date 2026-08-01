import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../../database/entities/usuario.entity';
import type { JwtPayload } from '../../auth/types';

/** Solo usuarios con total_compras >= 1 pueden crear tickets — invitados y clientes sin compras, no (ver CLAUDE.md) */
@Injectable()
export class CompraVerificadaGuard implements CanActivate {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const usuarioId = request.user?.sub;
    if (!usuarioId) return false;

    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario || usuario.totalCompras < 1) {
      throw new ForbiddenException(
        'Necesitas al menos una compra para crear un ticket',
      );
    }
    return true;
  }
}
