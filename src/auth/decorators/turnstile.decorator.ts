import { UseGuards, applyDecorators } from '@nestjs/common';
import { TurnstileGuard } from '../guards/turnstile.guard.js';

/**
 * Декоратор для защиты эндпоинта капчей Cloudflare Turnstile (заглушка / продакшн).
 * Заменяет устаревший @nestlab/google-recaptcha и устраняет ошибки ERR_REQUIRE_ESM на Vercel.
 */
export function Turnstile() {
  return applyDecorators(UseGuards(TurnstileGuard));
}

/**
 * Алиас для обратной совместимости с @Recaptcha()
 */
export const Recaptcha = Turnstile;
