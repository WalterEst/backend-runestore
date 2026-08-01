import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CrearDireccionDto {
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

  @IsOptional()
  @IsBoolean()
  esPrincipal?: boolean;
}

export class ActualizarDireccionDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  alias?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  calle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  depto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  comuna?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  codigoPostal?: string;

  @IsOptional()
  @IsBoolean()
  esPrincipal?: boolean;
}
