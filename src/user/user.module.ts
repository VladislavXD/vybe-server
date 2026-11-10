import { Module } from '@nestjs/common';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js';
import { MinioModule } from '../minio/minio.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [MinioModule, PrismaModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
