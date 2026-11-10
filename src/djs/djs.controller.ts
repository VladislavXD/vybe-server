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
	Query
} from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { Authorization } from '../auth/decorators/auth.decorator.js';
import { Authorized } from '../auth/decorators/authorized.decorator.js';
import { CurrentDj } from './decorators/current-dj.decorator.js';
import { DjAuth } from './decorators/dj-auth.decorator.js';
import { DjsService } from './djs.service.js';
import { AttachDjDto } from './dto/attach-dj.dto.js';
import { CreateDjDto } from './dto/create-dj.dto.js';
import { LoginDjDto } from './dto/login-dj.dto.js';
import { StartShiftDto } from './dto/start-shift.dto.js';
import { TelegramLoginDjDto } from './dto/telegram-login-dj.dto.js';
import { UpdateDjDto } from './dto/update-dj.dto.js';

@Controller('djs')
export class DjsController {
	constructor(private readonly djsService: DjsService) {}

	// =========================================================================
	// АВТОРИЗАЦИЯ DJ (ПУБЛИЧНЫЕ ЭНДПОИНТЫ)
	// =========================================================================


	@HttpCode(HttpStatus.OK)
	@Post('auth/login-pin')
	async loginWithPin(@Body() dto: LoginDjDto) {
		return this.djsService.loginWithPin(dto);
	}


	@HttpCode(HttpStatus.OK)
	@Post('auth/login-telegram')
	async loginWithTelegram(@Body() dto: TelegramLoginDjDto) {
		return this.djsService.loginWithTelegram(dto);
	}


	@DjAuth()
	@Get('me')
	async getMe(@CurrentDj('id') djId: string) {
		return this.djsService.getMe(djId);
	}


  
	@DjAuth()
	@HttpCode(HttpStatus.CREATED)
	@Post('shift/start')
	async startShift(
		@CurrentDj('id') djId: string,
		@Body() dto: StartShiftDto
	) {
		return this.djsService.startShift(djId, dto);
	}

	/**
	 * Завершить текущую смену с подведением итогов (заказы, доход).
	 */
	@DjAuth()
	@HttpCode(HttpStatus.OK)
	@Post('shift/end')
	async endShift(@CurrentDj('id') djId: string) {
		return this.djsService.endShift(djId);
	}

	/**
	 * Получить текущую активную смену и live-статистику.
	 */
	@DjAuth()
	@Get('shift/current')
	async getCurrentShift(@CurrentDj('id') djId: string) {
		return this.djsService.getCurrentShift(djId);
	}

	/**
	 * История смен DJ.
	 */
	@DjAuth()
	@Get('shift/history')
	async getShiftHistory(
		@CurrentDj('id') djId: string,
		@Query('page') page?: string,
		@Query('limit') limit?: string
	) {
		const pageNumber = page ? parseInt(page, 10) : 1;
		const limitNumber = limit ? parseInt(limit, 10) : 20;
		return this.djsService.getShiftHistory(djId, pageNumber, limitNumber);
	}

	/**
	 * Получить заказы текущей активной смены DJ (приоритетные первыми).
	 */
	@DjAuth()
	@Get('shift/orders')
	async getShiftOrders(
		@CurrentDj('id') djId: string,
		@Query('status') status?: OrderStatus
	) {
		return this.djsService.getShiftOrders(djId, status);
	}

	// =========================================================================
	// УПРАВЛЕНИЕ DJ ДЛЯ ВЛАДЕЛЬЦА ЗАВЕДЕНИЯ (VENUE OWNER)
	// =========================================================================

	/**
	 * Создать нового DJ и привязать к своему заведению.
	 */
	@Authorization(UserRole.VENUE_OWNER, UserRole.ADMIN)
	@HttpCode(HttpStatus.CREATED)
	@Post('venue/:venueId')
	async createForVenue(
		@Authorized('id') userId: string,
		@Authorized('role') userRole: UserRole,
		@Param('venueId') venueId: string,
		@Body() dto: CreateDjDto
	) {
		return this.djsService.createForVenue(userId, userRole, venueId, dto);
	}

	/**
	 * Получить список всех DJ заведения.
	 */
	@Authorization(UserRole.VENUE_OWNER, UserRole.ADMIN)
	@Get('venue/:venueId')
	async getVenueDjs(
		@Authorized('id') userId: string,
		@Authorized('role') userRole: UserRole,
		@Param('venueId') venueId: string
	) {
		return this.djsService.getVenueDjs(userId, userRole, venueId);
	}

	/**
	 * Привязать существующего в платформе DJ к заведению.
	 */
	@Authorization(UserRole.VENUE_OWNER, UserRole.ADMIN)
	@Post('venue/:venueId/attach')
	async attachExistingDj(
		@Authorized('id') userId: string,
		@Authorized('role') userRole: UserRole,
		@Param('venueId') venueId: string,
		@Body() dto: AttachDjDto
	) {
		return this.djsService.attachExistingDj(userId, userRole, venueId, dto);
	}

	/**
	 * Обновить данные DJ заведения.
	 */
	@Authorization(UserRole.VENUE_OWNER, UserRole.ADMIN)
	@Patch('venue/:venueId/:djId')
	async updateDj(
		@Authorized('id') userId: string,
		@Authorized('role') userRole: UserRole,
		@Param('venueId') venueId: string,
		@Param('djId') djId: string,
		@Body() dto: UpdateDjDto
	) {
		return this.djsService.updateDj(userId, userRole, venueId, djId, dto);
	}

	/**
	 * Отвязать DJ от заведения.
	 */
	@Authorization(UserRole.VENUE_OWNER, UserRole.ADMIN)
	@Delete('venue/:venueId/:djId')
	async removeDjFromVenue(
		@Authorized('id') userId: string,
		@Authorized('role') userRole: UserRole,
		@Param('venueId') venueId: string,
		@Param('djId') djId: string
	) {
		return this.djsService.removeDjFromVenue(userId, userRole, venueId, djId);
	}
}
