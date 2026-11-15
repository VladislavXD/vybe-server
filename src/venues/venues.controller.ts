import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Authorization } from '../auth/decorators/auth.decorator.js';
import { Authorized } from '../auth/decorators/authorized.decorator.js';
import { CreateVenueDto } from './dto/create-venue.dto.js';
import { UpdateVenueDto } from './dto/update-venue.dto.js';
import { VenuesService } from './venues.service.js';

@Controller('venues')
export class VenuesController {
	constructor(private readonly venuesService: VenuesService) {}

	/**
	 * Создать новое заведение (онбординг владельца).
	 */
	@Authorization(UserRole.VENUE_OWNER, UserRole.ADMIN)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	async create(
		@Authorized('id') userId: string,
		@Body() dto: CreateVenueDto
	) {
		return this.venuesService.create(userId, dto);
	}

	/**
	 * Получить все заведения текущего авторизованного владельца.
	 */
	@Authorization()
	@Get('my')
	async getMyVenues(@Authorized('id') userId: string) {
		return this.venuesService.getMyVenues(userId);
	}

	/**
	 * Получить существующее заведение или автоматически создать дефолтное.
	 * Позволяет владельцу сразу начать работу со столами и QR-кодами без барьеров.
	 */
	@Authorization()
	@Get('default')
	async getOrCreateDefault(@Authorized('id') userId: string) {
		return this.venuesService.getOrCreateDefaultVenue(userId);
	}

	/**
	 * Публичный просмотр страницы заведения по URL slug (для гостей).
	 */
	@Get('slug/:slug')
	async findBySlug(@Param('slug') slug: string) {
		return this.venuesService.findBySlug(slug);
	}

	/**
	 * Получить данные заведения по ID.
	 */
	@Authorization()
	@Get(':id')
	async findById(@Param('id') id: string) {
		return this.venuesService.findById(id);
	}

	/**
	 * Обновить настройки заведения (цены треков, статус приема заказов, реквизиты).
	 */
	@Authorization(UserRole.VENUE_OWNER, UserRole.ADMIN)
	@Patch(':id')
	async update(
		@Authorized('id') userId: string,
		@Authorized('role') userRole: UserRole,
		@Param('id') id: string,
		@Body() dto: UpdateVenueDto
	) {
		return this.venuesService.update(userId, userRole, id, dto);
	}
}
