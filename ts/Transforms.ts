// ValueTransform.ts
export type TransformType =
  | 'lowercase'
  | 'uppercase'
  | 'replace'
  | 'regexReplace'
  | 'trim'
  | 'prefix'
  | 'suffix';

export interface ValueTransform {
  type: TransformType;
  /** Optional parameters depending on type */
  find?: string; // used for replace
  replace?: string; // used for replace
  pattern?: string; // used for regexReplace
  flags?: string; // used for regexReplace
  value?: string; // used for prefix/suffix
}

/** Create an executable function from a ValueTransform */
export function makeTransformFn(t: ValueTransform): (s: string) => string {
  switch (t.type) {
    case 'lowercase':
      return s => s.toLowerCase();
    case 'uppercase':
      return s => s.toUpperCase();
    case 'trim':
      return s => s.trim();
    case 'replace':
      return s => s.split(t.find ?? '').join(t.replace ?? '');
    case 'regexReplace': {
      const re = new RegExp(t.pattern ?? '', t.flags);
      return s => s.replace(re, t.replace ?? '');
    }
    case 'prefix':
      return s => (t.value ?? '') + s;
    case 'suffix':
      return s => s + (t.value ?? '');
    default:
      return s => s;
  }
}

/** Combine multiple transforms */
export function makeTransformPipeline(list: ValueTransform[]): (s: string) => string {
  const fns = list.map(makeTransformFn);
  return s => fns.reduce((acc, fn) => fn(acc), s);
}
