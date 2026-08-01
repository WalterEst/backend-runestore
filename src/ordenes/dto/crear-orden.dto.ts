import { Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class DireccionEnvioDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  alias?: string;

  @IsString()
  @MaxLength(150)
  calle: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  depto?: string;

  @IsString()
  @MaxLength(80)
  comuna: string;

  @IsString()
  @MaxLength(80)
  region: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  codigoPostal?: string;
}

export class CrearOrdenDto {
  @IsEmail()
  @MaxLength(191)
  emailComprador: string;

  @IsString()
  @MaxLength(160)
  nombreComprador: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefonoComprador?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  rutComprador?: string;

  @ValidateNested()
  @Type(() => DireccionEnvioDto)
  direccionEnvio: DireccionEnvioDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notasCliente?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  cuponCodigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  giftcardCodigo?: string;
}
