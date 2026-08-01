import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CrearEnvioDto {
  @IsString()
  @MaxLength(50)
  courier: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  numeroSeguimiento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  etiquetaUrl?: string;
}
