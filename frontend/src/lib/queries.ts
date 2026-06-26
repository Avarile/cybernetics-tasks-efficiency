import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createApiClient } from './api-client';
import { useAuth } from './auth-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KrProgress {
  keyResult: { id: number; slug: string; title: string; target: number; unit: string };
  progressPct: number;
  paceStatus: 'behind' | 'on_track' | 'ahead';
}

export interface OkrTreeNode {
  objective: { id: number; slug: string; title: string; description?: string };
  keyResults: KrProgress[];
  children: OkrTreeNode[];
}

export interface Initiative {
  id: number;
  slug: string;
  title: string;
  status?: string;
  ownerPersonId?: number;
}

export interface ActivityEvent {
  id: number;
  slug: string;
  occurredAt: string;
  recordedAt: string | null;
  actorPersonId: number;
  subjectType: string;
  subjectId: number;
  type: string;
  payload: Record<string, unknown>;
  source: string;
}

// ---------------------------------------------------------------------------
// Shared client factory
// ---------------------------------------------------------------------------

function useApiClient() {
  const { token } = useAuth();
  return createApiClient({
    baseUrl: '/api',
    getToken: () => token,
  });
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useOkrTree(objectiveSlug: string) {
  const client = useApiClient();
  return useQuery<OkrTreeNode>({
    queryKey: ['okr-tree', objectiveSlug],
    queryFn: () => client.get<OkrTreeNode>(`/okr/tree/${objectiveSlug}`),
    enabled: !!objectiveSlug,
  });
}

export function useMyInitiatives() {
  const client = useApiClient();
  const { user } = useAuth();
  return useQuery<{ items: Initiative[]; total: number }>({
    queryKey: ['my-initiatives', user?.id],
    queryFn: () =>
      client.post<{ items: Initiative[]; total: number }>('/initiatives/search', {
        ownerPersonId: user?.id,
      }),
    enabled: !!user?.id,
  });
}

export function useInitiativeTimeline(slug: string) {
  const client = useApiClient();
  return useQuery<ActivityEvent[]>({
    queryKey: ['initiative-timeline', slug],
    queryFn: () => client.get<ActivityEvent[]>(`/tracking/initiatives/${slug}/timeline`),
    enabled: !!slug,
  });
}

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

type SlugMutationVars = { slug: string; payload?: Record<string, unknown> };

function useLifecycleMutation(action: string) {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, payload = {} }: SlugMutationVars) =>
      client.post(`/tracking/initiatives/${slug}/${action}`, payload),
    onSuccess: (_data, { slug }) => {
      void qc.invalidateQueries({ queryKey: ['my-initiatives'] });
      void qc.invalidateQueries({ queryKey: ['initiative-timeline', slug] });
    },
  });
}

export function useStartInitiative() {
  return useLifecycleMutation('start');
}

export function usePauseInitiative() {
  return useLifecycleMutation('pause');
}

export function useResumeInitiative() {
  return useLifecycleMutation('resume');
}

export function useBlockInitiative() {
  return useLifecycleMutation('block');
}

export function useUnblockInitiative() {
  return useLifecycleMutation('unblock');
}

export function useCompleteInitiative() {
  return useLifecycleMutation('complete');
}

export function useCancelInitiative() {
  return useLifecycleMutation('cancel');
}

export function useLogTime() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, minutes }: { slug: string; minutes: number }) =>
      client.post(`/tracking/initiatives/${slug}/time`, { minutes }),
    onSuccess: (_data, { slug }) => {
      void qc.invalidateQueries({ queryKey: ['my-initiatives'] });
      void qc.invalidateQueries({ queryKey: ['initiative-timeline', slug] });
    },
  });
}

export function useRecordOutcome() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, result }: { slug: string; result: string }) =>
      client.post(`/tracking/initiatives/${slug}/outcome`, { result }),
    onSuccess: (_data, { slug }) => {
      void qc.invalidateQueries({ queryKey: ['my-initiatives'] });
      void qc.invalidateQueries({ queryKey: ['initiative-timeline', slug] });
    },
  });
}

export function useMeasureKr() {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, value }: { slug: string; value: number }) =>
      client.post(`/tracking/key-results/${slug}/measure`, { value }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['okr-tree'] });
    },
  });
}
