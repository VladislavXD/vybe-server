import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { QrcodeService } from './qrcode.service.js';

@Controller('q')
export class QRedirectController {
	constructor(private readonly qrcodeService: QrcodeService) {}

	/**
	 * Публичная точка входа для физических QR-кодов и NFC меток.
	 * URL вида: https://app.trackup.uz/q/:code или http://localhost:5000/q/:code
	 *
	 * Выполняет:
	 * 1. Поиск QR-кода и проверку активности
	 * 2. Инкремент счетчика сканирований и времени последнего сканирования
	 * 3. Мгновенный 302 HTTP редирект на экран гостя с соответствующим типом (music, food, review)
	 */
	@Get(':code')
	async handleQrRedirect(
		@Param('code') code: string,
		@Res() res: Response
	) {
		const { redirectUrl } = await this.qrcodeService.resolveByCode(code);
		return res.redirect(302, redirectUrl);
	}
}
