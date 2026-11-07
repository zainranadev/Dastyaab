import { Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { err } from '../errors/app-exception';
import { Actor, Entity, checkTransition } from './status-machine';

export interface TransitionInput {
  entity: Entity;
  id: string;
  from: string;
  to: string;
  actor: Actor;
  changedBy: string | null;
  note?: string;
  completedAt?: Date;
}

/**
 * D8: EVERY status change in the app goes through `transition()`.
 * It (1) validates the table, (2) updates with a compare-and-set on the old status
 * (so two concurrent requests can never both win), and (3) writes status_history.
 * Always call it inside a prisma.$transaction so the change and its side effects commit together.
 */
@Injectable()
export class StatusService {
  async transition(tx: Prisma.TransactionClient, input: TransitionInput): Promise<void> {
    const { entity, id, from, to, actor, changedBy, note } = input;
    checkTransition(entity, from, to, actor);

    const count =
      entity === 'PROBLEM'
        ? (
            await tx.problem.updateMany({
              where: { id, status: from as never },
              data: { status: to as never },
            })
          ).count
        : (
            await tx.booking.updateMany({
              where: { id, status: from as never },
              data: { status: to as never, ...(input.completedAt ? { completedAt: input.completedAt } : {}) },
            })
          ).count;

    if (count !== 1) {
      throw entity === 'PROBLEM' && from === 'OPEN'
        ? err.conflict('PROBLEM_NOT_OPEN', 'This problem is no longer open.')
        : err.conflict('INVALID_STATUS_TRANSITION', `${entity === 'PROBLEM' ? 'Problem' : 'Booking'} is no longer ${from}.`);
    }
    await this.record(tx, { entity, id, from, to, changedBy, note });
  }

  async record(
    tx: Prisma.TransactionClient,
    r: { entity: Entity; id: string; from: string | null; to: string; changedBy: string | null; note?: string },
  ): Promise<void> {
    await tx.statusHistory.create({
      data: {
        entityType: r.entity,
        entityId: r.id,
        fromStatus: r.from,
        toStatus: r.to,
        changedBy: r.changedBy,
        note: r.note ?? null,
      },
    });
  }
}

@Global()
@Module({ providers: [StatusService], exports: [StatusService] })
export class StatusModule {}
