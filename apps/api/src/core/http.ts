import { ArgumentsHost, CallHandler, Catch, ExceptionFilter, ExecutionContext, HttpException, HttpStatus, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { map, Observable } from 'rxjs';
import { AuthUser } from './auth';
import { toPlain } from './plain';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : (body as { message?: string | string[] }).message ?? exception.message;
      const text = Array.isArray(message) ? message.join('；') : message;
      return res.status(exception.getStatus()).json({ ...(typeof body === 'object' ? (body as object) : {}), message: text });
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2002') {
      return res.status(HttpStatus.CONFLICT).json({ message: '数据已存在，请勿重复提交' });
    }
    // eslint-disable-next-line no-console
    console.error(exception);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: '服务器内部错误' });
  }
}

@Injectable()
export class PlainInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
    return next.handle().pipe(map((data) => (data instanceof StreamableFile ? data : toPlain(data, user?.role))));
  }
}
