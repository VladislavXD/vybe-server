import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { UserModule } from './user/user.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { DjsModule } from './djs/djs.module.js';
import { TracksModule } from './tracks/tracks.module.js';
import { MinioModule } from './minio/minio.module.js';
import { RedisModule } from './redis/redis.module.js';
import { QrcodeModule } from './qrcode/qrcode.module.js';
import { VenuesModule } from './venues/venues.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MinioModule,
    AuthModule,
    UserModule,
    PaymentsModule,
    NotificationsModule,
    OrdersModule,
    DjsModule,
    TracksModule,
    RedisModule,
    VenuesModule,
    QrcodeModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
