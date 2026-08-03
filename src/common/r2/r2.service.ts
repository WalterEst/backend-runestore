import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const MIME_PERMITIDOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;

export interface PresignedUrlResultado {
  urlSubida: string;
  urlPublica: string;
  key: string;
  expiraEnSegundos: number;
}

/**
 * Genera URLs prefirmadas para que el navegador suba directo a Cloudflare R2
 * (compatible S3) sin que el binario pase por el backend — ver documento
 * maestro Parte 1.3. Los nombres siempre son UUID + extensión validada:
 * nunca el nombre original del archivo (evita colisiones y path traversal).
 */
@Injectable()
export class R2Service {
  private readonly client: S3Client | null;
  private readonly bucket?: string;
  private readonly publicUrl?: string;

  constructor(private readonly config: ConfigService) {
    const accountId = this.config.get<string>('r2.accountId');
    const accessKeyId = this.config.get<string>('r2.accessKeyId');
    const secretAccessKey = this.config.get<string>('r2.secretAccessKey');
    this.bucket = this.config.get<string>('r2.bucket');
    this.publicUrl = this.config.get<string>('r2.publicUrl');

    this.client =
      accountId && accessKeyId && secretAccessKey
        ? new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId, secretAccessKey },
          })
        : null;
  }

  async generarUrlSubida(
    mimeType: string,
    prefijo: 'productos' | 'tickets' | 'avatares',
  ): Promise<PresignedUrlResultado> {
    const extension = MIME_PERMITIDOS[mimeType];
    if (!extension) {
      throw new ServiceUnavailableException('Tipo de archivo no permitido');
    }
    if (!this.client || !this.bucket || !this.publicUrl) {
      throw new ServiceUnavailableException(
        'Almacenamiento de imágenes no configurado (R2_* pendiente en .env)',
      );
    }

    const key = `${prefijo}/${randomUUID()}.${extension}`;
    const expiraEnSegundos = 300;

    // ContentLength no se fija aquí: un PUT prefirmado con ContentLength exige que el
    // navegador envíe exactamente ese tamaño. El máximo de 5MB se valida en el DTO de
    // entrada (antes de firmar) y debe reforzarse con una regla de tamaño en el bucket R2.
    const comando = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    const urlSubida = await getSignedUrl(this.client, comando, {
      expiresIn: expiraEnSegundos,
    });

    return {
      urlSubida,
      urlPublica: `${this.publicUrl}/${key}`,
      key,
      expiraEnSegundos,
    };
  }
}

export { MIME_PERMITIDOS, TAMANO_MAXIMO_BYTES };
