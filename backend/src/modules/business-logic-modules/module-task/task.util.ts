import env from 'src/utils/env';

/** Compose the display key for a task (e.g. "TASK-123"). Never stored. */
export function buildTaskKey(sequenceId: number | null): string | null {
  if (sequenceId == null) return null;
  return `${env.TASK_KEY_PREFIX}-${sequenceId}`;
}
