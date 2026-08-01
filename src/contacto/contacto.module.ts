import { Module } from '@nestjs/common';
import { EmailService } from '../common/email/email.service';
import { TurnstileService } from '../common/turnstile/turnstile.service';
import { ContactoController } from './contacto.controller';
import { ContactoService } from './contacto.service';

@Module({
  controllers: [ContactoController],
  providers: [ContactoService, TurnstileService, EmailService],
})
export class ContactoModule {}
