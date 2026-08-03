import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Auditoria } from '../database/entities/auditoria.entity';
import { Boleta } from '../database/entities/boleta.entity';
import { Carrito } from '../database/entities/carrito.entity';
import { CarritoItem } from '../database/entities/carrito-item.entity';
import { Envio } from '../database/entities/envio.entity';
import { Orden } from '../database/entities/orden.entity';
import { OrdenItem } from '../database/entities/orden-item.entity';
import { Producto } from '../database/entities/producto.entity';
import { ReservaStock } from '../database/entities/reserva-stock.entity';
import { Talla } from '../database/entities/talla.entity';
import {
  bloquearVariante,
  calcularStockDisponible,
} from '../common/inventario/stock.util';
import { ContextoCarrito } from '../carrito/carrito.service';
import { CuponesService } from '../cupones/cupones.service';
import { GiftcardsService } from '../giftcards/giftcards.service';
import { PromocionesService } from '../promociones/promociones.service';
import { CrearOrdenDto } from './dto/crear-orden.dto';

const MINUTOS_RESERVA = 15;
const MAX_INTENTOS_NUMERO_ORDEN = 5;

interface ItemOrdenCalculado {
  varianteId: number;
  nombreProducto: string;
  talla: string;
  color: string | null;
  sku: string;
  precioUnitario: number;
  cantidad: number;
}

@Injectable()
export class OrdenesService {
  constructor(
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    @InjectRepository(ReservaStock)
    private readonly reservas: Repository<ReservaStock>,
    @InjectRepository(OrdenItem)
    private readonly ordenItems: Repository<OrdenItem>,
    @InjectRepository(Envio) private readonly envios: Repository<Envio>,
    @InjectRepository(Boleta) private readonly boletas: Repository<Boleta>,
    @InjectRepository(Auditoria)
    private readonly auditoria: Repository<Auditoria>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cuponesService: CuponesService,
    private readonly giftcardsService: GiftcardsService,
    private readonly promocionesService: PromocionesService,
  ) {}

