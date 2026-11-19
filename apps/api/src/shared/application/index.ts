// Building blocks for command and query handlers in every context.
// Plain TypeScript, like the kernel.

export type { CommandHandler } from './command.js';
export type { QueryHandler } from './query.js';
export { UNIT_OF_WORK, type UnitOfWork } from './unit-of-work.js';
