import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { DjsService } from './djs.service.js';

vi.mock('argon2', () => ({
	hash: vi.fn().mockResolvedValue('hashed_pin'),
	verify: vi.fn().mockImplementation(async (hashed, plain) => plain === '1234')
}));

describe('DjsService', () => {
	let service: DjsService;
	let prismaMock: any;
	let jwtServiceMock: any;

	beforeEach(() => {
		prismaMock = {
			dj: {
				findUnique: vi.fn(),
				create: vi.fn(),
				update: vi.fn()
			},
			venueDj: {
				findUnique: vi.fn(),
				create: vi.fn(),
				findMany: vi.fn(),
				deleteMany: vi.fn()
			},
			djShift: {
				findFirst: vi.fn(),
				create: vi.fn(),
				update: vi.fn(),
				updateMany: vi.fn(),
				findMany: vi.fn(),
				count: vi.fn()
			},
			order: {
				findMany: vi.fn(),
				count: vi.fn()
			},
			venue: {
				findFirst: vi.fn()
			}
		};

		jwtServiceMock = {
			sign: vi.fn().mockReturnValue('mock_jwt_token')
		};

		service = new DjsService(
			prismaMock as unknown as PrismaService,
			jwtServiceMock as unknown as JwtService
		);
	});

	describe('loginWithPin', () => {
		it('should throw UnauthorizedException if DJ does not exist or is inactive', async () => {
			prismaMock.dj.findUnique.mockResolvedValue(null);

			await expect(
				service.loginWithPin({ phone: '+998901234567', pinCode: '1234' })
			).rejects.toThrow(UnauthorizedException);
		});

		it('should throw UnauthorizedException if PIN is incorrect', async () => {
			prismaMock.dj.findUnique.mockResolvedValue({
				id: 'dj-1',
				name: 'DJ Test',
				phone: '+998901234567',
				pinCodeHash: 'some_hash',
				isActive: true
			});

			await expect(
				service.loginWithPin({ phone: '+998901234567', pinCode: '9999' })
			).rejects.toThrow(UnauthorizedException);
		});

		it('should succeed and return token when PIN is valid', async () => {
			prismaMock.dj.findUnique.mockResolvedValue({
				id: 'dj-1',
				name: 'DJ Pulse',
				phone: '+998901234567',
				pinCodeHash: 'some_hash',
				isActive: true
			});
			prismaMock.djShift.findFirst.mockResolvedValue(null);

			const result = await service.loginWithPin({
				phone: '+998901234567',
				pinCode: '1234'
			});

			expect(result.token).toBe('mock_jwt_token');
			expect(result.dj.name).toBe('DJ Pulse');
			expect((result.dj as any).pinCodeHash).toBeUndefined();
		});
	});

	describe('startShift', () => {
		it('should throw ForbiddenException if DJ is not linked to venue', async () => {
			prismaMock.venueDj.findUnique.mockResolvedValue(null);

			await expect(
				service.startShift('dj-1', { venueId: 'venue-1' })
			).rejects.toThrow(ForbiddenException);
		});

		it('should close old shifts and create a new active shift', async () => {
			prismaMock.venueDj.findUnique.mockResolvedValue({
				venueId: 'venue-1',
				djId: 'dj-1'
			});
			prismaMock.djShift.updateMany.mockResolvedValue({ count: 1 });
			prismaMock.djShift.create.mockResolvedValue({
				id: 'shift-1',
				venueId: 'venue-1',
				djId: 'dj-1',
				isActive: true
			});

			const result = await service.startShift('dj-1', { venueId: 'venue-1' });

			expect(prismaMock.djShift.updateMany).toHaveBeenCalledTimes(2);
			expect(prismaMock.djShift.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						venueId: 'venue-1',
						djId: 'dj-1',
						isActive: true
					})
				})
			);
			expect(result.id).toBe('shift-1');
		});
	});

	describe('endShift', () => {
		it('should throw BadRequestException if no active shift', async () => {
			prismaMock.djShift.findFirst.mockResolvedValue(null);

			await expect(service.endShift('dj-1')).rejects.toThrow(BadRequestException);
		});

		it('should calculate statistics and mark shift inactive', async () => {
			prismaMock.djShift.findFirst.mockResolvedValue({
				id: 'shift-1',
				djId: 'dj-1',
				isActive: true
			});
			prismaMock.order.findMany.mockResolvedValue([
				{ status: 'ACCEPTED', amount: 30000 },
				{ status: 'PLAYING', amount: 50000 },
				{ status: 'REJECTED', amount: 30000 }
			]);
			prismaMock.djShift.update.mockResolvedValue({
				id: 'shift-1',
				isActive: false,
				totalOrders: 3,
				acceptedOrders: 2,
				totalEarned: 80000
			});

			const result = await service.endShift('dj-1');

			expect(prismaMock.djShift.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: 'shift-1' },
					data: expect.objectContaining({
						isActive: false,
						totalOrders: 3,
						acceptedOrders: 2,
						totalEarned: 80000
					})
				})
			);
			expect(result.shift.totalEarned).toBe(80000);
		});
	});
});
