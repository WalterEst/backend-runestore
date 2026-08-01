import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Boleta } from '../database/entities/boleta.entity';
import { Orden } from '../database/entities/orden.entity';
import { OrdenItem } from '../database/entities/orden-item.entity';
import { DteService } from '../common/dte/dte.service';
import { EmailService } from '../common/email/email.service';
import { BoletasAdminController } from './boletas-admin.controller';
import { BoletasCron } from './boletas.cron';
import { BoletasService } from './boletas.service';

@Module({
  imports: [TypeOrmModule.forFeature([Boleta, Orden, OrdenItem])],
  controllers: [BoletasAdminController],
  providers: [BoletasService, BoletasCron, DteService, EmailService],
})
export class BoletasModule {}
