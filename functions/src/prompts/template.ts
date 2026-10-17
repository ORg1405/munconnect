// Substituição de placeholders {{chave}} sem regex dinâmica. Falha alto se um
// placeholder ficar sem valor (evita mandar "{{dossie}}" literal ao modelo).

export function render(template: string, vars: Record<string, string>): string {
  const out = template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (!(key in vars)) throw new Error(`Placeholder sem valor: ${match}`);
    return vars[key];
  });
  return out;
}

export function placeholdersOf(template: string): string[] {
  return [...new Set([...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
}
