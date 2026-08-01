import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SolicitarResetDto {
  @IsEmail()
  @MaxLength(191)
  email: string;
}

export class ConfirmarResetDto {
  @IsString()
  @MinLength(1)
  token: string;

  @IsString()
  @MinLength(10)
  @MaxLength(72)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'La contraseña debe incluir al menos una letra y un número',
  })
  passwordNueva: string;
}
