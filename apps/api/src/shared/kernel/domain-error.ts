/**
 * A rule of the domain was broken. Carries a stable `code` and data, never user-facing text.
 *
 * - `code` is what clients branch on. It becomes `extensions.code` in GraphQL (docs/09 §3).
 * - `message` is an English fallback for logs and developers. Users see text translated
 *   from `code` at the edge (rule 15, docs/12).
 * - `details` is JSON-safe data the translation or the client may need
 *   (`{ currentVersion: 8 }`, `{ fields: { email: 'EMAIL_INVALID' } }`).
 *
 * Context errors extend this class and declare their own code:
 *
 * ```ts
 * export class LastAdminError extends DomainError {
 *   readonly code = 'LAST_ADMIN';
 *   constructor(workspaceId: string) {
 *     super('A workspace must keep at least one admin', { workspaceId });
 *   }
 * }
 * ```
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  readonly details: Readonly<Record<string, unknown>>;

  protected constructor(
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.details = Object.freeze({ ...details });
  }
}

/**
 * The thing doesn't exist, **or** the caller isn't allowed to know it does (rule 11).
 * Policies throw this rather than FORBIDDEN for private boards.
 */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';

  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`, { resource, id });
  }
}

/** Field name → error code, e.g. `{ email: 'EMAIL_INVALID' }`. Codes, not messages (rule 15). */
export type FieldErrors = Readonly<Record<string, string>>;

/** Input broke one or more value-object rules. Surfaces as `VALIDATION_FAILED` + `details.fields`. */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_FAILED';
  declare readonly details: Readonly<{ fields: FieldErrors }>;

  constructor(readonly fields: FieldErrors) {
    super(`Validation failed: ${Object.keys(fields).join(', ')}`, {
      fields: { ...fields },
    });
  }

  /** Shorthand for a single field. */
  static field(field: string, code: string): ValidationError {
    return new ValidationError({ [field]: code });
  }
}

/**
 * The aggregate changed since it was read. Two sources, one code:
 *
 * - a repository's versioned UPDATE matched 0 rows (lost race). Commutative commands
 *   retry on this.
 * - a client's `expectedVersion` is stale (text edits, rule 9). Never retried: the user
 *   resolves it in the conflict dialog.
 */
export class ConcurrencyError extends DomainError {
  readonly code = 'VERSION_CONFLICT';

  constructor(
    readonly aggregateType: string,
    readonly aggregateId: string,
    readonly expectedVersion: number,
    readonly currentVersion?: number,
  ) {
    super(
      `${aggregateType} ${aggregateId} is no longer at version ${expectedVersion}`,
      {
        aggregateType,
        aggregateId,
        expectedVersion,
        ...(currentVersion === undefined ? {} : { currentVersion }),
      },
    );
  }
}
