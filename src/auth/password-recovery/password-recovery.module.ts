import { Module } from '@nestjs/common';

import { PasswordRecoveryController } from './password-recovery.controller.js';
import { PasswordRecoveryService } from './password-recovery.service.js';
import { UserModule } from '../../user/user.module.js';
import { MailModule } from '../../libs/mail/mail.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
	imports: [UserModule, MailModule, PrismaModule],
	controllers: [PasswordRecoveryController],
	providers: [PasswordRecoveryService]
})
export class PasswordRecoveryModule {}
