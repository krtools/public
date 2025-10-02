type Rule = {
  desc: string
  regex: RegExp
  replace: string | ((...args: any[]) => string)
}

export function transformTailwindV4(source: string, filename: string): string {
  const rules: Rule[] = [
    // ───────────────────────────────────────────────
    // Prefix migration
    {
      desc: "prefix change: tw- → tw:",
      regex: /\b([a-z0-9:]*?)tw-([a-zA-Z0-9\[\]\-:/]+)\b/g,
      replace: (full, prefix, rest) => {
        const newClass = `${prefix}tw:${rest}`
        console.log(`[${filename}] ${full} → ${newClass}`)
        return newClass
      },
    },

    // ───────────────────────────────────────────────
    // Flexbox
    {
      desc: "flex-grow → grow",
      regex: /\btw:(?:[a-z0-9:]*?)flex-grow\b/gi,
      replace: () => {
        console.log(`[${filename}] flex-grow → tw:grow`)
        return "tw:grow"
      },
    },
    {
      desc: "flex-shrink → shrink",
      regex: /\btw:(?:[a-z0-9:]*?)flex-shrink\b/gi,
      replace: () => {
        console.log(`[${filename}] flex-shrink → tw:shrink`)
        return "tw:shrink"
      },
    },

    // ───────────────────────────────────────────────
    // Width + height same → size
    {
      desc: "w-N + h-N → size-N",
      regex: /\btw:(?:[a-z0-9:]*?)w-(\d+)\s+tw:(?:[a-z0-9:]*?)h-\1\b/gi,
      replace: (_m, n) => {
        console.log(`[${filename}] w-${n} h-${n} → tw:size-${n}`)
        return `tw:size-${n}`
      },
    },

    // ───────────────────────────────────────────────
    // Blur
    {
      desc: "blur-sm → blur-xs",
      regex: /\btw:(?:[a-z0-9:]*?)blur-sm\b/gi,
      replace: () => {
        console.log(`[${filename}] blur-sm → tw:blur-xs`)
        return "tw:blur-xs"
      },
    },
    {
      desc: "blur (bare) → blur-sm",
      regex: /\btw:(?:[a-z0-9:]*?)\bblur\b/gi,
      replace: () => {
        console.log(`[${filename}] blur → tw:blur-sm`)
        return "tw:blur-sm"
      },
    },

    // ───────────────────────────────────────────────
    // Rounded
    {
      desc: "rounded → rounded-sm",
      regex: /\btw:(?:[a-z0-9:]*?)rounded(?!-[a-z0-9])/gi,
      replace: () => {
        console.log(`[${filename}] rounded → tw:rounded-sm`)
        return "tw:rounded-sm"
      },
    },
    {
      desc: "rounded-sm → rounded-xs",
      regex: /\btw:(?:[a-z0-9:]*?)rounded-sm\b/gi,
      replace: () => {
        console.log(`[${filename}] rounded-sm → tw:rounded-xs`)
        return "tw:rounded-xs"
      },
    },

    // ───────────────────────────────────────────────
    // Rings
    {
      desc: "ring → ring-3",
      regex: /\btw:(?:[a-z0-9:]*?)\bring\b/gi,
      replace: () => {
        console.log(`[${filename}] ring → tw:ring-3`)
        return "tw:ring-3"
      },
    },

    // ───────────────────────────────────────────────
    // Opacity (unified)
    {
      desc: "opacity utilities: <util>-opacity-N → <util>/N",
      regex: /\btw:([a-z-]+)-opacity-(\d{1,3})\b/gi,
      replace: (_m, util, num) => {
        const newClass = `tw:${util}/${num}`
        console.log(`[${filename}] ${_m} → ${newClass}`)
        return newClass
      },
    },

    // ───────────────────────────────────────────────
    // TODO: Colors
    // Tailwind v4 dropped some old palettes (lightBlue, warmGray, coolGray, trueGray).
    // If you used them, add explicit rules here, e.g.:
    // tw:bg-light-blue-500 → tw:bg-sky-500
    // tw:text-cool-gray-600 → tw:text-gray-600
    // etc.
  ]

  let out = source
  for (const rule of rules) {
    out = out.replace(rule.regex, rule.replace as any)
  }
  return out
}
