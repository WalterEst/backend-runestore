import { IsOptional, IsString } from 'class-validator';

export class IniciarPagoDto {
  /** Requerido solo para invitados: prueba de propiedad de la orden (ver ordenes.token_consulta) */
  @IsOptional()
  @IsString()
  tokenConsulta?: string;
}
