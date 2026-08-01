import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { JwtAuthOpcionalGuard } from '../auth/guards/jwt-auth-opcional.guard';
import type { JwtPayload } from '../auth/types';
import { IniciarPagoDto } from './dto/iniciar-pago.dto';
import { PagosService } from './pagos.service';

const NOMBRE_COOKIE_CARRITO = 'cart_session';

@Controller('pagos/webpay')
export class PagosController {
  constructor(
    private readonly pagosService: PagosService,
    private readonly config: ConfigService,
  ) {}

  @Post('ordenes/:ordenId/iniciar')
  @UseGuards(JwtAuthOpcionalGuard)
  iniciar(
    @Param('ordenId', ParseIntPipe) ordenId: number,
    @Body() dto: IniciarPagoDto,
    @Req() req: Request & { user?: JwtPayload },
  ) {
    const ctx = req.user
      ? { usuarioId: req.user.sub }
      : {
          sessionId: (req.cookies as Record<string, string> | undefined)?.[
            NOMBRE_COOKIE_CARRITO
          ],
        };
    return this.pagosService.iniciar(ordenId, ctx, dto.tokenConsulta);
  }

  /** returnUrl que Transbank invoca (POST) tras el pago con token_ws en el body */
  @Post('retorno')
  async retornoPost(
    @Body('token_ws') tokenWs: string | undefined,
    @Res() res: Response,
  ) {
    await this.redirigirSegunResultado(tokenWs, res);
  }

  /**
   * Si el cliente abandona/cancela ANTES de pagar, Transbank redirige por GET con
   * TBK_TOKEN (sin token_ws) — no hay nada que confirmar (commit fallaría). La
   * orden queda pendiente_pago y expira sola por el cron de la Fase 4.
   */
  @Get('retorno')
  async retornoGet(
    @Query('token_ws') tokenWs: string | undefined,
    @Res() res: Response,
  ) {
    await this.redirigirSegunResultado(tokenWs, res);
  }

  private async redirigirSegunResultado(
    tokenWs: string | undefined,
    res: Response,
  ): Promise<void> {
    const frontendOrigin = this.config.get<string>('frontendOrigin');

    if (!tokenWs) {
      res.redirect(`${frontendOrigin}/checkout/resultado?estado=abandonado`);
      return;
    }

    const resultado = await this.pagosService.confirmar(tokenWs);
    const estado = resultado.aprobado ? 'pagada' : 'rechazada';
    res.redirect(
      `${frontendOrigin}/checkout/resultado?orden=${resultado.numeroOrden}&estado=${estado}`,
    );
  }
}
