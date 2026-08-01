import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Faq } from '../database/entities/faq.entity';
import { Pagina } from '../database/entities/pagina.entity';
import { ContenidoAdminController } from './admin/contenido-admin.controller';
import { ContenidoController } from './contenido.controller';
import { FaqsService } from './faqs.service';
import { PaginasService } from './paginas.service';

@Module({
  imports: [TypeOrmModule.forFeature([Pagina, Faq])],
  controllers: [ContenidoController, ContenidoAdminController],
  providers: [PaginasService, FaqsService],
  exports: [PaginasService],
})
export class ContenidoModule {}
