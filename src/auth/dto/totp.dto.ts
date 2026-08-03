import { IsString, Length, MinLength } from 'class-validator';

export class ConfirmarTotpDto {
  @IsString()
  @Length(6, 6)
  codigo: string;
}

export class DesactivarTotpDto {
  @IsString()
  @MinLength(1)
  password: string;
}

export class VerificarLoginTotpDto {
  @IsString()
  tokenTemporal: string;

  @IsString()
  @Length(6, 6)
  codigo: string;
}
