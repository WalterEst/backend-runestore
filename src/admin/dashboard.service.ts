import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { Boleta } from '../database/entities/boleta.entity';
import { Orden } from '../database/entities/orden.entity';
import { OrdenItem } from '../database/entities/orden-item.entity';
import { Pago } from '../database/entities/pago.entity';
import { ProductoVariante } from '../database/entities/producto-variante.entity';
import { SolicitudDerecho } from '../database/entities/solicitud-derecho.entity';
import { Ticket } from '../database/entities/ticket.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { WebhookLog } from '../database/entities/webhook-log.entity';
import { RangoFechasDto } from './dto/rango-fechas.dto';

/** Órdenes que representan una venta efectivamente concretada (no canceladas/expiradas/pendientes de pago) */
const ESTADOS_VENTA_CONCRETADA = [
  'pagada',
  'en_preparacion',
  'enviada',
  'entregada',
] as const;

/**
 * Plazo de respuesta usado para el semáforo de solicitudes de derecho. La ley 21.719 y su
 * reglamento no fijan aquí un número de días exacto para todo tipo de solicitud — este valor
 * es un supuesto operativo razonable (similar al estándar RGPD) y debe confirmarlo el equipo
 * legal antes de producción; ver checklist Parte 4 (documento_maestro_sistema.md 5.5).
 */
const PLAZO_SOLICITUD_DIAS = 10;

