/**
 * A request to change something, as plain data: `RegisterUser`, `MoveTicket`.
 *
 * ```ts
 * export interface RegisterUser {
 *   readonly email: string;
 *   readonly fullName: string;
 *   readonly password: string;
 * }
 *
 * export class RegisterUserHandler implements CommandHandler<RegisterUser> {
 *   async execute(command: RegisterUser): Promise<void> { … }
 * }
 * ```
 *
 * The resolver calls `handler.execute(command)` directly. There's no command bus.
 */
export interface CommandHandler<TCommand, TResult = void> {
  execute(command: TCommand): Promise<TResult>;
}
