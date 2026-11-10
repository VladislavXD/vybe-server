import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisService } from '../../redis/redis.service.js';
import { PhoneOtpService } from './phone-otp.service.js';

describe('PhoneOtpService', () => {
	let service: PhoneOtpService;
	let redisServiceMock: any;
	let configServiceMock: any;

	beforeEach(() => {
		redisServiceMock = {
			exists: vi.fn(),
			set: vi.fn(),
			get: vi.fn(),
			del: vi.fn()
		};

		configServiceMock = {
			get: vi.fn().mockReturnValue('development'),
			getOrThrow: vi.fn().mockReturnValue('development')
		};

		service = new PhoneOtpService(
			redisServiceMock as unknown as RedisService,
			configServiceMock as unknown as ConfigService
		);
	});

	describe('normalizePhone', () => {
		it('should normalize 998901234567 to +998901234567', () => {
			expect(service.normalizePhone('998901234567')).toBe('+998901234567');
		});

		it('should clean spaces, dashes, and parentheses', () => {
			expect(service.normalizePhone('+998 (90) 123-45-67')).toBe('+998901234567');
		});
	});

	describe('requestOtp', () => {
		it('should throw BadRequestException if cooldown is active', async () => {
			redisServiceMock.exists.mockResolvedValue(true);

			await expect(
				service.requestOtp('+998901234567')
			).rejects.toThrow(BadRequestException);
		});

		it('should generate 6-digit code and save to Redis', async () => {
			redisServiceMock.exists.mockResolvedValue(false);
			redisServiceMock.set.mockResolvedValue(undefined);

			const result = await service.requestOtp('+998901234567');

			expect(result.phone).toBe('+998901234567');
			expect(result.expiresIn).toBe(300);
			expect(redisServiceMock.set).toHaveBeenCalledTimes(3);
		});
	});

	describe('verifyOtp', () => {
		it('should throw BadRequestException if code is missing or expired', async () => {
			redisServiceMock.get.mockResolvedValue(null);

			await expect(
				service.verifyOtp('+998901234567', '123456')
			).rejects.toThrow(BadRequestException);
		});

		it('should throw BadRequestException if code does not match', async () => {
			redisServiceMock.get
				.mockResolvedValueOnce('654321') // stored code
				.mockResolvedValueOnce('0'); // attempts

			await expect(
				service.verifyOtp('+998901234567', '111111')
			).rejects.toThrow(BadRequestException);
		});

		it('should return true and clear keys if code matches', async () => {
			redisServiceMock.get
				.mockResolvedValueOnce('123456') // stored code
				.mockResolvedValueOnce('0'); // attempts
			redisServiceMock.del.mockResolvedValue(undefined);

			const result = await service.verifyOtp('+998901234567', '123456');

			expect(result).toBe(true);
			expect(redisServiceMock.del).toHaveBeenCalledTimes(3);
		});
	});
});
