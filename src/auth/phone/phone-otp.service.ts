import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import { RedisService } from '../../redis/redis.service.js';
import { isDev } from '../../libs/common/utils/is-dev.util.js';

@Injectable()
export class PhoneOtpService {
	private readonly logger = new Logger(PhoneOtpService.name);

	private readonly ESKIZ_BASE_URL = 'https://notify.eskiz.uz/api';
	private readonly ESKIZ_TOKEN_KEY = 'eskiz:auth_token';
	// Храним токен в Redis 25 дней (срок жизни токена в Eskiz — 30 дней)
	private readonly ESKIZ_TOKEN_TTL = 25 * 24 * 60 * 60;

	// Время жизни OTP кода (секунды): 5 минут
	private readonly OTP_TTL_SECONDS = 300;
	// Задержка между повторными отправками (секунды): 60 секунд
	private readonly RESEND_COOLDOWN_SECONDS = 60;
	// Максимальное количество попыток ввода
	private readonly MAX_VERIFY_ATTEMPTS = 5;

	public constructor(
		private readonly redisService: RedisService,
		private readonly configService: ConfigService
	) {}

	/**
	 * Нормализует номер телефона к формату +998XXXXXXXXX.
	 */
	public normalizePhone(phone: string): string {
		let cleaned = phone.replace(/[\s\-()]/g, '');
		if (cleaned.startsWith('998') && !cleaned.startsWith('+')) {
			cleaned = `+${cleaned}`;
		}
		return cleaned;
	}

	/**
	 * Генерирует и отправляет OTP код на номер телефона.
	 * @param rawPhone - Номер телефона пользователя
	 * @returns Объект со статусом и временем жизни кода
	 */
	public async requestOtp(rawPhone: string) {
		const phone = this.normalizePhone(rawPhone);

		// Проверяем кулдаун повторной отправки (1 минута)
		const cooldownKey = `phone_otp:cooldown:${phone}`;
		const isCooldownActive = await this.redisService.exists(cooldownKey);

		if (isCooldownActive) {
			throw new BadRequestException(
				'Пожалуйста, подождите перед повторным запросом кода подтверждения.'
			);
		}

		// Генерируем 6-значный криптографически стойкий код
		const code = randomInt(100000, 1000000).toString();

		// Сохраняем код в Redis с TTL
		const codeKey = `phone_otp:code:${phone}`;
		const attemptsKey = `phone_otp:attempts:${phone}`;

		await this.redisService.set(codeKey, code, this.OTP_TTL_SECONDS);
		await this.redisService.set(cooldownKey, '1', this.RESEND_COOLDOWN_SECONDS);
		await this.redisService.set(attemptsKey, '0', this.OTP_TTL_SECONDS);

		// Отправка SMS через Eskiz.uz
		await this.sendSms(phone, code);

		const isDevelopment = isDev(this.configService);

		return {
			message: 'SMS с кодом подтверждения отправлено.',
			phone,
			expiresIn: this.OTP_TTL_SECONDS,
			// В режиме разработки возвращаем код в ответе для удобства тестирования
			...(isDevelopment && { devCode: code })
		};
	}

	/**
	 * Проверяет введенный OTP код.
	 * @param rawPhone - Номер телефона пользователя
	 * @param code - 6-значный код
	 * @returns true при успешной валидации
	 */
	public async verifyOtp(rawPhone: string, code: string): Promise<boolean> {
		const phone = this.normalizePhone(rawPhone);
		const codeKey = `phone_otp:code:${phone}`;
		const attemptsKey = `phone_otp:attempts:${phone}`;

		const storedCode = await this.redisService.get(codeKey);

		if (!storedCode) {
			throw new BadRequestException(
				'Код подтверждения не найден или срок его действия истек. Запросите новый код.'
			);
		}

		// Проверяем количество попыток ввода
		const rawAttempts = await this.redisService.get(attemptsKey);
		const attempts = rawAttempts ? parseInt(rawAttempts, 10) : 0;

		if (attempts >= this.MAX_VERIFY_ATTEMPTS) {
			await this.redisService.del(codeKey);
			await this.redisService.del(attemptsKey);
			throw new BadRequestException(
				'Превышено максимальное число попыток ввода. Запросите код заново.'
			);
		}

		if (storedCode !== code.trim()) {
			await this.redisService.set(
				attemptsKey,
				(attempts + 1).toString(),
				this.OTP_TTL_SECONDS
			);
			const remainingAttempts = this.MAX_VERIFY_ATTEMPTS - (attempts + 1);
			throw new BadRequestException(
				`Неверный код подтверждения. Осталось попыток: ${remainingAttempts}`
			);
		}

		// Код верен — удаляем использованный код и счетчики
		await this.redisService.del(codeKey);
		await this.redisService.del(attemptsKey);
		await this.redisService.del(`phone_otp:cooldown:${phone}`);

		return true;
	}

