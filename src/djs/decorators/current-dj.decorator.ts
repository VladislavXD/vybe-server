import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Декоратор для извлечения объекта авторизованного DJ (или его конкретного поля) из запроса.
 *
 * @example
 * findMyProfile(@CurrentDj() dj: Dj)
 * getMyId(@CurrentDj('id') djId: string)
 */
export const CurrentDj = createParamDecorator(
	(data: string | undefined, ctx: ExecutionContext) => {
		const request = ctx.switchToHttp().getRequest();
		const dj = request.dj;

		return data ? dj?.[data] : dj;
	}
);
