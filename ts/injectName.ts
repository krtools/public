/** For a Record<K, V extends object>, add the K as 'name' as the property into each object in a record */
export function injectName<O extends object, T extends Record<string, O>>(obj: T): {[K in keyof T]: T[K] & {name: K}} {
  const rec = {} as any;
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'name') throw new Error(`cannot have ${k} as a property`);
    Object.assign(rec, {[k]: {...v, name: k}});
  }
  return rec;
}
