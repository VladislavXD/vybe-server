import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { UserService } from '../user/user.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { GoogleRecaptchaModule } from '@nestlab/google-recaptcha';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getRecaptchaConfig } from '../config/recaptcha.config.js';
import { ProviderModule } from './provider/provider.module.js';
import { getProvidersConfig } from '../config/providers.config.js';
import { EmailConfirmationModule } from './email-confirmation/email-confirmation.module.js';
import { MailService } from '../libs/mail/mail.service.js';
import { TwoFactorAuthService } from './two-factor-auth/two-factor-auth.service.js';
import { PasswordRecoveryModule } from './password-recovery/password-recovery.module.js';
import { JwtModule } from '@nestjs/jwt';
import { getJwtConfig } from '../config/jwt.config.js';
import { MinioModule } from '../minio/minio.module.js';
import { AUTH_SERVICE } from './auth.constants.js';
import { PhoneOtpService } from './phone/phone-otp.service.js';


@Module({
  imports: 
  [
    ProviderModule.registerAsync({
      imports: [ConfigModule],
      useFactory: getProvidersConfig,
      inject: [ConfigService]
    }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: getJwtConfig,
      inject: [ConfigService]
    }),

    PrismaModule, 
    MinioModule,
    GoogleRecaptchaModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getRecaptchaConfig,
      inject: [ConfigService]
    }),
    forwardRef(() => EmailConfirmationModule),
    PasswordRecoveryModule
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: AUTH_SERVICE, useExisting: AuthService },
    UserService,
    MailService,
    TwoFactorAuthService,
    PhoneOtpService
  ],
  exports: [AuthService, AUTH_SERVICE, JwtModule, PhoneOtpService]
})
export class AuthModule {}
