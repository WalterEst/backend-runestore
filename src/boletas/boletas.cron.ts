import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BoletasService } from './boletas.service';

@Injectable()
export class BoletasCron {
  private readonly logger = new Logger(BoletasCron.name);

  constructor(private readonly boletasService: BoletasService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async emitirPendientes(): Promise<void> {
    try {
      await this.boletasService.emitirPendientes();
    } catch (error) {
      this.logger.error(
        'Error en el job de emisión de boletas',
        error as Error,
      );
    }
  }
}
