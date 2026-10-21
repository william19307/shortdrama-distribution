import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthUser } from './auth';

export function assertFound<T>(row: T | null | undefined, message = '内容不存在'): T {
  if (!row) throw new NotFoundException(message);
  return row;
}

/** 客户看自己的企业；运营看 ownerId；商务看 bdId。主管和管理员不限客户。 */
export function assertCompanyAccess(user: AuthUser, company: { id: string; ownerId: string | null; bdId?: string | null }) {
  if (user.role === 'ADMIN' || user.role === 'OPS_MANAGER') return;
  if (user.role === 'CLIENT') {
    if (user.companyId !== company.id) throw new ForbiddenException('只能查看自己的企业');
    return;
  }
  if (user.role === 'OPS') {
    if (company.ownerId !== user.id) throw new ForbiddenException('只能处理分配给你的客户');
    return;
  }
  if (user.role === 'BD') {
    if (company.bdId !== user.id) throw new ForbiddenException('只能处理分配给你的客户');
    return;
  }
  if (user.role === 'FINANCE') {
    throw new ForbiddenException('财务不能操作该客户的这项内容');
  }
}

export function maskAccount(no: string) {
  if (no.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, no.length - 4))}${no.slice(-4)}`;
}

export function safeFilename(name: string) {
  return name.replace(/[^\w.\-\u4e00-\u9fa5]+/g, '_').slice(0, 80);
}
