import * as fs from 'fs';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MergeLevel = 'identical' | 'normalizable' | 'reconcilable' | 'divergent';

export interface TsConfigJson {
  compilerOptions?: Record<string, unknown>;
  include?: string[];
  exclude?: string[];
  files?: string[];
  [key: string]: unknown;
}

export interface TsConfigEntry {
  path: string;
  config: TsConfigJson;
}

// For reconcilable groups: field → { configPath: value }
export type ConflictMap = Record<string, Record<string, unknown>>;

export interface ComparisonGroup {
  level: MergeLevel;
  paths: string[];
  // normalizable: human-readable description of what changes would make configs identical
  appliedNormalizations?: string[];
  // reconcilable: which fields differ and what each config has
  conflicts?: ConflictMap;
  // identical/normalizable/reconcilable: the proposed merged compilerOptions
  proposedMerge?: Record<string, unknown>;
}

export interface GroupOptions {
  // Extra compilerOptions fields to exclude from comparison (beyond built-in project-specific ones)
  excludeFields?: string[];
  // Max number of differing fields to still be considered 'reconcilable' (default: 3)
  reconcilableThreshold?: number;
  // Which TS version defaults to strip (default: '6.0')
  typescriptVersion?: '6.0' | '5.x';
}

export interface GroupResult {
  groups: ComparisonGroup[];
  summary: {
    total: number;
    byLevel: Record<MergeLevel, number>;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

// compilerOptions fields that are inherently project-specific and excluded from comparison.
// These will never be identical across projects, so comparing them is noise.
const BASE_EXCLUDED_COMPILER_OPTIONS = new Set([
  'outDir',
  'rootDir',
  'baseUrl',
  'paths',
  'typeRoots',
  'declarationDir',
  'tsBuildInfoFile',
]);

// TS version defaults. Fields set to these values are redundant and can be stripped
// before comparison (since two configs with and without explicit defaults are semantically equal).
const TS_DEFAULTS: Record<string, Record<string, unknown>> = {
  '6.0': {
    strict: true,
    moduleDetection: 'auto',
  },
  '5.x': {
    strict: false,
  },
};

// ─── Loading ──────────────────────────────────────────────────────────────────

export function loadTsConfig(filePath: string): TsConfigEntry {
  const resolved = path.resolve(filePath);
  const raw = fs.readFileSync(resolved, 'utf-8');

  // tsconfig uses JSONC (JSON with comments + trailing commas)
  const stripped = raw
    .replace(/\/\/.*$/gm, '')           // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')   // multi-line comments
    .replace(/,(\s*[}\]])/g, '$1');     // trailing commas

  return { path: resolved, config: JSON.parse(stripped) as TsConfigJson };
}

// Simple recursive discovery — finds all tsconfig*.json files under a directory
export function discoverTsConfigs(dir: string): TsConfigEntry[] {
  const results: TsConfigEntry[] = [];

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        walk(full);
      } else if (entry.isFile() && /^tsconfig.*\.json$/.test(entry.name)) {
        results.push(loadTsConfig(full));
      }
    }
  }

  walk(path.resolve(dir));
  return results;
}

// ─── Normalization ────────────────────────────────────────────────────────────

interface NormalizeResult {
  options: Record<string, unknown>;
  // Human-readable list of what was changed to produce these options
  normalizations: string[];
}

function normalizeCompilerOptions(
  raw: Record<string, unknown>,
  tsVersion: '6.0' | '5.x',
  excluded: Set<string>
): NormalizeResult {
  const defaults = TS_DEFAULTS[tsVersion];
  const normalizations: string[] = [];
  const result: Record<string, unknown> = {};
  const sortedArrayFields: string[] = [];
  const strippedDefaultFields: string[] = [];

  for (const [key, val] of Object.entries(raw)) {
    if (excluded.has(key)) continue;

    // Sort arrays so ["dom", "es2022"] and ["es2022", "dom"] compare equal
    const normalized = Array.isArray(val) ? [...val].sort() : val;

    if (Array.isArray(val) && JSON.stringify(val) !== JSON.stringify(normalized)) {
      sortedArrayFields.push(key);
    }

    // Skip values that match the TS version's implicit defaults
    if (key in defaults && JSON.stringify(defaults[key]) === JSON.stringify(normalized)) {
      strippedDefaultFields.push(key);
      continue;
    }

    result[key] = normalized;
  }

  if (sortedArrayFields.length > 0) {
    normalizations.push(`sort arrays: ${sortedArrayFields.join(', ')}`);
  }
  if (strippedDefaultFields.length > 0) {
    normalizations.push(`strip TS ${tsVersion} defaults: ${strippedDefaultFields.join(', ')}`);
  }

  return { options: result, normalizations };
}

