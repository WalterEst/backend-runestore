import { Controller, Get, Param } from '@nestjs/common';
import { FaqsService } from './faqs.service';
import { PaginasService } from './paginas.service';

@Controller()
export class ContenidoController {
  constructor(
    private readonly paginasService: PaginasService,
    private readonly faqsService: FaqsService,
  ) {}

  @Get('paginas')
  listarPaginas() {
    return this.paginasService.listarPublicas();
  }

  @Get('paginas/:slug')
  obtenerPagina(@Param('slug') slug: string) {
    return this.paginasService.obtenerPublicaPorSlug(slug);
  }

  @Get('faqs')
  listarFaqs() {
    return this.faqsService.listarPublicas();
  }
}
