// Shared plumbing for `push-to-r2.mjs` and `sync-from-r2.mjs`.
// Underscore-prefixed filename advertises "internal helper, don't run
// directly". Both scripts import a small surface from here.

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

// ────────────────────────────────────────────────────────────────────────
// .env loading
// ────────────────────────────────────────────────────────────────────────

/**
 * Load `KEY=value` lines from `.env` files in the supplied list of
 * candidate paths. Existing `process.env` values always win — explicit
 * shell env beats file-on-disk. No external dotenv dep: we control
 * the format anyway.
 */
export function loadDotEnv(candidatePaths) {
  for (const path of candidatePaths) {
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

/** Repo root, computed from this module's location. */
export const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Read + validate the four required R2 env vars. Loads `.env` from
 * the repo root + any extra paths the caller supplies (e.g. the sync
 * destination directory) before checking. Exits with a helpful
 * message on any missing var.
 */
export function loadR2Env({extraDotEnvPaths = []} = {}) {
  loadDotEnv([join(REPO_ROOT, '.env'), ...extraDotEnvPaths]);
  const env = {
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_PREFIX: process.env.R2_PREFIX ?? '',
  };
  for (const k of [
    'R2_ACCOUNT_ID',
    'R2_BUCKET',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
  ]) {
    if (!env[k] || env[k].trim() === '') {
      console.error(
        `Missing required env var ${k}. Set it in your shell or in a ` +
          `\`.env\` file at the repo root.`,
      );
      process.exit(1);
    }
  }
  return env;
}

// ────────────────────────────────────────────────────────────────────────
// S3 client
// ────────────────────────────────────────────────────────────────────────

export function createR2Client(env) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────
// Manifest
// ────────────────────────────────────────────────────────────────────────

/**
 * On-the-wire manifest format version.
 *
 * v1: `files: { path: blobSha }` — string per file.
 * v2: `files: { path: { sha, size } }` — object per file. The `size`
 *     in bytes lets the sync side render byte-accurate progress
 *     without an extra HEAD round-trip per object.
 */
export const MANIFEST_VERSION = 2;

/**
 * In-memory upgrade of a manifest read from R2 to the latest version.
 * Lets old buckets keep working after a script bump without a full
 * re-push. v1 entries get `size: 0` — that loses the byte-accurate
 * progress for the *first* sync after the upgrade, but the next push
 * will rewrite the manifest in v2 form so subsequent runs are fine.
 */
export function normalizeManifest(m) {
  if (!m) return null;
  if (m.version === 1) {
    return {
      ...m,
      version: MANIFEST_VERSION,
      files: Object.fromEntries(
        Object.entries(m.files).map(([path, sha]) => [path, {sha, size: 0}]),
      ),
    };
  }
  if (m.version === MANIFEST_VERSION) return m;
  throw new Error(
    `Manifest version ${m.version} is newer than this script understands ` +
      `(${MANIFEST_VERSION}). Upgrade the script.`,
  );
}

export function manifestKey(prefix) {
  return `${prefix}manifest.json`;
}
export function filesPrefix(prefix) {
  return `${prefix}files/`;
}

/** Returns the parsed + normalized remote manifest, or null when missing. */
export async function readRemoteManifest(client, bucket, prefix) {
  try {
    const resp = await client.send(
      new GetObjectCommand({Bucket: bucket, Key: manifestKey(prefix)}),
    );
    const body = await streamToString(resp.Body);
    return normalizeManifest(JSON.parse(body));
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

export async function writeRemoteManifest(client, bucket, prefix, manifest) {
  const body = JSON.stringify(manifest, null, 2);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: manifestKey(prefix),
      Body: body,
      ContentType: 'application/json; charset=utf-8',
      ContentLength: Buffer.byteLength(body),
    }),
  );
}

// ────────────────────────────────────────────────────────────────────────
// Progress reporter
// ────────────────────────────────────────────────────────────────────────

/**
 * Renders an in-place progress line on a TTY, periodic lines on
 * non-TTY (CI, logs piped to a file). Designed for sequential
 * loops where the caller marks files as starting / done / failed.
 *
 * On a TTY:
 *   `\r`-rewinds and prints a single line that updates in place,
 *   throttled to ~10 Hz so the terminal isn't overwhelmed. The line
 *   is clipped to the terminal width and padded to clear leftover
 *   characters from longer prior renders.
 *
 * On non-TTY:
 *   prints a fresh status line every ~5 s (and on `start`/`finish`),
 *   so a `tee logs.txt` or CI run still gets readable progress
 *   without an MB of carriage returns.
 */
export class Progress {
  constructor({label, totalFiles, totalBytes}) {
    this.label = label;
    this.totalFiles = totalFiles;
    this.totalBytes = totalBytes;
    this.doneFiles = 0;
    this.doneBytes = 0;
    this.failedFiles = 0;
    this.startedAt = Date.now();
    this.isTTY = !!process.stdout.isTTY;
    this.lastRenderAt = 0;
    this.lastLineLen = 0;
    this.currentName = '';
  }

  /** Mark the in-flight item — used as the rightmost label segment. */
  start(name) {
    this.currentName = name;
    this.maybeRender();
  }

  /** Mark a file as completed; bumps file + byte counters. */
  done(bytes) {
    this.doneFiles += 1;
    this.doneBytes += bytes;
    this.maybeRender();
  }

  /** Mark a file as failed; bumps the failure counter only. */
  fail() {
    this.failedFiles += 1;
    this.maybeRender(true);
  }

  /**
   * Render a final line + newline, plus a single summary line that
   * survives in the terminal scrollback.
   */
  finish() {
    this.render(true);
    if (this.isTTY) process.stdout.write('\n');
    const elapsed = (Date.now() - this.startedAt) / 1000;
    const rate = elapsed > 0 ? this.doneBytes / elapsed : 0;
    const failed =
      this.failedFiles > 0 ? `, ${this.failedFiles} failed` : '';
    console.log(
      `  ${this.label}: ${this.doneFiles}/${this.totalFiles} files, ` +
        `${formatBytes(this.doneBytes)} in ${formatDuration(elapsed)} ` +
        `(avg ${formatBytes(rate)}/s)${failed}`,
    );
  }

  maybeRender(force = false) {
    const now = Date.now();
    const interval = this.isTTY ? 100 : 5000;
    if (!force && now - this.lastRenderAt < interval) return;
    this.render();
    this.lastRenderAt = now;
  }

  render(_force = false) {
    const elapsed = Math.max(0.001, (Date.now() - this.startedAt) / 1000);
    const rate = this.doneBytes / elapsed;
    const remaining = Math.max(0, this.totalBytes - this.doneBytes);
    const etaSec =
      this.doneFiles === 0
        ? Infinity
        : rate > 0
          ? remaining / rate
          : Infinity;
    const pctFiles = this.totalFiles
      ? Math.floor((100 * this.doneFiles) / this.totalFiles)
      : 0;
    const totalBytesLabel =
      this.totalBytes > 0 ? `/${formatBytes(this.totalBytes)}` : '';
    const failed =
      this.failedFiles > 0 ? `  ${this.failedFiles}!` : '';
    const line =
      `  [${this.doneFiles}/${this.totalFiles}] ${pctFiles.toString().padStart(3)}%` +
      `  ${formatBytes(this.doneBytes)}${totalBytesLabel}` +
      `  ${formatBytes(rate)}/s` +
      `  ETA ${formatDuration(etaSec)}` +
      failed +
      (this.currentName ? `  ${truncateMid(this.currentName, 36)}` : '');
    if (this.isTTY) {
      // Clip to terminal width so a long line doesn't wrap and break
      // the `\r` rewind.
      const cols = process.stdout.columns || 80;
      const clipped = line.length > cols - 1 ? line.slice(0, cols - 1) : line;
      const padding = Math.max(0, this.lastLineLen - clipped.length);
      process.stdout.write('\r' + clipped + ' '.repeat(padding));
      this.lastLineLen = clipped.length;
    } else {
      console.log(line);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────
// Formatters
// ────────────────────────────────────────────────────────────────────────

export function formatBytes(n) {
  if (!Number.isFinite(n)) return '?';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '?';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm.toString().padStart(2, '0')}m`;
}

/** "src/very/long/path/to/file.tsx" → "src/ver…to/file.tsx" */
export function truncateMid(s, max) {
  if (s.length <= max) return s;
  const half = Math.max(1, Math.floor((max - 1) / 2));
  return s.slice(0, half) + '…' + s.slice(-(max - 1 - half));
}

// ────────────────────────────────────────────────────────────────────────
// Misc helpers
// ────────────────────────────────────────────────────────────────────────

export async function streamToString(body) {
  if (typeof body.transformToString === 'function') {
    return body.transformToString();
  }
  const chunks = [];
  for await (const c of body) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

export function* chunked(arr, n) {
  for (let i = 0; i < arr.length; i += n) yield arr.slice(i, i + n);
}

export function guessContentType(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.html')) return 'text/html; charset=utf-8';
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs'))
    return 'text/javascript; charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.txt') || lower.endsWith('.md'))
    return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}