// Produces a stable JSON key by sorting object keys — used for group bucketing
function toCanonicalKey(options: Record<string, unknown>): string {
  const sorted = Object.fromEntries(
    Object.entries(options).sort(([a], [b]) => a.localeCompare(b))
  );
  return JSON.stringify(sorted);
}

// ─── Internal working type ────────────────────────────────────────────────────

interface WorkingEntry {
  path: string;
  rawOptions: Record<string, unknown>;       // compilerOptions with excluded fields removed
  normalizedOptions: Record<string, unknown>; // after sorting arrays + stripping defaults
  normalizations: string[];
  normalizedKey: string;
}

// ─── Comparison helpers ───────────────────────────────────────────────────────

// Returns all compilerOptions fields where the configs disagree
function computeConflicts(entries: WorkingEntry[]): ConflictMap {
  const conflicts: ConflictMap = {};
  const allKeys = new Set(entries.flatMap(e => Object.keys(e.normalizedOptions)));

  for (const key of allKeys) {
    const perPath = entries.map(e => ({ path: e.path, val: e.normalizedOptions[key] }));
    const unique = new Set(perPath.map(p => JSON.stringify(p.val)));

    if (unique.size > 1) {
      conflicts[key] = Object.fromEntries(perPath.map(p => [p.path, p.val]));
    }
  }

  return conflicts;
}

// Majority-vote per field — used to produce a suggested merged compilerOptions
function proposeMerge(entries: WorkingEntry[]): Record<string, unknown> {
  const allKeys = new Set(entries.flatMap(e => Object.keys(e.normalizedOptions)));
  const result: Record<string, unknown> = {};

  for (const key of allKeys) {
    const counts = new Map<string, { count: number; val: unknown }>();

    for (const entry of entries) {
      const val = entry.normalizedOptions[key];
      if (val === undefined) continue;
      const serialized = JSON.stringify(val);
      const existing = counts.get(serialized);
      counts.set(serialized, { count: (existing?.count ?? 0) + 1, val });
    }

    let best = { count: -1, val: undefined as unknown };
    for (const candidate of counts.values()) {
      if (candidate.count > best.count) best = candidate;
    }
    if (best.val !== undefined) result[key] = best.val;
  }

  return result;
}

// ─── Reconcilable clustering ──────────────────────────────────────────────────

// Greedy O(n²) clustering: each entry tries to join the first existing cluster
// where adding it keeps the total conflict count within the threshold.
// Note: greedy order-dependence means edge cases with 3+ configs may not find
// the globally optimal grouping — good enough for typical project counts.
function clusterByReconcilability(
  entries: WorkingEntry[],
  threshold: number
): WorkingEntry[][] {
  const clusters: { members: WorkingEntry[] }[] = [];

  for (const entry of entries) {
    let placed = false;

    for (const cluster of clusters) {
      const conflicts = computeConflicts([...cluster.members, entry]);
      if (Object.keys(conflicts).length <= threshold) {
        cluster.members.push(entry);
        placed = true;
        break;
      }
    }

    if (!placed) {
      clusters.push({ members: [entry] });
    }
  }

  return clusters.map(c => c.members);
}

// ─── Main grouping function ───────────────────────────────────────────────────

export function groupTsConfigs(
  entries: TsConfigEntry[],
  options: GroupOptions = {}
): GroupResult {
  const {
    excludeFields = [],
    reconcilableThreshold = 3,
    typescriptVersion = '6.0',
  } = options;

  const excluded = new Set([...BASE_EXCLUDED_COMPILER_OPTIONS, ...excludeFields]);

  // Build normalized working entries
  const working: WorkingEntry[] = entries.map(entry => {
    const rawOptions = { ...(entry.config.compilerOptions ?? {}) };
    for (const field of excluded) delete rawOptions[field];

    const { options: normalizedOptions, normalizations } = normalizeCompilerOptions(
      rawOptions,
      typescriptVersion,
      excluded
    );

    return {
      path: entry.path,
      rawOptions,
      normalizedOptions,
      normalizations,
      normalizedKey: toCanonicalKey(normalizedOptions),
    };
  });

  // Group by normalized key — configs that share a key are identical or normalizable
  const keyBuckets = new Map<string, WorkingEntry[]>();
  for (const entry of working) {
    const bucket = keyBuckets.get(entry.normalizedKey) ?? [];
    bucket.push(entry);
    keyBuckets.set(entry.normalizedKey, bucket);
  }

  const groups: ComparisonGroup[] = [];
  const ungrouped: WorkingEntry[] = [];

  for (const members of keyBuckets.values()) {
    if (members.length === 1) {
      // Only one config has this normalized form — needs reconcilable/divergent check
      ungrouped.push(members[0]);
      continue;
    }

    const anyNormalized = members.some(m => m.normalizations.length > 0);
    const level: MergeLevel = anyNormalized ? 'normalizable' : 'identical';

    // Aggregate the unique normalization descriptions across the group
    const appliedNormalizations = [...new Set(members.flatMap(m => m.normalizations))];

    groups.push({
      level,
      paths: members.map(m => m.path),
      ...(appliedNormalizations.length > 0 ? { appliedNormalizations } : {}),
      proposedMerge: members[0].normalizedOptions, // identical post-normalization
    });
  }

  // Cluster the ungrouped entries by reconcilability
  const clusters = clusterByReconcilability(ungrouped, reconcilableThreshold);

  for (const cluster of clusters) {
    if (cluster.length === 1) {
      // Couldn't reconcile with any other config
      groups.push({ level: 'divergent', paths: [cluster[0].path] });
      continue;
    }

    const conflicts = computeConflicts(cluster);
    groups.push({
      level: 'reconcilable',
      paths: cluster.map(e => e.path),
      conflicts,
      proposedMerge: proposeMerge(cluster),
    });
  }

  const byLevel = groups.reduce(
    (acc, g) => ({ ...acc, [g.level]: (acc[g.level] ?? 0) + 1 }),
    {} as Record<MergeLevel, number>
  );

  return {
    groups,
    summary: {
      total: entries.length,
      byLevel: {
        identical: byLevel.identical ?? 0,
        normalizable: byLevel.normalizable ?? 0,
        reconcilable: byLevel.reconcilable ?? 0,
        divergent: byLevel.divergent ?? 0,
      },
    },
  };
}