export type SemaforoPlazo = 'verde' | 'amarillo' | 'rojo';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    @InjectRepository(OrdenItem)
    private readonly ordenItems: Repository<OrdenItem>,
    @InjectRepository(Pago) private readonly pagos: Repository<Pago>,
    @InjectRepository(Boleta) private readonly boletas: Repository<Boleta>,
    @InjectRepository(ProductoVariante)
    private readonly variantes: Repository<ProductoVariante>,
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(SolicitudDerecho)
    private readonly solicitudes: Repository<SolicitudDerecho>,
    @InjectRepository(WebhookLog)
    private readonly webhooks: Repository<WebhookLog>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  private rango(dto?: RangoFechasDto) {
    const hasta = dto?.hasta ? new Date(dto.hasta) : new Date();
    const desde = dto?.desde
      ? new Date(dto.desde)
      : new Date(hasta.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { desde, hasta };
  }

  async ventasPorPeriodo(
    dto?: RangoFechasDto,
  ): Promise<{ fecha: string; totalVentas: number; ordenes: number }[]> {
    const { desde, hasta } = this.rango(dto);
    const filas = await this.ordenes
      .createQueryBuilder('orden')
      .select('DATE(orden.creado_en)', 'fecha')
      .addSelect('SUM(orden.total)', 'totalVentas')
      .addSelect('COUNT(*)', 'ordenes')
      .where('orden.estado IN (:...estados)', {
        estados: ESTADOS_VENTA_CONCRETADA,
      })
      .andWhere('orden.creado_en BETWEEN :desde AND :hasta', { desde, hasta })
      .groupBy('DATE(orden.creado_en)')
      .orderBy('fecha', 'ASC')
      .getRawMany<{ fecha: string; totalVentas: string; ordenes: string }>();

    return filas.map((f) => ({
      fecha: f.fecha,
      totalVentas: Number(f.totalVentas),
      ordenes: Number(f.ordenes),
    }));
  }

  async topProductos(dto?: RangoFechasDto & { limite?: number }): Promise<
    {
      sku: string;
      nombreProducto: string;
      unidades: number;
      totalVendido: number;
    }[]
  > {
    const { desde, hasta } = this.rango(dto);
    const limite = dto?.limite && dto.limite > 0 ? dto.limite : 10;

    const filas = await this.ordenItems
      .createQueryBuilder('item')
      .innerJoin('item.orden', 'orden')
      .select('item.sku', 'sku')
      .addSelect('item.nombre_producto', 'nombreProducto')
      .addSelect('SUM(item.cantidad)', 'unidades')
      .addSelect('SUM(item.cantidad * item.precio_unitario)', 'totalVendido')
      .where('orden.estado IN (:...estados)', {
        estados: ESTADOS_VENTA_CONCRETADA,
      })
      .andWhere('orden.creado_en BETWEEN :desde AND :hasta', { desde, hasta })
      .groupBy('item.sku')
      .addGroupBy('item.nombre_producto')
      .orderBy('unidades', 'DESC')
      .limit(limite)
      .getRawMany<{
        sku: string;
        nombreProducto: string;
        unidades: string;
        totalVendido: string;
      }>();

    return filas.map((f) => ({
      sku: f.sku,
      nombreProducto: f.nombreProducto,
      unidades: Number(f.unidades),
      totalVendido: Number(f.totalVendido),
    }));
  }

  /** Variantes activas cuyo stock físico cayó al mínimo o por debajo — Parte 5.2 */
  async stockBajoMinimo(): Promise<
    {
      varianteId: number;
      sku: string;
      producto: string;
      stock: number;
      stockMinimo: number;
    }[]
  > {
    const variantes = await this.variantes
      .createQueryBuilder('variante')
      .innerJoin('variante.producto', 'producto')
      .select('variante.id', 'varianteId')
      .addSelect('variante.sku', 'sku')
      .addSelect('producto.nombre', 'producto')
      .addSelect('variante.stock', 'stock')
      .addSelect('variante.stock_minimo', 'stockMinimo')
      .where('variante.activa = true')
      .andWhere('variante.stock <= variante.stock_minimo')
      .orderBy('variante.stock', 'ASC')
      .getRawMany<{
        varianteId: number;
        sku: string;
        producto: string;
        stock: number;
        stockMinimo: number;
      }>();
    return variantes;
  }

  async ticketsAbiertos(): Promise<{
    total: number;
    porEstado: Record<string, number>;
  }> {
    const filas = await this.tickets
      .createQueryBuilder('ticket')
      .select('ticket.estado', 'estado')
      .addSelect('COUNT(*)', 'cantidad')
      .where('ticket.estado != :cerrado', { cerrado: 'cerrado' })
      .groupBy('ticket.estado')
      .getRawMany<{ estado: string; cantidad: string }>();

    const porEstado: Record<string, number> = {};
    let total = 0;
    for (const fila of filas) {
      const cantidad = Number(fila.cantidad);
      porEstado[fila.estado] = cantidad;
      total += cantidad;
    }
    return { total, porEstado };
  }

  /** Semáforo desde recibida_en: verde (<70% del plazo), amarillo (70-100%), rojo (plazo vencido) */
  private calcularSemaforo(recibidaEn: Date): {
    diasTranscurridos: number;
    semaforo: SemaforoPlazo;
  } {
    const diasTranscurridos = Math.floor(
      (Date.now() - recibidaEn.getTime()) / (24 * 60 * 60 * 1000),
    );
    const proporcion = diasTranscurridos / PLAZO_SOLICITUD_DIAS;
    const semaforo: SemaforoPlazo =
      proporcion >= 1 ? 'rojo' : proporcion >= 0.7 ? 'amarillo' : 'verde';
    return { diasTranscurridos, semaforo };
  }

  async solicitudesPendientes(): Promise<
    (Pick<
      SolicitudDerecho,
      'id' | 'email' | 'tipo' | 'estado' | 'recibidaEn'
    > & {
      diasTranscurridos: number;
      semaforo: SemaforoPlazo;
    })[]
  > {
    const pendientes = await this.solicitudes.find({
      where: [{ estado: 'recibida' }, { estado: 'en_proceso' }],
      order: { recibidaEn: 'ASC' },
    });

    return pendientes.map((s) => ({
      id: s.id,
      email: s.email,
      tipo: s.tipo,
      estado: s.estado,
      recibidaEn: s.recibidaEn,
      ...this.calcularSemaforo(s.recibidaEn),
    }));
  }

  async webhooksSinProcesar(): Promise<{ total: number; masDe10Min: number }> {
    const [total, masDe10Min] = await Promise.all([
      this.webhooks.count({ where: { procesado: false } }),
      this.webhooks.count({
        where: {
          procesado: false,
          recibidoEn: LessThanOrEqual(new Date(Date.now() - 10 * 60 * 1000)),
        },
      }),
    ]);
    return { total, masDe10Min };
  }

  /** Pagos autorizados hace más de 1h sin boleta emitida — la boleta es asíncrona pero no debe estancarse */
  private async pagosSinBoletaMasDe1h(): Promise<number> {
    return this.pagos
      .createQueryBuilder('pago')
      .leftJoin(Boleta, 'boleta', 'boleta.orden_id = pago.orden_id')
      .where('pago.estado = :estado', { estado: 'autorizado' })
      .andWhere('pago.confirmado_en <= :haceUnaHora', {
        haceUnaHora: new Date(Date.now() - 60 * 60 * 1000),
      })
      .andWhere('(boleta.id IS NULL OR boleta.estado = :pendiente)', {
        pendiente: 'pendiente',
      })
      .getCount();
  }

  private async usuariosBloqueados(): Promise<number> {
    return this.usuarios.count({
      where: { bloqueadoHasta: MoreThan(new Date()) },
    });
  }

  /**
   * Alertas operativas que deben existir desde el día 1 (documento maestro 5.3). El conteo de
   * "logins fallidos por IP" no es reconstruible desde el esquema (no hay IP por intento, solo
   * el contador bloqueado_hasta del usuario) — se reporta en su lugar cuántos usuarios están
   * bloqueados ahora mismo, que es la señal real disponible.
   */
  async alertas(): Promise<{
    pagosSinBoleta: number;
    webhooksSinProcesar: number;
    stockBajoMinimo: number;
    usuariosBloqueados: number;
    solicitudesCercaDelPlazo: number;
  }> {
    const [pagosSinBoleta, webhooks, stock, bloqueados, solicitudes] =
      await Promise.all([
        this.pagosSinBoletaMasDe1h(),
        this.webhooksSinProcesar(),
        this.stockBajoMinimo(),
        this.usuariosBloqueados(),
        this.solicitudesPendientes(),
      ]);

    return {
      pagosSinBoleta,
      webhooksSinProcesar: webhooks.masDe10Min,
      stockBajoMinimo: stock.length,
      usuariosBloqueados: bloqueados,
      solicitudesCercaDelPlazo: solicitudes.filter(
        (s) => s.semaforo !== 'verde',
      ).length,
    };
  }
}
