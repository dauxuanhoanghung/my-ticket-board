/**
 * The current time, as a port (UTC everywhere).
 *
 * Handlers read it once per command and pass `now` into aggregate methods, so the domain
 * itself never asks for the time. Tests inject a fixed clock.
 *
 * It's an abstract class rather than an interface so it can be the Nest DI token as well
 * as the type: `{ provide: Clock, useClass: SystemClock }`, then `constructor(clock: Clock)`.
 * Interfaces are erased at runtime and would need a separate `Symbol` token.
 */
export abstract class Clock {
  abstract now(): Date;
}
