import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthUser } from './auth';

export function assertFound<T>(row: T | null | undefined, message = '内容不存在'): T {
  if (!row) throw new NotFoundException(message);
  return row;
}

/** 客户只能碰自己的企业；运营只能碰负责客户；管理员放行。 */
export function assertCompanyAccess(user: AuthUser, company: { id: string; ownerId: string | null }) {
  if (user.role === 'ADMIN') return;
  if (user.role === 'CLIENT') {
    if (user.companyId !== company.id) throw new ForbiddenException('只能查看自己的企业');
    return;
  }
  if (user.role === 'OPS') {
    if (company.ownerId !== user.id) throw new ForbiddenException('只能处理分配给你的客户');
    return;
  }
}

export function maskAccount(no: string) {
  if (no.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, no.length - 4))}${no.slice(-4)}`;
}

export function safeFilename(name: string) {
  return name.replace(/[^\w.\-\u4e00-\u9fa5]+/g, '_').slice(0, 80);
}