	/**
	 * Отправка SMS через Eskiz.uz API.
	 * Поддерживает боевой и тестовый статус аккаунта в Eskiz.
	 */
	private async sendSms(phone: string, code: string): Promise<void> {
		// В DEV-режиме выводим код в консоль
		if (isDev(this.configService)) {
			this.logger.log(`[SMS OTP DEV] Номер: ${phone}, Код: ${code}`);
		}

		const email = this.configService.getOrThrow<string>('ESKIZ_EMAIL');
		const password = this.configService.getOrThrow<string>('ESKIZ_PASSWORD');

		// Если реквизиты Eskiz не настроены в .env, логируем предупреждение без падения приложения
		if (!email || !password) {
			this.logger.warn(
				`[SMS OTP] ESKIZ_EMAIL или ESKIZ_PASSWORD не заданы в .env. SMS на ${phone} не отправлено.`
			);
			return;
		}

		// Eskiz принимает номер без знака плюса (например: 998901234567)
		const cleanPhone = phone.replace('+', '');
		const from = this.configService.getOrThrow<string>('ESKIZ_FROM') || '4546';
		const isTestMode = this.configService.getOrThrow<string>('ESKIZ_TEST_MODE') === 'true';

		// В тестовом статусе Eskiz разрешает отправлять ТОЛЬКО фиксированные тексты
		const message = isTestMode
			? 'Это тест от Eskiz'
			: `Код подтверждения: ${code}`;

		try {
			await this.executeSendSms(cleanPhone, message, from);
			this.logger.log(`[SMS OTP] SMS успешно отправлено на номер ${phone}`);
		} catch (error) {
			this.logger.error(
				`[SMS OTP] Ошибка отправки SMS на номер ${phone}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Выполняет сетевой запрос отправки SMS с поддержкой авто-обновления токена при 401.
	 */
	private async executeSendSms(cleanPhone: string, message: string, from: string): Promise<void> {
		let token = await this.getEskizToken();

		let response = await this.sendSmsRequest(cleanPhone, message, from, token);

		// Если токен был отозван или сброшен (401 Unauthorized) — обновляем и повторяем запрос
		if (response.status === 401) {
			this.logger.warn('[SMS OTP] Токен Eskiz истек или недействителен. Получаем новый токен...');
			await this.redisService.del(this.ESKIZ_TOKEN_KEY);
			token = await this.getEskizToken();
			response = await this.sendSmsRequest(cleanPhone, message, from, token);
		}

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Eskiz SMS API error (HTTP ${response.status}): ${errorText}`);
		}
	}

	/**
	 * Отправляет POST запрос к /api/message/sms/send в формате FormData.
	 */
	private async sendSmsRequest(
		cleanPhone: string,
		message: string,
		from: string,
		token: string
	): Promise<Response> {
		const formData = new FormData();
		formData.append('mobile_phone', cleanPhone);
		formData.append('message', message);
		formData.append('from', from);

		return fetch(`${this.ESKIZ_BASE_URL}/message/sms/send`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`
			},
			body: formData
		});
	}

	/**
	 * Получает токен авторизации Eskiz:
	 * 1. Проверяет наличие токена в Redis.
	 * 2. Если токена нет — запрашивает POST /api/auth/login через FormData.
	 * 3. Сохраняет токен в Redis на 25 дней.
	 */
	private async getEskizToken(): Promise<string> {
		// 1. Проверяем токен в кэше Redis
		const cachedToken = await this.redisService.get(this.ESKIZ_TOKEN_KEY);
		if (cachedToken) {
			return cachedToken;
		}

		// 2. Запрашиваем новый токен через FormData
		const email = this.configService.getOrThrow<string>('ESKIZ_EMAIL');
		const password = this.configService.getOrThrow<string>('ESKIZ_PASSWORD');

		const formData = new FormData();
		formData.append('email', email);
		formData.append('password', password);

		const response = await fetch(`${this.ESKIZ_BASE_URL}/auth/login`, {
			method: 'POST',
			body: formData
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Eskiz auth failed (HTTP ${response.status}): ${errorText}`);
		}

		const result = (await response.json()) as {
			message: string;
			data: { token: string };
			token_type: string;
		};

		const token = result?.data?.token;

		if (!token) {
			throw new Error('Eskiz auth response does not contain token');
		}

		// 3. Сохраняем в Redis с TTL 25 дней
		await this.redisService.set(this.ESKIZ_TOKEN_KEY, token, this.ESKIZ_TOKEN_TTL);
		this.logger.log('[SMS OTP] Получен и сохранен в Redis новый токен Eskiz');

		return token;
	}
}
