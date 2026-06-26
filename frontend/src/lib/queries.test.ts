import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock the api-client module
const mockPost = vi.fn();
const mockGet = vi.fn();

vi.mock('./api-client', () => ({
  createApiClient: () => ({ post: mockPost, get: mockGet }),
}));

// Mock auth-context so we don't need AuthProvider
vi.mock('./auth-context', () => ({
  useAuth: () => ({ user: { id: '42', slug: 'alice', email: 'a@b.com', role: 'member' }, token: 'tok' }),
}));

import { useStartInitiative, useMyInitiatives, useOkrTree, useInitiativeTimeline } from './queries';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('queries', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
  });

  it('useStartInitiative POSTs to /tracking/initiatives/:slug/start', async () => {
    mockPost.mockResolvedValue({ id: 1, type: 'started' });
    const { result } = renderHook(() => useStartInitiative(), {
      wrapper: makeWrapper(),
    });
    result.current.mutate({ slug: 'my-initiative' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPost).toHaveBeenCalledWith('/tracking/initiatives/my-initiative/start', {});
  });

  it('useMyInitiatives POSTs to /initiatives/search with ownerPersonId', async () => {
    mockPost.mockResolvedValue({ items: [], total: 0 });
    const { result } = renderHook(() => useMyInitiatives(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPost).toHaveBeenCalledWith('/initiatives/search', { ownerPersonId: '42' });
  });

  it('useOkrTree GETs /okr/tree/:slug', async () => {
    mockGet.mockResolvedValue({ objective: { title: 'Grow' }, keyResults: [], children: [] });
    const { result } = renderHook(() => useOkrTree('grow-2024'), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith('/okr/tree/grow-2024');
  });

  it('useInitiativeTimeline GETs /tracking/initiatives/:slug/timeline', async () => {
    mockGet.mockResolvedValue([]);
    const { result } = renderHook(() => useInitiativeTimeline('my-initiative'), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith('/tracking/initiatives/my-initiative/timeline');
  });
});
