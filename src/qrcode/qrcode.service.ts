import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, QrCodeType, UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service.js';
import { VenuesService } from '../venues/venues.service.js';
import { BatchCreateQrcodeDto } from './dto/batch-create-qrcode.dto.js';
import { CreateQrcodeDto } from './dto/create-qrcode.dto.js';
import { UpdateQrcodeDto } from './dto/update-qrcode.dto.js';
import {
	extractTableNumber,
	normalizeQrCodeType,
	QrServiceType,
	toServiceType
} from './types/qrcode.types.js';

export interface QrFilterOptions {
	type?: QrCodeType | string | null;
	isActive?: boolean;
	search?: string;
}

@Injectable()
export class QrcodeService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly configService: ConfigService,
		private readonly venuesService: VenuesService
	) {}

	// =========================================================================
	// ПУБЛИЧНЫЙ РЕЗОЛВ И СКАНИРОВАНИЕ (ГОСТЕВОЙ ПУТЬ)
	// =========================================================================

	/**
	 * Резолвит QR-код по короткому nanoid-коду.
	 * Инкрементирует счетчик сканирований `scanCount` и проставляет `lastScannedAt`.
	 * Формирует целевой redirectUrl на страницу гостя в зависимости от QrCodeType (MUSIC, FOOD, REVIEWS).
	 */
	async resolveByCode(code: string) {
		const qrCode = await this.prisma.qrCode.findUnique({
			where: { code },
			include: {
				venue: {
					select: {
						id: true,
						name: true,
						slug: true,
						logoUrl: true,
						address: true,
						city: true
					}
				}
			}
		});

		if (!qrCode) {
			throw new NotFoundException(`QR-код с кодом "${code}" не найден.`);
		}

		const clientOrigin = this.getClientBaseUrl();
		const serviceType: QrServiceType = toServiceType(qrCode.type);
		const tableNumber = extractTableNumber(qrCode.tableLabel);

		// Если QR-код временно деактивирован заведением — перенаправляем на красивый экран выключенного столика
		if (!qrCode.isActive) {
			const venueName = qrCode.venue?.name || '';
			const redirectUrl = `${clientOrigin}/g/${qrCode.id}?status=disabled&type=${serviceType}&venue=${encodeURIComponent(venueName)}&table=${encodeURIComponent(qrCode.tableLabel)}&code=${qrCode.code}`;

			return {
				redirectUrl,
				serviceType,
				isActive: false,
				qrCode: {
					id: qrCode.id,
					code: qrCode.code,
					tableLabel: qrCode.tableLabel,
					tableNumber,
					type: qrCode.type,
					serviceType,
					zoneId: qrCode.zoneId,
					source: qrCode.source,
					scanCount: qrCode.scanCount,
					lastScannedAt: qrCode.lastScannedAt,
					isActive: false
				},
				venue: qrCode.venue,
				message: 'Данный QR-код временно деактивирован заведением.'
			};
		}

		// Асинхронно обновляем аналитику сканирования (scanCount, lastScannedAt)
		await this.prisma.qrCode.update({
			where: { id: qrCode.id },
			data: {
				scanCount: { increment: 1 },
				lastScannedAt: new Date()
			}
		});

		// Формируем редирект на гостевую страницу: /g/[id]?type=music|food|review
		const redirectUrl = `${clientOrigin}/g/${qrCode.id}?type=${serviceType}&venue=${encodeURIComponent(qrCode.venue?.name || '')}&table=${encodeURIComponent(qrCode.tableLabel)}&code=${qrCode.code}`;

		return {
			redirectUrl,
			serviceType,
			qrCode: {
				id: qrCode.id,
				code: qrCode.code,
				tableLabel: qrCode.tableLabel,
				tableNumber,
				type: qrCode.type,
				serviceType,
				zoneId: qrCode.zoneId,
				source: qrCode.source,
				scanCount: qrCode.scanCount + 1,
				lastScannedAt: new Date()
			},
			venue: qrCode.venue
		};
	}

	// =========================================================================
	// УПРАВЛЕНИЕ QR-КОДАМИ (VENUE OWNER / ADMIN)
	// =========================================================================

	/**
	 * Вспомогательный метод: определяет и валидирует заведение владельца.
	 * Если venueId не передан — автоматически берет или создает заведение пользователя.
	 */
	public async resolveVenueId(
		userId: string,
		userRole: UserRole,
		providedVenueId?: string | null
	): Promise<string> { 
		if (providedVenueId && providedVenueId.trim()) {
			const cleanId = providedVenueId.trim();
			await this.venuesService.checkVenueOwnership(userId, userRole, cleanId);
			return cleanId;
		}

		const defaultVenue = await this.venuesService.getOrCreateDefaultVenue(userId);
		return defaultVenue.id;
	}

	/**
	 * Создать одиночный QR-код для заведения.
	 * Если venueId не указан — автоматически привязывается к заведению текущего владельца.
	 */
	async create(userId: string, userRole: UserRole, dto: CreateQrcodeDto) {
		const targetVenueId: string = await this.resolveVenueId(userId, userRole, dto.venueId);

		let code = dto.customCode?.trim();
		if (code) {
			const existing = await this.prisma.qrCode.findUnique({ where: { code } });
			if (existing) {
				throw new BadRequestException(`QR-код "${code}" уже занят в системе.`);
			}
		} else {
			code = await this.generateUniqueCode();
		}

		const resolvedType = normalizeQrCodeType(dto.type) ?? QrCodeType.MUSIC;

		const createData: Prisma.QrCodeUncheckedCreateInput = {
			code,
			tableLabel: dto.tableLabel.trim(),
			type: resolvedType,
			zoneId: dto.zoneId?.trim() || null,
			source: dto.source?.trim() || 'table_tent',
			venueId: targetVenueId
		};

		const qrCode = await this.prisma.qrCode.create({
			data: createData,
			include: {
				venue: {
					select: {
						id: true,
						name: true,
						slug: true
					}
				}
			}
		});

		const scanUrl = this.getScanUrl(qrCode.code);
		const dataUrl = await this.generateDataUrl(scanUrl);
		const serviceType = toServiceType(qrCode.type);
		const tableNumber = extractTableNumber(qrCode.tableLabel);

		return {
			...qrCode,
			tableNumber,
			serviceType,
			scanUrl,
			dataUrl
		};
	}

	/**
	 * Пакетное создание диапазона QR-кодов для заведения (например, Столы с 1 по 25).
	 * Если venueId не указан — автоматически привязывается к заведению текущего владельца.
	 */
	async batchCreate(userId: string, userRole: UserRole, dto: BatchCreateQrcodeDto) {
		const targetVenueId: string = await this.resolveVenueId(userId, userRole, dto.venueId);

		if (dto.startTable > dto.endTable) {
			throw new BadRequestException('Начальный номер стола не может быть больше конечного.');
		}

		const totalToCreate = dto.endTable - dto.startTable + 1;
		if (totalToCreate > 150) {
			throw new BadRequestException('За один запрос можно сгенерировать не более 150 QR-кодов.');
		}

		const prefix = dto.tablePrefix ?? 'Стол ';
		const resolvedType = normalizeQrCodeType(dto.type) ?? QrCodeType.MUSIC;
		const createdList = [];

		for (let i = dto.startTable; i <= dto.endTable; i++) {
			const code = await this.generateUniqueCode();
			const tableLabel = `${prefix}${i}`;

			const itemData: Prisma.QrCodeUncheckedCreateInput = {
				code,
				tableLabel,
				type: resolvedType,
				zoneId: dto.zoneId?.trim() || null,
				source: dto.source?.trim() || 'table_tent',
				venueId: targetVenueId
			};

			const created = await this.prisma.qrCode.create({
				data: itemData
			});

			createdList.push({
				id: created.id,
				code: created.code,
				tableLabel: created.tableLabel,
				tableNumber: i,
				type: created.type,
				serviceType: toServiceType(created.type),
				scanUrl: this.getScanUrl(created.code)
			});
		}

		return {
			message: `Успешно создано ${createdList.length} QR-кодов.`,
			count: createdList.length,
			items: createdList
		};
	}

	/**
	 * Получить все QR-коды заведения с фильтрацией и поиском.
	 */
	async findAllByVenue(
		userId: string,
		userRole: UserRole,
		venueId?: string | null,
		filters?: QrFilterOptions
	) {
		const targetVenueId = await this.resolveVenueId(
			userId,
			userRole,
			!venueId || venueId === 'my' ? undefined : venueId
		);

		const where: Prisma.QrCodeWhereInput = { venueId: targetVenueId };

		if (filters?.type) {
			const normalized = normalizeQrCodeType(filters.type);
			if (normalized) {
				where.type = normalized;
			}
		}

		if (typeof filters?.isActive === 'boolean') {
			where.isActive = filters.isActive;
		}

		if (filters?.search && filters.search.trim()) {
			const q = filters.search.trim();
			where.OR = [
				{ tableLabel: { contains: q, mode: 'insensitive' } },
				{ code: { contains: q, mode: 'insensitive' } },
				{ source: { contains: q, mode: 'insensitive' } }
			];
		}

		const items = await this.prisma.qrCode.findMany({
			where,
			orderBy: [{ createdAt: 'desc' }],
			include: {
				_count: {
					select: { orders: true }
				}
			}
		});

		return items.map((item) => ({
			...item,
			tableNumber: extractTableNumber(item.tableLabel),
			serviceType: toServiceType(item.type),
			scanUrl: this.getScanUrl(item.code)
		}));
	}

	/**
	 * Получить детальную информацию по одному QR-коду.
	 */
	async findById(userId: string, userRole: UserRole, id: string) {
		const qrCode = await this.prisma.qrCode.findUnique({
			where: { id },
			include: {
				venue: {
					select: {
						id: true,
						name: true,
						slug: true,
						ownerId: true
					}
				},
				_count: {
					select: { orders: true }
				}
			}
		});

		if (!qrCode) {
			throw new NotFoundException(`QR-код с ID "${id}" не найден.`);
		}

		await this.checkVenueOwnership(userId, userRole, qrCode.venueId);

		const scanUrl = this.getScanUrl(qrCode.code);
		const dataUrl = await this.generateDataUrl(scanUrl);

		return {
			...qrCode,
			tableNumber: extractTableNumber(qrCode.tableLabel),
			serviceType: toServiceType(qrCode.type),
			scanUrl,
			dataUrl
		};
	}

	/**
	 * Обновить QR-код (метку стола, назначение MUSIC/FOOD/REVIEWS, статус активности, зону).
	 * Позволяет мгновенно менять назначение стола без перепечатки физического QR!
	 */
	async update(
		userId: string,
		userRole: UserRole,
		id: string,
		dto: UpdateQrcodeDto
	) {
		const existing = await this.prisma.qrCode.findUnique({
			where: { id },
			select: { id: true, venueId: true }
		});

		if (!existing) {
			throw new NotFoundException(`QR-код с ID "${id}" не найден.`);
		}

		await this.checkVenueOwnership(userId, userRole, existing.venueId);

		const resolvedType = dto.type ? normalizeQrCodeType(dto.type) : undefined;

		const updated = await this.prisma.qrCode.update({
			where: { id },
			data: {
				...(dto.tableLabel !== undefined && { tableLabel: dto.tableLabel.trim() }),
				...(resolvedType !== undefined && { type: resolvedType }),
				...(dto.zoneId !== undefined && { zoneId: dto.zoneId ? dto.zoneId.trim() : null }),
				...(dto.source !== undefined && { source: dto.source ? dto.source.trim() : null }),
				...(dto.isActive !== undefined && { isActive: dto.isActive })
			}
		});

		return {
			...updated,
			tableNumber: extractTableNumber(updated.tableLabel),
			serviceType: toServiceType(updated.type),
			scanUrl: this.getScanUrl(updated.code)
		};
	}

	/**
	 * Удалить или деактивировать QR-код.
	 * Если к QR уже привязаны заказы, выполняется мягкая деактивация, сохраняя целостность истории заказов.
	 */
	async delete(userId: string, userRole: UserRole, id: string) {
		const qrCode = await this.prisma.qrCode.findUnique({
			where: { id },
			include: {
				_count: {
					select: { orders: true }
				}
			}
		});

		if (!qrCode) {
			throw new NotFoundException(`QR-код с ID "${id}" не найден.`);
		}

		await this.checkVenueOwnership(userId, userRole, qrCode.venueId);

		if (qrCode._count.orders > 0) {
			const deactivated = await this.prisma.qrCode.update({
				where: { id },
				data: { isActive: false }
			});
			return {
				message: 'QR-код имеет привязанные заказы и был безопасно деактивирован.',
				deactivated: true,
				item: {
					...deactivated,
					tableNumber: extractTableNumber(deactivated.tableLabel),
					serviceType: toServiceType(deactivated.type),
					scanUrl: this.getScanUrl(deactivated.code)
				}
			};
		}

		await this.prisma.qrCode.delete({ where: { id } });

		return {
			message: 'QR-код успешно удален.',
			deleted: true,
			id
		};
	}

	// =========================================================================
	// ГЕНЕРАЦИЯ ГРАФИЧЕСКИХ QR-КОДОВ (PNG, SVG, DATA-URL)
	// =========================================================================

	/**
	 * Сгенерировать Base64 Data URL для вставки в `<img src="...">`.
	 */
	async generateDataUrl(text: string): Promise<string> {
		return QRCode.toDataURL(text, {
			errorCorrectionLevel: 'H',
			margin: 2,
			width: 512,
			color: {
				dark: '#0C0B0F',
				light: '#FFFFFF'
			}
		});
	}

	/**
	 * Сгенерировать PNG Buffer для прямой отдачи файла или скачивания.
	 */
	async generatePngBuffer(text: string, width = 512): Promise<Buffer> {
		return QRCode.toBuffer(text, {
			type: 'png',
			errorCorrectionLevel: 'H',
			margin: 2,
			width,
			color: {
				dark: '#0C0B0F',
				light: '#FFFFFF'
			}
		});
	}

	/**
	 * Сгенерировать векторный SVG QR-кода (для печати в полиграфии).
	 */
	async generateSvg(text: string): Promise<string> {
		return QRCode.toString(text, {
			type: 'svg',
			errorCorrectionLevel: 'H',
			margin: 2,
			color: {
				dark: '#0C0B0F',
				light: '#FFFFFF'
			}
		});
	}

	/**
	 * Полный URL редиректа по коду: https://app.trackup.uz/q/<code>
	 */
	getScanUrl(code: string): string {
		const base =
			this.configService.get<string>('SHORT_URL_BASE') ||
			this.configService.get<string>('SERVER_URL') ||
			'http://localhost:5000';
		return `${base.replace(/\/$/, '')}/q/${code}`;
	}

	/**
	 * Базовый URL клиентского приложения (SPA / PWA).
	 */
	getClientBaseUrl(): string {
		return (
			this.configService.get<string>('ALLOWED_ORIGIN') ||
			this.configService.get<string>('CLIENT_URL') ||
			'http://localhost:3000'
		);
	}

	/**
	 * Генерация криптографически стойкого случайного nanoid-кода (8 символов).
	 */
	private async generateUniqueCode(length = 8): Promise<string> {
		const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
		let attempts = 0;

		while (attempts < 10) {
			const bytes = randomBytes(length);
			let code = '';
			for (let i = 0; i < length; i++) {
				code += alphabet[bytes[i] % alphabet.length];
			}

			const existing = await this.prisma.qrCode.findUnique({
				where: { code }
			});

			if (!existing) {
				return code;
			}
			attempts++;
		}

		throw new BadRequestException('Не удалось сгенерировать уникальный QR-код. Повторите попытку.');
	}

	/**
	 * Проверка прав владения заведением.
	 */
	public async checkVenueOwnership(
		userId: string,
		userRole: UserRole,
		venueId?: string | null
	) {
		if (userRole === UserRole.ADMIN) {
			return true;
		}

		if (!venueId || !venueId.trim()) {
			throw new BadRequestException('ID заведения не указан.');
		}

		const venue = await this.prisma.venue.findFirst({
			where: {
				id: venueId.trim(),
				ownerId: userId
			}
		});

		if (!venue) {
			throw new ForbiddenException(
				'У вас нет доступа к управлению этим заведением.'
			);
		}

		return true;
	}
}
