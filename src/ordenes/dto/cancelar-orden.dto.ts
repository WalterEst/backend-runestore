import { IsString, MaxLength, MinLength } from 'class-validator';

export class CancelarOrdenDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  motivo: string;
}
