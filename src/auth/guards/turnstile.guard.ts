import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Защитный Guard для проверки капчи Cloudflare Turnstile.
 * В текущем режиме работает как безопасная заглушка (pass-through).
 * Если в .env задан CF_TURNSTILE_SECRET_KEY, автоматически валидирует токен через API Cloudflare.
 */
@Injectable()
export class TurnstileGuard implements CanActivate {
  private readonly logger = new Logger(TurnstileGuard.name);

  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const secretKey =
      this.configService.get<string>('CF_TURNSTILE_SECRET_KEY') ||
      process.env.CF_TURNSTILE_SECRET_KEY;

    const isEnabled =
      this.configService.get<string>('CF_TURNSTILE_ENABLED') === 'true' ||
      Boolean(secretKey);

    // Если капча отключена или секретный ключ не задан — пропускаем запрос (режим заглушки)
    if (!isEnabled || !secretKey) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const token =
      (req.headers['cf-turnstile-response'] as string) ||
      (req.headers['turnstile'] as string) ||
      (req.headers['recaptcha'] as string) ||
      req.body?.turnstile ||
      req.body?.['cf-turnstile-response'] ||
      req.body?.recaptcha;

    if (!token) {
      throw new BadRequestException('Капча Cloudflare Turnstile обязательна для заполнения.');
    }

    try {
      const clientIp =
        (req.headers['cf-connecting-ip'] as string) ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        req.ip;

      const formData = new URLSearchParams();
      formData.append('secret', secretKey);
      formData.append('response', token);
      if (clientIp) {
        formData.append('remoteip', clientIp);
      }

      const verifyRes = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          body: formData,
        }
      );

      const outcome = (await verifyRes.json()) as { success?: boolean; 'error-codes'?: string[] };

      if (!outcome.success) {
        this.logger.warn(`Cloudflare Turnstile verification failed: ${outcome['error-codes']?.join(', ')}`);
        throw new BadRequestException('Проверка капчи не пройдена. Повторите попытку.');
      }

      return true;
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      this.logger.error(`Error verifying Cloudflare Turnstile: ${err instanceof Error ? err.message : err}`);
      // В случае сбоя сети Cloudflare не блокируем легитимных пользователей
      return true;
    }
  }
}
