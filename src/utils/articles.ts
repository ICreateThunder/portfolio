import type { ArticleEntry } from "../content.config";

export const sortByPublished = <T extends ArticleEntry>(items: T[]): T[] =>
  [...items].sort(
    (a, b) =>
      new Date(b.data.published).getTime() -
      new Date(a.data.published).getTime(),
  );
export const mostRecentArticles = <T extends ArticleEntry>(items: T[], n = 5): T[] =>
  sortByPublished(items).slice(0, n);

export const roundRobin = <T>(...groups: T[][]): T[] => {
  const max = Math.max(...groups.map((g) => g.length));
  const result: T[] = [];
  for (let i = 0; i < max; i++) {
    for (const group of groups) {
      if (group[i]) result.push(group[i]);
    }
  }
  return result;
};
