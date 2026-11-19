/**
 * A read: `GetBoardSnapshot`, `GetMe`. Same shape as a command handler, but it
 * only reads. Query handlers may skip aggregates and read tables directly.
 */
export interface QueryHandler<TQuery, TResult> {
  execute(query: TQuery): Promise<TResult>;
}
