# MJApp - AI Image Generator

React + Vite + Supabase + Vercel serverless function (`/api/generate`).

## Features
- Email/password auth (Supabase) with session listener
- Generate image endpoint (placeholder image URL for now)
- Per-user gallery stored in `images` table
- RLS-ready design (ensure policies are applied in Supabase)

## Environment Variables
You need **both** frontend (Vite) and backend variables in Vercel Production (and Preview if you use it):

Frontend (public – required for client auth):
```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Backend (server-only; duplicates are fine; service role is secret):
```
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE=service-role-key (DO NOT prefix with VITE_)
```
Optional:
```
IMAGE_API_URL=https://your-image-api.example.com/generate
```

## Local Development
1. Create `./.env.local` in project root:
```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE=service-role-key  # optional locally if you call serverless directly
```
2. Install deps: `npm install`
3. Run dev: `npm run dev`

## Database (Supabase) Setup
Run in Supabase SQL editor:
```sql
create table if not exists images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  prompt text not null,
  image_url text not null,
  created_at timestamptz default now()
);

alter table images enable row level security;

create policy if not exists "images_select_own" on images
for select using (auth.uid() = user_id);

create policy if not exists "images_insert_own" on images
for insert with check (auth.uid() = user_id);
```
(Optional) index for faster gallery queries:
```sql
create index if not exists images_user_created_idx on images(user_id, created_at desc);
```

## API Endpoint
`/api/generate` expects:
```json
POST { "prompt": "your text" }
```
Headers:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```
Response:
```json
{ "imageUrl": "https://..." }
```
(Currently returns a placeholder URL until integrated with a real provider.)

## Common Issues
- 400 on `/auth/v1/token`: Wrong credentials attempt or empty email/password.
- `supabaseUrl is required` (frontend): Missing `VITE_SUPABASE_URL` at build time.
- Broken image placeholder: `imageUrl` invalid or provider failed. Check Network panel for `/api/generate` response.

## Enhancements To Consider
- Pagination (`range()` queries)
- Delete images (add RLS delete policy)
- Real image generation provider integration
- Rate limiting or usage quotas per user

## License
Specify license here (MIT, etc.).
