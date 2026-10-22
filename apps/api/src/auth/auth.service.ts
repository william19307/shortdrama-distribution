import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import type { LoginInput, RegisterInput } from '@shortform/shared';
import { AuditService } from '../core/audit.service';
import { AuthUser } from '../core/auth';
import { PrismaService } from '../core/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async register(input: RegisterInput) {
    const exists = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (exists) throw new ConflictException('这个邮箱已经注册');
    const passwordHash = await hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
        role: 'CLIENT',
        company: { create: { name: input.companyName } },
      },
      include: { company: true },
    });
    await this.audit.write(user.id, 'register', 'User', user.id, { email: user.email });
    return this.tokenFor(user);
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() }, include: { company: true } });
    if (!user || user.disabled) throw new UnauthorizedException('邮箱或密码不正确');
    const ok = await compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('邮箱或密码不正确');
    await this.audit.write(user.id, 'login', 'User', user.id);
    return this.tokenFor(user);
  }

  async me(user: AuthUser) {
    const full = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { company: true },
    });
    if (!full) throw new UnauthorizedException('登录已失效');
    return this.publicUser(full);
  }

  private tokenFor(user: { id: string; role: AuthUser['role']; companyId: string | null; name: string; email: string; company?: { name: string; certStatus: string } | null }) {
    const accessToken = this.jwt.sign({ sub: user.id, role: user.role, companyId: user.companyId });
    return { accessToken, user: this.publicUser(user) };
  }

  private publicUser(user: { id: string; role: AuthUser['role']; companyId: string | null; name: string; email: string; company?: { name: string; certStatus: string } | null }) {
    return {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      companyId: user.companyId,
      companyName: user.company?.name ?? null,
      certStatus: user.company?.certStatus ?? null,
    };
  }
}
