import { ValidationError, type FieldErrors } from './domain-error.js';

/**
 * Success or failure as a value, for operations where failing is normal: mainly
 * value-object factories (`Email.create(raw)`), so a handler can collect every field
 * error into one `VALIDATION_FAILED` instead of stopping at the first.
 *
 * Convention in this codebase:
 * - VO factories return `Result<Vo, string>` where the string is an error code.
 * - Aggregate methods **throw** a `DomainError` when an invariant is broken.
 *
 * It's a plain discriminated union, so `if (!r.success) return r;` narrows without
 * helpers (the same shape as zod's `safeParse`).
 */
export type Ok<T> = { readonly success: true; readonly value: T };
export type Fail<E> = { readonly success: false; readonly error: E };
export type Result<T, E = string> = Ok<T> | Fail<E>;

export function ok<T>(value: T): Ok<T> {
  return { success: true, value };
}

export function fail<E>(error: E): Fail<E> {
  return { success: false, error };
}

/**
 * Returns the value or throws. Use it where failure is a bug (tests, already-validated
 * data), not as a way to skip handling a real failure.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.success) return result.value;
  const { error } = result;
  throw error instanceof Error
    ? error
    : new Error(`unwrap() on a failed Result: ${String(error)}`);
}

type OkValues<T extends Record<string, Result<unknown, string>>> = {
  readonly [K in keyof T]: T[K] extends Result<infer V, string> ? V : never;
};

/**
 * Validates several fields at once. Every failure is reported, keyed by field name.
 *
 * ```ts
 * const input = validateFields({
 *   email: Email.create(cmd.email),
 *   fullName: FullName.create(cmd.fullName),
 * });
 * if (!input.success) throw input.error;         // ValidationError { email: 'EMAIL_INVALID', … }
 * const { email, fullName } = input.value;   // typed as Email and FullName
 * ```
 */
export function validateFields<
  T extends Record<string, Result<unknown, string>>,
>(fields: T): Result<OkValues<T>, ValidationError> {
  const errors: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  for (const [name, result] of Object.entries(fields)) {
    if (result.success) values[name] = result.value;
    else errors[name] = result.error;
  }

  if (Object.keys(errors).length > 0)
    return fail(new ValidationError(errors satisfies FieldErrors));
  return ok(values as OkValues<T>);
}
