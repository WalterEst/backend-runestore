import { Injectable, Logger } from '@nestjs/common';

/**
 * Stub del envío de email transaccional. El proveedor real (SES/Brevo, ver
 * documento_maestro_sistema.md Parte 1.2) se conecta en una fase posterior;
 * mientras tanto solo deja constancia en el log para no romper los flujos de
 * auth que dependen de enviar un link (verificación, reset de password).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  enviarVerificacionEmail(destino: string, token: string): void {
    this.logger.log(
      `[email pendiente de proveedor real] Verificación de cuenta para ${destino}: token=${token}`,
    );
  }

  enviarResetPassword(destino: string, token: string): void {
    this.logger.log(
      `[email pendiente de proveedor real] Reset de password para ${destino}: token=${token}`,
    );
  }

  enviarBoletaEmitida(
    destino: string,
    numeroOrden: string,
    pdfUrl: string,
  ): void {
    this.logger.log(
      `[email pendiente de proveedor real] Boleta de ${numeroOrden} para ${destino}: ${pdfUrl}`,
    );
  }

  enviarDespacho(
    destino: string,
    numeroOrden: string,
    courier: string,
    numeroSeguimiento: string | null,
  ): void {
    this.logger.log(
      `[email pendiente de proveedor real] Despacho de ${numeroOrden} para ${destino}: ${courier} ${numeroSeguimiento ?? '(sin tracking)'}`,
    );
  }

  /** Reenvía la consulta del formulario de contacto público a la casilla interna de la tienda */
  enviarConsultaContacto(
    nombreRemitente: string,
    emailRemitente: string,
    mensaje: string,
  ): void {
    this.logger.log(
      `[email pendiente de proveedor real] Nueva consulta de contacto de ${nombreRemitente} <${emailRemitente}>: ${mensaje}`,
    );
  }
}
