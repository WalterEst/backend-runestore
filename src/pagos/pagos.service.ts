import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Boleta } from '../database/entities/boleta.entity';
import { MovimientoInventario } from '../database/entities/movimiento-inventario.entity';
import { Orden } from '../database/entities/orden.entity';
import { OrdenItem } from '../database/entities/orden-item.entity';
import { Pago } from '../database/entities/pago.entity';
import { ProductoVariante } from '../database/entities/producto-variante.entity';
import { ReservaStock } from '../database/entities/reserva-stock.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { WebpayService } from '../common/webpay/webpay.service';
import { calcularNetoIva } from '../common/dte/boleta-calculo.util';
import { ContextoCarrito } from '../carrito/carrito.service';

export interface InicioPagoResultado {
  urlPago: string;
  token: string;
}

export interface ResultadoConfirmacion {
  aprobado: boolean;
  numeroOrden: string;
  motivoRechazo?: string;
}

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  constructor(
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    @InjectRepository(Pago) private readonly pagos: Repository<Pago>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly webpayService: WebpayService,
    private readonly config: ConfigService,
  ) {}

  async iniciar(
    ordenId: number,
    ctx: ContextoCarrito,
    tokenConsulta: string | undefined,
  ): Promise<InicioPagoResultado> {
    const orden = await this.ordenes.findOne({ where: { id: ordenId } });
    if (!orden) throw new NotFoundException('Orden no encontrada');

    this.verificarPropiedad(orden, ctx, tokenConsulta);

    if (orden.estado !== 'pendiente_pago') {
      throw new BadRequestException(
        `La orden está en estado "${orden.estado}" y no admite un nuevo pago`,
      );
    }

    const returnUrl = `${this.config.get<string>('backendPublicUrl')}/pagos/webpay/retorno`;

    // numero_orden = buyOrder de Webpay: es único y nunca se reutiliza (ver CLAUDE.md)
    const { token, url } = await this.webpayService.crear(
      orden.numeroOrden,
      `orden-${orden.id}`,
      orden.total,
      returnUrl,
    );

    // Reintentos de pago = nuevas filas en pagos, nunca se sobrescribe la anterior
    await this.pagos.save(
      this.pagos.create({
        ordenId: orden.id,
        pasarela: 'webpay',
        tokenPasarela: token,
        estado: 'iniciado',
        monto: orden.total,
      }),
    );

    return { urlPago: url, token };
  }

  /**
   * Confirma el pago tras el retorno desde Webpay. Triple validación obligatoria
   * (response_code===0 && status==='AUTHORIZED' && amount===orden.total leído de
   * BD) — ver CLAUDE.md. Si aprueba: pago→autorizado, orden→pagada, stock−,
   * kardex, reserva liberada, total_compras+1, todo en una transacción.
   */
  async confirmar(tokenWs: string): Promise<ResultadoConfirmacion> {
    const pagoPrevio = await this.pagos.findOne({
      where: { tokenPasarela: tokenWs },
    });
    if (!pagoPrevio) throw new NotFoundException('Pago no encontrado');

    // Idempotencia: un token de Webpay solo se puede confirmar (commit) una vez;
    // si ya lo procesamos, devolvemos el resultado guardado sin volver a mutar nada.
    if (pagoPrevio.estado !== 'iniciado') {
      const orden = await this.ordenes.findOne({
        where: { id: pagoPrevio.ordenId },
      });
      return {
        aprobado: pagoPrevio.estado === 'autorizado',
        numeroOrden: orden?.numeroOrden ?? '',
      };
    }

    const respuesta = await this.webpayService.confirmar(tokenWs);

    return this.dataSource.transaction(async (manager) => {
      const orden = await manager.findOne(Orden, {
        where: { id: pagoPrevio.ordenId },
      });
      if (!orden) throw new NotFoundException('Orden no encontrada');

      // Triple validación contra la orden real en BD — nunca contra lo que "diga" el cliente
      const responseCodeOk = respuesta.responseCode === 0;
      const statusOk = respuesta.status === 'AUTHORIZED';
      const montoOk = respuesta.amount === orden.total;
      const aprobado = responseCodeOk && statusOk && montoOk;

      const ultimos4 = respuesta.cardDetail?.cardNumber?.slice(-4) ?? null;

      // JSON crudo de la pasarela (columna `json`) para disputas — ver CLAUDE.md.
      // El QueryDeepPartialEntity de TypeORM no infiere bien un Record<string, unknown>
      // anidado, de ahí el cast puntual del objeto completo de cambios.
      await manager.update(Pago, { id: pagoPrevio.id }, {
        estado: aprobado ? 'autorizado' : 'rechazado',
        codigoAutorizacion: respuesta.authorizationCode ?? null,
        tipoTarjeta: respuesta.paymentTypeCode ?? null,
        ultimos4,
        respuestaRaw: respuesta.raw,
        confirmadoEn: new Date(),
      } as any);

      if (!aprobado) {
        this.logger.warn(
          `Pago rechazado orden=${orden.numeroOrden} responseCode=${respuesta.responseCode} status=${respuesta.status} montoOk=${montoOk}`,
        );
        // La orden queda pendiente_pago: el cliente puede reintentar hasta que la reserva expire (cron Fase 4)
        return {
          aprobado: false,
          numeroOrden: orden.numeroOrden,
          motivoRechazo: !montoOk
            ? 'Monto no coincide con la orden'
            : 'Pago rechazado por la pasarela',
        };
      }

      await this.confirmarStockYOrden(manager, orden);

      return { aprobado: true, numeroOrden: orden.numeroOrden };
    });
  }

  private async confirmarStockYOrden(
    manager: EntityManager,
    orden: Orden,
  ): Promise<void> {
    await manager.update(Orden, { id: orden.id }, { estado: 'pagada' });

    const items = await manager.find(OrdenItem, {
      where: { ordenId: orden.id },
    });
    for (const item of items) {
      if (!item.varianteId) continue;

      // UPDATE defensivo: solo descuenta si alcanza el stock (nunca queda negativo)
      const resultado = await manager
        .createQueryBuilder()
        .update(ProductoVariante)
        .set({ stock: () => `stock - ${item.cantidad}` })
        .where('id = :id AND stock >= :cantidad', {
          id: item.varianteId,
          cantidad: item.cantidad,
        })
        .execute();

      if (!resultado.affected) {
        // No debería ocurrir: la reserva de la Fase 4 ya apartó esta unidad. Se deja
        // constancia igual — nunca se bloquea la confirmación de un pago ya autorizado.
        this.logger.error(
          `Stock insuficiente al confirmar pago (inconsistencia): varianteId=${item.varianteId} ordenId=${orden.id}`,
        );
        continue;
      }

      const variante = await manager.findOne(ProductoVariante, {
        where: { id: item.varianteId },
      });

      await manager.save(
        manager.create(MovimientoInventario, {
          varianteId: item.varianteId,
          tipo: 'venta',
          cantidad: -item.cantidad,
          stockResultante: variante?.stock ?? 0,
          referencia: orden.numeroOrden,
        }),
      );
    }

    await manager.delete(ReservaStock, { ordenId: orden.id });

    if (orden.usuarioId) {
      await manager
        .createQueryBuilder()
        .update(Usuario)
        .set({ totalCompras: () => 'total_compras + 1' })
        .where('id = :id', { id: orden.usuarioId })
        .execute();
    }

    // La emisión real contra el emisor DTE es un job asíncrono (cron, ver
    // BoletasCron) — acá solo dejamos la fila "pendiente"; un error del emisor
    // JAMÁS debe revertir o bloquear este pago (CLAUDE.md).
    const { neto, iva } = calcularNetoIva(orden.total);
    await manager.save(
      manager.create(Boleta, {
        ordenId: orden.id,
        tipo: 'boleta',
        rutReceptor: orden.rutComprador ?? null,
        montoNeto: neto,
        iva,
        montoTotal: orden.total,
        estado: 'pendiente',
      }),
    );
  }

  private verificarPropiedad(
    orden: Orden,
    ctx: ContextoCarrito,
    tokenConsulta: string | undefined,
  ): void {
    if (ctx.usuarioId) {
      if (orden.usuarioId === ctx.usuarioId) return;
      throw new ForbiddenException('No tienes acceso a esta orden');
    }
    if (tokenConsulta && orden.tokenConsulta === tokenConsulta) return;
    throw new ForbiddenException('No tienes acceso a esta orden');
  }
}
