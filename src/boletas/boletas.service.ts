import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Boleta } from '../database/entities/boleta.entity';
import { Orden } from '../database/entities/orden.entity';
import { OrdenItem } from '../database/entities/orden-item.entity';
import { DteService } from '../common/dte/dte.service';
import { EmailService } from '../common/email/email.service';

@Injectable()
export class BoletasService {
  private readonly logger = new Logger(BoletasService.name);

  constructor(
    @InjectRepository(Boleta) private readonly boletas: Repository<Boleta>,
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    @InjectRepository(OrdenItem)
    private readonly ordenItems: Repository<OrdenItem>,
    private readonly dteService: DteService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Job asíncrono post-pago (llamado por el cron): intenta emitir cada boleta
   * pendiente contra el emisor DTE. Un error acá NUNCA toca el pago ni la orden
   * — la boleta simplemente sigue "pendiente" y se reintenta en la próxima corrida.
   */
  async emitirPendientes(): Promise<void> {
    const pendientes = await this.boletas.find({
      where: { estado: 'pendiente' },
    });

    for (const boleta of pendientes) {
      try {
        await this.emitirUna(boleta);
      } catch (error) {
        this.logger.warn(
          `No se pudo emitir boleta ordenId=${boleta.ordenId}: ${(error as Error).message}`,
        );
      }
    }
  }

  private async emitirUna(boleta: Boleta): Promise<void> {
    const orden = await this.ordenes.findOne({ where: { id: boleta.ordenId } });
    if (!orden) return;

    const items = await this.ordenItems.find({ where: { ordenId: orden.id } });

    const resultado = await this.dteService.emitirBoleta({
      montoNeto: boleta.montoNeto,
      iva: boleta.iva,
      montoTotal: boleta.montoTotal,
      rutReceptor: boleta.rutReceptor,
      razonSocialReceptor: boleta.razonSocial,
      referencia: orden.numeroOrden,
      items: items.map((i) => ({
        nombre: i.nombreProducto,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
      })),
    });

    await this.boletas.update(
      { id: boleta.id },
      {
        folio: resultado.folio,
        pdfUrl: resultado.pdfUrl,
        estado: 'emitida',
        emitidaEn: new Date(),
      },
    );

    this.emailService.enviarBoletaEmitida(
      orden.emailComprador,
      orden.numeroOrden,
      resultado.pdfUrl,
    );
  }
}
