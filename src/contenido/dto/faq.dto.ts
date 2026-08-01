import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class CrearFaqDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  categoria?: string;

  @IsString()
  @MaxLength(300)
  pregunta: string;

  @IsString()
  respuesta: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}

export class ActualizarFaqDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  categoria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  pregunta?: string;

  @IsOptional()
  @IsString()
  respuesta?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  publicada?: boolean;
}
