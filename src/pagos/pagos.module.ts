import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Boleta } from '../database/entities/boleta.entity';
import { MovimientoInventario } from '../database/entities/movimiento-inventario.entity';
import { Orden } from '../database/entities/orden.entity';
import { OrdenItem } from '../database/entities/orden-item.entity';
import { Pago } from '../database/entities/pago.entity';
import { ProductoVariante } from '../database/entities/producto-variante.entity';
import { ReservaStock } from '../database/entities/reserva-stock.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { WebpayService } from '../common/webpay/webpay.service';
import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Orden,
      Pago,
      OrdenItem,
      ProductoVariante,
      ReservaStock,
      Usuario,
      MovimientoInventario,
      Boleta,
    ]),
  ],
  controllers: [PagosController],
  providers: [PagosService, WebpayService],
})
export class PagosModule {}
