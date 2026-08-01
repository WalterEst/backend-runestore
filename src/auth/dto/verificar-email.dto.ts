import { IsString, MinLength } from 'class-validator';

export class VerificarEmailDto {
  @IsString()
  @MinLength(1)
  token: string;
}
