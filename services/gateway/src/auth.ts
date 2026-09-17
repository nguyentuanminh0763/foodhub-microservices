import { Body, CanActivate, Controller, ExecutionContext, Get, HttpCode, HttpException, Injectable, OnModuleDestroy, Post, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'node:crypto';
import { IsString, Length } from 'class-validator';
import Redis from 'ioredis';
import type { Request, Response } from 'express';

class LoginDto {
  @IsString() @Length(1, 100) username: string;
  @IsString() @Length(1, 200) password: string;
}

export interface Identity { sub: string; role: 'customer' | 'admin' }

@Injectable()
export class AuthService {
  private readonly jwt = new JwtService();

  login(input: LoginDto) {
    // Explicit local demo accounts. No registration or customer-selected roles.
    const accounts = [
      { username: 'customer', password: process.env.DEMO_CUSTOMER_PASSWORD, sub: 'customer', role: 'customer' },
      { username: 'customer2', password: process.env.DEMO_CUSTOMER_PASSWORD, sub: 'customer2', role: 'customer' },
      { username: 'admin', password: process.env.DEMO_ADMIN_PASSWORD, sub: 'admin', role: 'admin' },
    ];
    const account = accounts.find(a => a.username === input.username);
    const hash = (value: string) => createHash('sha256').update(value).digest();
    const valid = timingSafeEqual(hash(input.password), hash(account?.password ?? 'disabled'));
    if (!valid || !account?.password || !process.env.JWT_SECRET) throw new UnauthorizedException('Invalid credentials');
    return { accessToken: this.jwt.sign({ sub: account.sub, role: account.role }, {
      secret: process.env.JWT_SECRET, algorithm: 'HS256', expiresIn: '1h', issuer: 'foodhub', audience: 'foodhub-api',
    }), tokenType: 'Bearer', expiresIn: 3600 };
  }

  verify(token: string): Identity {
    try {
      const identity = this.jwt.verify(token, { secret: process.env.JWT_SECRET, algorithms: ['HS256'], issuer: 'foodhub', audience: 'foodhub-api' });
      if (typeof identity.sub !== 'string' || !['customer', 'admin'].includes(identity.role)) throw new Error('Invalid identity');
      return identity;
    } catch { throw new UnauthorizedException('Invalid or expired bearer token'); }
  }
}

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Get('health') health() { return { service: 'gateway', status: 'ok' }; }
  @Post('auth/login') @HttpCode(200) login(@Body() body: LoginDto) { return this.auth.login(body); }
}

@Injectable()
export class AccessGuard implements CanActivate, OnModuleDestroy {
  private readonly redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false }) : undefined;
  constructor(private readonly auth: AuthService) {
    this.redis?.on('error', () => {});
    if (process.env.NODE_ENV !== 'test' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || !process.env.INTERNAL_TOKEN || !this.redis)) {
      throw new Error('JWT_SECRET (32+ characters), INTERNAL_TOKEN and REDIS_URL are required');
    }
  }
  onModuleDestroy() { this.redis?.disconnect(); }

  async canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    res.setHeader('x-content-type-options', 'nosniff');
    if (/^\/api\/(?:health|(?:restaurants|orders|payments|notifications)\/health)\/?$/.test(req.path)) return true;
    if (process.env.NODE_ENV === 'test' && !process.env.JWT_SECRET) return true;
    const login = /^\/api\/auth\/login\/?$/.test(req.path);
    if (this.redis) {
      let count: number;
      try {
        count = Number(await this.redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n", 1, `rate:${login ? 'login' : 'api'}:${req.ip}`));
      } catch { throw new ServiceUnavailableException('Rate limiter unavailable'); }
      const limit = login ? 20 : Number(process.env.RATE_LIMIT_MAX ?? 300);
      if (count > limit) {
        res.setHeader('retry-after', '60');
        throw new HttpException('Too many requests', 429);
      }
    }
    if (login) return true;
    if (req.method === 'GET' && /^\/api\/(restaurants|orders)\/docs(?:-json|\/.*)?$/.test(req.path)) return true;
    const authorization = req.headers.authorization;
    if (authorization?.startsWith('Bearer ')) res.locals.user = this.auth.verify(authorization.slice(7));
    if (req.method === 'GET' && /^\/api\/restaurants(?:\/\d+)?\/?$/.test(req.path)) return true;
    if (!res.locals.user) throw new UnauthorizedException('Bearer token required');
    return true;
  }
}
