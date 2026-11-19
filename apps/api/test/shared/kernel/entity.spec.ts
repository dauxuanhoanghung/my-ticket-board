import { describe, expect, it } from 'vitest';
import { Entity } from '../../../src/shared/kernel/index.js';

class Member extends Entity<string> {
  constructor(
    id: string,
    readonly role: string,
  ) {
    super(id);
  }
}

class Label extends Entity<string> {
  constructor(id: string) {
    super(id);
  }
}

describe('Entity.equals', () => {
  it('compares by id, not by attributes', () => {
    expect(new Member('u1', 'ADMIN').equals(new Member('u1', 'OBSERVER'))).toBe(
      true,
    );
    expect(new Member('u1', 'ADMIN').equals(new Member('u2', 'ADMIN'))).toBe(
      false,
    );
  });

  it('is false for a different entity type with the same id', () => {
    expect(new Member('x', 'ADMIN').equals(new Label('x'))).toBe(false);
  });

  it('is false for null and undefined', () => {
    const member = new Member('u1', 'ADMIN');
    expect(member.equals(null)).toBe(false);
    expect(member.equals(undefined)).toBe(false);
  });
});
