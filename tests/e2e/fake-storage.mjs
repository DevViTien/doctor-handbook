// Fake Supabase Storage for E2E tests (change add-patient-avatars, design §7).
//
// Implements only the Storage API routes the app uses (storage-js 2.119), in memory:
//   POST   /storage/v1/object/upload/sign/:bucket/:path        → { url, token }
//   PUT    /storage/v1/object/upload/sign/:bucket/:path?token  → { Key }
//   POST   /storage/v1/object/sign/:bucket/:path               → { signedURL }
//   POST   /storage/v1/object/sign/:bucket   { paths }         → [{ path, signedURL, error }]
//   GET    /storage/v1/object/sign/:bucket/:path?token         → the bytes
//   DELETE /storage/v1/object/:bucket        { prefixes }      → [{ name }]
//   POST   /storage/v1/object/list/:bucket   { prefix }        → [{ name }]
// plus test-only routes under /__fake (list, read, write, reset, fail) and /health.
// POST /__fake/fail { route: "list" } makes the list route answer 500 until the next reset.
// Never part of the app bundle.
import { randomBytes } from "node:crypto";
import http from "node:http";

const PORT = Number(process.env.FAKE_STORAGE_PORT ?? 54321);
const objects = new Map(); // "bucket/path" -> { body: Buffer, type, cacheControl }
const tokens = new Map(); // token -> { key, kind: "upload" | "read", expiresAt }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

function send(res, status, body, headers = {}) {
  const isBuffer = Buffer.isBuffer(body);
  res.writeHead(status, {
    ...CORS,
    ...(isBuffer ? {} : { "Content-Type": "application/json" }),
    ...headers,
  });
  res.end(isBuffer ? body : JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const json = async (req) => {
  const raw = await readBody(req);
  return raw.length ? JSON.parse(raw.toString("utf8")) : {};
};

function issue(key, kind, seconds) {
  const token = randomBytes(16).toString("hex");
  tokens.set(token, { key, kind, expiresAt: Date.now() + seconds * 1000 });
  return token;
}

function check(token, key, kind) {
  const entry = token ? tokens.get(token) : undefined;
  return Boolean(entry && entry.key === key && entry.kind === kind && entry.expiresAt > Date.now());
}

/** Routes switched to fail by POST /__fake/fail (cleared by the reset). */
const failing = new Set();

const notFound = { statusCode: "404", error: "not_found", message: "Object not found" };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://fake");
    const path = decodeURIComponent(url.pathname);
    if (req.method === "OPTIONS") return send(res, 204, {});
    if (path === "/health") return send(res, 200, { ok: true });

    // --- Test-only routes ---
    if (path === "/__fake/objects" && req.method === "GET") {
      const prefix = url.searchParams.get("prefix") ?? "";
      const list = [...objects.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({ key, size: value.body.length, type: value.type }));
      return send(res, 200, list);
    }
    if (path === "/__fake/fail" && req.method === "POST") {
      const { route } = await json(req);
      failing.add(String(route));
      return send(res, 200, { ok: true });
    }
    if (path === "/__fake/objects" && req.method === "DELETE") {
      objects.clear();
      tokens.clear();
      failing.clear();
      return send(res, 200, { ok: true });
    }
    if (path === "/__fake/object") {
      const key = url.searchParams.get("key") ?? "";
      if (req.method === "PUT") {
        objects.set(key, {
          body: await readBody(req),
          type: req.headers["content-type"] ?? "application/octet-stream",
          cacheControl: "max-age=3600",
        });
        return send(res, 200, { ok: true });
      }
      const object = objects.get(key);
      return object
        ? send(res, 200, object.body, { "Content-Type": object.type })
        : send(res, 404, notFound);
    }

    // --- Storage API ---
    const api = path.replace(/^\/storage\/v1/, "");
    let match = api.match(/^\/object\/upload\/sign\/([^/]+)\/(.+)$/);
    if (match) {
      const key = `${match[1]}/${match[2]}`;
      if (req.method === "POST") {
        const token = issue(key, "upload", 2 * 60 * 60);
        return send(res, 200, { url: `/object/upload/sign/${key}?token=${token}`, token });
      }
      if (req.method === "PUT") {
        if (!check(url.searchParams.get("token"), key, "upload")) {
          return send(res, 400, {
            statusCode: "403",
            error: "invalid_token",
            message: "Invalid token",
          });
        }
        objects.set(key, {
          body: await readBody(req),
          type: req.headers["content-type"] ?? "application/octet-stream",
          cacheControl: req.headers["cache-control"] ?? "max-age=3600",
        });
        return send(res, 200, { Key: key });
      }
    }
    match = api.match(/^\/object\/sign\/([^/]+)\/(.+)$/);
    if (match) {
      const key = `${match[1]}/${match[2]}`;
      if (req.method === "POST") {
        const { expiresIn = 60 } = await json(req);
        if (!objects.has(key)) return send(res, 400, notFound);
        return send(res, 200, {
          signedURL: `/object/sign/${key}?token=${issue(key, "read", expiresIn)}`,
        });
      }
      if (req.method === "GET") {
        const object = objects.get(key);
        if (!object || !check(url.searchParams.get("token"), key, "read"))
          return send(res, 400, notFound);
        return send(res, 200, object.body, {
          "Content-Type": object.type,
          "Cache-Control": object.cacheControl,
        });
      }
    }
    match = api.match(/^\/object\/sign\/([^/]+)$/);
    if (match && req.method === "POST") {
      const bucket = match[1];
      const { expiresIn = 60, paths = [] } = await json(req);
      return send(
        res,
        200,
        paths.map((p) => {
          const key = `${bucket}/${p}`;
          return objects.has(key)
            ? {
                path: p,
                error: null,
                signedURL: `/object/sign/${key}?token=${issue(key, "read", expiresIn)}`,
              }
            : {
                path: p,
                error: "Either the object does not exist or you do not have access to it",
                signedURL: null,
              };
        }),
      );
    }
    match = api.match(/^\/object\/list\/([^/]+)$/);
    if (match && req.method === "POST" && failing.has("list")) {
      return send(res, 500, { statusCode: "500", error: "internal", message: "Fake failure" });
    }
    if (match && req.method === "POST") {
      const bucket = match[1];
      const { prefix = "" } = await json(req);
      const base = `${bucket}/${prefix ? `${prefix.replace(/\/$/, "")}/` : ""}`;
      const names = [...objects.keys()]
        .filter((key) => key.startsWith(base))
        .map((key) => ({ name: key.slice(base.length) }));
      return send(res, 200, names);
    }
    match = api.match(/^\/object\/([^/]+)$/);
    if (match && req.method === "DELETE") {
      const bucket = match[1];
      const { prefixes = [] } = await json(req);
      const removed = prefixes
        .filter((p) => objects.delete(`${bucket}/${p}`))
        .map((name) => ({ name }));
      return send(res, 200, removed);
    }
    return send(res, 404, {
      statusCode: "404",
      error: "not_found",
      message: `No route ${req.method} ${path}`,
    });
  } catch (error) {
    return send(res, 500, { statusCode: "500", error: "internal", message: String(error) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`Fake storage on http://127.0.0.1:${PORT}
`);
});
