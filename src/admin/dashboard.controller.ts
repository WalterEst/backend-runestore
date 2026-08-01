import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { RangoFechasDto } from './dto/rango-fechas.dto';

/** Panel de administración — documento maestro Parte 5.1: dashboard es exclusivo del rol admin */
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('ventas')
  ventasPorPeriodo(@Query() dto: RangoFechasDto) {
    return this.dashboardService.ventasPorPeriodo(dto);
  }

  @Get('top-productos')
  topProductos(@Query() dto: RangoFechasDto, @Query('limite') limite?: string) {
    return this.dashboardService.topProductos({
      ...dto,
      limite: limite ? parseInt(limite, 10) : undefined,
    });
  }

  @Get('stock-bajo-minimo')
  stockBajoMinimo() {
    return this.dashboardService.stockBajoMinimo();
  }

  @Get('tickets-abiertos')
  ticketsAbiertos() {
    return this.dashboardService.ticketsAbiertos();
  }

  @Get('solicitudes-pendientes')
  solicitudesPendientes() {
    return this.dashboardService.solicitudesPendientes();
  }

  @Get('webhooks-sin-procesar')
  webhooksSinProcesar() {
    return this.dashboardService.webhooksSinProcesar();
  }

  @Get('alertas')
  alertas() {
    return this.dashboardService.alertas();
  }
}
