export const COLLECTIONS = [
  "projects",
  "resources",
  "tricks",
  "newsletters",
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];