  /**
   * Checkout transaccional: valida stock con FOR UPDATE por cada variante (serializa
   * compras concurrentes de la misma variante), congela snapshots en orden_items,
   * crea reservas_stock (15 min) y marca el carrito como convertido. Todo o nada.
   */
  async crear(ctx: ContextoCarrito, dto: CrearOrdenDto): Promise<Orden> {
    return this.dataSource.transaction(async (manager) => {
      const carrito = await this.obtenerCarritoConItems(manager, ctx);
      if (carrito.items.length === 0) {
        throw new BadRequestException('El carrito está vacío');
      }

      const itemsOrden: ItemOrdenCalculado[] = [];
      let subtotal = 0;

      for (const item of carrito.items) {
        // SELECT ... FOR UPDATE: punto de serialización. Una segunda transacción
        // concurrente sobre la MISMA variante queda bloqueada hasta que esta termine.
        const variante = await bloquearVariante(manager, item.varianteId);
        if (!variante || !variante.activa) {
          throw new BadRequestException(
            `Variante ${item.varianteId} ya no está disponible`,
          );
        }

        const disponible = await calcularStockDisponible(
          manager,
          variante.id,
          variante.stock,
        );
        if (item.cantidad > disponible) {
          throw new BadRequestException(
            `Stock insuficiente para ${item.varianteId}: quedan ${Math.max(disponible, 0)} unidades`,
          );
        }

        const producto = await manager.findOne(Producto, {
          where: { id: variante.productoId },
        });
        const talla = await manager.findOne(Talla, {
          where: { id: variante.tallaId },
        });
        // Los insumos (tipoProducto=blanco) no tienen precio: nunca se venden.
        if (
          !producto ||
          !talla ||
          producto.tipoProducto !== 'estampado' ||
          producto.precio === null
        ) {
          throw new BadRequestException('Producto o talla no encontrados');
        }

        // Precio recalculado en backend al momento del checkout — nunca el precio congelado del carrito
        const precioUnitario =
          (producto.precioOferta ?? producto.precio) + variante.precioExtra;
        subtotal += precioUnitario * item.cantidad;

        itemsOrden.push({
          varianteId: variante.id,
          nombreProducto: producto.nombre,
          talla: talla.codigo,
          color: variante.color,
          sku: variante.sku,
          precioUnitario,
          cantidad: item.cantidad,
        });
      }

      // Costo de envío: la Fase 6 (courier) todavía no calcula tarifas reales por zona
      const costoEnvio = 0;
      const descuentoPromo =
        await this.promocionesService.calcularDescuentoTiendaCompleta(subtotal);

      const numeroOrden = await this.generarNumeroOrdenUnico(manager);
      const tokenConsulta = randomBytes(32).toString('hex');

      // Se crea con el descuento de promoción (no depende del id de la orden); cupón y
      // giftcard se aplican DESPUÉS porque sus tablas de auditoría referencian orden_id,
      // y la fila se actualiza al final con el descuento y total definitivos.
      const orden = await manager.save(
        manager.create(Orden, {
          numeroOrden,
          usuarioId: ctx.usuarioId ?? null,
          emailComprador: dto.emailComprador,
          nombreComprador: dto.nombreComprador,
          telefonoComprador: dto.telefonoComprador ?? null,
          rutComprador: dto.rutComprador ?? null,
          tokenConsulta,
          estado: 'pendiente_pago',
          subtotal,
          descuento: descuentoPromo,
          costoEnvio,
          total: subtotal - descuentoPromo + costoEnvio,
          direccionEnvioSnapshot: { ...dto.direccionEnvio },
          notasCliente: dto.notasCliente ?? null,
        }),
      );

      let descuentoCupon = 0;
      let montoGiftcard = 0;
      let cuponId: number | null = null;
      let giftcardId: number | null = null;

      if (dto.cuponCodigo) {
        if (!ctx.usuarioId) {
          throw new BadRequestException('Inicia sesión para usar un cupón');
        }
        const resultado = await this.cuponesService.validarYCanjear(
          manager,
          dto.cuponCodigo,
          ctx.usuarioId,
          orden.id,
          subtotal,
        );
        cuponId = resultado.cuponId;
        descuentoCupon = resultado.descuento;
      }

      const totalTrasPromoYCupon = Math.max(
        0,
        subtotal - descuentoPromo - descuentoCupon,
      );

      if (dto.giftcardCodigo) {
        const resultado = await this.giftcardsService.validarYCanjear(
          manager,
          dto.giftcardCodigo,
          totalTrasPromoYCupon + costoEnvio,
          orden.id,
        );
        giftcardId = resultado.giftcardId;
        montoGiftcard = resultado.montoAplicado;
      }

      const descuentoTotal = descuentoPromo + descuentoCupon + montoGiftcard;
      const total = Math.max(0, subtotal - descuentoTotal + costoEnvio);

      await manager.update(
        Orden,
        { id: orden.id },
        { descuento: descuentoTotal, total, cuponId, giftcardId },
      );

      const expiraEn = new Date(Date.now() + MINUTOS_RESERVA * 60 * 1000);
      for (const itemOrden of itemsOrden) {
        await manager.save(
          manager.create(OrdenItem, { ...itemOrden, ordenId: orden.id }),
        );
        await manager.save(
          manager.create(ReservaStock, {
            varianteId: itemOrden.varianteId,
            ordenId: orden.id,
            cantidad: itemOrden.cantidad,
            expiraEn,
          }),
        );
      }

      await manager.delete(CarritoItem, { carritoId: carrito.id });
      await manager.update(
        Carrito,
        { id: carrito.id },
        { estado: 'convertido' },
      );

      return orden;
    });
  }

  async obtenerPropia(ordenId: number, usuarioId: number) {
    const orden = await this.ordenes.findOne({ where: { id: ordenId } });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    // Anti-IDOR: solo el dueño puede ver su orden — ver CLAUDE.md
    if (orden.usuarioId !== usuarioId) {
      throw new ForbiddenException('No tienes acceso a esta orden');
    }
    return this.enriquecer(orden);
  }

  async listarPropias(usuarioId: number): Promise<Orden[]> {
    return this.ordenes.find({
      where: { usuarioId },
      order: { creadoEn: 'DESC' },
    });
  }

  async obtenerPorToken(numeroOrden: string, token: string) {
    const orden = await this.ordenes.findOne({ where: { numeroOrden } });
    if (!orden || !orden.tokenConsulta || orden.tokenConsulta !== token) {
      throw new NotFoundException('Orden no encontrada');
    }
    return this.enriquecer(orden);
  }

