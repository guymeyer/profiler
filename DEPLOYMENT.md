# Deployment — Vercel + Cloudflare Access

This guide stands up a live instance of Profiler gated by Cloudflare Access.
Total monthly cost: **~$20** (Vercel Pro) + **$0** (Cloudflare Access free
tier, up to 50 users) + Anthropic API usage.

## What you'll end up with

```
[ user's browser ]
        │
        ▼  ──── (a) Cloudflare Access intercepts. User signs in via
[ profiler.your-domain.com ]    email OTP or OAuth. CF injects a
        │                       Cf-Access-Jwt-Assertion header.
        ▼  ──── (b) Vercel receives the request. middleware.ts
[ Vercel ]                      verifies the JWT before any page runs.
        │                       Anyone hitting the raw *.vercel.app
        ▼                       URL directly gets 403.
[ Profiler app + Anthropic ]
```

Two layers (Cloudflare Access + JWT verification middleware) is intentional —
if a misconfiguration in Cloudflare ever drops the gate, the middleware still
refuses traffic that doesn't carry a valid Access token.

---

## Prerequisites

1. **GitHub account** with the repo pushed.
2. **Vercel account** — sign up at vercel.com.
3. **A domain you control**, manageable in Cloudflare DNS. If you don't have
   a domain, you can buy one cheap (Cloudflare Registrar, Porkbun, etc.).
4. **Cloudflare account** — free tier is fine. The domain needs to be using
   Cloudflare nameservers.
5. **Anthropic API key** — from console.anthropic.com.

---

## Step 1 — Push the repo to GitHub

If you haven't already:

```bash
git init
git add .
git commit -m "initial"
gh repo create profiler --private --source=. --push
```

`.env.local` is already gitignored — your API key won't leak.

---

## Step 2 — Deploy to Vercel

1. In Vercel dashboard → **Add New** → **Project** → import the GitHub repo.
2. Framework should auto-detect as **Next.js**. Leave build settings default.
3. Before clicking Deploy, add environment variables:

   | Key | Value | Notes |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | `sk-ant-...` | Required for real LLM analysis |
   | `NEXT_PUBLIC_HAS_ANTHROPIC_KEY` | `1` | UI signal so it doesn't say "mock mode" |

   Leave `CF_ACCESS_TEAM` and `CF_ACCESS_AUD` blank for now — you'll fill
   these in after Cloudflare Access is configured. The middleware fails closed
   when they're missing, so the production URL will return 503 until you wire
   Cloudflare. That's intentional.

4. **Click Deploy.** Wait for the build to finish (~1 min).

5. **Enable Vercel "Standard Protection"** as a temporary safety net while
   you finish setup:
   - Project settings → Deployment Protection → **Vercel Authentication**.
   - This requires a Vercel account to view the deployment URLs. Anyone you
     haven't invited to the team can't see the app even if they know the URL.
   - You'll remove this later once Cloudflare Access is the gate.

---

## Step 3 — Upgrade to Vercel Pro

Required because:

- Free Hobby plan caps function execution at **10 seconds**.
- Analyses regularly run 30–120 seconds (longer with deep research /
  web search). They will silently truncate on Hobby.
- Pro raises this to 60s default, configurable up to 300s. The repo's
  `vercel.json` and `app/layout.tsx` are already set to 300s.

Upgrade in Project Settings → Plans. ~$20/mo.

---

## Step 4 — Custom domain

You need a subdomain pointing at Vercel that Cloudflare can then proxy.

1. In Vercel project → Settings → Domains → **Add** → e.g.
   `profiler.your-domain.com`.
2. Vercel shows you the DNS record to create.
3. In Cloudflare DNS for your domain → add the record Vercel showed
   (typically a `CNAME` pointing at `cname.vercel-dns.com`).
4. **Important**: set the Cloudflare DNS record to **"Proxied"** (orange
   cloud), not "DNS only". Cloudflare Access only works with proxied traffic.
5. Wait for the cert to issue (Vercel does this automatically).
6. Verify by visiting `profiler.your-domain.com` — should show the Vercel
   Authentication screen you enabled in step 2, prove the routing works.

---

## Step 5 — Set up Cloudflare Access

In the Cloudflare dashboard → **Zero Trust** (you may need to walk through
the one-time Zero Trust setup; the free plan is sufficient).

1. **Settings → Authentication → Login methods**. Configure at least one:
   - **One-time PIN** (no setup; CF emails users a 6-digit code) — easiest.
   - **Google / GitHub / Microsoft / Apple** — OAuth, needs app credentials
     from each provider.

2. **Access → Applications → Add an application → Self-hosted**.
   - **Application name**: `Profiler`
   - **Session duration**: `24 hours` (or whatever feels right)
   - **Domain**: `profiler.your-domain.com`
   - Click Next.

3. **Add a policy**:
   - **Policy name**: `Allowed users`
   - **Action**: `Allow`
   - **Configure rules** — e.g.:
     - Include: `Emails ending in @yourcompany.com`, OR
     - Include: `Emails` → list specific addresses, OR
     - Include: `Google group`, etc.
   - You can stack rules (`Include` is OR; `Require` is AND).
   - Click Next.

4. **Settings page** (last screen of the application wizard):
   - **Application Audience (AUD) Tag** — **copy this**. You'll set it as
     `CF_ACCESS_AUD` in Vercel.
   - Save.

5. Note your **team name** from the URL: `https://<TEAM>.cloudflareaccess.com`
   (visible top-right of Zero Trust dashboard, or in the URL bar). This is
   `CF_ACCESS_TEAM`.

---

## Step 6 — Wire the middleware

