export const CACHE_DEFAULT_TTL_MS = 5 * 60 * 1000;
export const CACHE_TTL_SHORT = 60 * 1000;
export const CACHE_TTL_MEDIUM = 15 * 60 * 1000;

// Keys are tenant-scoped by `schema` (IDBConfigOptions.schema_id). Without the
// schema prefix, tenants sharing the Redis instance would read each other's
// cached rows. ALWAYS pass the caller's ctx.schema_id.
export const cacheKey = {
  account: (schema: string, id: number | string) => `cyb:${schema}:account:${id}`,
  person: (schema: string, id: number | string) => `cyb:${schema}:person:${id}`,
  organization: (schema: string, id: number | string) => `cyb:${schema}:org:${id}`,
  team: (schema: string, id: number | string) => `cyb:${schema}:team:${id}`,
  fileSig: (schema: string, token: string) => `cyb:${schema}:file:sig:${token}`,
  fileLocalSig: (schema: string, token: string) => `cyb:${schema}:file:lsig:${token}`,
  fileUpload: (schema: string, token: string) => `cyb:${schema}:file:upload:${token}`,
  filePreview: (schema: string, token: string) => `cyb:${schema}:file:preview:${token}`,
  mailRate: (schema: string, purpose: string, email: string) => `cyb:${schema}:mail:rate:${purpose}:${email}`,
};
