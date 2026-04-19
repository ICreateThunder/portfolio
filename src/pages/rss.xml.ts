import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { sortByPublished } from "../utils/articles";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const [newsletters, projects, resources, tricks] = await Promise.all([
    getCollection("newsletters"),
    getCollection("projects"),
    getCollection("resources"),
    getCollection("tricks"),
  ]);

  const all = sortByPublished([
    ...newsletters,
    ...projects,
    ...resources,
    ...tricks,
  ]);

  return rss({
    title: "Robert Shalders",
    description:
      "Articles on software engineering, distributed systems, performance, and the occasional compromise of values.",
    site: context.site!,
    trailingSlash: false,
    items: all.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      pubDate: new Date(entry.data.published),
      link: `/${entry.collection}/${entry.data.slug}`,
      categories: entry.data.tags,
      author: entry.data.author ?? "Robert Shalders",
    })),
    customData: `<language>en-gb</language>`,
  });
}
