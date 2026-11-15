import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { getJwtConfig } from '../config/jwt.config.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UserModule } from '../user/user.module.js';
import { VenuesModule } from '../venues/venues.module.js';
import { QRedirectController } from './q-redirect.controller.js';
import { QrcodeController } from './qrcode.controller.js';
import { QrcodeService } from './qrcode.service.js';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    VenuesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: getJwtConfig,
      inject: [ConfigService],
    }),
  ],
  controllers: [QrcodeController, QRedirectController],
  providers: [QrcodeService],
  exports: [QrcodeService],
})
export class QrcodeModule {}
