
# Rebuild elitechatweb in this Lovable project

## What's in the source repo

A full-featured chat app: auth, DMs + groups, voice recorder, media gallery, status/stories, reels, in-chat games (Tic-Tac-Toe, Connect 4), admin portal, reel-manager portal, smart replies, themes/wallpapers. Backend is Supabase: 26 SQL migrations, 2 edge functions (`lovable-chat`, `smart-reply`), realtime, storage. Frontend is Vite + React 18 + `react-router-dom` (single `/` route) + shadcn + Tailwind v3.

This project's template is TanStack Start v1 + Tailwind v4. Most components don't touch the router, so they port nearly as-is. The framework-shaped pieces (`App.tsx`, `main.tsx`, `index.css`, router, Supabase client) get rewritten to fit the template.

## Plan

### 1. Backend (Lovable Cloud)
- Enable Lovable Cloud (Supabase).
- Concatenate the 26 source migrations into one ordered migration under `supabase/migrations/` and run it. Schema: profiles, user_roles, contacts, messages, groups, group_members, stories/status, reels, games, announcements, etc.
- Port edge functions `lovable-chat` and `smart-reply` into `supabase/functions/` (kept as Supabase Edge Functions so the existing client `supabase.functions.invoke()` calls keep working unchanged).
- Create storage buckets the app references (avatars, media, voice, reels, stories) with policies matching the source.

### 2. Frontend port
- Copy `src/components/**` (43 feature components incl. `admin/` and `games/`), `src/lib/**` (chatStore, connect4, ticTacToe, lovableBot, utils), `src/hooks/use-mobile.tsx`, `src/integrations/supabase/{client,types}.ts`, `src/assets/wallpaper-*` and `public/` assets (favicon, notification.wav, etc.) into this project.
- Adapt the Supabase client to read `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` injected by Lovable Cloud.
- Replace the design-system stub in `src/styles.css` with the source `src/index.css` tokens (HSL variables, fonts, custom utilities). Add Tailwind v4 `@theme inline` bindings so existing `bg-background`, `text-foreground`, etc. classes keep resolving.
- Keep shadcn UI components from this project's `src/components/ui/*` (already present); add the few extras the source needs (`toast.tsx`, `toaster.tsx`, `use-toast.ts`) so existing imports compile.

### 3. Routing shell
- Replace `src/routes/index.tsx` with the source `pages/Index.tsx` body (it's the entire app behind one route — gate is auth state, not URL).
- Update `src/routes/__root.tsx` to mount `<Toaster />`, `<Sonner />`, `<TooltipProvider>` around the `<Outlet />` (equivalent of the source `App.tsx`).
- Update root `head()` with the app's title/description.
- No additional routes needed — the app is single-route by design.

### 4. Dependencies
Install what the source uses and this template doesn't already have: `@supabase/supabase-js`, `react-router-dom` is dropped, plus any missing Radix packages, `embla-carousel-react`, `react-day-picker`, `cmdk`, `vaul`, `input-otp`, `date-fns`, `next-themes`, `recharts`, `sonner`, `react-hook-form`, `@hookform/resolvers`, `zod`, `react-resizable-panels`, `tailwindcss-animate` (or its v4 equivalent already in template).

### 5. Verify
- Build passes.
- Auth screen renders on `/`.
- Sign up → profile loads → sidebar + chat area mount.
- Spot-check: send a DM, open a group, record voice, play a game, open admin (if admin role).

## Important caveats — please read

- **Scale**: this is ~100 files and a 26-step DB migration. Expect this to take multiple back-and-forth turns and consume meaningful credits. I'll do it in batches (backend → core port → feature components → fixes) and report progress.
- **Secrets**: the source repo committed a `.env` with Supabase keys. Lovable Cloud will mint a brand-new Supabase project — your old project's data, users, and storage will NOT come with it. Rotate the leaked keys in the original Supabase project regardless.
- **Edge functions**: kept as Supabase Edge Functions (not converted to TanStack server functions) so the in-app `supabase.functions.invoke(...)` call sites need zero changes.
- **Tailwind v3 → v4**: any source class that depended on v3-only behavior may need tweaks. I'll fix as they surface during verification.
- **Realtime / push**: depends on the Cloud project's settings; the code ports as-is and should work once tables and policies are in place.

## Technical notes

- Source `App.tsx` uses BrowserRouter with one route — replaced by `__root.tsx` providers + `index.tsx` page; `useNavigate`/`Link` from `react-router-dom` are not used anywhere else in the source, so removing the package is safe.
- Source `index.css` uses HSL custom properties (`--background: 0 0% 100%` etc.) with `hsl(var(--background))` in Tailwind. Template uses oklch + bare `var(--background)`. I'll keep the source's HSL system intact and rewrite `@theme inline` to wrap each token with `hsl(...)` — fewer downstream class changes.
- `src/integrations/supabase/types.ts` (generated) is copied verbatim and used by components; Lovable Cloud regenerates its own types but the shapes align with the migrations we run.

Approve and I'll start with step 1 (enable Cloud + apply migrations).
