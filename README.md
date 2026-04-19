# Robert Shalders — Portfolio

Personal portfolio and technical blog at [robertshalders.com](https://robertshalders.com).

## Stack

- [Astro 5](https://astro.build/) — static site generation, zero runtime JS by default
- [Tailwind CSS v4](https://tailwindcss.com/) — utility-first styling with typography plugin
- [TypeScript](https://www.typescriptlang.org/) — strict mode
- [Bun](https://bun.sh/) — package manager and build runtime
- [Biome](https://biomejs.dev/) — linting and formatting

## Deployment

Deployed to AWS S3 with CloudFront CDN. GitHub Actions builds and deploys on push to `main`.

All fonts are self-hosted (Bebas Neue, JetBrains Mono, Roboto, Trivial). No external CDN dependencies at runtime.

## Development

```bash
bun install
bun run dev       # local dev server
bun run build     # production build to dist/
bun run lint      # biome linting
bun run check     # astro type checking
```

## Content

Articles are written in Markdown under `src/content/` across four collections: projects, newsletters, resources, and tricks.

## Project Structure

```
src/
  components/     UI components (Navigation, Drawer, CategoryTabs, Prose)
  content/        Markdown articles organised by collection
  layouts/        Base layout with View Transitions
  pages/          Page routes (index, profile, articles, collection views)
  styles/         Global CSS, CRT effects, animations
  types/          TypeScript interfaces
  utils/          Article sorting and helper functions
public/
  fonts/          Self-hosted font files
  images/         Static assets
```

## Tools Used

This site was built with assistance from [Claude](https://claude.ai) and [GPT-OSS](https://github.com/openai/gpt-oss) (self-hosted). AI tools were used for scaffolding, iteration, and content drafting. Design decisions, architecture, and final content are my own.

## License

MIT. See [LICENSE](LICENSE).
