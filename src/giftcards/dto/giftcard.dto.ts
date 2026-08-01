import {
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class EmitirGiftcardDto {
  @IsInt()
  @Min(1000)
  @Max(500000)
  montoInicial: number;

  @IsOptional()
  @IsEmail()
  @MaxLength(191)
  emailDestinatario?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  mensaje?: string;

  @IsOptional()
  @IsDateString()
  expiraEn?: string;
}
