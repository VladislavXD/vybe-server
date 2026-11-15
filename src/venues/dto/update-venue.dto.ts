import {
	IsBoolean,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	Max,
	Min
} from 'class-validator';
import { Type } from 'class-transformer';
import { VenueStatus } from '@prisma/client';

export class UpdateVenueDto {
	@IsString()
	@IsOptional()
	name?: string;

	@IsString()
	@IsOptional()
	slug?: string;

	@IsString()
	@IsOptional()
	description?: string;

	@IsString()
	@IsOptional()
	address?: string;

	@IsString()
	@IsOptional()
	city?: string;

	@IsString()
	@IsOptional()
	logoUrl?: string;

	@IsString()
	@IsOptional()
	coverUrl?: string;

	@IsEnum(VenueStatus)
	@IsOptional()
	status?: VenueStatus;

	@Type(() => Number)
	@IsInt()
	@Min(0)
	@Max(100)
	@IsOptional()
	commissionPercent?: number;

	@Type(() => Number)
	@IsInt()
	@Min(1000)
	@IsOptional()
	baseTrackPrice?: number;

	@Type(() => Number)
	@IsInt()
	@Min(0)
	@IsOptional()
	prioritySurcharge?: number;

	@IsBoolean()
	@IsOptional()
	isAcceptingOrders?: boolean;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(30)
	@IsOptional()
	orderTimeoutMin?: number;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	@IsOptional()
	maxQueueLimit?: number;

	@IsString()
	@IsOptional()
	legalName?: string;

	@IsString()
	@IsOptional()
	inn?: string;

	@IsString()
	@IsOptional()
	bankAccount?: string;

	@IsString()
	@IsOptional()
	mfo?: string;
}
