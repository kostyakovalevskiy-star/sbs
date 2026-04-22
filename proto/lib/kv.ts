const inMemoryStore = new Map<string, unknown>();

async function getKVFromUpstash<T>(key: string): Promise<T | null> {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
  return redis.get<T>(key);
}

async function setKVToUpstash(key: string, value: unknown): Promise<void> {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
  await redis.set(key, value);
}

async function listKVFromUpstash(prefix: string): Promise<string[]> {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
  return redis.keys(`${prefix}*`);
}

export async function getKV<T>(key: string): Promise<T | null> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return getKVFromUpstash<T>(key);
  }
  const value = inMemoryStore.get(key);
  return (value as T) ?? null;
}

export async function setKV(key: string, value: unknown): Promise<void> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return setKVToUpstash(key, value);
  }
  inMemoryStore.set(key, value);
}

export async function listKV(prefix: string): Promise<string[]> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return listKVFromUpstash(prefix);
  }
  const keys: string[] = [];
  for (const key of inMemoryStore.keys()) {
    if (key.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

export async function deleteKV(key: string): Promise<void> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
    await redis.del(key);
    return;
  }
  inMemoryStore.delete(key);
}
