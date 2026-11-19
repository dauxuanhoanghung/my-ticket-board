import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  fail,
  ok,
  unwrap,
  validateFields,
  ValidationError,
  type Result,
} from '../../../src/shared/kernel/index.js';

// A tiny value object in the shape real ones use: private constructor, Result factory.
class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<Email> {
    const value = raw.trim().toLowerCase();
    return /^[^@\s]+@[^@\s]+$/.test(value)
      ? ok(new Email(value))
      : fail('EMAIL_INVALID');
  }
}

const fullName = (raw: string): Result<string> =>
  raw.trim().length > 0 ? ok(raw.trim()) : fail('FULL_NAME_REQUIRED');

describe('Result', () => {
  it('narrows on .success', () => {
    const result = Email.create(' A@B.io ');
    if (!result.success) throw new Error('expected success');
    expect(result.value.value).toBe('a@b.io');
  });

  describe('unwrap', () => {
    it('returns the value of a successful result', () => {
      expect(unwrap(ok(42))).toBe(42);
    });

    it('rethrows an Error as is', () => {
      const error = ValidationError.field('email', 'EMAIL_INVALID');
      expect(() => unwrap(fail(error))).toThrow(error);
    });

    it('wraps a non-Error failure', () => {
      expect(() => unwrap(fail('EMAIL_INVALID'))).toThrow(/EMAIL_INVALID/);
    });
  });

  describe('validateFields', () => {
    it('returns typed values when every field is valid', () => {
      const result = validateFields({
        email: Email.create('a@b.io'),
        fullName: fullName('Hùng'),
      });

      if (!result.success) throw result.error;
      expectTypeOf(result.value).toEqualTypeOf<{
        readonly email: Email;
        readonly fullName: string;
      }>();
      expect(result.value.email.value).toBe('a@b.io');
      expect(result.value.fullName).toBe('Hùng');
    });

    it('reports every failing field, not just the first', () => {
      const result = validateFields({
        email: Email.create('nope'),
        fullName: fullName('  '),
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.fields).toEqual({
        email: 'EMAIL_INVALID',
        fullName: 'FULL_NAME_REQUIRED',
      });
    });
  });
});
