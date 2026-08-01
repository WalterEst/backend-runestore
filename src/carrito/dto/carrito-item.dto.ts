import { IsInt, Min } from 'class-validator';

export class AgregarItemDto {
  @IsInt()
  varianteId: number;

  @IsInt()
  @Min(1)
  cantidad: number;
}

export class ActualizarItemDto {
  @IsInt()
  @Min(0)
  cantidad: number;
}
