import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrdenesService } from './ordenes.service';

@Injectable()
export class OrdenesCron {
  private readonly logger = new Logger(OrdenesCron.name);

  constructor(private readonly ordenesService: OrdenesService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async liberarReservasExpiradas(): Promise<void> {
    try {
      await this.ordenesService.liberarReservasExpiradas();
    } catch (error) {
      this.logger.error('Error liberando reservas expiradas', error as Error);
    }
  }
}
