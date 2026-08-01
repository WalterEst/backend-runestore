import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { SuscribirseDto } from './dto/newsletter.dto';
import { NewsletterService } from './newsletter.service';

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('suscribirse')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  suscribirse(@Body() dto: SuscribirseDto, @Req() req: Request) {
    return this.newsletterService.suscribirse(dto.email, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('confirmar/:token')
  confirmar(@Param('token') token: string) {
    return this.newsletterService.confirmar(token);
  }

  @Post('baja/:token')
  darDeBaja(@Param('token') token: string, @Req() req: Request) {
    return this.newsletterService.darDeBaja(token, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
