import { forwardRef, Module } from '@nestjs/common';

import { MailModule } from '../../libs/mail/mail.module.js';
import { UserModule } from '../../user/user.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuthModule } from '../auth.module.js';

import { EmailConfirmationController } from './email-confirmation.controller.js';
import { EmailConfirmationService } from './email-confirmation.service.js';

@Module({
	imports: [MailModule, UserModule, PrismaModule, forwardRef(() => AuthModule)],
	controllers: [EmailConfirmationController],
	providers: [EmailConfirmationService],
	exports: [EmailConfirmationService]
})
export class EmailConfirmationModule {}
