// Push / pull source between this repo and a Cloudflare R2 bucket.
//
// Subcommands:
//
//   list                                  smoke-test R2 credentials.
//   push                                  push committed source to R2.
//   pull [<dest>] [--delete] [--dry-run]  sync from R2 into a local dir.
//
// `push` walks `git ls-tree -r HEAD`, diffs against the bucket's
// `manifest.json`, uploads only the files whose blob sha changed,
// deletes objects whose paths disappeared from git, then writes the
// new manifest LAST. If anything fails mid-push the manifest still
// points at the prior consistent state so a `pull` never sees a
// half-applied update.
//
// `pull` reads R2's manifest, diffs against `<dest>/.r2-sync.json`
// (created on first sync), downloads only the changed paths, then
// writes the new local state last. Without `--delete` it leaves
// locally-extra files alone — safe default that lets gitignored /
// scratch files coexist next to the synced source.
//
// Bucket layout (rooted at `R2_PREFIX`, default empty):
//
//   <prefix>manifest.json   { commit, generated, files: {path: {sha, size}} }
//   <prefix>files/<path>    file contents at that path (latest version)
//
// Required env vars (read from `.env` at the repo root or your shell;
// `pull` also reads `.env` at the destination):
//
//   R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
//   R2_PREFIX (optional)

import {
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import {execFileSync} from 'node:child_process';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {
  REPO_ROOT,
  loadR2Env,
  createR2Client,
  MANIFEST_VERSION,
  filesPrefix,
  readRemoteManifest,
  writeRemoteManifest,
  Progress,
  chunked,
  formatBytes,
  guessContentType,
} from './_r2-shared.mjs';

// ────────────────────────────────────────────────────────────────────────
// Entrypoint + dispatch
// ────────────────────────────────────────────────────────────────────────

const subcommand = process.argv[2];
const subArgs = process.argv.slice(3);

async function main() {
  switch (subcommand) {
    case 'list':
      return cmdList();
    case 'push':
      return cmdPush();
    case 'pull':
      return cmdPull(subArgs);
    case undefined:
    case '--help':
    case '-h':
    case 'help':
      printUsage();
      process.exit(subcommand ? 0 : 2);
      // eslint-disable-next-line no-fallthrough
      return;
    default:
      console.error(`unknown subcommand: ${subcommand}`);
      printUsage();
      process.exit(2);
  }
}

function printUsage() {
  console.log(`Usage: node scripts/sync.mjs <command> [options]

Commands:
  list                                  smoke-test R2 credentials
  push                                  push committed source to R2
  pull [<dest>] [--delete] [--dry-run]  sync from R2 into a local dir

Required env vars (in your shell or .env at the repo root):
  R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
  R2_PREFIX (optional)`);
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  if (err.$metadata) {
    console.error('  http status:', err.$metadata.httpStatusCode);
    console.error('  request id: ', err.$metadata.requestId);
  }
  process.exit(1);
});

// ────────────────────────────────────────────────────────────────────────
// Subcommand: list (smoke-test creds)
// ────────────────────────────────────────────────────────────────────────

async function cmdList() {
  const env = loadR2Env();
  const client = createR2Client(env);
  console.log(`Listing objects in r2://${env.R2_BUCKET} (max 5)…`);
  const out = await client.send(
    new ListObjectsV2Command({
      Bucket: env.R2_BUCKET,
      MaxKeys: 5,
      Prefix: env.R2_PREFIX || undefined,
    }),
  );
  const count = out.KeyCount ?? 0;
  if (count === 0) {
    console.log('  bucket is reachable and empty (under prefix). ✅');
    return;
  }
  for (const obj of out.Contents ?? []) {
    console.log(`  ${obj.Key}  (${obj.Size} bytes)`);
  }
  if (out.IsTruncated) console.log('  …truncated.');
}

// ────────────────────────────────────────────────────────────────────────
// Subcommand: push
// ────────────────────────────────────────────────────────────────────────

