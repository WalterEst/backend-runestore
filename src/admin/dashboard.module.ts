import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Boleta } from '../database/entities/boleta.entity';
import { Orden } from '../database/entities/orden.entity';
import { OrdenItem } from '../database/entities/orden-item.entity';
import { Pago } from '../database/entities/pago.entity';
import { ProductoVariante } from '../database/entities/producto-variante.entity';
import { SolicitudDerecho } from '../database/entities/solicitud-derecho.entity';
import { Ticket } from '../database/entities/ticket.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { WebhookLog } from '../database/entities/webhook-log.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Orden,
      OrdenItem,
      Pago,
      Boleta,
      ProductoVariante,
      Ticket,
      SolicitudDerecho,
      WebhookLog,
      Usuario,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
