import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

export class ZodPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        message: parsed.error.issues.map((issue) => `${issue.path.join('.') || '参数'}: ${issue.message}`).join('；'),
      });
    }
    return parsed.data;
  }
}
