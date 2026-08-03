import { IsUrl } from 'class-validator';

export class ActualizarAvatarDto {
  @IsUrl()
  url: string;
}
