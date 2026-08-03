import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Auditoria } from '../database/entities/auditoria.entity';
import { Carrito } from '../database/entities/carrito.entity';
import {
  Consentimiento,
  FinalidadConsentimiento,
} from '../database/entities/consentimiento.entity';
import { Direccion } from '../database/entities/direccion.entity';
import { Orden } from '../database/entities/orden.entity';
import { Pagina } from '../database/entities/pagina.entity';
import { Resena } from '../database/entities/resena.entity';
import { Rol } from '../database/entities/rol.entity';
import { Ticket } from '../database/entities/ticket.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { ActualizarDireccionDto, CrearDireccionDto } from './dto/direccion.dto';
import { ActualizarPerfilDto } from './dto/perfil.dto';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Direccion)
    private readonly direcciones: Repository<Direccion>,
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    @InjectRepository(Consentimiento)
    private readonly consentimientos: Repository<Consentimiento>,
    @InjectRepository(Resena) private readonly resenas: Repository<Resena>,
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(Rol) private readonly roles: Repository<Rol>,
    @InjectRepository(Auditoria)
    private readonly auditoria: Repository<Auditoria>,
    @InjectRepository(Pagina) private readonly paginas: Repository<Pagina>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Slug de página <-> finalidad de consentimiento que ese documento cubre */
  private static readonly PAGINAS_CON_CONSENTIMIENTO: Record<
    string,
    FinalidadConsentimiento
  > = {
    'terminos-condiciones': 'terminos_condiciones',
    'politica-privacidad': 'politica_privacidad',
  };

  async obtenerPerfil(usuarioId: number) {
    const usuario = await this.usuarios.findOne({
      where: { id: usuarioId },
      relations: { rol: true },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return this.sinCamposSensibles(usuario);
  }

  async actualizarPerfil(usuarioId: number, dto: ActualizarPerfilDto) {
    await this.usuarios.update({ id: usuarioId }, dto);
    return this.obtenerPerfil(usuarioId);
  }

  async actualizarAvatar(usuarioId: number, url: string) {
    await this.usuarios.update({ id: usuarioId }, { avatarUrl: url });
    return this.obtenerPerfil(usuarioId);
  }

  async listarDirecciones(usuarioId: number): Promise<Direccion[]> {
    return this.direcciones.find({
      where: { usuarioId },
      order: { id: 'DESC' },
    });
  }

  async crearDireccion(
    usuarioId: number,
    dto: CrearDireccionDto,
  ): Promise<Direccion> {
    if (dto.esPrincipal) {
      await this.direcciones.update({ usuarioId }, { esPrincipal: false });
    }
    return this.direcciones.save(
      this.direcciones.create({
        ...dto,
        usuarioId,
        esPrincipal: !!dto.esPrincipal,
      }),
    );
  }

  async actualizarDireccion(
    usuarioId: number,
    direccionId: number,
    dto: ActualizarDireccionDto,
  ): Promise<Direccion> {
    const direccion = await this.obtenerDireccionPropia(usuarioId, direccionId);
    if (dto.esPrincipal) {
      await this.direcciones.update({ usuarioId }, { esPrincipal: false });
    }
    Object.assign(direccion, dto);
    return this.direcciones.save(direccion);
  }

  async eliminarDireccion(
    usuarioId: number,
    direccionId: number,
  ): Promise<void> {
    await this.obtenerDireccionPropia(usuarioId, direccionId);
    await this.direcciones.delete({ id: direccionId });
  }

  /** Portabilidad (Ley 21.719): exporta todo lo que identifica al titular en JSON legible */
  async exportarDatos(usuarioId: number) {
    const [perfil, direcciones, ordenes, consentimientos, resenas, tickets] =
      await Promise.all([
        this.obtenerPerfil(usuarioId),
        this.listarDirecciones(usuarioId),
        this.ordenes.find({
          where: { usuarioId },
          order: { creadoEn: 'DESC' },
        }),
        this.consentimientos.find({
          where: { usuarioId },
          order: { creadoEn: 'DESC' },
        }),
        this.resenas.find({ where: { usuarioId } }),
        this.tickets.find({ where: { usuarioId } }),
      ]);

    return { perfil, direcciones, ordenes, consentimientos, resenas, tickets };
  }

  private async obtenerDireccionPropia(
    usuarioId: number,
    direccionId: number,
  ): Promise<Direccion> {
    const direccion = await this.direcciones.findOne({
      where: { id: direccionId },
    });
    if (!direccion) throw new NotFoundException('Dirección no encontrada');
    // Anti-IDOR: solo el dueño puede leer/editar su dirección — ver CLAUDE.md
    if (direccion.usuarioId !== usuarioId) {
      throw new ForbiddenException('No tienes acceso a esta dirección');
    }
    return direccion;
  }

  private sinCamposSensibles(
    usuario: Usuario,
  ): Omit<Usuario, 'passwordHash' | 'refreshTokenHash' | 'totpSecret'> {
    const copia: Partial<Usuario> = { ...usuario };
    delete copia.passwordHash;
    delete copia.refreshTokenHash;
    delete copia.totpSecret;
    return copia as Omit<Usuario, 'passwordHash' | 'refreshTokenHash' | 'totpSecret'>;
  }

  /**
   * Ejecuta el procedimiento de supresión documentado en RunarStore.sql: anonimiza
   * usuarios y los snapshots de ordenes cerradas, borra direcciones y carritos. Las
   * órdenes/boletas NUNCA se borran (obligación tributaria ~6 años); la persona
   * simplemente deja de ser identificable en ellas.
   */
  async anonimizarUsuario(usuarioId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const usuario = await manager.findOne(Usuario, {
        where: { id: usuarioId },
      });
      if (!usuario) throw new NotFoundException('Usuario no encontrado');

      const anon = `anon-${usuarioId}@suprimido.local`;

      await manager.update(
        Usuario,
        { id: usuarioId },
        {
          email: anon,
          nombre: 'Suprimido',
          apellido: 'Suprimido',
          rut: null,
          telefono: null,
          avatarUrl: null,
          passwordHash: 'SUPRIMIDO',
          refreshTokenHash: null,
          totpSecret: null,
          totpHabilitado: false,
          activo: false,
          eliminadoEn: new Date(),
        },
      );

      await manager
        .createQueryBuilder()
        .update(Orden)
        .set({
          emailComprador: anon,
          nombreComprador: 'Suprimido',
          telefonoComprador: null,
          rutComprador: null,
          direccionEnvioSnapshot: { suprimido: true },
        })
        .where('usuario_id = :usuarioId', { usuarioId })
        .andWhere('estado IN (:...estados)', {
          estados: ['entregada', 'cancelada', 'reembolsada', 'expirada'],
        })
        .execute();

      await manager.delete(Direccion, { usuarioId });
      await manager.delete(Carrito, { usuarioId });
    });
  }

  // --- Administración (Parte 5.1 del documento maestro) ---

  async listarAdmin(): Promise<
    Omit<Usuario, 'passwordHash' | 'refreshTokenHash' | 'totpSecret'>[]
  > {
    const usuarios = await this.usuarios.find({
      relations: { rol: true },
      order: { creadoEn: 'DESC' },
    });
    return usuarios.map((u) => this.sinCamposSensibles(u));
  }

  async cambiarRol(
    usuarioId: number,
    nombreRol: string,
    actorId: number,
    ip?: string,
  ): Promise<Omit<Usuario, 'passwordHash' | 'refreshTokenHash' | 'totpSecret'>> {
    const rol = await this.roles.findOne({ where: { nombre: nombreRol } });
    if (!rol) throw new BadRequestException(`Rol "${nombreRol}" no existe`);

    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const rolAnterior = usuario.rolId;
    await this.usuarios.update({ id: usuarioId }, { rolId: rol.id });

    await this.auditoria.save(
      this.auditoria.create({
        usuarioId: actorId,
        accion: 'cambio_rol',
        entidad: 'usuario',
        entidadId: usuarioId,
        detalle: { rolAnterior, rolNuevo: rol.id, rolNombre: rol.nombre },
        ip: ip ?? null,
      }),
    );

    return this.obtenerPerfil(usuarioId);
  }

  async toggleActivo(
    usuarioId: number,
    actorId: number,
    ip?: string,
  ): Promise<Omit<Usuario, 'passwordHash' | 'refreshTokenHash' | 'totpSecret'>> {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const nuevoEstado = !usuario.activo;
    // Desactivar revoca cualquier sesión activa
    await this.usuarios.update(
      { id: usuarioId },
      {
        activo: nuevoEstado,
        refreshTokenHash: nuevoEstado ? usuario.refreshTokenHash : null,
      },
    );

    await this.auditoria.save(
      this.auditoria.create({
        usuarioId: actorId,
        accion: nuevoEstado ? 'activar_usuario' : 'desactivar_usuario',
        entidad: 'usuario',
        entidadId: usuarioId,
        detalle: { activo: nuevoEstado },
        ip: ip ?? null,
      }),
    );

    return this.obtenerPerfil(usuarioId);
  }

  /**
   * Compara la versión vigente de cada política (términos/privacidad) contra el
   * último consentimiento otorgado por el usuario para esa finalidad. Si subió
   * una versión nueva desde entonces, hay que volver a pedirle que acepte — ver
   * documento maestro Parte 4.1 y CLAUDE.md.
   */
  async consentimientosPendientes(usuarioId: number) {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const slugs = Object.keys(UsuariosService.PAGINAS_CON_CONSENTIMIENTO);
    const paginas = await this.paginas.find({
      where: slugs.map((slug) => ({ slug, publicada: true })),
    });

    const pendientes: {
      finalidad: FinalidadConsentimiento;
      slug: string;
      version: number;
    }[] = [];

    for (const pagina of paginas) {
      const finalidad = UsuariosService.PAGINAS_CON_CONSENTIMIENTO[pagina.slug];
      const ultimoOtorgado = await this.consentimientos.findOne({
        where: { email: usuario.email, finalidad, otorgado: true },
        order: { creadoEn: 'DESC' },
      });
      if (!ultimoOtorgado || ultimoOtorgado.version < pagina.version) {
        pendientes.push({
          finalidad,
          slug: pagina.slug,
          version: pagina.version,
        });
      }
    }

    return pendientes;
  }

  async aceptarConsentimiento(
    usuarioId: number,
    slug: string,
    ctx: { ip?: string; userAgent?: string },
  ): Promise<{ mensaje: string }> {
    const finalidad = UsuariosService.PAGINAS_CON_CONSENTIMIENTO[slug];
    if (!finalidad)
      throw new BadRequestException('Esa página no exige consentimiento');

    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const pagina = await this.paginas.findOne({
      where: { slug, publicada: true },
    });
    if (!pagina) throw new NotFoundException('Página no encontrada');

    await this.consentimientos.save(
      this.consentimientos.create({
        usuarioId,
        email: usuario.email,
        finalidad,
        paginaId: pagina.id,
        version: pagina.version,
        otorgado: true,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      }),
    );

    return { mensaje: 'Consentimiento registrado' };
  }
}
