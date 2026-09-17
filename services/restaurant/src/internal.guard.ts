import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class InternalGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.path.endsWith('/health')) return true;
    const secret = process.env.INTERNAL_TOKEN;
    if (!secret && process.env.NODE_ENV === 'test') return true;
    const received = req.headers['x-internal-token'];
    if (!secret || typeof received !== 'string' || Buffer.byteLength(received) !== Buffer.byteLength(secret) ||
        !timingSafeEqual(Buffer.from(received), Buffer.from(secret))) throw new UnauthorizedException();
    return true;
  }
}