async function cmdPush() {
  const env = loadR2Env();
  const client = createR2Client(env);
  const FILES_PREFIX = filesPrefix(env.R2_PREFIX);

  const headSha = git('rev-parse', 'HEAD').trim();
  console.log(
    `Pushing snapshot of HEAD ${headSha.slice(0, 12)} ` +
      `→ r2://${env.R2_BUCKET}/${env.R2_PREFIX || '(root)'}`,
  );

  // 1. Local tree, with sizes.
  const localFiles = listGitTree(headSha);
  const localTotalBytes = sumSizes(localFiles);
  console.log(
    `  local: ${localFiles.size} tracked files (${formatBytes(localTotalBytes)})`,
  );

  // 2. Remote manifest (auto-upgraded from v1 if needed).
  const remoteManifest = await readRemoteManifest(
    client,
    env.R2_BUCKET,
    env.R2_PREFIX,
  );
  if (remoteManifest === null) {
    console.log('  remote: no manifest (treating as empty)');
  } else {
    console.log(
      `  remote: manifest at commit ${remoteManifest.commit?.slice(0, 12) ?? '?'} ` +
        `with ${Object.keys(remoteManifest.files).length} files`,
    );
  }

  // 3. Diff.
  const remoteFiles = remoteManifest?.files ?? {};
  const toUpload = []; // [{path, sha, size}]
  const toDelete = []; // [path]
  for (const [path, info] of localFiles) {
    if (remoteFiles[path]?.sha !== info.sha) toUpload.push({path, ...info});
  }
  for (const path of Object.keys(remoteFiles)) {
    if (!localFiles.has(path)) toDelete.push(path);
  }
  const uploadBytes = toUpload.reduce((acc, f) => acc + f.size, 0);
  console.log(
    `  delta: upload=${toUpload.length} (${formatBytes(uploadBytes)}) ` +
      `delete=${toDelete.length} ` +
      `unchanged=${localFiles.size - toUpload.length}`,
  );

  if (toUpload.length === 0 && toDelete.length === 0) {
    console.log('  nothing to do. ✅');
    return;
  }

  // 4. Upload changed files, with progress.
  const progress = new Progress({
    label: 'upload',
    totalFiles: toUpload.length,
    totalBytes: uploadBytes,
  });
  let failed = 0;
  for (const {path, sha, size} of toUpload) {
    progress.start(path);
    const localAbs = join(REPO_ROOT, path);
    const key = `${FILES_PREFIX}${path}`;
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: env.R2_BUCKET,
          Key: key,
          Body: createReadStream(localAbs),
          ContentLength: size,
          ContentType: guessContentType(path),
          // Storing the git blob sha as user metadata gives us a
          // fast integrity check (or repair path) later without
          // re-downloading every object.
          Metadata: {'git-blob': sha},
        }),
      );
      progress.done(size);
    } catch (err) {
      failed++;
      progress.fail();
      console.error(`\n  upload failed for ${path}: ${err.message}`);
    }
  }
  progress.finish();

  // 5. Delete removed files. R2's S3 DeleteObjects accepts up to 1000
  //    keys per call; chunk to be safe.
  let deleted = 0;
  for (const chunk of chunked(toDelete, 1000)) {
    try {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: env.R2_BUCKET,
          Delete: {
            Objects: chunk.map((p) => ({Key: `${FILES_PREFIX}${p}`})),
          },
        }),
      );
      deleted += chunk.length;
      console.log(`  deleted ${deleted}/${toDelete.length}`);
    } catch (err) {
      console.error(`  delete failed (${chunk.length} keys): ${err.message}`);
      failed += chunk.length;
    }
  }

  // 6. Manifest LAST. If anything above bombed, the manifest still
  //    points at the prior consistent state — pull side won't see
  //    the half-update.
  if (failed > 0) {
    console.error(
      `  ${failed} operation(s) failed; not advancing the manifest. Rerun the push.`,
    );
    process.exit(1);
  }

  const newManifest = {
    version: MANIFEST_VERSION,
    commit: headSha,
    generated: new Date().toISOString(),
    files: Object.fromEntries(localFiles),
  };
  await writeRemoteManifest(client, env.R2_BUCKET, env.R2_PREFIX, newManifest);
  console.log('  manifest advanced. ✅');
}

// ────────────────────────────────────────────────────────────────────────
// Subcommand: pull
// ────────────────────────────────────────────────────────────────────────

