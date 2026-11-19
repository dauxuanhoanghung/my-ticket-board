import { describe, expect, it } from 'vitest';
import {
  ConcurrencyError,
  DomainError,
  NotFoundError,
  ValidationError,
} from '../../../src/shared/kernel/index.js';

class LastAdminError extends DomainError {
  readonly code = 'LAST_ADMIN';
  constructor(workspaceId: string) {
    super('A workspace must keep at least one admin', { workspaceId });
  }
}

describe('DomainError', () => {
  it('a context error carries its code, name and details', () => {
    const error = new LastAdminError('w1');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('LAST_ADMIN');
    expect(error.name).toBe('LastAdminError');
    expect(error.details).toEqual({ workspaceId: 'w1' });
    expect(Object.isFrozen(error.details)).toBe(true);
  });

  it('NotFoundError', () => {
    const error = new NotFoundError('Board', 'b1');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.details).toEqual({ resource: 'Board', id: 'b1' });
  });

  it('ValidationError keeps field codes under details.fields', () => {
    const error = new ValidationError({
      email: 'EMAIL_INVALID',
      fullName: 'FULL_NAME_TOO_LONG',
    });

    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.details).toEqual({
      fields: { email: 'EMAIL_INVALID', fullName: 'FULL_NAME_TOO_LONG' },
    });
    expect(ValidationError.field('email', 'EMAIL_INVALID').fields).toEqual({
      email: 'EMAIL_INVALID',
    });
  });

  it('ConcurrencyError maps to VERSION_CONFLICT and omits an unknown current version', () => {
    expect(new ConcurrencyError('Ticket', 't1', 7).details).toEqual({
      aggregateType: 'Ticket',
      aggregateId: 't1',
      expectedVersion: 7,
    });

    const error = new ConcurrencyError('Ticket', 't1', 7, 8);
    expect(error.code).toBe('VERSION_CONFLICT');
    expect(error.details).toMatchObject({ currentVersion: 8 });
  });
});
