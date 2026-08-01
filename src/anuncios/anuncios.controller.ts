import { Controller, Get } from '@nestjs/common';
import { AnunciosService } from './anuncios.service';

@Controller('anuncios')
export class AnunciosController {
  constructor(private readonly anunciosService: AnunciosService) {}

  @Get('activo')
  obtenerActivo() {
    return this.anunciosService.obtenerActivo();
  }
}
