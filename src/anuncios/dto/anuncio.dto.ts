import { IsString, IsUrl, MaxLength } from 'class-validator';

export class CrearAnuncioDto {
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  imagenUrl: string;
}
