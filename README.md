# Carbonwise

Carbonwise is a browser-based building carbon estimator with private Supabase accounts, user-owned workspaces and projects, and an owner-scoped project assessment store. The carbon model is still an indicative prototype; authentication does not make its assumptions suitable for certification or engineering sign-off.

## Local setup

Requires Node.js 20.19+ or 22.12+ and npm.

1. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the Supabase project’s API settings. Only the publishable key belongs in a browser build. Never use `SUPABASE_SECRET_KEY`, a service-role key, or a database password in any `VITE_` variable.
2. Install dependencies with `npm install`.
3. Run `npm run dev` and open the local URL printed by Vite.

The first account is guided through workspace setup and creation of its first building project. After sign-in, the project picker lists only the authenticated user’s projects. Project inputs are autosaved to that project’s assessment record.

## Supabase database setup

The migration in `supabase/migrations` creates `workspaces`, `projects`, and `project_assessments`. It sets owner defaults to `auth.uid()`, enables RLS, and grants authenticated users CRUD only through policies that check the owner. Composite foreign keys ensure a project can only reference its owner’s workspace and an assessment can only reference its owner’s project. Anonymous access is revoked.

To apply it to the linked Supabase project, install the Supabase CLI, authenticate, and use the project ref from the Supabase URL:

```sh
supabase login
supabase link --project-ref buhzhylsovjnsaqildma
supabase db push --dry-run
supabase db push
```

The final command applies the migration to the remote database and requires the database password or authenticated CLI access. Review the dry-run output first. The migration is not applied until `db push` completes successfully.

## Supabase Auth production settings

- Configure the production site URL and exact local/production redirect URLs in Authentication URL Configuration. Confirmation and recovery links return to the app origin.
- Keep email confirmation enabled. Configure custom SMTP before inviting external users; Supabase’s default mail service is restricted and intended for development.
- Configure the Supabase password policy to require at least 12 characters, and set appropriate sign-in, recovery, and signup rate limits. The app also checks for 12 characters in signup and password reset forms.
- Add CAPTCHA / abuse protection before opening public signup at scale. Configure MFA according to your organization’s risk policy.
- Set backups and recovery to match your production recovery needs, then periodically review RLS policies and auth logs.
- Rotate the secret key that was pasted into the conversation. It is not used by this frontend or stored in this repository. A secret key bypasses RLS and must remain server-side.

## Build and deploy

Run `npm run build` and deploy the generated `dist/` directory to a static host that serves the SPA entry point over HTTPS. Add the two Vite settings as build-time environment variables in that host. The publishable key is intentionally browser-visible; database RLS is the access boundary. Do not put a secret key in deployment variables prefixed with `VITE_`.

## Carbon model scope

- Gross floor area = floor plate × floors.
- Material quantities may be estimated from editable area intensities, but each quantity needs its own project source before it is complete.
- Product-stage A1–A3 = Σ(material quantity × factor). Catalog factors remain unverified; a user-entered factor needs a source record and explicit user verification before it is eligible for a complete result.
- Operational results require a sourced factor record with compatible units; location assumptions are not fabricated into sourced results.
- Shading, solar and lower-carbon concrete remain unscored until actual inputs and added impacts are modeled. Mix candidates remain unscored without compatible product data.
- A4, A5, B1–B7, and C1–C4 are mapped from their module inputs. B7 operational water is included in whole-life totals but excluded from embodied carbon. Module D is reported separately.
- No combined whole-life total or carbon intensity is shown when required modules, area, or compatible factors are missing.

All demo quantity intensities, material factors, city energy intensities, grid factors, and intervention effects are illustrative and low-confidence. They are not authoritative Indian EPD/LCA data. Replace them with traceable project or supplier data and state the applicable system boundary before real-building decisions. This prototype makes no compliance claim.
