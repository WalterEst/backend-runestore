import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CrearPaginaDto {
  @IsString()
  @MaxLength(60)
  slug: string;

  @IsString()
  @MaxLength(120)
  titulo: string;

  @IsString()
  contenido: string;
}

export class ActualizarPaginaDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  titulo?: string;

  @IsOptional()
  @IsString()
  contenido?: string;

  @IsOptional()
  @IsBoolean()
  publicada?: boolean;

  /**
   * Si es true, sube `version` (dispara re-aceptación de consentimiento en el
   * próximo login/compra — ver Ley 21.719, CLAUDE.md). Si es false, edita el
   * contenido de la versión vigente sin exigir que el usuario vuelva a aceptar
   * (para correcciones menores de redacción).
   */
  @IsOptional()
  @IsBoolean()
  nuevaVersion?: boolean;
}
