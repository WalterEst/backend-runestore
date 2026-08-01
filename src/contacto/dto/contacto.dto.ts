import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class EnviarContactoDto {
  @IsString()
  @MaxLength(120)
  nombre: string;

  @IsEmail()
  @MaxLength(191)
  email: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  mensaje: string;

  @IsString()
  turnstileToken: string;
}
