// Pages affichées par la pagination ODS : toutes jusqu'à 7, sinon la première, la
// dernière et les voisines de la page courante, avec « … » entre les trous
// (planche 13 : « 1 2 3 … 36 »).
export type PageItem = number | "…";

export function pageItems(page: number, count: number): PageItem[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const keep = new Set([1, count, page - 1, page, page + 1]);
  if (page <= 2) [2, 3].forEach((n) => keep.add(n));
  if (page >= count - 1) [count - 2, count - 1].forEach((n) => keep.add(n));
  const pages = [...keep].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b);
  const out: PageItem[] = [];
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1]! > 1) out.push("…");
    out.push(n);
  });
  return out;
}
