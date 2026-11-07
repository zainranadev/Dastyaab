import { Transform } from 'class-transformer';

/** Trim whitespace from string inputs before validation. */
export const Trim = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));
