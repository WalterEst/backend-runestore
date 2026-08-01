import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ActualizarFaqDto, CrearFaqDto } from '../dto/faq.dto';
import { ActualizarPaginaDto, CrearPaginaDto } from '../dto/pagina.dto';
import { FaqsService } from '../faqs.service';
import { PaginasService } from '../paginas.service';

@Controller('admin/contenido')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ContenidoAdminController {
  constructor(
    private readonly paginasService: PaginasService,
    private readonly faqsService: FaqsService,
  ) {}

  @Get('paginas')
  listarPaginas() {
    return this.paginasService.listarAdmin();
  }

  @Post('paginas')
  crearPagina(@Body() dto: CrearPaginaDto) {
    return this.paginasService.crear(dto);
  }

  @Patch('paginas/:id')
  actualizarPagina(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPaginaDto,
  ) {
    return this.paginasService.actualizar(id, dto);
  }

  @Get('faqs')
  listarFaqs() {
    return this.faqsService.listarAdmin();
  }

  @Post('faqs')
  crearFaq(@Body() dto: CrearFaqDto) {
    return this.faqsService.crear(dto);
  }

  @Patch('faqs/:id')
  actualizarFaq(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarFaqDto,
  ) {
    return this.faqsService.actualizar(id, dto);
  }

  @Delete('faqs/:id')
  eliminarFaq(@Param('id', ParseIntPipe) id: number) {
    return this.faqsService.eliminar(id);
  }
}
