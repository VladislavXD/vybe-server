import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException
} from '@nestjs/common';
import { UserRole, VenueStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateVenueDto } from './dto/create-venue.dto.js';
import { UpdateVenueDto } from './dto/update-venue.dto.js';

@Injectable()
export class VenuesService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Создать новое заведение владельцем.
	 */
	async create(userId: string, dto: CreateVenueDto) {
		const slug = dto.slug ? this.slugify(dto.slug) : await this.generateUniqueSlug(dto.name);

		const existing = await this.prisma.venue.findUnique({ where: { slug } });
		if (existing) {
			throw new ConflictException(`Заведение с адресом "${slug}" уже существует.`);
		}

		const venue = await this.prisma.venue.create({
			data: {
				name: dto.name.trim(),
				slug,
				description: dto.description?.trim() || null,
				address: dto.address?.trim() || null,
				city: dto.city?.trim() || 'Tashkent',
				logoUrl: dto.logoUrl || null,
				coverUrl: dto.coverUrl || null,
				commissionPercent: dto.commissionPercent ?? 15,
				baseTrackPrice: dto.baseTrackPrice ?? 30000,
				prioritySurcharge: dto.prioritySurcharge ?? 20000,
				orderTimeoutMin: dto.orderTimeoutMin ?? 3,
				maxQueueLimit: dto.maxQueueLimit ?? 20,
				legalName: dto.legalName?.trim() || null,
				inn: dto.inn?.trim() || null,
				bankAccount: dto.bankAccount?.trim() || null,
				mfo: dto.mfo?.trim() || null,
				ownerId: userId,
				status: VenueStatus.ACTIVE // В MVP/пилоте сразу активно для быстрого старта
			}
		});

		return venue;
	}

	/**
	 * Получить все заведения текущего пользователя-владельца.
	 */
	async getMyVenues(userId: string) {
		return this.prisma.venue.findMany({
			where: { ownerId: userId },
			include: {
				_count: {
					select: {
						qrCodes: true,
						orders: true,
						shifts: true
					}
				},
				shifts: {
					where: { isActive: true },
					take: 1
				}
			},
			orderBy: { createdAt: 'desc' }
		});
	}

	/**
	 * Получить или автоматически создать базовое заведение для владельца.
	 * Это гарантирует, что пользователь может сразу создавать столы и QR без сложных шагов.
	 */
	async getOrCreateDefaultVenue(userId: string) {
		const existing = await this.prisma.venue.findFirst({
			where: { ownerId: userId },
			include: {
				_count: {
					select: { qrCodes: true, orders: true }
				}
			}
		});

		if (existing) {
			return existing;
		}

		// Получаем имя владельца
		const user = await this.prisma.user.findUnique({ where: { id: userId } });
		const venueName = user?.name ? `Заведение ${user.name}` : 'Мое заведение';
		const slug = await this.generateUniqueSlug(venueName);

		return this.prisma.venue.create({
			data: {
				name: venueName,
				slug,
				city: 'Tashkent',
				ownerId: userId,
				status: VenueStatus.ACTIVE,
				commissionPercent: 15,
				baseTrackPrice: 30000,
				prioritySurcharge: 20000,
				orderTimeoutMin: 3,
				maxQueueLimit: 20
			},
			include: {
				_count: {
					select: { qrCodes: true, orders: true }
				}
			}
		});
	}

	/**
	 * Получить заведение по ID.
	 */
	async findById(id: string) {
		const venue = await this.prisma.venue.findUnique({
			where: { id },
			include: {
				owner: {
					select: { id: true, name: true, email: true, phone: true }
				},
				_count: {
					select: { qrCodes: true, orders: true, shifts: true }
				}
			}
		});

		if (!venue) {
			throw new NotFoundException(`Заведение с ID "${id}" не найдено.`);
		}

		return venue;
	}

	/**
	 * Публичный просмотр страницы заведения по slug (для гостей).
	 */
	async findBySlug(slug: string) {
		const venue = await this.prisma.venue.findUnique({
			where: { slug },
			select: {
				id: true,
				name: true,
				slug: true,
				description: true,
				address: true,
				city: true,
				logoUrl: true,
				coverUrl: true,
				status: true,
				baseTrackPrice: true,
				prioritySurcharge: true,
				isAcceptingOrders: true,
				orderTimeoutMin: true,
				maxQueueLimit: true,
				shifts: {
					where: { isActive: true },
					select: {
						id: true,
						djName: true,
						startedAt: true
					},
					take: 1
				}
			}
		});

		if (!venue) {
			throw new NotFoundException(`Заведение "${slug}" не найдено.`);
		}

		return venue;
	}

	/**
	 * Обновить настройки заведения.
	 */
	async update(
		userId: string,
		userRole: UserRole,
		id: string,
		dto: UpdateVenueDto
	) {
		await this.checkVenueOwnership(userId, userRole, id);

		if (dto.slug) {
			const cleanSlug = this.slugify(dto.slug);
			const conflicting = await this.prisma.venue.findFirst({
				where: { slug: cleanSlug, NOT: { id } }
			});
			if (conflicting) {
				throw new ConflictException(`Адрес "${cleanSlug}" уже занят другим заведением.`);
			}
			dto.slug = cleanSlug;
		}

		return this.prisma.venue.update({
			where: { id },
			data: {
				...(dto.name !== undefined && { name: dto.name.trim() }),
				...(dto.slug !== undefined && { slug: dto.slug }),
				...(dto.description !== undefined && { description: dto.description?.trim() || null }),
				...(dto.address !== undefined && { address: dto.address?.trim() || null }),
				...(dto.city !== undefined && { city: dto.city.trim() }),
				...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl || null }),
				...(dto.coverUrl !== undefined && { coverUrl: dto.coverUrl || null }),
				...(dto.status !== undefined && { status: dto.status }),
				...(dto.commissionPercent !== undefined && { commissionPercent: dto.commissionPercent }),
				...(dto.baseTrackPrice !== undefined && { baseTrackPrice: dto.baseTrackPrice }),
				...(dto.prioritySurcharge !== undefined && { prioritySurcharge: dto.prioritySurcharge }),
				...(dto.isAcceptingOrders !== undefined && { isAcceptingOrders: dto.isAcceptingOrders }),
				...(dto.orderTimeoutMin !== undefined && { orderTimeoutMin: dto.orderTimeoutMin }),
				...(dto.maxQueueLimit !== undefined && { maxQueueLimit: dto.maxQueueLimit }),
				...(dto.legalName !== undefined && { legalName: dto.legalName?.trim() || null }),
				...(dto.inn !== undefined && { inn: dto.inn?.trim() || null }),
				...(dto.bankAccount !== undefined && { bankAccount: dto.bankAccount?.trim() || null }),
				...(dto.mfo !== undefined && { mfo: dto.mfo?.trim() || null })
			}
		});
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
			throw new ForbiddenException('У вас нет доступа к управлению этим заведением.');
		}

		return true;
	}

	/**
	 * Преобразование текста в URL slug.
	 */
	private slugify(text: string): string {
		return text
			.toString()
			.toLowerCase()
			.trim()
			.replace(/\s+/g, '-')
			.replace(/[^\w\-]+/g, '')
			.replace(/\-\-+/g, '-')
			.replace(/^-+/, '')
			.replace(/-+$/, '');
	}

	/**
	 * Генерация уникального slug для заведения.
	 */
	private async generateUniqueSlug(name: string): Promise<string> {
		let base = this.slugify(name);
		if (!base || base.length < 2) {
			base = 'venue';
		}

		const existing = await this.prisma.venue.findUnique({ where: { slug: base } });
		if (!existing) {
			return base;
		}

		// Добавляем короткий суффикс
		const suffix = randomBytes(2).toString('hex');
		return `${base}-${suffix}`;
	}
}
