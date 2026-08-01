import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Valida tokens de Cloudflare Turnstile contra su API de verificación.
 * Si TURNSTILE_SECRET_KEY no está configurada (dev sin sitio Cloudflare aún),
 * deja pasar con una advertencia en log — jamás falla silenciosamente en producción
 * porque ahí la variable de entorno sí debe estar seteada.
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly config: ConfigService) {}

  async verificar(token: string, ip?: string): Promise<void> {
    const secretKey = this.config.get<string>('turnstile.secretKey');
    const nodeEnv = this.config.get<string>('nodeEnv');

    if (!secretKey) {
      if (nodeEnv === 'production') {
        throw new BadRequestException(
          'Verificación anti-bots no disponible temporalmente',
        );
      }
      this.logger.warn(
        'TURNSTILE_SECRET_KEY no configurada: se omite verificación (solo permitido fuera de producción)',
      );
      return;
    }

    if (!token) {
      throw new BadRequestException('Verificación anti-bots requerida');
    }

    const body = new URLSearchParams();
    body.set('secret', secretKey);
    body.set('response', token);
    if (ip) body.set('remoteip', ip);

    const respuesta = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body },
    );
    const resultado = (await respuesta.json()) as { success: boolean };

    if (!resultado.success) {
      throw new BadRequestException('Verificación anti-bots fallida');
    }
  }
}
