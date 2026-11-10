import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class DjAuthGuard implements CanActivate {
	constructor(
		private readonly jwtService: JwtService,
		private readonly prisma: PrismaService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const authHeader = request.headers.authorization;
		const token = authHeader?.startsWith('Bearer ')
			? authHeader.substring(7)
			: null;

		if (!token) {
			throw new UnauthorizedException(
				'DJ не авторизован. Предоставьте токен авторизации Bearer.'
			);
		}

		try {
			const payload = this.jwtService.verify(token);

			if (!payload.sub || (payload.type !== 'dj' && payload.role !== 'DJ')) {
				throw new UnauthorizedException('Недействительный токен DJ.');
			}

			const dj = await this.prisma.dj.findUnique({
				where: { id: payload.sub },
				select: {
					id: true,
					name: true,
					realName: true,
					phone: true,
					telegramId: true,
					avatarUrl: true,
					isActive: true,
					createdAt: true,
					updatedAt: true
				}
			});

			if (!dj || !dj.isActive) {
				throw new UnauthorizedException(
					'Аккаунт DJ не найден или заблокирован.'
				);
			}

			request.dj = dj;
			return true;
		} catch (error) {
			if (error instanceof UnauthorizedException) {
				throw error;
			}
			throw new UnauthorizedException('Токен DJ недействителен или истек.');
		}
	}
}
