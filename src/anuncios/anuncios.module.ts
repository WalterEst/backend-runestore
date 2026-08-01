import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Anuncio } from '../database/entities/anuncio.entity';
import { AnunciosController } from './anuncios.controller';
import { AnunciosAdminController } from './admin/anuncios-admin.controller';
import { AnunciosService } from './anuncios.service';

@Module({
  imports: [TypeOrmModule.forFeature([Anuncio])],
  controllers: [AnunciosController, AnunciosAdminController],
  providers: [AnunciosService],
})
export class AnunciosModule {}