Back in Vercel project → Settings → Environment Variables, add:

| Key | Value |
|---|---|
| `CF_ACCESS_TEAM` | your team slug (e.g. `yourcompany`) — the bit before `.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | the AUD tag from step 5.4 |

**Redeploy** — env var changes don't take effect until next deploy. Vercel
dashboard → Deployments → latest → Redeploy.

---

## Step 7 — Verify the full gate

1. **Fresh incognito window** → `profiler.your-domain.com`.
2. Cloudflare Access login screen should appear.
3. Sign in with an allowed email; receive OTP via email.
4. App loads. ✅

Now test the bypass attempt:

1. Find your raw Vercel deployment URL (looks like
   `profiler-abc123.vercel.app`) — Vercel dashboard → Project → Settings →
   Domains shows it.
2. Try to hit it directly in incognito.
3. You should see **Vercel Authentication** (from step 2.5) OR if you've
   disabled Vercel auth, you should see the middleware's `403 Forbidden —
   this application must be accessed via Cloudflare Access` response.
4. ✅ The raw deployment isn't reachable without going through CF.

You can now optionally disable Vercel's "Standard Protection" from step 2.5,
keeping just Cloudflare Access as the gate. Or leave both on for defense in
depth (Vercel Authentication + CF Access).

---

## Recap of all environment variables

| Var | Required? | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes (for real analyses) | Anthropic API key |
| `NEXT_PUBLIC_HAS_ANTHROPIC_KEY` | recommended | UI signal, set to `1` |
| `CF_ACCESS_TEAM` | yes in prod | Cloudflare team slug |
| `CF_ACCESS_AUD` | yes in prod | Application audience tag |

---

## Operating notes

### Adding / removing users

Cloudflare Access dashboard → Applications → Profiler → policy → edit the
include rules. Changes apply at next session refresh (or instantly if you
revoke an existing session via the Logs tab).

### Auditing access

CF Access dashboard → Logs → Access. Every login attempt is recorded with
timestamp, email, IP, user agent.

### When CF Access is misconfigured

The middleware fails closed: missing env vars in production → `503`. A
malformed JWT → `403`. The app never silently exposes data when the gate
breaks.

### Local development

`NODE_ENV=development` bypasses the middleware. Just `pnpm dev` as usual.
You can leave `CF_ACCESS_TEAM` and `CF_ACCESS_AUD` unset locally.

### Costs to watch

- **Anthropic API** — every authenticated user pulls from the same key.
  Sonnet 4.6 is roughly $3/MTok input, $15/MTok output. A single
  artifact analysis with full audience context is ~10–30k input tokens
  + ~3–6k output tokens — call it $0.10–$0.40 per run. Deep research
  with web search adds more. Watch the Anthropic console.
- **Vercel** — $20/mo + bandwidth above the included quota. Streaming
  responses count toward bandwidth. Should be fine for an internal demo.
- **Cloudflare** — Access free up to 50 users. Beyond that, $7/user/mo.

### Known limitations worth flagging

- **LocalStorage is per-browser** — every authenticated user starts with a
  blank slate (seed people only, no customers / research / OKRs / saved
  audiences). For an internal demo where each viewer drives their own
  scenarios this is fine, but you can't pre-populate a shared dataset
  without a real backend (see `HANDOFF.md` for the path).
- **API key is shared** — anyone in the Access allowlist can run analyses
  on your dime. If your allowlist is broad, consider adding a per-session
  spend cap (see TODO below).
- **Deep research with web_search** can take 30–60s and uses Anthropic's
  built-in tool which is billed separately. Check the Anthropic console
  for current pricing.

---

## TODO / next hardening pass

These are good ideas but not yet implemented. Tackle if you grow beyond a
small internal audience.

- **Per-session API spend cap**. Pull `Cf-Access-Authenticated-User-Email`
  in middleware, increment a counter in Upstash Redis (free tier), reject
  when a user exceeds N analyses/day. Cheap insurance against a compromised
  allowlisted account.
- **Audit logging** of every analysis run (user email, audience composition,
  artifact title, timestamp) to an append-only store. Useful when stakeholders
  ask "what was the AI told about me?".
- **Multi-user backend** — Postgres + auth for shared profile/customer/OKR
  data across users. Single biggest unlock for adoption beyond the
  one-user-at-a-time demo posture. See `HANDOFF.md` § "Honest trade-offs".
- **Email-allowlist via Vercel env vars** as a second filter inside the
  middleware (in case Cloudflare policy gets too permissive). Read the
  email from `Cf-Access-Authenticated-User-Email` and check against a
  comma-separated env var.

---

## Quick troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `503 Server misconfigured` on the live domain | `CF_ACCESS_TEAM` or `CF_ACCESS_AUD` not set in Vercel prod env | Set them, redeploy. |
| `403 Forbidden — this application must be accessed via Cloudflare Access` on the custom domain | Cloudflare DNS record isn't proxied (grey cloud), or CF Access app isn't matching the domain | Set DNS to proxied; double-check the Access application domain. |
| Analyses hang for 10s then fail with a vague error | Vercel plan is Hobby, function timing out at 10s | Upgrade to Pro. |
| `429` or `Overloaded` errors during analysis | Anthropic transient overload | The app already retries (see `lib/llm/retry.ts`). Wait a minute. |
| PDF upload fails with `Body exceeded N MB` | Server actions body limit | `next.config.ts` is set to 10mb — if you need more, raise `experimental.serverActions.bodySizeLimit`. |
| Middleware 403s legitimate users | Cloudflare proxy mode off, or CF Access not active for the domain | Re-check Step 4 DNS and Step 5 Access app config. |
