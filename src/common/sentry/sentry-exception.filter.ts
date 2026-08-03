import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

/**
 * Reporta a Sentry solo lo que de verdad es un error del servidor: errores de validación,
 * 401/403/404, etc. (HttpException con status < 500) son parte normal del tráfico y no
 * deben inundar Sentry. Delega siempre en BaseExceptionFilter para no cambiar ninguna
 * respuesta — esto es puro reporting, no reemplaza el manejo de errores existente.
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const esErrorDeCliente =
      exception instanceof HttpException && exception.getStatus() < 500;
    if (!esErrorDeCliente) {
      Sentry.captureException(exception);
    }
    super.catch(exception, host);
  }
}