// ─── Merge function ───────────────────────────────────────────────────────────

export interface MergeOptions {
  // compilerOptions fields to NOT merge — each project keeps its own value.
  // Defaults to the same base project-specific fields used in comparison.
  preserveFields?: string[];
}

export interface MergeResult {
  // The shared compilerOptions that can live in a root/base tsconfig
  sharedCompilerOptions: Record<string, unknown>;
  // What each project's tsconfig needs to add back on top of the shared base
  perConfig: Array<{
    path: string;
    preservedOptions: Record<string, unknown>;
  }>;
}

export function mergeTsConfigs(
  entries: TsConfigEntry[],
  options: MergeOptions = {}
): MergeResult {
  const {
    preserveFields = [...BASE_EXCLUDED_COMPILER_OPTIONS],
  } = options;

  const preserveSet = new Set(preserveFields);
  const allOptions = entries.map(e => e.config.compilerOptions ?? {});
  const allKeys = new Set(allOptions.flatMap(o => Object.keys(o)));
  const sharedCompilerOptions: Record<string, unknown> = {};

  for (const key of allKeys) {
    if (preserveSet.has(key)) continue;

    // Majority vote across all configs for this field
    const counts = new Map<string, { count: number; val: unknown }>();
    for (const opts of allOptions) {
      const val = opts[key];
      if (val === undefined) continue;
      const serialized = JSON.stringify(val);
      const existing = counts.get(serialized);
      counts.set(serialized, { count: (existing?.count ?? 0) + 1, val });
    }

    let best = { count: -1, val: undefined as unknown };
    for (const candidate of counts.values()) {
      if (candidate.count > best.count) best = candidate;
    }
    if (best.val !== undefined) sharedCompilerOptions[key] = best.val;
  }

  const perConfig = entries.map(entry => {
    const preserved: Record<string, unknown> = {};
    const opts = entry.config.compilerOptions ?? {};

    for (const field of preserveFields) {
      if (field in opts) preserved[field] = opts[field];
    }

    return { path: entry.path, preservedOptions: preserved };
  });

  return { sharedCompilerOptions, perConfig };
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

// Simple ANSI helpers — no extra deps needed for a dev tool
const c = {
  bold:   (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[0m`,
  green:  (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[0m`,
  red:    (s: string) => `\x1b[31m${s}\x1b[0m`,
  gray:   (s: string) => `\x1b[90m${s}\x1b[0m`,
};

const LEVEL_COLOR: Record<MergeLevel, (s: string) => string> = {
  identical:    c.green,
  normalizable: c.cyan,
  reconcilable: c.yellow,
  divergent:    c.red,
};

function printUsage() {
  console.log(`
${c.bold('Usage:')} tsconfig-compare <glob> [options]

${c.bold('Options:')}
  --threshold <n>          max conflicting fields for 'reconcilable' (default: 3)
  --ts-version <5.x|6.0>  TS version defaults to strip (default: 6.0)
  --exclude <fields>       comma-separated compilerOptions fields to exclude
  --merge                  also print proposed shared merge output
  --json                   print raw JSON result to stdout

${c.bold('Examples:')}
  tsconfig-compare "packages/*/tsconfig.json"
  tsconfig-compare "**\/tsconfig*.json" --threshold 5 --merge
  tsconfig-compare "apps/*/tsconfig.json" --exclude "lib,types" --json
`);
}

function parseArgs(argv: string[]): {
  glob: string;
  threshold: number;
  tsVersion: '6.0' | '5.x';
  excludeFields: string[];
  showMerge: boolean;
  json: boolean;
} | null {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return null;
  }

  const glob = args[0];
  let threshold = 3;
  let tsVersion: '6.0' | '5.x' = '6.0';
  let excludeFields: string[] = [];
  let showMerge = false;
  let json = false;

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--threshold':
        threshold = parseInt(args[++i], 10);
        if (isNaN(threshold)) { console.error('--threshold must be a number'); process.exit(1); }
        break;
      case '--ts-version':
        const v = args[++i];
        if (v !== '6.0' && v !== '5.x') { console.error('--ts-version must be 6.0 or 5.x'); process.exit(1); }
        tsVersion = v;
        break;
      case '--exclude':
        excludeFields = args[++i].split(',').map(f => f.trim()).filter(Boolean);
        break;
      case '--merge':
        showMerge = true;
        break;
      case '--json':
        json = true;
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  return { glob, threshold, tsVersion, excludeFields, showMerge, json };
}

function printGroup(group: ComparisonGroup, index: number) {
  const colorize = LEVEL_COLOR[group.level];
  const label = colorize(c.bold(group.level.toUpperCase()));
  console.log(`\n${c.bold(`Group ${index + 1}`)} — ${label} (${group.paths.length} config${group.paths.length > 1 ? 's' : ''})`);

  for (const p of group.paths) {
    console.log(`  ${c.gray('•')} ${p}`);
  }

  if (group.appliedNormalizations && group.appliedNormalizations.length > 0) {
    console.log(c.dim(`  Normalizations needed:`));
    for (const n of group.appliedNormalizations) {
      console.log(c.dim(`    – ${n}`));
    }
  }

  if (group.conflicts && Object.keys(group.conflicts).length > 0) {
    console.log(c.dim(`  Conflicts:`));
    for (const [field, byPath] of Object.entries(group.conflicts)) {
      console.log(c.dim(`    ${c.yellow(field)}:`));
      for (const [p, val] of Object.entries(byPath)) {
        console.log(c.dim(`      ${path.basename(path.dirname(p))}: ${JSON.stringify(val)}`));
      }
    }
  }
}

async function main() {
  const parsed = parseArgs(process.argv);

  if (!parsed) {
    printUsage();
    process.exit(parsed === null && process.argv.length > 2 ? 0 : 1);
  }

  const { glob: pattern, threshold, tsVersion, excludeFields, showMerge, json } = parsed;

  // fs.glob is available from Node 22. The pattern is resolved relative to cwd.
  const { glob } = await import('node:fs/promises');
  const matched: string[] = [];
  for await (const file of glob(pattern, { cwd: process.cwd() })) {
    matched.push(path.resolve(file));
  }

  if (matched.length === 0) {
    console.error(`No files matched: ${pattern}`);
    process.exit(1);
  }

  const entries = matched.map(loadTsConfig);
  const result = groupTsConfigs(entries, {
    reconcilableThreshold: threshold,
    typescriptVersion: tsVersion,
    excludeFields,
  });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Human-readable output
  console.log(c.bold(`\nFound ${matched.length} tsconfig(s)\n`));
  result.groups.forEach((group, i) => printGroup(group, i));

  // Summary table
  const { byLevel } = result.summary;
  console.log(`\n${c.bold('Summary:')}`);
  console.log(`  ${c.green('identical')}:    ${byLevel.identical} group(s)`);
  console.log(`  ${c.cyan('normalizable')}: ${byLevel.normalizable} group(s)`);
  console.log(`  ${c.yellow('reconcilable')}: ${byLevel.reconcilable} group(s)`);
  console.log(`  ${c.red('divergent')}:    ${byLevel.divergent} group(s)`);

  if (showMerge) {
    // Only merge groups that are actually groupable (not divergent singletons)
    const mergeable = entries.filter(e =>
      result.groups.some(g => g.level !== 'divergent' && g.paths.includes(e.path))
    );

    if (mergeable.length > 0) {
      const merged = mergeTsConfigs(mergeable);
      console.log(`\n${c.bold('Proposed shared compilerOptions:')}`);
      console.log(JSON.stringify({ compilerOptions: merged.sharedCompilerOptions }, null, 2));

      console.log(`\n${c.bold('Per-project overrides:')}`);
      for (const { path: p, preservedOptions } of merged.perConfig) {
        if (Object.keys(preservedOptions).length > 0) {
          console.log(c.dim(`  ${p}:`));
          console.log(c.dim(`    ${JSON.stringify(preservedOptions)}`));
        }
      }
    }
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
