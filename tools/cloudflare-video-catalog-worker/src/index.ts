interface Env {
  CATALOG_BUCKET: R2Bucket;
  SOURCE_URL: string;
  OUTPUT_KEY: string;
  ALLOWED_ORIGIN: string;
  REFRESH_TOKEN?: string;
}
type Video = Record<string, unknown>;
type ApiPage = { total?: number; pages?: number; videos?: Video[] };
type ChunkInfo = { key: string; count: number };
type RefreshState = {
  runId: string;
  pages: number;
  nextPage: number;
  startedAt: string;
  chunks: ChunkInfo[];
};

const PAGE_BATCH_SIZE = 40;
const STATE_KEY = ".catalog-refresh/state.json";
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

async function fetchPage(sourceUrl: string, page: number): Promise<ApiPage> {
  const url = new URL(sourceUrl);
  url.searchParams.set("page", String(page));
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok)
        throw new Error(`Page ${page} returned HTTP ${response.status}`);
      return (await response.json()) as ApiPage;
    } catch (error) {
      lastError = error;
      if (attempt < 3)
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Could not fetch page ${page}`);
}

async function readState(env: Env): Promise<RefreshState | null> {
  const object = await env.CATALOG_BUCKET.get(STATE_KEY);
  return object ? object.json<RefreshState>() : null;
}

async function writeState(env: Env, state: RefreshState): Promise<void> {
  await env.CATALOG_BUCKET.put(STATE_KEY, JSON.stringify(state), {
    httpMetadata: { contentType: "application/json" },
  });
}

async function initializeRefresh(env: Env): Promise<RefreshState> {
  const first = await fetchPage(env.SOURCE_URL, 1);
  const runId = crypto.randomUUID();
  const key = `.catalog-refresh/${runId}/1-1.json`;
  const videos = first.videos || [];
  await env.CATALOG_BUCKET.put(key, JSON.stringify(videos), {
    httpMetadata: { contentType: "application/json" },
  });
  const state: RefreshState = {
    runId,
    pages: Math.max(1, Number(first.pages) || 1),
    nextPage: 2,
    startedAt: new Date().toISOString(),
    chunks: [{ key, count: videos.length }],
  };
  await writeState(env, state);
  return state;
}

async function fetchNextBatch(
  env: Env,
  state: RefreshState,
): Promise<RefreshState> {
  if (state.nextPage > state.pages) return state;
  const start = state.nextPage;
  const end = Math.min(state.pages, start + PAGE_BATCH_SIZE - 1);
  const collected: Video[] = [];
  for (let cursor = start; cursor <= end; cursor += 6) {
    const pages = Array.from(
      { length: Math.min(6, end - cursor + 1) },
      (_, offset) => cursor + offset,
    );
    const results = await Promise.all(
      pages.map((page) => fetchPage(env.SOURCE_URL, page)),
    );
    for (const result of results) collected.push(...(result.videos || []));
  }
  const key = `.catalog-refresh/${state.runId}/${start}-${end}.json`;
  await env.CATALOG_BUCKET.put(key, JSON.stringify(collected), {
    httpMetadata: { contentType: "application/json" },
  });
  const next = {
    ...state,
    nextPage: end + 1,
    chunks: [...state.chunks, { key, count: collected.length }],
  };
  await writeState(env, next);
  return next;
}

async function publish(env: Env, state: RefreshState): Promise<void> {
  const arrays: string[] = [];
  for (const chunk of state.chunks) {
    const object = await env.CATALOG_BUCKET.get(chunk.key);
    if (!object) throw new Error(`Missing refresh chunk ${chunk.key}`);
    const text = (await object.text()).trim();
    arrays.push(
      text.startsWith("[") && text.endsWith("]") ? text.slice(1, -1) : "",
    );
  }
  const total = state.chunks.reduce((sum, chunk) => sum + chunk.count, 0);
  const updatedAt = new Date().toISOString();
  const videosJson = arrays.filter(Boolean).join(",");
  const catalog = `{"total":${total},"pages":${state.pages},"updatedAt":${JSON.stringify(updatedAt)},"videos":[${videosJson}]}`;
  await env.CATALOG_BUCKET.put(env.OUTPUT_KEY, catalog, {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
      cacheControl:
        "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
    },
    customMetadata: {
      updatedAt,
      total: String(total),
      pages: String(state.pages),
    },
  });
  await Promise.all([
    env.CATALOG_BUCKET.delete(STATE_KEY),
    ...state.chunks.map(({ key }) => env.CATALOG_BUCKET.delete(key)),
  ]);
}

async function shouldStart(env: Env): Promise<boolean> {
  const current = await env.CATALOG_BUCKET.head(env.OUTPUT_KEY);
  if (!current) return true;
  const updatedAt = Date.parse(current.customMetadata?.updatedAt || "");
  return (
    !Number.isFinite(updatedAt) || Date.now() - updatedAt >= REFRESH_AFTER_MS
  );
}

async function runBatch(env: Env, forceStart = false) {
  let state = await readState(env);
  if (!state) {
    if (!forceStart && !(await shouldStart(env)))
      return {
        status: "current",
        message: "Catalog is less than 24 hours old",
      };
    state = await initializeRefresh(env);
    if (state.nextPage <= state.pages)
      return {
        status: "started",
        nextPage: state.nextPage,
        pages: state.pages,
      };
  }
  state = await fetchNextBatch(env, state);
  if (state.nextPage <= state.pages)
    return { status: "running", nextPage: state.nextPage, pages: state.pages };
  await publish(env, state);
  return {
    status: "complete",
    total: state.chunks.reduce((sum, chunk) => sum + chunk.count, 0),
    pages: state.pages,
  };
}

function cors(env: Env): HeadersInit {
  return {
    "access-control-allow-origin": env.ALLOWED_ORIGIN || "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
  };
}

function authorized(request: Request, env: Env): boolean {
  return (
    Boolean(env.REFRESH_TOKEN) &&
    request.headers.get("authorization") === `Bearer ${env.REFRESH_TOKEN}`
  );
}

export default {
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await runBatch(env);
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors(env) });
    if (request.method === "POST" && url.pathname === "/refresh") {
      if (!authorized(request, env))
        return Response.json(
          { error: "Unauthorized" },
          { status: 401, headers: cors(env) },
        );
      try {
        const result = await runBatch(env, true);
        return Response.json(result, { status: 202, headers: cors(env) });
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Refresh failed" },
          { status: 500, headers: cors(env) },
        );
      }
    }
    if (
      request.method === "GET" &&
      (url.pathname === "/" || url.pathname === "/status")
    ) {
      const [object, state] = await Promise.all([
        env.CATALOG_BUCKET.head(env.OUTPUT_KEY),
        readState(env),
      ]);
      return Response.json(
        {
          ready: Boolean(object),
          key: env.OUTPUT_KEY,
          ...(object?.customMetadata || {}),
          refresh: state
            ? {
                status: "running",
                nextPage: state.nextPage,
                pages: state.pages,
              }
            : { status: "idle" },
        },
        { headers: { ...cors(env), "cache-control": "no-store" } },
      );
    }
    if (request.method === "GET" && url.pathname === "/videos.json") {
      const object = await env.CATALOG_BUCKET.get(env.OUTPUT_KEY);
      if (!object)
        return Response.json(
          { error: "Catalog has not been generated yet" },
          { status: 404, headers: cors(env) },
        );
      const headers = new Headers(cors(env));
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      return new Response(object.body, { headers });
    }
    return new Response("Not found", { status: 404, headers: cors(env) });
  },
};
