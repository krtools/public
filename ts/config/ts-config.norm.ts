import { parse as parseJsonc } from "jsonc-parser";

// Top-level tsconfig arrays where order has no semantic meaning.
// Note: `extends` is intentionally excluded — TS 5.0+ supports array extends
// and later entries override earlier ones, so order matters there.
const UNORDERED_TOP_LEVEL_ARRAYS = new Set(["include", "exclude", "files"]);

// compilerOptions arrays where order doesn't matter.
// `paths` values are intentionally excluded — TypeScript tries fallback paths
// in the order they're listed, so those arrays are order-sensitive.
const UNORDERED_COMPILER_OPTION_ARRAYS = new Set([
  "lib",
  "types",
  "typeRoots",
  "rootDirs",
]);

// compilerOptions keys whose string values are filesystem paths.
const PATH_LIKE_STRING_KEYS = new Set([
  "baseUrl",
  "rootDir",
  "outDir",
  "outFile",
  "declarationDir",
  "tsBuildInfoFile",
]);

function normalizeFsPath(p: string): string {
  return p.replace(/\\/g, "/");
}

function sortStrings(arr: string[]): string[] {
  return [...arr].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

function normalizeReferences(
  refs: unknown[]
): Array<Record<string, unknown>> {
  const normalized = refs.map((r) =>
    normalizeObject(r as Record<string, unknown>, "references")
  );
  // Sort by path so two configs with the same refs in different orders compare equal.
  return normalized.sort((a, b) =>
    String(a.path ?? "").localeCompare(String(b.path ?? ""), "en", {
      sensitivity: "base",
    })
  );
}

function normalizeArray(arr: unknown[], key: string, parentKey?: string): unknown[] {
  const isTopLevelUnordered = UNORDERED_TOP_LEVEL_ARRAYS.has(key);
  const isCompilerOptionUnordered =
    parentKey === "compilerOptions" && UNORDERED_COMPILER_OPTION_ARRAYS.has(key);
  const isReferences = key === "references";

  if (isReferences) {
    return normalizeReferences(arr);
  }

  const items = arr.map((item) => {
    if (typeof item === "string") {
      // Glob patterns and paths in include/exclude/files/typeRoots/etc.
      return normalizeFsPath(item);
    }
    if (item !== null && typeof item === "object") {
      return normalizeObject(item as Record<string, unknown>, key);
    }
    return item;
  });

  if (isTopLevelUnordered || isCompilerOptionUnordered) {
    return sortStrings(items as string[]);
  }

  return items;
}

function normalizeObject(
  obj: Record<string, unknown>,
  parentKey?: string
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Sorting keys is the core move that makes two deeply-equal objects stringify-equal.
  for (const key of Object.keys(obj).sort()) {
    const value = obj[key];

    if (value === undefined) continue;

    if (Array.isArray(value)) {
      result[key] = normalizeArray(value, key, parentKey);
    } else if (value !== null && typeof value === "object") {
      result[key] = normalizeObject(value as Record<string, unknown>, key);
    } else if (typeof value === "string") {
      // Normalize path separators for known path-like string fields.
      const isPathLike =
        key === "extends" ||
        (parentKey === "references" && key === "path") ||
        (parentKey === "compilerOptions" && PATH_LIKE_STRING_KEYS.has(key));
      result[key] = isPathLike ? normalizeFsPath(value) : value;
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Normalizes a tsconfig so that two configs that are deeply equal will produce
 * identical strings. Accepts either a parsed object or a raw JSON/JSONC string
 * (tsconfig files may contain comments and trailing commas).
 *
 * What this does:
 *  - Sorts all object keys recursively
 *  - Sorts semantically-unordered arrays (include, exclude, files, lib, types, typeRoots, rootDirs, references)
 *  - Normalizes filesystem path separators to forward slashes
 *  - Strips undefined values
 *
 * What this intentionally does NOT do:
 *  - Sort `extends` arrays (TS 5.0+: later entries override earlier ones)
 *  - Sort `paths` values (TypeScript uses them as ordered fallbacks)
 *  - Resolve or expand glob patterns
 *  - Merge inherited config from `extends`
 */
export function normalizeTsConfig(input: string | Record<string, unknown>): string {
  const parsed =
    typeof input === "string"
      ? (parseJsonc(input, [], { disallowComments: false }) as Record<string, unknown>)
      : input;

  const normalized = normalizeObject(parsed);
  return JSON.stringify(normalized, null, 2);
}
