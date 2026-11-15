import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthMethod, VenueStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { hash, verify } from 'argon2';
import { MinioService } from '../minio/minio.service.js';
import { generateAvatar } from '../libs/common/utils/generateAvatar.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';

@Injectable()
export class UserService {
	public constructor(
		private readonly prismaService: PrismaService,
		private readonly minioService: MinioService
	) {}

	
	public async findById(id: string) {
		const user = await this.prismaService.user.findUnique({
			where: { id },
			include: {
				accounts: true,
			}
		});
		if (!user) {
			throw new NotFoundException('Пользователь не найден. Пожалуйста, проверьте введенные данные.');
		}

		return user;
	}

	public async findByPublicId(userId: string) {
		const user = await this.prismaService.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				name: true,
				username: true,
				avatarUrl: true,
				bio: true,
				status: true,
				role: true,
				createdAt: true,
				venues: true,
			}
		});
		if (!user) {
			throw new NotFoundException('Пользователь не найден. Пожалуйста, проверьте введенные данные.');
		}

		return user;
	}

	public async findByEmail(email: string) {
		const user = await this.prismaService.user.findUnique({
			where: { email },
			include: {
				accounts: true,
			}
		});
		return user;
	}

	public async findByPhone(phone: string) {
		const user = await this.prismaService.user.findUnique({
			where: { phone },
			include: {
				accounts: true,
			}
		});
		return user;
	}

	public async create(
		email: string | null,
		password: string,
		name: string,
		method: AuthMethod,
		isVerified: boolean,
		avatarUrl?: string,
		phone?: string,
		venueName?: string
	) {
		let finalAvatarUrl: string | null = null;

		if (avatarUrl) {
			// OAuth: сохраняем URL напрямую
			finalAvatarUrl = avatarUrl;
		} else {
			// Email/Phone регистрация: генерируем аватар через DiceBear и загружаем в MinIO
			const safeName = name ? name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'avatar';
			const avatarName = `${safeName}_${Date.now()}.png`;
			const avatarBuffer = await generateAvatar(name || 'user');

			const uploadResult = await this.minioService.uploadBuffer(
				avatarBuffer,
				avatarName,
				'avatars',
				'image/png'
			);
			finalAvatarUrl = uploadResult.secure_url;
		}

		// Автоматически создаем первое заведение для нового пользователя (владельца)
		const resolvedVenueName =
			venueName?.trim() ||
			(name?.trim() ? `Заведение ${name.trim()}` : 'Мое заведение');
		const cleanSlug = this.slugify(resolvedVenueName);
		const randomSuffix = randomBytes(2).toString('hex');
		const defaultSlug = `${cleanSlug}-${randomSuffix}`;

		const user = await this.prismaService.user.create({
			data: {
				email: email || null,
				phone: phone || null,
				password: password ? await hash(password) : null,
				name,
				method,
				isVerified,
				avatarUrl: finalAvatarUrl,
				venues: {
					create: {
						name: resolvedVenueName,
						slug: defaultSlug,
						city: 'Tashkent',
						status: VenueStatus.ACTIVE, // Сразу готово к работе в MVP
						commissionPercent: 15,
						baseTrackPrice: 30000,
						prioritySurcharge: 20000,
						orderTimeoutMin: 3,
						maxQueueLimit: 20
					}
				}
			},
			include: {
				accounts: true,
				venues: true
			}
		});

		return user;
	}

	/**
	 * Преобразование текста в URL slug.
	 */
	private slugify(text: string): string {
		return (
			text
				.toString()
				.toLowerCase()
				.trim()
				.replace(/\s+/g, '-')
				.replace(/[^\w\-]+/g, '')
				.replace(/\-\-+/g, '-')
				.replace(/^-+/, '')
				.replace(/-+$/, '') || 'venue'
		);
	}

	public async update(id: string, dto: UpdateUserDto) {
		const user = await this.findById(id);

		// Обработка аватарки если передан новый файл
		let newAvatarUrl: string | undefined = undefined;

		if (dto.avatarBuffer) {
			const oldUrl = user.avatarUrl;

			// Загружаем пользовательский файл в MinIO
			const safeNameBase = (dto.avatarOriginalFilename || user.name || 'avatar')
				.replace(/[^a-zA-Z0-9_-]/g, '_');
			const avatarName = `${safeNameBase}_${Date.now()}.png`;
			const uploadResult = await this.minioService.uploadBuffer(
				dto.avatarBuffer,
				avatarName,
				'avatars'
			);
			newAvatarUrl = uploadResult.secure_url;

			// Удаляем старую аватарку из MinIO если она там хранилась
			if (oldUrl) {
				try {
					await this.minioService.deleteByUrl(oldUrl);
				} catch (e) {
					if (process.env.NODE_ENV === 'development') {
						console.warn('Не удалось удалить старую аватарку:', e);
					}
				}
			}
		}

		const updateUser = await this.prismaService.user.update({
			where: { id: user.id },
			data: {
				...(dto.email !== undefined && { email: dto.email }),
				...(dto.phone !== undefined && { phone: dto.phone }),
				...(dto.name !== undefined && { name: dto.name }),
				...(dto.isTwoFactorEnabled !== undefined && { isTwoFactorEnabled: dto.isTwoFactorEnabled }),
				...(dto.bio !== undefined && { bio: dto.bio }),
				...(dto.status !== undefined && { status: dto.status }),
				...(dto.username !== undefined && { username: dto.username }),
				...(newAvatarUrl && { avatarUrl: newAvatarUrl }),
			}
		});

		return updateUser;
	}

	public async getRecomendedUsers(userId: string) {
		const recomended = await this.prismaService.user.findMany({
			where: {
				id: {
					not: userId
				},
				isActive: true
			},
			take: 15,
			select: {
				id: true,
				name: true,
				username: true,
				avatarUrl: true,
			}
		});

		return recomended.map(u => ({
			id: u.id,
			name: u.name,
			username: u.username,
			avatarUrl: u.avatarUrl,
		}));
	}

	/**
	 * Поиск пользователей
	 * Поддерживает:
	 * - Упоминания через @username
	 * - Поиск по имени, username и email (case-insensitive)
	 * - Нормализация диакритических знаков
	 */
	public async searchUser(query: string) {
		try {
			const normalize = (str = ''): string => {
				return str
					.normalize('NFKD')
					.replace(/\p{Diacritic}/gu, '')
					.replace(/[^\p{Letter}\p{Number}]+/gu, '')
					.toLowerCase();
			};

			const raw = (query || '').toString().trim();
			const isMention = raw.startsWith('@');
			const qClean = raw.replace(/^@/, '');
			const qNorm = normalize(qClean);

			const LIMIT = 12;

			if (!qClean || (qNorm.length < 2 && !(isMention && qClean.length >= 1))) {
				return [];
			}

			const primary = await this.prismaService.user.findMany({
				where: {
					OR: [
						{ name: { contains: qClean, mode: 'insensitive' } },
						{ email: { contains: qClean, mode: 'insensitive' } },
						{ username: { contains: qClean, mode: 'insensitive' } },
					],
				},
				take: LIMIT,
				select: {
					id: true,
					name: true,
					username: true,
					email: true,
					avatarUrl: true,
					bio: true,
				},
			});

			let results = primary;

			if (results.length < LIMIT) {
				const candidates = await this.prismaService.user.findMany({
					where: {},
					take: 200,
					select: {
						id: true,
						name: true,
						username: true,
						email: true,
						avatarUrl: true,
						bio: true,
					},
				});

				const seen = new Set(results.map((u) => u.id));

				const extra = candidates.filter((u) => {
					if (seen.has(u.id)) return false;

					const nName = normalize(u.name || '');
					const nUsername = normalize(u.username || '');
					const nEmail = normalize(u.email || '');

					if (isMention) {
						return nUsername.startsWith(qNorm) || nName.startsWith(qNorm);
					}

					return nName.includes(qNorm) || nUsername.includes(qNorm) || nEmail.includes(qNorm);
				});

				results = [...results, ...extra].slice(0, LIMIT);
			}

			if (isMention) {
				results.sort((a, b) => {
					const an = normalize(a.username || a.name || '');
					const bn = normalize(b.username || b.name || '');

					const aScore = an.startsWith(qNorm) ? 0 : an.includes(qNorm) ? 1 : 2;
					const bScore = bn.startsWith(qNorm) ? 0 : bn.includes(qNorm) ? 1 : 2;

					return aScore - bScore;
				});
			}

			return results.map((user) => ({
				id: user.id,
				name: user.name,
				username: user.username,
				avatarUrl: user.avatarUrl,
				bio: user.bio,
			}));

		} catch (error) {
			console.error('Search users error:', error);
			throw new Error('Ошибка поиска пользователей');
		}
	}

	/**
	 * Изменяет пароль пользователя
	 */
	public async changePassword(userId: string, dto: ChangePasswordDto) {
		const user = await this.findById(userId);

		if (!user.password || user.method !== AuthMethod.CREDENTIALS) {
			throw new BadRequestException(
				'Невозможно изменить пароль. Ваш аккаунт использует вход через социальные сети. Для управления паролем войдите через соответствующий сервис.'
			);
		}

		const isValidPassword = await verify(user.password, dto.currentPassword);

		if (!isValidPassword) {
			throw new UnauthorizedException(
				'Неверный текущий пароль. Пожалуйста, проверьте введенные данные и попробуйте снова.'
			);
		}

		const isSamePassword = await verify(user.password, dto.newPassword);
		if (isSamePassword) {
			throw new BadRequestException(
				'Новый пароль должен отличаться от текущего пароля.'
			);
		}

		const hashedPassword = await hash(dto.newPassword);

		return await this.prismaService.user.update({
			where: { id: userId },
			data: {
				password: hashedPassword,
				updatedAt: new Date()
			},
			select: {
				id: true,
				email: true,
				name: true,
				username: true
			}
		});
	}
}
