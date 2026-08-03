import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auditoria } from '../database/entities/auditoria.entity';
import { Carrito } from '../database/entities/carrito.entity';
import { Consentimiento } from '../database/entities/consentimiento.entity';
import { Direccion } from '../database/entities/direccion.entity';
import { Orden } from '../database/entities/orden.entity';
import { Pagina } from '../database/entities/pagina.entity';
import { Resena } from '../database/entities/resena.entity';
import { Rol } from '../database/entities/rol.entity';
import { SolicitudDerecho } from '../database/entities/solicitud-derecho.entity';
import { Ticket } from '../database/entities/ticket.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { R2Service } from '../common/r2/r2.service';
import { UsuariosAdminController } from './admin/usuarios-admin.controller';
import { SolicitudesDerechoService } from './solicitudes-derecho.service';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Usuario,
      Direccion,
      Orden,
      Consentimiento,
      Resena,
      Ticket,
      Rol,
      Auditoria,
      Carrito,
      SolicitudDerecho,
      Pagina,
    ]),
  ],
  controllers: [UsuariosController, UsuariosAdminController],
  providers: [UsuariosService, SolicitudesDerechoService, R2Service],
})
export class UsuariosModule {}
