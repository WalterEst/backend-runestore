import { Body, Controller, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { EnviarContactoDto } from './dto/contacto.dto';
import { ContactoService } from './contacto.service';

@Controller('contacto')
export class ContactoController {
  constructor(private readonly contactoService: ContactoService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  enviar(@Body() dto: EnviarContactoDto, @Req() req: Request) {
    return this.contactoService.enviar(dto, req.ip);
  }
}
