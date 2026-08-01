import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria } from '../database/entities/auditoria.entity';
import { SolicitudDerecho } from '../database/entities/solicitud-derecho.entity';
import { Usuario } from '../database/entities/usuario.entity';
import {
  CrearSolicitudDerechoDto,
  ResolverSolicitudDto,
} from './dto/solicitud-derecho.dto';
import { UsuariosService } from './usuarios.service';

export interface ContextoSolicitud {
  usuarioId?: number;
  email?: string;
  ip?: string;
}

@Injectable()
export class SolicitudesDerechoService {
  constructor(
    @InjectRepository(SolicitudDerecho)
    private readonly solicitudes: Repository<SolicitudDerecho>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Auditoria)
    private readonly auditoria: Repository<Auditoria>,
    private readonly usuariosService: UsuariosService,
  ) {}

  async crear(
    ctx: ContextoSolicitud,
    dto: CrearSolicitudDerechoDto,
  ): Promise<SolicitudDerecho> {
    let email = dto.email;
    if (ctx.usuarioId) {
      const usuario = await this.usuarios.findOne({
        where: { id: ctx.usuarioId },
      });
      if (!usuario) throw new NotFoundException('Usuario no encontrado');
      email = usuario.email;
    }
    if (!email) {
      throw new BadRequestException(
        'Se requiere el email del titular (invitado sin sesión)',
      );
    }

    return this.solicitudes.save(
      this.solicitudes.create({
        usuarioId: ctx.usuarioId ?? null,
        email,
        tipo: dto.tipo,
        detalle: dto.detalle ?? null,
        estado: 'recibida',
      }),
    );
  }

  async listarPropias(usuarioId: number): Promise<SolicitudDerecho[]> {
    return this.solicitudes.find({
      where: { usuarioId },
      order: { recibidaEn: 'DESC' },
    });
  }

  /** Panel admin: pendientes primero, ordenadas por antigüedad (corre el plazo legal desde recibida_en) */
  async listarAdmin(): Promise<SolicitudDerecho[]> {
    return this.solicitudes.find({
      order: { estado: 'ASC', recibidaEn: 'ASC' },
    });
  }

  async resolver(
    id: number,
    dto: ResolverSolicitudDto,
    actorId: number,
    ip?: string,
  ): Promise<SolicitudDerecho> {
    const solicitud = await this.solicitudes.findOne({ where: { id } });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');

    if (dto.estado === 'rechazada' && !dto.motivoRechazo) {
      throw new BadRequestException(
        'Todo rechazo debe fundarse en un motivo (Ley 21.719)',
      );
    }

    // Supresión aprobada = ejecutar la anonimización real, no solo marcar el estado
    if (dto.estado === 'completada' && solicitud.tipo === 'supresion') {
      if (!solicitud.usuarioId) {
        throw new BadRequestException(
          'No se puede anonimizar automáticamente una solicitud sin cuenta asociada',
        );
      }
      await this.usuariosService.anonimizarUsuario(solicitud.usuarioId);
    }

    solicitud.estado = dto.estado;
    solicitud.respuesta = dto.respuesta ?? null;
    solicitud.motivoRechazo =
      dto.estado === 'rechazada' ? (dto.motivoRechazo ?? null) : null;
    solicitud.resueltaEn = new Date();
    const guardada = await this.solicitudes.save(solicitud);

    await this.auditoria.save(
      this.auditoria.create({
        usuarioId: actorId,
        accion:
          solicitud.tipo === 'supresion' && dto.estado === 'completada'
            ? 'supresion_datos'
            : 'resolucion_solicitud_derecho',
        entidad: 'solicitud_derecho',
        entidadId: solicitud.id,
        detalle: { tipo: solicitud.tipo, estado: dto.estado },
        ip: ip ?? null,
      }),
    );

    return guardada;
  }
}
