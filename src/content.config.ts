import { defineCollection, z } from "astro:content";
import type { CollectionEntry } from "astro:content";
import { glob } from "astro/loaders";

// Schemas
const baseArticleSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  slug: z.string(),
  published: z.preprocess((val) => new Date(val), z.date()),
  tags: z.array(z.string()).optional(),
  author: z.string().optional().default("Robert Shalders"),
  image: z.string().url().optional(),
  references: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
        description: z.string().optional(),
        accessed: z.date().optional(),
      }),
    )
    .optional()
    .default([]),
});

// Collections
const newsletters = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/newsletters" }),
  schema: baseArticleSchema,
});

const tricks = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/tricks" }),
  schema: baseArticleSchema,
});

const resources = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/resources" }),
  schema: baseArticleSchema,
});

const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: baseArticleSchema.extend({
    repo: z.string().url().optional(),
  }),
});

// Export collections
export const collections = {
  newsletters,
  tricks,
  resources,
  projects,
};

export type ProjectEntry = CollectionEntry<"projects">;
export type NewsletterEntry = CollectionEntry<"newsletters">;
export type ResourceEntry = CollectionEntry<"resources">;
export type TrickEntry = CollectionEntry<"tricks">;
export type ArticleEntry = ProjectEntry | ResourceEntry | TrickEntry | NewsletterEntry;
