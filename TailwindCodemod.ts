type Rule = {
  desc: string;
  regex: RegExp;
  replace: string | ((...args: any[]) => string);
};

export function transformTailwindV4(source: string, filename: string): string {
  const rules: Rule[] = [
    // 1. Prefix change: tw- → tw:
    {
      desc: "prefix change: tw- → tw:",
      // matches optional variant chain (like “hover:dark:” etc) before tw-<rest>
      regex: /\b([a-z0-9:]*?)tw-([a-zA-Z0-9\[\]\-:/]+)\b/gi,
      replace: (full, prefix, rest) => {
        const newClass = `${prefix}tw:${rest}`;
        console.log(`[${filename}] ${full} → ${newClass}`);
        return newClass;
      },
    },

    // 2. Utility renames / shifts documented in v4 upgrade / depreciation lists

    {
      desc: "flex-grow → grow",
      regex: /\btw:(?:[a-z0-9:]*?)flex-grow\b/gi,
      replace: (m) => {
        console.log(`[${filename}] ${m} → tw:grow`);
        return "tw:grow";
      },
    },
    {
      desc: "flex-shrink → shrink",
      regex: /\btw:(?:[a-z0-9:]*?)flex-shrink\b/gi,
      replace: (m) => {
        console.log(`[${filename}] ${m} → tw:shrink`);
        return "tw:shrink";
      },
    },

    {
      desc: "w-N h-N → size-N (matching N)",
      // match “tw:w-4 tw:h-4” (order matters) or with variant prefixes
      regex: /\btw:(?:[a-z0-9:]*?)w-([0-9]+)\s+tw:(?:[a-z0-9:]*?)h-\1\b/gi,
      replace: (_m, n) => {
        console.log(`[${filename}] tw:w-${n} + tw:h-${n} → tw:size-${n}`);
        return `tw:size-${n}`;
      },
    },

    {
      desc: "blur-sm → blur-xs",
      regex: /\btw:(?:[a-z0-9:]*?)blur-sm\b/gi,
      replace: (m) => {
        console.log(`[${filename}] ${m} → tw:blur-xs`);
        return "tw:blur-xs";
      },
    },
    {
      desc: "blur → blur-sm (if standalone)",
      regex: /\btw:(?:[a-z0-9:]*?)\bblur\b/gi,
      replace: (m) => {
        console.log(`[${filename}] ${m} → tw:blur-sm`);
        return "tw:blur-sm";
      },
    },

    {
      desc: "rounded → rounded-sm (default)",
      // match `tw:rounded` not followed by a dash
      regex: /\btw:(?:[a-z0-9:]*?)rounded(?!-[a-z0-9])/gi,
      replace: (m) => {
        console.log(`[${filename}] ${m} → tw:rounded-sm`);
        return "tw:rounded-sm";
      },
    },
    {
      desc: "rounded-sm → rounded-xs",
      regex: /\btw:(?:[a-z0-9:]*?)rounded-sm\b/gi,
      replace: (m) => {
        console.log(`[${filename}] ${m} → tw:rounded-xs`);
        return "tw:rounded-xs";
      },
    },

    {
      desc: "ring → ring-3 (to maintain prior default semantics)",
      regex: /\btw:(?:[a-z0-9:]*?)\bring\b/gi,
      replace: (m) => {
        console.log(`[${filename}] ${m} → tw:ring-3`);
        return "tw:ring-3";
      },
    },

    // 3. Additional documented / community‐noted deprecations or renames (from upgrade guide / migration posts)

    // Example: “removal of deprecated utilities” — these may not map to a direct rename
    // We can flag unknown tw: classes that don’t exist in v4 (optional)
    // But if you find particular classes in your code, add them here in this list

    // Placeholder rule: flag unknown tw: classes (for your manual review)
    {
      desc: "flag unknown tw: utility (for manual review)",
      // a heuristic: tw:some-unknown that doesn’t follow common patterns (this is dangerous / too broad)
      regex: /\btw:([a-z][a-z0-9-:\/\[\]]+?)\b/gi,
      replace: (m, cls) => {
        // You might want to skip known ones; here just log for inspection
        // Note: Do _not_ blindly change; return m unchanged
        // But log potential classes to check
        console.log(`[${filename}] check class: tw:${cls}`);
        return m;
      },
    },
  ];

  let out = source;
  for (const rule of rules) {
    out = out.replace(rule.regex, rule.replace as any);
  }
  return out;
}
