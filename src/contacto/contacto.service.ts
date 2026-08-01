import { Injectable } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { EmailService } from '../common/email/email.service';
import { TurnstileService } from '../common/turnstile/turnstile.service';
import { EnviarContactoDto } from './dto/contacto.dto';

@Injectable()
export class ContactoService {
  constructor(
    private readonly turnstileService: TurnstileService,
    private readonly emailService: EmailService,
  ) {}

  async enviar(
    dto: EnviarContactoDto,
    ip?: string,
  ): Promise<{ mensaje: string }> {
    await this.turnstileService.verificar(dto.turnstileToken, ip);

    this.emailService.enviarConsultaContacto(
      sanitizeHtml(dto.nombre, { allowedTags: [] }),
      dto.email,
      sanitizeHtml(dto.mensaje, { allowedTags: [] }),
    );

    return { mensaje: 'Recibimos tu mensaje, te responderemos a la brevedad.' };
  }
}