async function cmdPull(args) {
  // Parse pull-only flags + positional dest.
  const flags = {delete: false, dryRun: false};
  const positional = [];
  for (const a of args) {
    if (a === '--delete') flags.delete = true;
    else if (a === '--dry-run' || a === '-n') flags.dryRun = true;
    else if (a === '--help' || a === '-h') {
      console.log(
        'usage: node scripts/sync.mjs pull [<destination-dir>] [--delete] [--dry-run]',
      );
      process.exit(0);
    } else positional.push(a);
  }

  const DEST = resolve(positional[0] ?? process.cwd());
  if (!existsSync(DEST)) {
    console.error(`destination does not exist: ${DEST}`);
    console.error('create it first or pass an existing directory.');
    process.exit(2);
  }

  const env = loadR2Env({extraDotEnvPaths: [join(DEST, '.env')]});
  const client = createR2Client(env);
  const FILES_PREFIX = filesPrefix(env.R2_PREFIX);
  const LOCAL_STATE_PATH = join(DEST, '.r2-sync.json');

  console.log(
    `Pulling r2://${env.R2_BUCKET}/${env.R2_PREFIX || '(root)'} → ${DEST}`,
  );

  // 1. Remote manifest.
  const remote = await readRemoteManifest(client, env.R2_BUCKET, env.R2_PREFIX);
  if (!remote) {
    console.log('  remote: no manifest yet — nothing has been pushed.');
    return;
  }
  if (remote.version > MANIFEST_VERSION) {
    console.error(
      `  remote manifest is v${remote.version}, this script understands v${MANIFEST_VERSION}.`,
    );
    process.exit(1);
  }
  const remoteCount = Object.keys(remote.files).length;
  const remoteBytes = Object.values(remote.files).reduce(
    (a, f) => a + (f.size ?? 0),
    0,
  );
  console.log(
    `  remote: ${remoteCount} files (${formatBytes(remoteBytes)}) ` +
      `at commit ${remote.commit?.slice(0, 12) ?? '?'}`,
  );

  // 2. Local state.
  const local = readLocalState(LOCAL_STATE_PATH);
  if (local) {
    console.log(
      `  local:  ${Object.keys(local.files).length} files at commit ${local.commit?.slice(0, 12) ?? '?'}`,
    );
  } else {
    console.log('  local:  no prior state (full pull)');
  }

  // 3. Diff.
  const localFiles = local?.files ?? {};
  const toDownload = []; // [{path, size}]
  const toDelete = []; // [path]
  for (const [path, info] of Object.entries(remote.files)) {
    if (localFiles[path]?.sha !== info.sha) {
      toDownload.push({path, size: info.size ?? 0});
    }
  }
  for (const path of Object.keys(localFiles)) {
    if (!(path in remote.files)) toDelete.push(path);
  }
  const downloadBytes = toDownload.reduce((a, f) => a + f.size, 0);
  console.log(
    `  delta: download=${toDownload.length} (${formatBytes(downloadBytes)}) ` +
      `delete=${toDelete.length} ` +
      `unchanged=${Object.keys(localFiles).length - toDelete.length}`,
  );

  if (toDownload.length === 0 && toDelete.length === 0) {
    console.log('  already in sync. ✅');
    return;
  }

  if (flags.dryRun) {
    console.log('  --dry-run: stopping before any side effects.');
    if (toDownload.length > 0) {
      console.log('  would download:');
      for (const {path} of toDownload.slice(0, 20)) console.log(`    + ${path}`);
      if (toDownload.length > 20)
        console.log(`    …and ${toDownload.length - 20} more.`);
    }
    if (toDelete.length > 0) {
      console.log('  would delete:');
      for (const p of toDelete.slice(0, 20)) console.log(`    - ${p}`);
      if (toDelete.length > 20)
        console.log(`    …and ${toDelete.length - 20} more.`);
    }
    return;
  }

  // 4. Downloads, with progress.
  const progress = new Progress({
    label: 'download',
    totalFiles: toDownload.length,
    totalBytes: downloadBytes,
  });
  let failed = 0;
  for (const {path, size} of toDownload) {
    progress.start(path);
    const localAbs = join(DEST, path);
    mkdirSync(dirname(localAbs), {recursive: true});
    try {
      const actualBytes = await downloadObject(
        client,
        env.R2_BUCKET,
        `${FILES_PREFIX}${path}`,
        localAbs,
      );
      // Use the actual byte count if we got one (in case the
      // manifest size was stale or 0 — e.g. a v1 → v2 upgrade).
      progress.done(actualBytes || size);
    } catch (err) {
      failed++;
      progress.fail();
      console.error(`\n  download failed for ${path}: ${err.message}`);
    }
  }
  progress.finish();

  // 5. Deletes (gated).
  let deleted = 0;
  if (flags.delete) {
    for (const path of toDelete) {
      const localAbs = join(DEST, path);
      try {
        if (existsSync(localAbs)) rmSync(localAbs);
        deleted++;
      } catch (err) {
        failed++;
        console.error(`  local delete failed for ${path}: ${err.message}`);
      }
    }
    if (deleted > 0) console.log(`  removed ${deleted} local file(s)`);
  } else if (toDelete.length > 0) {
    console.log(
      `  ${toDelete.length} path(s) gone from remote; pass --delete to remove locally.`,
    );
  }

  // 6. State LAST.
  if (failed > 0) {
    console.error(
      `  ${failed} operation(s) failed; not advancing local state. Rerun the pull.`,
    );
    process.exit(1);
  }
  // Take the remote files as truth, but if the user opted out of
  // `--delete`, keep the now-stale path-blob pairs in local state so
  // they're not re-downloaded next run. Otherwise they'd compare as
  // missing-locally and re-download forever.
  let nextFiles = remote.files;
  if (!flags.delete && toDelete.length > 0) {
    nextFiles = {...remote.files};
    for (const path of toDelete) nextFiles[path] = localFiles[path];
  }
  writeLocalState(LOCAL_STATE_PATH, {
    version: MANIFEST_VERSION,
    commit: remote.commit,
    syncedAt: new Date().toISOString(),
    files: nextFiles,
  });
  console.log('  state advanced. ✅');
}

