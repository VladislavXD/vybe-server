import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Query,
	Res
} from '@nestjs/common';
import { QrCodeType, UserRole } from '@prisma/client';
import type { Response } from 'express';
import { Authorization } from '../auth/decorators/auth.decorator.js';
import { Authorized } from '../auth/decorators/authorized.decorator.js';
import { BatchCreateQrcodeDto } from './dto/batch-create-qrcode.dto.js';
import { CreateQrcodeDto } from './dto/create-qrcode.dto.js';
import { UpdateQrcodeDto } from './dto/update-qrcode.dto.js';
import { QrcodeService } from './qrcode.service.js';
import { normalizeQrCodeType } from './types/qrcode.types.js';

@Controller('qrcode')
export class QrcodeController {
	constructor(private readonly qrcodeService: QrcodeService) {}

	// =========================================================================
	// ПУБЛИЧНЫЙ ЭНДПОИНТ (ДЛЯ КЛИЕНТА / ПРИЛОЖЕНИЯ)
	// =========================================================================

	/**
	 * Получить данные QR-кода и целевой redirectUrl в формате JSON.
	 * Инкрементирует счетчик сканирований.
	 */
	@Get('resolve/:code')
	async resolveCode(@Param('code') code: string) {
		return this.qrcodeService.resolveByCode(code);
	}

	// =========================================================================
	// УПРАВЛЕНИЕ QR-КОДАМИ ЗАВЕДЕНИЯ (VENUE OWNER / ADMIN)
	// =========================================================================

	/**
	 * Создать один QR-код для заведения.
	 */
	@Authorization(UserRole.VENUE_OWNER, UserRole.ADMIN)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	async create(
		@Authorized('id') userId: string,
		@Authorized('role') userRole: UserRole,
		@Body() dto: CreateQrcodeDto
	) {
		return this.qrcodeService.create(userId, userRole, dto);
	}

	/**
	 * Пакетное создание QR-кодов столов для заведения (например, Столы 1..30).
	 */
	@Authorization(UserRole.VENUE_OWNER, UserRole.ADMIN)
	@HttpCode(HttpStatus.CREATED)
	@Post('batch')
	async batchCreate(
		@Authorized('id') userId: string,
		@Authorized('role') userRole: UserRole,
		@Body() dto: BatchCreateQrcodeDto
	) {
		return this.qrcodeService.batchCreate(userId, userRole, dto);
	}

	/**
	 * Получить все QR-коды конкретного заведения с фильтрацией.
	 */
	@Authorization(UserRole.VENUE_OWNER, UserRole.ADMIN)
	@Get('venue/:venueId')
	async findAllByVenue(
		@Authorized('id') userId: string,
		@Authorized('role') userRole: UserRole,
		@Param('venueId') venueId: string,
		@Query('type') type?: string,
		@Query('isActive') isActive?: string,
		@Query('search') search?: string
	) {
		const parsedActive =
			isActive === 'true' ? true : isActive === 'false' ? false : undefined;

		return this.qrcodeService.findAllByVenue(userId, userRole, venueId, {
			type: normalizeQrCodeType(type),
			isActive: parsedActive,
			search
		});
	}

	/**
	 * Получить все QR-коды текущего заведения владельца (без необходимости знать venueId).
	 */
	@Authorization(UserRole.VENUE_OWNER, UserRole.ADMIN)
	@Get('my')
	async findMy(
		@Authorized('id') userId: string,
		@Authorized('role') userRole: UserRole,
		@Query('type') type?: string,
		@Query('isActive') isActive?: string,
		@Query('search') search?: string
	) {
		const parsedActive =
			isActive === 'true' ? true : isActive === 'false' ? false : undefined;

		return this.qrcodeService.findAllByVenue(userId, userRole, 'my', {
			type: normalizeQrCodeType(type),
			isActive: parsedActive,
			search
		});
	}

	/**
	 * Получить быстрый Base64 Data URL предпросмотра QR-кода.
	 */
	@Authorization(UserRole.VENUE_OWNER, UserRole.ADMIN)
	@Get(':id/preview')
	async getPreview(
		@Authorized('id') userId: string,
		@Authorized('role') userRole: UserRole,
		@Param('id') id: string
	) {
		return this.qrcodeService.findById(userId, userRole, id);
	}

	/**
	 * Сгенерировать и отдать графическое изображение QR-кода (PNG / SVG).
	 * Поддерживает скачивание как файл (?download=true).
	 */
	@Authorization(UserRole.VENUE_OWNER, UserRole.ADMIN)
	@Get(':id/image')
	async getImage(
		@Authorized('id') userId: string,
		@Authorized('role') userRole: UserRole,
		@Param('id') id: string,
		@Query('format') format: 'png' | 'svg' = 'png',
		@Query('size') size?: string,
		@Query('download') download?: string,
		@Res() res?: Response
	) {
		const qr = await this.qrcodeService.findById(userId, userRole, id);
		const filename = `qrcode-${qr.code}-${qr.tableLabel.replace(/\s+/g, '_')}.${format}`;

		if (format === 'svg') {
			const svgContent = await this.qrcodeService.generateSvg(qr.scanUrl);
			res?.setHeader('Content-Type', 'image/svg+xml');
			if (download === 'true') {
				res?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
			}
			return res?.send(svgContent);
		}

		// PNG по умолчанию
		const imageSize = size ? Math.min(Math.max(parseInt(size, 10), 100), 2000) : 600;
		const buffer = await this.qrcodeService.generatePngBuffer(qr.scanUrl, imageSize);

		res?.setHeader('Content-Type', 'image/png');
		if (download === 'true') {
			res?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
		}
		return res?.send(buffer);
	}

	/**
	 * Получить детальную информацию об одном QR-коде.
	 */
	@Authorization(UserRole.VENUE_OWNER, UserRole.ADMIN)
	@Get(':id')
	async findById(
		@Authorized('id') userId: string,
		@Authorized('role') userRole: UserRole,
		@Param('id') id: string
	) {
		return this.qrcodeService.findById(userId, userRole, id);
	}

	/**
	 * Обновить параметры QR-кода (название стола, назначение MUSIC/FOOD/REVIEWS, статус).
	 */
	@Authorization(UserRole.VENUE_OWNER, UserRole.ADMIN)
	@Patch(':id')
	async update(
		@Authorized('id') userId: string,
		@Authorized('role') userRole: UserRole,
		@Param('id') id: string,
		@Body() dto: UpdateQrcodeDto
	) {
		return this.qrcodeService.update(userId, userRole, id, dto);
	}

	/**
	 * Деактивировать или удалить QR-код.
	 */
	@Authorization(UserRole.VENUE_OWNER, UserRole.ADMIN)
	@Delete(':id')
	async delete(
		@Authorized('id') userId: string,
		@Authorized('role') userRole: UserRole,
		@Param('id') id: string
	) {
		return this.qrcodeService.delete(userId, userRole, id);
	}
}
