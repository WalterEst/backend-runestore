import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SuscribirseDto {
  @IsEmail()
  @MaxLength(191)
  email: string;
}

export class CrearCampanaDto {
  @IsString()
  @MaxLength(150)
  asunto: string;

  @IsString()
  contenidoHtml: string;

  @IsOptional()
  @IsString()
  programadaPara?: string;
}

export class ActualizarCampanaDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  asunto?: string;

  @IsOptional()
  @IsString()
  contenidoHtml?: string;

  @IsOptional()
  @IsIn(['borrador', 'programada'])
  estado?: 'borrador' | 'programada';

  @IsOptional()
  @IsString()
  programadaPara?: string;
}
