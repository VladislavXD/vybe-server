import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import type { Request, Response } from 'express';
import { LoginDto } from './dto/login.dto.js';
import { JwtLoginDto } from './dto/jwt-login.dto.js';
import { RequestPhoneOtpDto, VerifyPhoneOtpDto } from './dto/phone-otp.dto.js';
import { Recaptcha } from '@nestlab/google-recaptcha';
import { ProviderService } from './provider/provider.service.js';
import { ConfigService } from '@nestjs/config';
import { AuthProviderGuard } from './guards/provider.guard.js';
import { UserService } from '../user/user.service.js';


@Controller('auth')
export class AuthController {
  public constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
		private readonly providerService: ProviderService,
    private readonly userService: UserService
  ) {}


  @Recaptcha()
  @Post('register')
  @HttpCode(HttpStatus.OK)
  public async register(@Req() req: Request,@Body() dto: RegisterDto){
    return this.authService.register(req, dto)
  }

  
  @Recaptcha()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  public async login(@Req() req: Request,@Body() dto: LoginDto){
    return this.authService.login(req, dto)
  }
  
  /**
   * Регистрация через JWT (мобильное приложение).
   * Возвращает JWT токен для немедленного входа.
   * @param dto - Данные регистрации
   * @returns JWT токен и данные пользователя
   */
  @Recaptcha()
  @Post('register-jwt')
  @HttpCode(HttpStatus.OK)
  public async registerWithJwt(@Body() dto: RegisterDto){
    return this.authService.registerWithJwt(dto)
  }

  /**
   * Вход через JWT (мобильное приложение).
   * Возвращает JWT токен вместо создания сессии.
   * @param dto - Email и пароль пользователя
   * @returns JWT токен и данные пользователя
   */
  @Recaptcha()
  @Post('login-jwt')
  @HttpCode(HttpStatus.OK)
  public async loginWithJwt(@Body() dto: JwtLoginDto){
    return this.authService.loginWithJwt(dto)
  }

  /**
   * Запрос SMS OTP кода для авторизации по номеру телефона.
   * Отправляет 6-значный одноразовый код на указанный номер (+998XXXXXXXXX).
   * @param dto - DTO с номером телефона
   * @returns Статус отправки и время жизни кода
   */

  @Post(['phone/send-otp', 'phone-otp/send'])
  @HttpCode(HttpStatus.OK)
  public async requestPhoneOtp(@Body() dto: RequestPhoneOtpDto) {
    return this.authService.requestPhoneOtp(dto);
  }

  /**
   * Авторизация / Регистрация по номеру телефона через SMS OTP код (веб-сессия + токен).
   * Если пользователь новый — автоматически регистрирует учетную запись.
   * @param req - Объект HTTP запроса Express для сохранения сессии
   * @param dto - DTO с номером телефона, кодом и опциональным именем
   * @returns Пользователь, JWT токен и сессия
   */
  @Recaptcha()  
  @Post(['phone/verify-otp', 'phone-otp/verify', 'login-phone'])
  @HttpCode(HttpStatus.OK)
  public async loginWithPhoneOtp(
    @Req() req: Request,
    @Body() dto: VerifyPhoneOtpDto
  ) {
    return this.authService.loginWithPhoneOtp(req, dto);
  }

  /**
   * Авторизация / Регистрация по номеру телефона через JWT (мобильное приложение / SPA).
   * @param dto - DTO с номером телефона, кодом и опциональным именем
   * @returns JWT токен и данные пользователя
   */
  @Recaptcha()
  @Post(['phone/login-jwt', 'phone-otp/login-jwt'])
  @HttpCode(HttpStatus.OK)
  public async loginWithPhoneOtpJwt(@Body() dto: VerifyPhoneOtpDto) {
    return this.authService.loginWithPhoneOtpJwt(dto);
  }

  	/**
	 * Обработка колбэка от провайдера аутентификации.
	 * @param req - Объект запроса Express.
	 * @param res - Объект ответа Express.
	 * @param code - Код авторизации, полученный от провайдера.
	 * @param provider - Название провайдера аутентификации.
	 * @returns Перенаправление на страницу настроек.
	 * @throws BadRequestException - Если код авторизации не был предоставлен.
	 */
  @UseGuards(AuthProviderGuard)
	@Get('/oauth/callback/:provider')
	public async callback(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
		@Query('code') code: string,
		@Param('provider') provider: string
	) {
		if (!code) {
			throw new BadRequestException(
				'Не был предоставлен код авторизации.'
			)
		}

		await this.authService.extractProfileFromCode(req, provider, code)

		const rawOrigin =
			this.configService.get<string>('CLIENT_URL') ||
			this.configService.get<string>('ALLOWED_ORIGIN') ||
			'http://localhost:3000'
		const clientUrl = rawOrigin.split(',')[0].trim().replace(/\/+$/, '')

		return res.redirect(
			`${clientUrl}/en/dashboard/settings`
		)
	}


  	/**
	 * Подключение пользователя к провайдеру аутентификации.
	 * @param provider - Название провайдера аутентификации.
	 * @returns URL для аутентификации через провайдера.
	 */
	@UseGuards(AuthProviderGuard)
	@Get('/oauth/connect/:provider')
	public async connect(@Param('provider') provider: string) {
		const providerInstance = this.providerService.findByService(provider)

		return {
			url: providerInstance?.getAuthUrl() ,
		}
	}

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  public async logout(@Req() req: Request, @Res({passthrough: true}) res: 
  Response){
    return this.authService.logout(req, res)
  }


}
