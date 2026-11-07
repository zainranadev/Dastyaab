import { HttpException } from '@nestjs/common';

/** Standard codes from README section 11, plus a few extras marked below. */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONTRACTOR_NOT_VERIFIED'
  | 'NOT_FOUND'
  | 'INVALID_STATUS_TRANSITION'
  | 'DUPLICATE_RESOURCE'
  | 'PROBLEM_NOT_OPEN'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  // extras (specific 409s that make the UI and debugging clearer)
  | 'PROBLEM_HAS_QUOTES'
  | 'QUOTE_LIMIT_REACHED'
  | 'QUOTE_NOT_PENDING'
  | 'BOOKING_NOT_COMPLETED'
  | 'BOOKING_NOT_PAYABLE'
  | 'REVIEW_LOCKED'
  | 'SERVICE_UNAVAILABLE';

export class AppException extends HttpException {
  constructor(
    status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details: unknown[] = [],
  ) {
    super({ code, message, details }, status);
  }
}

/** Small factories so services read like sentences. */
export const err = {
  validation: (message: string, details: unknown[] = []) =>
    new AppException(400, 'VALIDATION_ERROR', message, details),
  unauthorized: (message = 'Missing or invalid token') =>
    new AppException(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'You are not allowed to do this') =>
    new AppException(403, 'FORBIDDEN', message),
  notVerified: () =>
    new AppException(403, 'CONTRACTOR_NOT_VERIFIED', 'Your contractor account is not verified yet.'),
  notFound: (what: string) => new AppException(404, 'NOT_FOUND', `${what} not found`),
  conflict: (code: ErrorCode, message: string) => new AppException(409, code, message),
};
