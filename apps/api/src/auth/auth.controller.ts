import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { loginSchema, registerSchema } from '@shortform/shared';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../core/auth';
import { ZodPipe } from '../core/zod.pipe';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body(new ZodPipe(registerSchema)) body: ReturnType<typeof registerSchema.parse>) {
    return this.auth.register(body);
  }

  @Post('login')
  login(@Body(new ZodPipe(loginSchema)) body: ReturnType<typeof loginSchema.parse>) {
    return this.auth.login(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }
}
