import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OrderStatus, UserRole } from '@prisma/client';
import { hash, verify } from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';
import { AttachDjDto } from './dto/attach-dj.dto.js';
import { CreateDjDto } from './dto/create-dj.dto.js';
import { LoginDjDto } from './dto/login-dj.dto.js';
import { StartShiftDto } from './dto/start-shift.dto.js';
import { TelegramLoginDjDto } from './dto/telegram-login-dj.dto.js';
import { UpdateDjDto } from './dto/update-dj.dto.js';

// Селектор полей DJ без конфиденциального pinCodeHash
const djSafeSelect = {
	id: true,
	name: true,
	realName: true,
	phone: true,
	telegramId: true,
	avatarUrl: true,
	isActive: true,
	createdAt: true,
	updatedAt: true
};

@Injectable()
export class DjsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly jwtService: JwtService
	) {}

	// =========================================================================
	// АВТОРИЗАЦИЯ И ПРОФИЛЬ DJ
	// =========================================================================

	/**
	 * Быстрый вход DJ по номеру телефона и PIN-коду.
	 */
	async loginWithPin(dto: LoginDjDto) {
		const dj = await this.prisma.dj.findUnique({
			where: { phone: dto.phone }
		});

		if (!dj || !dj.pinCodeHash || !dj.isActive) {
			throw new UnauthorizedException('Неверный номер телефона или PIN-код.');
		}

		const isPinValid = await verify(dj.pinCodeHash, dto.pinCode);
		if (!isPinValid) {
			throw new UnauthorizedException('Неверный номер телефона или PIN-код.');
		}

		const token = this.generateDjToken(dj.id);

		// Получаем текущую активную смену DJ (если есть)
		const activeShift = await this.prisma.djShift.findFirst({
			where: {
				djId: dj.id,
				isActive: true
			},
			include: {
				venue: {
					select: {
						id: true,
						name: true,
						slug: true,
						logoUrl: true
					}
				}
			}
		});

		const { pinCodeHash, ...safeDj } = dj;

		return {
			token,
			dj: safeDj,
			activeShift
		};
	}

	/**
	 * Вход DJ через Telegram WebApp / Bot по telegramId.
	 */
	async loginWithTelegram(dto: TelegramLoginDjDto) {
		const dj = await this.prisma.dj.findUnique({
			where: { telegramId: dto.telegramId }
		});

		if (!dj || !dj.isActive) {
			throw new UnauthorizedException(
				'DJ с указанным Telegram ID не найден или заблокирован.'
			);
		}

		const token = this.generateDjToken(dj.id);

		const activeShift = await this.prisma.djShift.findFirst({
			where: {
				djId: dj.id,
				isActive: true
			},
			include: {
				venue: {
					select: {
						id: true,
						name: true,
						slug: true,
						logoUrl: true
					}
				}
			}
		});

		const { pinCodeHash, ...safeDj } = dj;

		return {
			token,
			dj: safeDj,
			activeShift
		};
	}

	/**
	 * Получить профиль текущего авторизованного DJ с доступными заведениями и активной сменой.
	 */
	async getMe(djId: string) {
		const dj = await this.prisma.dj.findUnique({
			where: { id: djId },
			select: {
				...djSafeSelect,
				venues: {
					include: {
						venue: {
							select: {
								id: true,
								name: true,
								slug: true,
								logoUrl: true,
								address: true,
								isAcceptingOrders: true,
								baseTrackPrice: true,
								prioritySurcharge: true
							}
						}
					}
				}
			}
		});

		if (!dj) {
			throw new NotFoundException('DJ не найден.');
		}

		// Текущая активная смена
		const activeShift = await this.prisma.djShift.findFirst({
			where: {
				djId,
				isActive: true
			},
			include: {
				venue: {
					select: {
						id: true,
						name: true,
						slug: true,
						logoUrl: true
					}
				}
			}
		});

		return {
			...dj,
			activeShift
		};
	}

	// =========================================================================
	// УПРАВЛЕНИЕ СМЕНАМИ (DJ SHIFTS) - МАРШРУТИЗАЦИЯ ЗАКАЗОВ
	// =========================================================================

	/**
	 * Начать смену в заведении.
	 * В заведении в один момент времени может быть только 1 активная смена.
	 */
	async startShift(djId: string, dto: StartShiftDto) {
		// 1. Проверяем, что DJ прикреплен к этому заведению
		const affiliation = await this.prisma.venueDj.findUnique({
			where: {
				venueId_djId: {
					venueId: dto.venueId,
					djId
				}
			},
			include: {
				venue: true
			}
		});

		if (!affiliation) {
			throw new ForbiddenException(
				'Вы не прикреплены к данному заведению. Обратитесь к управляющему.'
			);
		}

		// 2. Закрываем любую текущую активную смену в этом заведении (если предыдущий DJ забыл закрыть)
		await this.prisma.djShift.updateMany({
			where: {
				venueId: dto.venueId,
				isActive: true
			},
			data: {
				isActive: false,
				endedAt: new Date()
			}
		});

		// 3. Закрываем любую активную смену этого DJ в других заведениях
		await this.prisma.djShift.updateMany({
			where: {
				djId,
				isActive: true
			},
			data: {
				isActive: false,
				endedAt: new Date()
			}
		});

		// 4. Открываем новую смену
		const shift = await this.prisma.djShift.create({
			data: {
				venueId: dto.venueId,
				djId,
				isActive: true,
				startedAt: new Date()
			},
			include: {
				venue: {
					select: {
						id: true,
						name: true,
						slug: true,
						logoUrl: true,
						baseTrackPrice: true,
						prioritySurcharge: true,
						orderTimeoutMin: true
					}
				}
			}
		});

		return shift;
	}

	/**
	 * Завершить текущую смену DJ с фиксацией итоговой аналитики за вечер.
	 */
	async endShift(djId: string) {
		const activeShift = await this.prisma.djShift.findFirst({
			where: {
				djId,
				isActive: true
			}
		});

		if (!activeShift) {
			throw new BadRequestException('У вас нет активной смены для завершения.');
		}


		const orders = await this.prisma.order.findMany({
			where: {
				shiftId: activeShift.id
			},
			select: {
				status: true,
				amount: true
			}
		});

		const totalOrders = orders.length;
		const successfulStatuses: OrderStatus[] = [
			OrderStatus.ACCEPTED,
			OrderStatus.PLAYING,
			OrderStatus.COMPLETED
		];

		const acceptedOrders = orders.filter((o) =>
			successfulStatuses.includes(o.status)
		).length;

		const totalEarned = orders
			.filter((o) => successfulStatuses.includes(o.status))
			.reduce((sum, o) => sum + o.amount, 0);

		// Завершаем смену и обновляем агрегаты
		const closedShift = await this.prisma.djShift.update({
			where: { id: activeShift.id },
			data: {
				isActive: false,
				endedAt: new Date(),
				totalOrders,
				acceptedOrders,
				totalEarned
			},
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

		return {
			message: 'Смена успешно завершена.',
			shift: closedShift
		};
	}

	/**
	 * Получить текущую активную смену DJ с live-статистикой заказов.
	 */
	async getCurrentShift(djId: string) {
		const shift = await this.prisma.djShift.findFirst({
			where: {
				djId,
				isActive: true
			},
			include: {
				venue: {
					select: {
						id: true,
						name: true,
						slug: true,
						logoUrl: true,
						orderTimeoutMin: true,
						baseTrackPrice: true,
						prioritySurcharge: true
					}
				}
			}
		});

		if (!shift) {
			return null;
		}

		// Live-подсчет заказов текущей смены
		const [pendingCount, acceptedCount, playingCount, completedCount] =
			await Promise.all([
				this.prisma.order.count({
					where: { shiftId: shift.id, status: OrderStatus.PENDING }
				}),
				this.prisma.order.count({
					where: { shiftId: shift.id, status: OrderStatus.ACCEPTED }
				}),
				this.prisma.order.count({
					where: { shiftId: shift.id, status: OrderStatus.PLAYING }
				}),
				this.prisma.order.count({
					where: { shiftId: shift.id, status: OrderStatus.COMPLETED }
				})
			]);

		return {
			...shift,
			stats: {
				pending: pendingCount,
				accepted: acceptedCount,
				playing: playingCount,
				completed: completedCount,
				totalHandled: acceptedCount + playingCount + completedCount
			}
		};
	}

	/**
	 * Получить историю смен DJ с пагинацией.
	 */
	async getShiftHistory(djId: string, page = 1, limit = 20) {
		const skip = (page - 1) * limit;

		const [shifts, total] = await Promise.all([
			this.prisma.djShift.findMany({
				where: {
					djId,
					isActive: false
				},
				orderBy: { startedAt: 'desc' },
				skip,
				take: limit,
				include: {
					venue: {
						select: {
							id: true,
							name: true,
							slug: true,
							logoUrl: true
						}
					}
				}
			}),
			this.prisma.djShift.count({
				where: {
					djId,
					isActive: false
				}
			})
		]);

		return {
			shifts,
			meta: {
				total,
				page,
				limit,
				pages: Math.ceil(total / limit)
			}
		};
	}

	/**
	 * Получить список заказов текущей активной смены (с сортировкой: приоритетные первыми).
	 */
	async getShiftOrders(djId: string, status?: OrderStatus) {
		const activeShift = await this.prisma.djShift.findFirst({
			where: {
				djId,
				isActive: true
			}
		});

		if (!activeShift) {
			throw new BadRequestException('У вас нет активной смены.');
		}

		const whereCondition: any = {
			shiftId: activeShift.id
		};

		if (status) {
			whereCondition.status = status;
		}

		return this.prisma.order.findMany({
			where: whereCondition,
			orderBy: [
				{ isPriority: 'desc' }, // VIP-приоритетные заказы всегда вверху очереди!
				{ createdAt: 'asc' }
			],
			include: {
				guest: {
					select: {
						name: true
					}
				},
				qrCode: {
					select: {
						tableLabel: true
					}
				}
			}
		});
	}

	/**
	 * Вспомогательный метод для модуля Orders: получить активную смену заведения.
	 */
	async getActiveShiftForVenue(venueId: string) {
		return this.prisma.djShift.findFirst({
			where: {
				venueId,
				isActive: true
			},
			include: {
				dj: {
					select: djSafeSelect
				}
			}
		});
	}

	// =========================================================================
	// УПРАВЛЕНИЕ ДИДЖЕЯМИ ВЛАДЕЛЬЦЕМ ЗАВЕДЕНИЯ (VENUE OWNER)
	// =========================================================================

	/**
	 * Создать DJ и привязать к заведению.
	 * Если DJ с таким номером уже существует в системе — привязывает его к заведению.
	 */
	async createForVenue(
		userId: string,
		userRole: UserRole,
		venueId: string,
		dto: CreateDjDto
	) {
		await this.checkVenueOwnership(userId, userRole, venueId);

		let dj = await this.prisma.dj.findUnique({
			where: { phone: dto.phone }
		});

		if (dj) {
			// DJ уже существует в базе — проверяем, не привязан ли уже к этому заведению
			const existingLink = await this.prisma.venueDj.findUnique({
				where: {
					venueId_djId: {
						venueId,
						djId: dj.id
					}
				}
			});

			if (existingLink) {
				throw new ConflictException(
					'DJ с таким номером телефона уже привязан к вашему заведению.'
				);
			}

			// Привязываем существующего DJ
			await this.prisma.venueDj.create({
				data: {
					venueId,
					djId: dj.id,
					isDefault: dto.isDefault ?? false
				}
			});

			const { pinCodeHash, ...safeDj } = dj;
			return {
				message: 'Существующий DJ успешно прикреплен к вашему заведению.',
				dj: safeDj
			};
		}

		// DJ новый — хешируем PIN-код и создаем
		const pinCodeHash = await hash(dto.pinCode);

		const newDj = await this.prisma.dj.create({
			data: {
				name: dto.name,
				realName: dto.realName,
				phone: dto.phone,
				telegramId: dto.telegramId,
				pinCodeHash,
				avatarUrl: dto.avatarUrl,
				venues: {
					create: {
						venueId,
						isDefault: dto.isDefault ?? false
					}
				}
			},
			select: djSafeSelect
		});

		return {
			message: 'DJ успешно создан и прикреплен к заведению.',
			dj: newDj
		};
	}

	/**
	 * Получить всех DJ, прикрепленных к заведению.
	 */
	async getVenueDjs(userId: string, userRole: UserRole, venueId: string) {
		await this.checkVenueOwnership(userId, userRole, venueId);

		const venueDjs = await this.prisma.venueDj.findMany({
			where: { venueId },
			include: {
				dj: {
					select: {
						...djSafeSelect,
						shifts: {
							where: { venueId },
							orderBy: { startedAt: 'desc' },
							take: 1
						}
					}
				}
			},
			orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
		});

		return venueDjs.map((item) => ({
			dj: item.dj,
			isDefault: item.isDefault,
			attachedAt: item.createdAt,
			lastShift: item.dj.shifts[0] ?? null
		}));
	}

	/**
	 * Привязать существующего в платформе DJ к заведению.
	 */
	async attachExistingDj(
		userId: string,
		userRole: UserRole,
		venueId: string,
		dto: AttachDjDto
	) {
		await this.checkVenueOwnership(userId, userRole, venueId);

		let djId = dto.djId;

		if (!djId && dto.phone) {
			const found = await this.prisma.dj.findUnique({
				where: { phone: dto.phone },
				select: { id: true }
			});
			if (!found) {
				throw new NotFoundException('DJ с таким номером телефона не найден.');
			}
			djId = found.id;
		}

		if (!djId) {
			throw new BadRequestException('Укажите djId или phone.');
		}

		const existing = await this.prisma.venueDj.findUnique({
			where: {
				venueId_djId: {
					venueId,
					djId
				}
			}
		});

		if (existing) {
			throw new ConflictException('DJ уже привязан к данному заведению.');
		}

		return this.prisma.venueDj.create({
			data: {
				venueId,
				djId,
				isDefault: dto.isDefault ?? false
			},
			include: {
				dj: {
					select: djSafeSelect
				}
			}
		});
	}

	/**
	 * Обновить профиль DJ (владелец заведения или админ).
	 */
	async updateDj(
		userId: string,
		userRole: UserRole,
		venueId: string,
		djId: string,
		dto: UpdateDjDto
	) {
		await this.checkVenueOwnership(userId, userRole, venueId);

		const dataToUpdate: any = {};

		if (dto.name) dataToUpdate.name = dto.name;
		if (dto.realName !== undefined) dataToUpdate.realName = dto.realName;
		if (dto.phone) dataToUpdate.phone = dto.phone;
		if (dto.telegramId !== undefined) dataToUpdate.telegramId = dto.telegramId;
		if (dto.avatarUrl !== undefined) dataToUpdate.avatarUrl = dto.avatarUrl;
		if (dto.isActive !== undefined) dataToUpdate.isActive = dto.isActive;

		if (dto.pinCode) {
			dataToUpdate.pinCodeHash = await hash(dto.pinCode);
		}

		const updatedDj = await this.prisma.dj.update({
			where: { id: djId },
			data: dataToUpdate,
			select: djSafeSelect
		});

		return updatedDj;
	}

	/**
	 * Отвязать DJ от заведения.
	 */
	async removeDjFromVenue(
		userId: string,
		userRole: UserRole,
		venueId: string,
		djId: string
	) {
		await this.checkVenueOwnership(userId, userRole, venueId);

		// Если у DJ была активная смена в этом заведении — закрываем её
		await this.prisma.djShift.updateMany({
			where: {
				venueId,
				djId,
				isActive: true
			},
			data: {
				isActive: false,
				endedAt: new Date()
			}
		});

		await this.prisma.venueDj.deleteMany({
			where: {
				venueId,
				djId
			}
		});

		return { message: 'DJ успешно отвязан от заведения.' };
	}

	// =========================================================================
	// ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
	// =========================================================================

	/**
	 * Генерация JWT токена для авторизации DJ.
	 */
	private generateDjToken(djId: string): string {
		return this.jwtService.sign({
			sub: djId,
			role: 'DJ',
			type: 'dj'
		});
	}

	/**
	 * Проверка прав владения заведением.
	 */
	private async checkVenueOwnership(
		userId: string,
		userRole: UserRole,
		venueId: string
	) {
		if (userRole === UserRole.ADMIN) {
			return true;
		}

		const venue = await this.prisma.venue.findFirst({
			where: {
				id: venueId,
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