// ────────────────────────────────────────────────────────────────────────
// Helpers — push side
// ────────────────────────────────────────────────────────────────────────

/**
 * Map of `path → {sha, size}` for every file in the given commit's
 * tree. Stats each file on disk to grab the size; if a tracked file
 * is somehow missing locally (e.g. a stale checkout) it's omitted
 * with a warning rather than killing the whole push.
 */
function listGitTree(commit) {
  // `-z` for NUL-separated output: tolerates filenames with newlines
  // / quotes / non-ASCII without parsing escapes ourselves.
  const out = execFileSync(
    'git',
    ['ls-tree', '-r', '-z', '--format=%(objectname) %(path)', commit],
    {cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024},
  );
  const map = new Map();
  for (const line of out.split('\0')) {
    if (!line) continue;
    const space = line.indexOf(' ');
    if (space < 0) continue;
    const sha = line.slice(0, space);
    const path = line.slice(space + 1);
    let size = 0;
    try {
      size = statSync(join(REPO_ROOT, path)).size;
    } catch (err) {
      console.error(
        `  warning: tracked file missing on disk: ${path} (${err.code})`,
      );
      continue;
    }
    map.set(path, {sha, size});
  }
  return map;
}

function sumSizes(map) {
  let total = 0;
  for (const v of map.values()) total += v.size;
  return total;
}

function git(...args) {
  return execFileSync('git', args, {cwd: REPO_ROOT, encoding: 'utf8'});
}

// ────────────────────────────────────────────────────────────────────────
// Helpers — pull side
// ────────────────────────────────────────────────────────────────────────

function readLocalState(path) {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    // Tolerate a v1 local state too (old `path → sha`). Upgrade in
    // memory; the next successful pull rewrites it as v2.
    if (parsed.version === 1 && parsed.files) {
      parsed.version = MANIFEST_VERSION;
      parsed.files = Object.fromEntries(
        Object.entries(parsed.files).map(([p, sha]) => [
          p,
          typeof sha === 'string' ? {sha, size: 0} : sha,
        ]),
      );
    }
    return parsed;
  } catch (err) {
    console.error(
      `  local state at ${path} is corrupt (${err.message}); ` +
        `treating as empty (next pull will be full).`,
    );
    return null;
  }
}

function writeLocalState(path, state) {
  // Atomic-ish: write to a sibling tmp + rename, so a crash mid-write
  // doesn't leave the file half-finished.
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  // POSIX rename replaces atomically; on Windows the destination
  // must not already exist.
  if (existsSync(path)) rmSync(path);
  renameSync(tmp, path);
}

async function downloadObject(client, bucket, key, localAbs) {
  const resp = await client.send(
    new GetObjectCommand({Bucket: bucket, Key: key}),
  );
  let bytes = 0;
  await pipeline(
    resp.Body,
    async function* (source) {
      for await (const chunk of source) {
        bytes += chunk.length;
        yield chunk;
      }
    },
    createWriteStream(localAbs),
  );
  return bytes;
}
