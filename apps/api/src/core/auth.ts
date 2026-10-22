import { createParamDecorator, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PassportStrategy } from '@nestjs/passport';
import { Prisma } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Role } from '@shortform/shared';
import { PrismaService } from './prisma.service';

export type AuthUser = {
  id: string;
  role: Role;
  companyId: string | null;
  name: string;
  email: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(),
    });
  }

  async validate(payload: { sub: string }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.disabled) throw new UnauthorizedException('登录已失效');
    return { id: user.id, role: user.role, companyId: user.companyId, name: user.name, email: user.email };
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

export function assertRole(user: AuthUser, roles: Role[], message = '没有权限') {
  if (!roles.includes(user.role)) throw new ForbiddenException(message);
}

/** 管理员可以看全部运营页面，但合同、审核、分成、数据录入等业务写入返回 403。 */
export function assertBusinessWrite(user: AuthUser) {
  if (user.role === 'ADMIN') throw new ForbiddenException('管理员只能修改系统配置，不能办理业务');
}

export async function nextCode(tx: Prisma.TransactionClient, prefix: string, pad = 5) {
  const row = await tx.counter.upsert({
    where: { id: prefix },
    create: { id: prefix, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}${String(row.value).padStart(pad, '0')}`;
}

export function day(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32 || secret.startsWith('change-me'))) {
    throw new Error('生产环境必须配置不少于 32 位、且不以 change-me 开头的 JWT_SECRET');
  }
  return secret || 'dev-only-change-me';
}
