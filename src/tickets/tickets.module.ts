import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../database/entities/ticket.entity';
import { TicketMensaje } from '../database/entities/ticket-mensaje.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { R2Service } from '../common/r2/r2.service';
import { TicketsAdminController } from './admin/tickets-admin.controller';
import { CompraVerificadaGuard } from './guards/compra-verificada.guard';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, TicketMensaje, Usuario])],
  controllers: [TicketsController, TicketsAdminController],
  providers: [TicketsService, CompraVerificadaGuard, R2Service],
})
export class TicketsModule {}