  /** Detalle de tracking post-venta: ítems comprados + estado de envío + boleta, si existen */
  private async enriquecer(orden: Orden) {
    const [items, envio, boleta] = await Promise.all([
      this.ordenItems.find({ where: { ordenId: orden.id } }),
      this.envios.findOne({ where: { ordenId: orden.id } }),
      this.boletas.findOne({ where: { ordenId: orden.id } }),
    ]);

    return {
      ...orden,
      items,
      envio: envio ?? null,
      boleta: boleta
        ? { folio: boleta.folio, estado: boleta.estado, pdfUrl: boleta.pdfUrl }
        : null,
    };
  }

  // --- Administración (Parte 5.1 del documento maestro) ---

  /** admin y bodeguero ven todas las órdenes; bodeguero no ve pagos (Parte 5.1) */
  async listarAdmin(estado?: string): Promise<Orden[]> {
    return this.ordenes.find({
      where: estado ? { estado: estado as Orden['estado'] } : {},
      order: { creadoEn: 'DESC' },
      take: 200,
    });
  }

  async obtenerAdmin(ordenId: number) {
    const orden = await this.ordenes.findOne({ where: { id: ordenId } });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    return this.enriquecer(orden);
  }

  /**
   * Cancelación manual solo para órdenes que todavía no se pagaron. Cancelar una orden
   * ya pagada requiere reversar el cobro en la pasarela (reembolso) — ese flujo no está
   * implementado (Transbank no expone hoy una integración de reembolso en este proyecto),
   * así que deliberadamente no se permite cancelar órdenes 'pagada' en adelante desde acá.
   */
  async cancelar(
    ordenId: number,
    motivo: string,
    actorId: number,
    ip?: string,
  ): Promise<Orden> {
    const orden = await this.ordenes.findOne({ where: { id: ordenId } });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    if (orden.estado !== 'pendiente_pago') {
      throw new BadRequestException(
        `Solo se pueden cancelar órdenes pendientes de pago (estado actual: "${orden.estado}")`,
      );
    }

    await this.ordenes.update({ id: ordenId }, { estado: 'cancelada' });
    await this.auditoria.save(
      this.auditoria.create({
        usuarioId: actorId,
        accion: 'cancelar_orden',
        entidad: 'orden',
        entidadId: ordenId,
        detalle: { motivo, numeroOrden: orden.numeroOrden },
        ip: ip ?? null,
      }),
    );

    return this.obtenerAdmin(ordenId);
  }

  /** Cron: libera reservas vencidas y expira órdenes que nunca se pagaron — ver CLAUDE.md */
  async liberarReservasExpiradas(): Promise<void> {
    const ahora = new Date();
    const reservasVencidas = await this.reservas
      .createQueryBuilder('r')
      .where('r.expiraEn < :ahora', { ahora })
      .getMany();
    if (reservasVencidas.length === 0) return;

    const idsOrdenesAfectadas = new Set(reservasVencidas.map((r) => r.ordenId));

    await this.reservas
      .createQueryBuilder()
      .delete()
      .where('expira_en < :ahora', { ahora })
      .execute();

    await this.ordenes
      .createQueryBuilder()
      .update(Orden)
      .set({ estado: 'expirada' })
      .where('id IN (:...ids)', { ids: [...idsOrdenesAfectadas] })
      .andWhere('estado = :estado', { estado: 'pendiente_pago' })
      .execute();
  }

  private async obtenerCarritoConItems(
    manager: EntityManager,
    ctx: ContextoCarrito,
  ): Promise<Carrito & { items: CarritoItem[] }> {
    const where = ctx.usuarioId
      ? { usuarioId: ctx.usuarioId, estado: 'activo' as const }
      : { sessionId: ctx.sessionId, estado: 'activo' as const };

    if (!ctx.usuarioId && !ctx.sessionId) {
      throw new BadRequestException('No hay carrito activo');
    }

    const carrito = await manager.findOne(Carrito, { where });
    if (!carrito) throw new BadRequestException('No hay carrito activo');

    const items = await manager.find(CarritoItem, {
      where: { carritoId: carrito.id },
    });
    return { ...carrito, items };
  }

  private async generarNumeroOrdenUnico(
    manager: EntityManager,
  ): Promise<string> {
    const anio = new Date().getFullYear();
    for (let intento = 0; intento < MAX_INTENTOS_NUMERO_ORDEN; intento++) {
      const numeroOrden = `ORD-${anio}-${randomBytes(5).toString('hex').toUpperCase()}`;
      const existente = await manager.findOne(Orden, {
        where: { numeroOrden },
      });
      if (!existente) return numeroOrden;
    }
    throw new BadRequestException(
      'No se pudo generar un número de orden único',
    );
  }
}
