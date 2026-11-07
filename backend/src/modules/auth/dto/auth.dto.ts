import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../../common/transforms';

export const PHONE_RE = /^\+?\d{10,15}$/;

const normalizeEmail = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value,
);
const normalizePhone = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/[\s\-()]/g, '') : value,
);

export class RegisterDto {
  @normalizeEmail
  @IsEmail()
  email: string;

  @normalizePhone
  @Matches(PHONE_RE, { message: 'phone must be a valid number, e.g. +923001234567' })
  phone: string;

  /** BR-02: min 8 chars, at least one letter and one number (72 = bcrypt limit). */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/[A-Za-z]/, { message: 'password must contain at least one letter' })
  @Matches(/\d/, { message: 'password must contain at least one number' })
  password: string;

  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  fullName: string;

  @IsIn(['CUSTOMER', 'CONTRACTOR'])
  role: 'CUSTOMER' | 'CONTRACTOR';
}

export class LoginDto {
  @normalizeEmail
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(72)
  password: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}
