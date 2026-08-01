import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  WebpayPlus,
} from 'transbank-sdk';

export interface CrearTransaccionResultado {
  token: string;
  url: string;
}

export interface ConfirmarTransaccionResultado {
  amount: number;
  status: string;
  buyOrder: string;
  sessionId?: string;
  cardDetail?: { cardNumber?: string };
  authorizationCode?: string;
  paymentTypeCode?: string;
  responseCode: number;
  raw: Record<string, unknown>;
}

interface RespuestaCommitWebpay {
  amount: number;
  status: string;
  buy_order: string;
  session_id?: string;
  card_detail?: { card_number?: string };
  authorization_code?: string;
  payment_type_code?: string;
  response_code: number;
  [clave: string]: unknown;
}

/**
 * Envoltorio delgado sobre transbank-sdk. Modalidad redirect (PCI SAQ-A): el
 * backend nunca ve el número de tarjeta, solo crea/confirma la transacción con
 * Transbank — ver documento maestro Parte 4.2 y CLAUDE.md.
 */
@Injectable()
export class WebpayService {
  private readonly logger = new Logger(WebpayService.name);
  private readonly transaction: InstanceType<typeof WebpayPlus.Transaction>;

  constructor(config: ConfigService) {
    const commerceCode = config.get<string>('transbank.commerceCode');
    const apiKey = config.get<string>('transbank.apiKey');
    const environment = config.get<string>('transbank.environment');

    if (environment === 'production') {
      if (!commerceCode || !apiKey) {
        throw new Error(
          'TRANSBANK_COMMERCE_CODE y TRANSBANK_API_KEY son obligatorios en producción',
        );
      }
      this.transaction = WebpayPlus.Transaction.buildForProduction(
        commerceCode,
        apiKey,
      );
    } else {
      // Ambiente de integración: si no hay credenciales propias, usa las públicas
      // de prueba que Transbank publica en su SDK (pensadas exactamente para esto).
      this.logger.warn(
        'WebpayService en modo integración (sandbox de pruebas)',
      );
      this.transaction = WebpayPlus.Transaction.buildForIntegration(
        commerceCode || IntegrationCommerceCodes.WEBPAY_PLUS,
        apiKey || IntegrationApiKeys.WEBPAY,
      );
    }
  }

  async crear(
    buyOrder: string,
    sessionId: string,
    monto: number,
    returnUrl: string,
  ): Promise<CrearTransaccionResultado> {
    const respuesta = (await this.transaction.create(
      buyOrder,
      sessionId,
      monto,
      returnUrl,
    )) as { token: string; url: string };
    return { token: respuesta.token, url: respuesta.url };
  }

  async confirmar(token: string): Promise<ConfirmarTransaccionResultado> {
    const r = (await this.transaction.commit(token)) as RespuestaCommitWebpay;
    return {
      amount: r.amount,
      status: r.status,
      buyOrder: r.buy_order,
      sessionId: r.session_id,
      cardDetail: r.card_detail
        ? { cardNumber: r.card_detail.card_number }
        : undefined,
      authorizationCode: r.authorization_code,
      paymentTypeCode: r.payment_type_code,
      responseCode: r.response_code,
      raw: r,
    };
  }
}
