import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auditoria } from '../database/entities/auditoria.entity';
import { Boleta } from '../database/entities/boleta.entity';
import { Carrito } from '../database/entities/carrito.entity';
import { CarritoItem } from '../database/entities/carrito-item.entity';
import { Envio } from '../database/entities/envio.entity';
import { Orden } from '../database/entities/orden.entity';
import { OrdenItem } from '../database/entities/orden-item.entity';
import { Producto } from '../database/entities/producto.entity';
import { ProductoVariante } from '../database/entities/producto-variante.entity';
import { ReservaStock } from '../database/entities/reserva-stock.entity';
import { Talla } from '../database/entities/talla.entity';
import { CuponesModule } from '../cupones/cupones.module';
import { GiftcardsModule } from '../giftcards/giftcards.module';
import { PromocionesModule } from '../promociones/promociones.module';
import { OrdenesController } from './ordenes.controller';
import { OrdenesAdminController } from './admin/ordenes-admin.controller';
import { OrdenesService } from './ordenes.service';
import { OrdenesCron } from './ordenes.cron';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Orden,
      OrdenItem,
      Carrito,
      CarritoItem,
      ProductoVariante,
      Producto,
      Talla,
      ReservaStock,
      Envio,
      Boleta,
      Auditoria,
    ]),
    CuponesModule,
    GiftcardsModule,
    PromocionesModule,
  ],
  controllers: [OrdenesController, OrdenesAdminController],
  providers: [OrdenesService, OrdenesCron],
})
export class OrdenesModule {}
