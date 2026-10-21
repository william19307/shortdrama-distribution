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
      secretOrKey: process.env.JWT_SECRET || 'dev-only-change-me',
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
