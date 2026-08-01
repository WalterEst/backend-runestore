import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Roles permitidos para el endpoint, ej: @Roles('admin', 'soporte') */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
