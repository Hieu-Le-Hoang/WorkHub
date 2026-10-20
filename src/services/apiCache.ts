/**
 * Unified API Cache — localStorage + memory
 * Instant data on mount, persist qua F5, auto TTL expiry
 * Base: api-data-loading Wecare Skill
 */

const PREFIX = 'api_cache_';
const memory = new Map<string, { data: unknown; ts: number }>();

export function cacheGet<T>(key: string, ttl: number): T | null {
    const mem = memory.get(key);
    if (mem && Date.now() - mem.ts < ttl) return mem.data as T;

    try {
        const raw = localStorage.getItem(PREFIX + key);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts > ttl) {
            localStorage.removeItem(PREFIX + key);
            return null;
        }
        memory.set(key, { data, ts });
        return data as T;
    } catch { return null; }
}

export function cacheSet<T>(key: string, data: T): void {
    const entry = { data, ts: Date.now() };
    memory.set(key, entry);
    try { localStorage.setItem(PREFIX + key, JSON.stringify(entry)); } catch {}
}

export function cacheClear(key: string): void {
    memory.delete(key);
    localStorage.removeItem(PREFIX + key);
}
