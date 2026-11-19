/**
 * Something with an identity that persists while its attributes change.
 *
 * Two entities are equal when they're the same kind and have the same id, whatever their
 * other fields say. Entities that aren't aggregate roots (`BoardMember`, `ChecklistItem`)
 * live inside an aggregate and are never loaded or saved on their own.
 */
export abstract class Entity<TId extends string> {
  protected constructor(readonly id: TId) {}

  equals(other: Entity<TId> | null | undefined): boolean {
    if (other === null || other === undefined) return false;
    if (other === this) return true;
    return other.constructor === this.constructor && other.id === this.id;
  }
}
