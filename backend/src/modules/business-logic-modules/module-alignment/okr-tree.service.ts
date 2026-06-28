import { Injectable } from '@nestjs/common';
import { IDBConfigOptions } from '../../../infra/application-db/application-db.module';
import { ObjectiveRepository } from '../module-objective/objective.repo';
import { KeyResultRepository } from '../module-key-result/key-result.repo';
import { AlignmentRepository } from './alignment.repo';
import { IObjectiveEntity } from '../module-objective/objective.interface';
import { IKeyResultEntity } from '../module-key-result/key-result.interface';
import { AppException } from '../../../utils/exception.provider';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type PaceStatus = 'ahead' | 'on_track' | 'behind';

export interface KrProgress {
  keyResult: IKeyResultEntity;
  progressPct: number;
  paceStatus: PaceStatus;
}

export interface OkrTreeNode {
  objective: IObjectiveEntity;
  keyResults: KrProgress[];
  children: OkrTreeNode[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class OkrTreeService {
  constructor(
    private readonly objectiveRepo: ObjectiveRepository,
    private readonly keyResultRepo: KeyResultRepository,
    private readonly alignmentRepo: AlignmentRepository,
  ) {}

  /**
   * Compute direction-aware progress for a single key result.
   * Pure — no I/O.
   */
  computeKrProgress(kr: IKeyResultEntity): KrProgress {
    const start = parseFloat(kr.startValue ?? '0');
    const target = parseFloat(kr.targetValue ?? '0');
    const current = parseFloat(kr.currentValue ?? '0');

    let progressPct: number;

    const denominator =
      kr.direction === 'increase' ? target - start : start - target;

    if (denominator === 0) {
      // If denominator is zero the target equals the start; treat as complete
      // only when current already meets/exceeds the target.
      if (kr.direction === 'increase') {
        progressPct = current >= target ? 1 : 0;
      } else {
        progressPct = current <= target ? 1 : 0;
      }
    } else {
      const raw =
        kr.direction === 'increase'
          ? (current - start) / (target - start)
          : (start - current) / (start - target);

      // Guard NaN → 0
      progressPct = isNaN(raw) ? 0 : Math.min(1, Math.max(0, raw));
    }

    return {
      keyResult: kr,
      progressPct,
      // NOTE: This is a placeholder pace heuristic — the objective's `period`
      // field is a label string (e.g. "2024-Q1"), not a start/end date pair,
      // so elapsed fraction cannot be reliably computed in this phase.
      // Replace with time-bounded logic once periods carry dates.
      paceStatus: progressPct >= 0.7 ? 'ahead' : progressPct >= 0.4 ? 'on_track' : 'behind',
    };
  }

  /**
   * Recursively build the OKR tree rooted at the given objective.
   * Cycle guard: a visited Set of objective IDs prevents infinite loops on
   * cyclic alignment links (e.g. A → B → A).
   */
  async buildTree(
    rootObjectiveId: number,
    ctx: IDBConfigOptions,
    visited: Set<number> = new Set(),
  ): Promise<OkrTreeNode> {
    if (visited.has(rootObjectiveId)) {
      // Cycle detected — return a leaf node (no children) to break the loop
      const obj = await this.objectiveRepo.findById(rootObjectiveId, ctx);
      if (!obj) AppException.notFound('Objective', rootObjectiveId);
      return { objective: obj, keyResults: [], children: [] };
    }

    visited.add(rootObjectiveId);

    const [objective, krs, alignmentRows] = await Promise.all([
      this.objectiveRepo.findById(rootObjectiveId, ctx),
      this.keyResultRepo.findByObjectiveId(rootObjectiveId, ctx),
      this.alignmentRepo.findChildren('objective', rootObjectiveId, ctx),
    ]);

    if (!objective) AppException.notFound('Objective', rootObjectiveId);

    const keyResults: KrProgress[] = krs.map((kr) => this.computeKrProgress(kr));

    // Recurse into each child objective alignment link
    const children: OkrTreeNode[] = [];
    for (const row of alignmentRows) {
      if (row.fromType === 'objective') {
        const childNode = await this.buildTree(row.fromId, ctx, visited);
        children.push(childNode);
      }
    }

    return { objective, keyResults, children };
  }
}
