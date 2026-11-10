import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { getJwtConfig } from '../config/jwt.config.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UserModule } from '../user/user.module.js';
import { DjsController } from './djs.controller.js';
import { DjsService } from './djs.service.js';
import { DjAuthGuard } from './guards/dj-auth.guard.js';

@Module({
	imports: [
		PrismaModule,
		UserModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: getJwtConfig,
			inject: [ConfigService]
		})
	],
	controllers: [DjsController],
	providers: [DjsService, DjAuthGuard],
	exports: [DjsService, DjAuthGuard]
})
export class DjsModule {}
