import { IsIn, IsInt, Max, Min } from 'class-validator';
import {
  MIME_PERMITIDOS,
  TAMANO_MAXIMO_BYTES,
} from '../../common/r2/r2.service';

export class PresignedUrlDto {
  @IsIn(Object.keys(MIME_PERMITIDOS))
  mimeType: string;

  @IsInt()
  @Min(1)
  @Max(TAMANO_MAXIMO_BYTES)
  tamanoBytes: number;
}
