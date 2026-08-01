import { IsIn } from 'class-validator';

const ROLES = ['cliente', 'admin', 'soporte', 'bodeguero'] as const;

export class CambiarRolDto {
  @IsIn(ROLES)
  rol: (typeof ROLES)[number];
}
