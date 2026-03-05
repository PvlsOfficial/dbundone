# DBundone — Website

Marketing & documentation site for [DBundone](../README.md).

Built with **Next.js 16** (App Router), **React 19**, **Tailwind CSS 4**, and **MDX** for blog/docs content.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page (hero, features, VST section, pricing, FAQ) |
| `/docs` | Documentation |
| `/blog` | Blog posts (MDX) |
| `/changelog` | Release changelog |
| `/pricing` | Pricing cards + Stripe checkout |
| `/download` | Desktop app download |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |
| `/refund` | Refund policy |

## Getting Started

```bash
npm install
cp .env.example .env.local   # fill in Stripe keys
npm run dev                   # http://localhost:3000
```

## Environment Variables

See [`.env.example`](.env.example) for required keys.

## Deployment

Deploy to **Vercel** (recommended) or any Node.js-compatible host:

```bash
npm run build    # produces .next/ + sitemap
npm start        # production server
```

Set the environment variables in your hosting dashboard before deploying.
