import { applyDecorators, UseGuards } from '@nestjs/common';
import { DjAuthGuard } from '../guards/dj-auth.guard.js';

/**
 * Декоратор для защиты эндпоинтов, предназначенных для авторизованных DJ.
 */
export function DjAuth() {
	return applyDecorators(UseGuards(DjAuthGuard));
}
