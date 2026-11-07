import { err } from '../errors/app-exception';

/**
 * PURE status machine (README section 7). No database, no framework state,
 * so it is trivially unit-testable (target: 100% coverage).
 * Any transition not listed here is invalid -> 409 INVALID_STATUS_TRANSITION.
 */
export type Actor = 'CUSTOMER' | 'CONTRACTOR' | 'SYSTEM';
export type Entity = 'PROBLEM' | 'BOOKING';

export type ProblemState = 'OPEN' | 'BOOKED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
export type BookingState =
  | 'SCHEDULED'
  | 'ON_THE_WAY'
  | 'IN_PROGRESS'
  | 'AWAITING_CONFIRMATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

type Table<S extends string> = Partial<Record<S, Partial<Record<S, Actor[]>>>>;

export const PROBLEM_TRANSITIONS: Table<ProblemState> = {
  OPEN: {
    BOOKED: ['CUSTOMER'], // customer accepts a quote
    CANCELLED: ['CUSTOMER'],
    EXPIRED: ['SYSTEM'],
  },
  BOOKED: {
    COMPLETED: ['SYSTEM'], // booking completes
    CANCELLED: ['SYSTEM'], // booking cancelled
  },
};

export const BOOKING_TRANSITIONS: Table<BookingState> = {
  SCHEDULED: {
    ON_THE_WAY: ['CONTRACTOR'],
    CANCELLED: ['CUSTOMER', 'CONTRACTOR'],
  },
  ON_THE_WAY: {
    IN_PROGRESS: ['CONTRACTOR'],
    CANCELLED: ['CONTRACTOR'],
  },
  IN_PROGRESS: {
    AWAITING_CONFIRMATION: ['CONTRACTOR'],
  },
  AWAITING_CONFIRMATION: {
    COMPLETED: ['CUSTOMER', 'SYSTEM'], // system = 72h auto-complete
    // DISPUTED: Phase 3
  },
};

const label = (e: Entity) => (e === 'PROBLEM' ? 'Problem' : 'Booking');

export function checkTransition(entity: Entity, from: string, to: string, actor: Actor): void {
  const table = (entity === 'PROBLEM' ? PROBLEM_TRANSITIONS : BOOKING_TRANSITIONS) as Record<
    string,
    Record<string, Actor[]> | undefined
  >;
  const allowedActors = table[from]?.[to];
  if (!allowedActors) {
    throw err.conflict('INVALID_STATUS_TRANSITION', `${label(entity)} cannot move from ${from} to ${to}.`);
  }
  if (!allowedActors.includes(actor)) {
    throw err.forbidden(`A ${actor.toLowerCase()} cannot move a ${label(entity).toLowerCase()} from ${from} to ${to}.`);
  }
}

export function canTransition(entity: Entity, from: string, to: string, actor: Actor): boolean {
  try {
    checkTransition(entity, from, to, actor);
    return true;
  } catch {
    return false;
  }
}
