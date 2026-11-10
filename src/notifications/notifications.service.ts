import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  public async createNotification(data: {
    userId: string;
    type: string;
    issuerId?: string;
    message?: string;
  }): Promise<void> {
    // Базовая заглушка для создания уведомлений
  }
}
