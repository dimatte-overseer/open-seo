# OpenSEO

> Open source alternative to Semrush and Ahrefs

OpenSEO is an SEO tool for _the people_. If tools like Semrush or Ahrefs are too expensive or bloated, OpenSEO is a pay-as-you-go alternative that you actually control.

> All-in-one SEO tool for you and your AI agent.

Connect with any agent like Claude Code, OpenClaw or Hermes. We have pre-built skills, but you can build your own to tailor OpenSEO to your needs.

<img width="100%" alt="openseo-keyword-research" src="https://github.com/user-attachments/assets/8ebdc439-3e72-41ab-8bde-8cda771ef2e8" />

## Hosted Version

Try OpenSEO for free on our website. If you want to support the project, a hosted subscription is $10/month.

[openseo.so](https://openseo.so)

## Why use OpenSEO?

- Best in class MCP and AI Skills.
- Modern, simple UI.
  - Focused workflows instead of a bloated, complex SEO suite.
- No subscriptions.
  - Bring your own DataForSEO API key and pay only for what you use.
- Fork and vibe code your own custom tool.

## Main SEO Workflows

- Keyword research
- Rank tracking
- Competitor Insights
- Backlinks
- Site Audits
- AI Visibility

## OpenSEO MCP & Agent Skills

OpenSEO exposes an MCP server so AI agents like Claude Code, OpenClaw, and Hermes can use your SEO data directly. Agent Skills are reusable workflows that guide your agent through SEO tasks using the MCP.

- [Set up ChatGPT web or desktop](https://openseo.so/docs/chatgpt) (works on Free and paid ChatGPT plans)
- [Set up Codex](https://openseo.so/docs/codex-plugin)
- [Set up OpenSEO MCP](https://openseo.so/docs/mcp)
- [Set up OpenSEO Agent Skills](https://openseo.so/docs/skills/setup)

## Self-Hosting

OpenSEO supports two self-hosting paths:

- **Simple: Docker (Best for testing it out)** - For personal use on your own machine. See [`docs/SELF_HOSTING_DOCKER.md`](./docs/SELF_HOSTING_DOCKER.md).
  - Unless you already are self-hosting other apps and are confident doing so, we recommend self-hosting with Cloudflare as opposed to Railway, Coolify or Dokploy.
  - We plan to make it simpler to host on those platforms in the next few months.
- **Recommended: Cloudflare** - For internet-facing self-hosting across multiple devices or with your team (works on the free plan). See [`docs/SELF_HOSTING_CLOUDFLARE.md`](./docs/SELF_HOSTING_CLOUDFLARE.md).

Either way, you need a DataForSEO API key to get SEO data. See [`docs/DATAFORSEO_API_KEY.md`](./docs/DATAFORSEO_API_KEY.md).

## Costs

OpenSEO needs a [DataForSEO](https://dataforseo.com/?aff=255379) API key so that you can get SEO data. You pay them directly when self hosting.

See [openseo.so/pricing](https://openseo.so/pricing)

When you self host, your costs will be slightly lower than the estimates on our website. The way the hosted service makes money is by charging 28% extra for every request we make to DataForSEO.

## Local Development

See [`docs/LOCAL_DEVELOPMENT.md`](./docs/LOCAL_DEVELOPMENT.md).

## Contributing

Creating clear issues is the best way to contribute.

Read more here: [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md)

We have this skill: `/simple-issue-description` which helps.

```sh
npx skills add every-app/open-seo --skill simple-issue-description
```

## Community

Join Discord to chat: [Discord](https://discord.gg/c9uGs3cFXr)

Follow along for updates:

- Follow on X: https://x.com/bensenescu
- Sign up for the mailing list on our website: [openseo.so](https://openseo.so)

## Dimatte deployment

This fork (`dimatte/open-seo`) runs one OpenSEO shared by all of Nicolás Cerón's companies, on the Cloudflare free plan (account `290e6974d5ab11e9b3563b1c6f9b4584`). Agents: see the Dimatte section at the end of [`AGENTS.md`](./AGENTS.md).

- **App:** https://open-seo.nicocerond.workers.dev (MCP: `/mcp`). No company domain on purpose.
- **Cloudflare:** Workers `open-seo` (app, `*/5` cron, Smart Placement) and `open-seo-audit` (site audits, no public URL); D1 `open-seo` (ENAM); KV `open-seo-kv` and `open-seo-oauth-kv`; R2 `open-seo` (DataForSEO cache, `dataforseo-cache/` expires after 7 days); Workflows `rank-check-workflow`, `ai-visibility-workflow`, `site-audit-workflow`; Durable Objects `SamChatAgent`, `AuditScratchpad`. Workers Logs and traces are on (`observability` in `wrangler.jsonc`). Anonymous telemetry to upstream is off.
- **Access:** Zero Trust team `floral-rice-2cd8.cloudflareaccess.com`, application **OpenSEO (Dimatte shared)** covering the Worker itself plus `open-seo.nicocerond.workers.dev` and `*-open-seo.nicocerond.workers.dev` (preview and version URLs). Policies: service token `openseo-agents-mcp` (Service Auth, for agents) and email one-time PIN for nicocerond@gmail.com, nicolasceron.d@gmail.com and nico@dardo.studio (24 h sessions). Edit who gets in under Zero Trust > Access controls > Applications. The app trusts whoever Access admits (`AUTH_MODE=cloudflare_access`, `TEAM_DOMAIN` and `POLICY_AUD` are Worker vars set by the deploy script).
- **Service token:** client id and secret live only in the macOS keychain (`openseo-access-client-id`, `openseo-access-client-secret`); Claude Code reads them through `~/.claude/mcp-helpers/openseo-headers.sh`. It expires on 2027-10-11: rotate it in Zero Trust > Access controls > Service credentials, update the two keychain items, done.
- **Secrets:** `DATAFORSEO_API_KEY` (base64 of `login:api_password`) on both Workers, set with `scripts/set-dataforseo-key.sh` (prompts, never echoes). Until it is set the UI, projects and MCP work but every SEO data feature reports the key as missing. Optional: `OPENROUTER_API_KEY` (SAM agent, research helpers) and `CONTEXT_API_KEY` (JS rendering fallback), set with `pnpm exec wrangler secret put <NAME> --name open-seo`.
- **Deploy:** `pnpm install && node scripts/dimatte-deploy.mjs` from an up-to-date `main`. It builds, points the generated Wrangler configs at the resources above, applies D1 migrations, deploys both Workers and then fails (and hides the URL again) if an anonymous request is not stopped by Access. `--hidden` deploys with the workers.dev and preview URLs off. Do not use `pnpm run deploy` or `pnpm deploy:selfhost`: they target upstream's resource ids or Alchemy.
- **Updating from upstream:** `.github/workflows/upstream-sync.yml` opens a PR from `every-app:main` every Monday when upstream is ahead (never auto-merges). It needs the organization setting Settings > Actions > General > "Allow GitHub Actions to create and approve pull requests"; while that is off the run fails with a one-click link to open the PR by hand. Review it (watch `wrangler*.jsonc`, `drizzle/sqlite/` and `src/middleware/ensure-user/cloudflareAccess.ts`), merge with a merge commit, then deploy. By hand: `git fetch upstream && git merge upstream/main`.
- **Fork changes:** service-token requests get their own agent user in the shared workspace (`src/middleware/ensure-user/cloudflareAccess.ts`), the deploy and key scripts, the sync workflow, and these notes. Upstream's `docker-image`, `pr-preview`, `sourcemaps`, `deploy-production` and `deploy-website` workflows are disabled in this fork.
- **Free-plan limits:** 10 ms CPU per request, 100k requests a day, 5 cron triggers per account (this one uses the fifth), no Browser Run for "Render JavaScript" audits.
