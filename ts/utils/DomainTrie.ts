export type DomainTrie = Map<string, DomainTrie> & {end?: boolean};
export type DomainTrieRoot = DomainTrie & {hasDomain: (url: string) => boolean};

export function buildDomainTrie(domains: Iterable<string>): DomainTrieRoot {
  const root: DomainTrie = new Map();
  for (const d of domains) {
    let node: DomainTrie = root;
    for (const part of d.toLowerCase().split('.').reverse()) {
      if (!node.has(part)) node.set(part, new Map() as DomainTrie);
      node = node.get(part)!;
    }
    node.end = true;
  }

  return Object.assign(root, {
    hasDomain: (s: string) => isOneOfHostnames(s, root)
  });
}

export function isOneOfHostnames(url: string, trie: DomainTrie) {
  if (!URL.canParse(url)) return false;
  const parts = new URL(url).hostname.toLowerCase().split('.').reverse();

  let node: DomainTrie | undefined = trie;
  for (const part of parts) {
    node = node.get(part);
    if (!node) return false;
    if (node.end) return true;
  }
  return false;
}
