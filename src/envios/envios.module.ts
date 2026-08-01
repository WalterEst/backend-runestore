import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Envio } from '../database/entities/envio.entity';
import { Orden } from '../database/entities/orden.entity';
import { EmailService } from '../common/email/email.service';
import { EnviosController } from './envios.controller';
import { EnviosService } from './envios.service';

@Module({
  imports: [TypeOrmModule.forFeature([Envio, Orden])],
  controllers: [EnviosController],
  providers: [EnviosService, EmailService],
  exports: [EnviosService],
})
export class EnviosModule {}
