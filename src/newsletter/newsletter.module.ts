import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consentimiento } from '../database/entities/consentimiento.entity';
import { NewsletterCampana } from '../database/entities/newsletter-campana.entity';
import { NewsletterSuscriptor } from '../database/entities/newsletter-suscriptor.entity';
import { NewsletterAdminController } from './admin/newsletter-admin.controller';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NewsletterSuscriptor,
      NewsletterCampana,
      Consentimiento,
    ]),
  ],
  controllers: [NewsletterController, NewsletterAdminController],
  providers: [NewsletterService],
})
export class NewsletterModule {}
