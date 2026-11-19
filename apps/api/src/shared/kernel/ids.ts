/**
 * Ids referenced by more than one bounded context.
 *
 * Every context points at users (members, assignees, actors), so `UserId` lives here.
 * Ids used by a single context (`TicketId`, `InvitationId`…) belong in that context's
 * `domain/`. Move an id here only once a second context needs it.
 *
 * Plain string aliases for now: they document intent, but the compiler doesn't stop
 * you from passing a `SessionId` where a `UserId` is expected.
 */
export type UserId = string;
export type SessionId = string;

// Version nibble 7, RFC 4122 variant (8, 9, a, b).
const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** True for a lowercase UUIDv7 string, the only id format the app generates (rule 10). */
export function isUuidV7(value: string): boolean {
  return UUID_V7.test(value);
}
