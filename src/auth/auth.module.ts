import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consentimiento } from '../database/entities/consentimiento.entity';
import { Pagina } from '../database/entities/pagina.entity';
import { Rol } from '../database/entities/rol.entity';
import { TokenUsuario } from '../database/entities/token-usuario.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { EmailService } from '../common/email/email.service';
import { TurnstileService } from '../common/turnstile/turnstile.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      Usuario,
      Rol,
      TokenUsuario,
      Consentimiento,
      Pagina,
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, TurnstileService, EmailService],
  exports: [JwtStrategy, PassportModule],
})
export class AuthModule {}
