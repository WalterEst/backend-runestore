import {
  Body,
  Controller,
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
import { ActualizarCampanaDto, CrearCampanaDto } from '../dto/newsletter.dto';
import { NewsletterService } from '../newsletter.service';

@Controller('admin/newsletter')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class NewsletterAdminController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Get('suscriptores')
  listarSuscriptores() {
    return this.newsletterService.listarSuscriptoresAdmin();
  }

  @Get('campanas')
  listarCampanas() {
    return this.newsletterService.listarCampanasAdmin();
  }

  @Post('campanas')
  crearCampana(@Body() dto: CrearCampanaDto) {
    return this.newsletterService.crearCampana(dto);
  }

  @Patch('campanas/:id')
  actualizarCampana(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCampanaDto,
  ) {
    return this.newsletterService.actualizarCampana(id, dto);
  }
}
