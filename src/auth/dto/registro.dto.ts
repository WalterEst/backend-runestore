import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegistroDto {
  @IsEmail()
  @MaxLength(191)
  email: string;

  /** Mínimo 10 caracteres, al menos una letra y un número — evita passwords triviales sin ser excesivo */
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'La contraseña debe incluir al menos una letra y un número',
  })
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  apellido: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  /** Debe ser true: no se puede registrar sin aceptar términos y política de privacidad */
  @IsBoolean()
  aceptaTerminos: boolean;

  /** Checkbox separado, nunca condición para comprar — ver CLAUDE.md */
  @IsOptional()
  @IsBoolean()
  aceptaMarketing?: boolean;

  /** Token de Cloudflare Turnstile resuelto en el frontend */
  @IsString()
  turnstileToken: string;
}
