/**
 * Values that survive `JSON.stringify` → `JSON.parse` unchanged.
 *
 * Event payloads end up in a `jsonb` column and on the wire, so they must be plain JSON.
 * A `Date` would silently turn into a string and a `Map` into `{}`. Use ISO strings for
 * timestamps and plain objects or arrays for collections.
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject;
export type JsonObject = { readonly [key: string]: JsonValue | undefined };

/**
 * Constraint for a payload type: every property must be JSON.
 *
 * Written as a mapped type so it works with `type` aliases and `interface`s alike
 * (an `interface` is never assignable to an index signature like `JsonObject`).
 */
export type JsonShape<T> = { readonly [K in keyof T]: JsonValue | undefined };
