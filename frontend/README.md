This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Internationalization (i18n)

### Supported locales

- `ko` (Korean, default)
- `en` (English)

The active locale is driven by the authenticated user's profile (`GET /users/me`
→ `user.locale`). Unauthenticated sessions fall back to whatever was stored in
`localStorage` under `idea-workflow.locale`, and finally to the default (`ko`).
Changing the language on `/profile` persists to the API; on save success the
client flips the store and the UI re-renders immediately.

### Architecture

```
src/lib/i18n/
├── types.ts          # Locale type + isLocale guard + LOCALES / DEFAULT_LOCALE
├── core.ts           # Pure translate(locale, key, params) + TranslationKey type
│                     # — no "use client"; safe for server code and tests
├── index.ts          # "use client" hooks (useT, useLocale) on top of core
├── locale-sync.tsx   # <LocaleSync /> — syncs user.locale / localStorage into store
└── dict/
    ├── types.ts      # Dict structural contract (ko shape, widened to `string`)
    ├── ko.ts         # Reference dictionary (source of truth for keys)
    └── en.ts         # English translations

src/lib/stores/locale-store.ts
    # zustand store; mirrors lang onto <html lang> and persists to localStorage
```

- Call `useT()` in React components to get the `t(key, params?)` function.
- Call `useLocale()` when you need the raw locale (e.g. to key a form by locale
  so `react-hook-form` picks up new Zod error messages after a language change).
- Call `translate(locale, key, params?)` from non-React code (timers, WS
  handlers, server utils). Pass `useLocaleStore.getState().locale` if you want
  to honour the current user choice.

### Adding a translation key

1. Add the key under the appropriate namespace in `src/lib/i18n/dict/ko.ts`
   (source of truth).
2. Add the matching key with the same shape in
   `src/lib/i18n/dict/en.ts`. TypeScript will reject mismatches because the
   English dictionary is typed against the Korean shape via `Dict`.
3. Reference it as `t("namespace.key")`. The `TranslationKey` type autocompletes
   every valid key.
4. Use `{{ param }}` placeholders in values when you need interpolation (e.g.
   `"Updated {{count}} items"`). Passing a missing param in development triggers
   a `console.warn` so drift is noticed early.

### Fallbacks

- Missing key in the target locale → falls back to `DEFAULT_LOCALE` (ko) and
  warns in development.
- Missing in both → returns the key itself so the UI still renders and the
  typo is visible.
- `en.ts` can omit subtrees; only the missing leaves fall back.

### Documentation (MDX)

Frontmatter supports `title_en` / `summary_en` alongside the Korean `title` /
`summary`. The sidebar (`src/components/docs/docs-sidebar.tsx`) and page
heading (`src/components/docs/doc-header.tsx`) pick the locale-appropriate
strings via `@/lib/docs/locale`. MDX body content is still Korean; an English
session shows a `DocBodyNotice` at the top of each page explaining that
translations are rolling out.

### Tests

The locale store defaults to `ko`. Tests that assert against English UI should
set the locale explicitly in `beforeEach`:

```ts
import { useLocaleStore } from "@/lib/stores/locale-store";

beforeEach(() => {
  useLocaleStore.setState({ locale: "en" });
});
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
