export const CACHE_DEFAULT_TTL_MS = 5 * 60 * 1000;
export const CACHE_TTL_SHORT = 60 * 1000;
export const CACHE_TTL_MEDIUM = 15 * 60 * 1000;

export const cacheKey = {
  person: (id: string) => `cyb:person:${id}`,
  organization: (id: string) => `cyb:org:${id}`,
  team: (id: string) => `cyb:team:${id}`,
};
