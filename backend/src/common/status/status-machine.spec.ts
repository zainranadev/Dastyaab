import { AppException } from '../errors/app-exception';
import {
  Actor,
  BOOKING_TRANSITIONS,
  BookingState,
  PROBLEM_TRANSITIONS,
  ProblemState,
  canTransition,
  checkTransition,
} from './status-machine';

const PROBLEM_STATES: ProblemState[] = ['OPEN', 'BOOKED', 'COMPLETED', 'CANCELLED', 'EXPIRED'];
const BOOKING_STATES: BookingState[] = [
  'SCHEDULED', 'ON_THE_WAY', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'COMPLETED', 'CANCELLED', 'DISPUTED',
];
const ACTORS: Actor[] = ['CUSTOMER', 'CONTRACTOR', 'SYSTEM'];

function catchError(fn: () => void): AppException {
  try {
    fn();
  } catch (e) {
    return e as AppException;
  }
  throw new Error('expected an error but none was thrown');
}

describe('status machine (README section 7, D8)', () => {
  describe('booking transitions', () => {
    it('allows every listed transition for its allowed actors', () => {
      for (const [from, targets] of Object.entries(BOOKING_TRANSITIONS)) {
        for (const [to, actors] of Object.entries(targets!)) {
          for (const actor of actors!) {
            expect(() => checkTransition('BOOKING', from, to, actor)).not.toThrow();
          }
        }
      }
    });

    it('BR-32: only the contractor moves a booking forward', () => {
      expect(canTransition('BOOKING', 'SCHEDULED', 'ON_THE_WAY', 'CONTRACTOR')).toBe(true);
      expect(canTransition('BOOKING', 'SCHEDULED', 'ON_THE_WAY', 'CUSTOMER')).toBe(false);
      expect(canTransition('BOOKING', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'CUSTOMER')).toBe(false);
    });

    it('BR-33/BR-34: customer or system (72h) completes; contractor cannot', () => {
      expect(canTransition('BOOKING', 'AWAITING_CONFIRMATION', 'COMPLETED', 'CUSTOMER')).toBe(true);
      expect(canTransition('BOOKING', 'AWAITING_CONFIRMATION', 'COMPLETED', 'SYSTEM')).toBe(true);
      expect(canTransition('BOOKING', 'AWAITING_CONFIRMATION', 'COMPLETED', 'CONTRACTOR')).toBe(false);
    });

    it('BR-35: customer cancels only while SCHEDULED; contractor while SCHEDULED or ON_THE_WAY', () => {
      expect(canTransition('BOOKING', 'SCHEDULED', 'CANCELLED', 'CUSTOMER')).toBe(true);
      expect(canTransition('BOOKING', 'ON_THE_WAY', 'CANCELLED', 'CUSTOMER')).toBe(false);
      expect(canTransition('BOOKING', 'SCHEDULED', 'CANCELLED', 'CONTRACTOR')).toBe(true);
      expect(canTransition('BOOKING', 'ON_THE_WAY', 'CANCELLED', 'CONTRACTOR')).toBe(true);
      expect(canTransition('BOOKING', 'IN_PROGRESS', 'CANCELLED', 'CONTRACTOR')).toBe(false);
    });

    it('rejects every unlisted pair with 409 INVALID_STATUS_TRANSITION', () => {
      for (const from of BOOKING_STATES) {
        for (const to of BOOKING_STATES) {
          if (BOOKING_TRANSITIONS[from]?.[to]) continue;
          const e = catchError(() => checkTransition('BOOKING', from, to, 'SYSTEM'));
          expect(e.getStatus()).toBe(409);
          expect(e.code).toBe('INVALID_STATUS_TRANSITION');
        }
      }
    });

    it('uses the README message', () => {
      const e = catchError(() => checkTransition('BOOKING', 'SCHEDULED', 'COMPLETED', 'CUSTOMER'));
      expect(e.message).toBe('Booking cannot move from SCHEDULED to COMPLETED.');
    });

    it('returns 403 FORBIDDEN (not 409) when the move is valid but the actor is wrong', () => {
      const e = catchError(() => checkTransition('BOOKING', 'SCHEDULED', 'ON_THE_WAY', 'CUSTOMER'));
      expect(e.getStatus()).toBe(403);
      expect(e.code).toBe('FORBIDDEN');
    });

    it('terminal states have no exits', () => {
      for (const terminal of ['COMPLETED', 'CANCELLED'] as const) {
        for (const to of BOOKING_STATES) {
          for (const actor of ACTORS) expect(canTransition('BOOKING', terminal, to, actor)).toBe(false);
        }
      }
    });

    it('DISPUTED is not reachable in Phase 1', () => {
      for (const from of BOOKING_STATES) {
        for (const actor of ACTORS) expect(canTransition('BOOKING', from, 'DISPUTED', actor)).toBe(false);
      }
    });
  });

  describe('problem transitions', () => {
    it('allows every listed transition for its allowed actors', () => {
      for (const [from, targets] of Object.entries(PROBLEM_TRANSITIONS)) {
        for (const [to, actors] of Object.entries(targets!)) {
          for (const actor of actors!) {
            expect(() => checkTransition('PROBLEM', from, to, actor)).not.toThrow();
          }
        }
      }
    });

    it('BR-13: only the system expires a problem', () => {
      expect(canTransition('PROBLEM', 'OPEN', 'EXPIRED', 'SYSTEM')).toBe(true);
      expect(canTransition('PROBLEM', 'OPEN', 'EXPIRED', 'CUSTOMER')).toBe(false);
    });

    it('BR-15: customer cancels while OPEN only', () => {
      expect(canTransition('PROBLEM', 'OPEN', 'CANCELLED', 'CUSTOMER')).toBe(true);
      expect(canTransition('PROBLEM', 'BOOKED', 'CANCELLED', 'CUSTOMER')).toBe(false);
    });

    it('rejects every unlisted pair with 409 and the Problem label', () => {
      for (const from of PROBLEM_STATES) {
        for (const to of PROBLEM_STATES) {
          if (PROBLEM_TRANSITIONS[from]?.[to]) continue;
          const e = catchError(() => checkTransition('PROBLEM', from, to, 'SYSTEM'));
          expect(e.getStatus()).toBe(409);
          expect(e.message).toBe(`Problem cannot move from ${from} to ${to}.`);
        }
      }
    });
  });
});
