type TypeMap = {
  string: string;
  number: number;
  boolean: boolean;
  bigint: bigint;
  symbol: symbol;
  undefined: undefined;
  object: object;
  function: Function;
};

// helper to map tuple of keys -> union of actual types
type TypesFromKeys<K extends readonly (keyof TypeMap)[]> = TypeMap[K[number]];

export function isTypeOf<K extends readonly (keyof TypeMap)[]>(
  value: unknown,
  ...types: K
): value is TypesFromKeys<K> {
  return types.some((t) => typeof value === t);
}
