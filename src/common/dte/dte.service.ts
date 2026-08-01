import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class DteNoConfiguradoError extends Error {
  constructor() {
    super(
      'Emisor DTE no configurado (DTE_PROVIDER/DTE_API_KEY pendientes en .env)',
    );
  }
}

export interface ItemDte {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

export interface DatosEmisionDte {
  montoNeto: number;
  iva: number;
  montoTotal: number;
  rutReceptor: string | null;
  razonSocialReceptor: string | null;
  items: ItemDte[];
  referencia: string;
}

export interface ResultadoEmisionDte {
  folio: number;
  pdfUrl: string;
  raw: Record<string, unknown>;
}

/**
 * Adaptador contra el emisor DTE (OpenFactura/Haulmer o LibreDTE — ver documento
 * maestro Parte 1.2). La forma exacta del payload la define la API del proveedor
 * elegido; esto sigue la forma general documentada por OpenFactura (v2/dte) pero
 * DEBE verificarse contra la cuenta real antes de producción — no hay credenciales
 * de prueba públicas para DTE como sí las hay para Transbank.
 */
@Injectable()
export class DteService {
  private readonly logger = new Logger(DteService.name);

  constructor(private readonly config: ConfigService) {}

  async emitirBoleta(datos: DatosEmisionDte): Promise<ResultadoEmisionDte> {
    const apiKey = this.config.get<string>('dte.apiKey');
    const rutEmisor = this.config.get<string>('dte.rutEmisor');
    const environment = this.config.get<string>('dte.environment');

    if (!apiKey || !rutEmisor) {
      throw new DteNoConfiguradoError();
    }

    const baseUrl =
      environment === 'produccion'
        ? 'https://api.haulmer.com/v2/dte/document'
        : 'https://dev-api.haulmer.com/v2/dte/document';

    const payload = {
      Documento: {
        Encabezado: {
          IdentificacionDTE: { TipoDTE: 39 }, // 39 = boleta electrónica afecta
          Emisor: { Rut: rutEmisor },
          Receptor: {
            Rut: datos.rutReceptor ?? '66666666-6',
            RazonSocial: datos.razonSocialReceptor ?? 'Consumidor final',
          },
          Totales: {
            MntNeto: datos.montoNeto,
            IVA: datos.iva,
            MntTotal: datos.montoTotal,
          },
        },
        Detalle: datos.items.map((item, indice) => ({
          NroLinDet: indice + 1,
          NmbItem: item.nombre.slice(0, 80),
          QtyItem: item.cantidad,
          PrcItem: item.precioUnitario,
        })),
      },
      referencia: datos.referencia,
    };

    const respuesta = await fetch(baseUrl, {
      method: 'POST',
      headers: { apikey: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!respuesta.ok) {
      const texto = await respuesta.text();
      throw new Error(`Emisor DTE respondió ${respuesta.status}: ${texto}`);
    }

    const resultado = (await respuesta.json()) as {
      folio: number;
      urlPdf?: string;
      pdf_url?: string;
    };

    return {
      folio: resultado.folio,
      pdfUrl: resultado.urlPdf ?? resultado.pdf_url ?? '',
      raw: resultado as unknown as Record<string, unknown>,
    };
  }
}
