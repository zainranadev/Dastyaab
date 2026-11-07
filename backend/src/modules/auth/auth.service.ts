import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { err } from '../../common/errors/app-exception';
import { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { SAFE_USER } from '../users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

type TokenUser = { id: string; role: string; email: string };
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** BR-01 (unique email + phone), BR-02 (password rules enforced by the DTO, stored hashed). */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { phone: dto.phone }] },
      select: { email: true },
    });
    if (existing) {
      throw err.conflict(
        'DUPLICATE_RESOURCE',
        existing.email === dto.email ? 'Email is already registered.' : 'Phone number is already registered.',
      );
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, phone: dto.phone, passwordHash, fullName: dto.fullName, role: dto.role },
      select: SAFE_USER,
    });
    return { user, ...(await this.issueTokens(user)) };
  }

  async login(dto: LoginDto) {
    const row = await this.prisma.user.findFirst({ where: { email: dto.email, deletedAt: null } });
    const ok = row ? await bcrypt.compare(dto.password, row.passwordHash) : false;
    if (!row || !ok || !row.isActive) throw err.unauthorized('Invalid email or password.');
    const user = await this.prisma.user.findFirstOrThrow({ where: { id: row.id }, select: SAFE_USER });
    return { user, ...(await this.issueTokens(user)) };
  }

  /** D6: refresh tokens rotate. Re-using an already-rotated token revokes the whole family. */
  async refresh(token: string) {
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw err.unauthorized('Invalid refresh token.');
    }

    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.userId !== payload.sub) throw err.unauthorized('Invalid refresh token.');

    if (record.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw err.unauthorized('Refresh token was already used. Please log in again.');
    }
    if (record.expiresAt < new Date()) throw err.unauthorized('Refresh token expired.');

    const revoked = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count !== 1) throw err.unauthorized('Invalid refresh token.');

    const user = await this.prisma.user.findFirst({
      where: { id: record.userId, deletedAt: null, isActive: true },
      select: SAFE_USER,
    });
    if (!user) throw err.unauthorized();
    return { user, ...(await this.issueTokens(user)) };
  }

  async logout(token: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { loggedOut: true };
  }

  private async issueTokens(user: TokenUser) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, email: user.email },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', { infer: true }) as JwtSignOptions['expiresIn'],
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti: randomUUID() },
      {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true }) as JwtSignOptions['expiresIn'],
      },
    );
    const { exp } = this.jwt.decode<{ exp: number }>(refreshToken);
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: sha256(refreshToken), expiresAt: new Date(exp * 1000) },
    });
    return { accessToken, refreshToken };
  }
}
