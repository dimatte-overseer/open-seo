# Agent guidance

## Engineering principles

- Prefer simple, readable, flat code with minimal indirection.
- Work on bugs a real user hit or would plausibly hit. Don't open a ticket or PR for an edge case found only by reading the code; flag it instead. Security holes and significant billing abuse are the exception.
- Search for existing implementations and installed libraries before creating new helpers or abstractions.
- Abstract when it prevents meaningful drift and makes the result simpler to maintain. Avoid speculative or one-use abstraction layers.
- Keep product data normalized and relationships explicit. Do not encode relational data in JSON or text merely to avoid joins.
- For new application-backed backend functionality, default to: TanStack server function → service → repository.
- Keep schema changes, queries, and mutations compatible with both SQLite and Postgres.
- Use idiomatic TypeScript. Use Zod to validate untrusted data and narrow runtime values at trust boundaries.
- Prefer established project helpers and libraries over hand-rolled implementations.
- Prefer idiomatic TanStack Query, Router, and Form patterns for server state, routing, and submitted forms.
- shadcn components in `src/client/components/ui/` are built on Base UI, not Radix. Compose them with the `render` prop, not `asChild`.
- Specs under `docs/maintainers/specs/` are public design records: what a feature does, how it works, the alternatives considered and why they lost. No line numbers, migration mechanics, test plans, incidents, costs, or internal infrastructure details.

## Testing

- Don't add tests just for the sake of it. A test exists to enforce core behavior or a hard-to-spot edge case that could actually occur.
- Keep tests as simple as possible, and always review them looking for simplifications.
- Test behavior at the public entry point. Assert argument forwarding to a mocked collaborator only when that mapping is the contract (billing params, telemetry events).
- Statically import the module under test. `vi.mock` is hoisted, so per-test `await import()` and `vi.resetModules()` are banned unless module-level state must reset — comment why.
- Never re-declare a production class in a test. Import the real one; if the module is too heavy to import, move the class to a leaf module first (see `ga4Errors.ts`, `gscErrors.ts`).
- `beforeEach` sets default mock return values only. Vitest's `clearMocks` already resets call state — no `mockReset`/`mockClear` ceremonies.
- Fixtures contain only the fields the test asserts on or the types require. Shared shapes get a factory with overrides (see `ga4-test-fixtures.ts`, `tool-test-support.ts`); a fixture longer than its test's assertions is a smell.
- One test per invariant. Don't re-test Zod or a library, and don't repeat an output-schema round-trip in every happy path.
- Don't mock ORM builder chains. Test repositories through services or real SQL evaluation; chain mocks break on refactors that change no behavior.
- Don't export a function only so a test can reach it. Test through the public entry point (the service object, tool handler, or workflow); Knip fails CI on the orphaned export.
- Vitest's `clearMocks` clears call history only. A `mockResolvedValue` or `mockImplementation` set inside a test survives into the next one, so every persistent default belongs in `beforeEach`.
- A negative test must fail for the reason its name gives. If a different guard rejects first (hosted mode off, missing auth, an earlier validation), the test proves nothing about the behavior it names.

## Plugin versions

- Bump the OpenSEO plugin version when a PR adds a new MCP tool, adds a new shipped skill, or substantially changes a shipped skill's workflow or instructions. Substantial skill changes include changing its required steps, tool choices, or expected output.
- Routine fixes, refactors, and changes to existing tools' implementation, behavior, schemas, or descriptions do not require a bump. Neither do minor skill edits, internal-only skills, tests, website or app changes, or routine plugin configuration edits. Use judgment for other major plugin changes; do not bump merely because a plugin-related file changed.
- The plugin points at the hosted MCP server, so server changes reach users on deploy without a plugin version bump. When a fix applies to both the app and an MCP tool, ship it to both.
- When a bump is warranted, keep `plugins/openseo/.codex-plugin/plugin.json`, `plugins/openseo/.claude-plugin/plugin.json`, and `plugins/openseo/.cursor-plugin/plugin.json` on the same version. Default to a patch bump unless the maintainer requests a minor or major bump.
- Bump once per PR relative to `origin/main`, not once per edit or tool. For a PR that requires a bump, if main advances the plugin version before merge, update the branch to a version newer than main. Otherwise, keep main's version. The app's `package.json` version follows its separate release process.
- Run `pnpm sync-plugin-skills` after changing a shipped skill and include the updated plugin copy, even when no version bump is needed. Call out plugin version and instruction changes for maintainer review.

## Documentation audience

- `docs/` (except `docs/maintainers/`) and `web/content/docs/` are public, user-facing documentation. Write only material that helps users understand, use, or self-host the product.
- Do not put internal working notes, content briefs, drafts, asset-sourcing notes, implementation logs, or agent handoffs in those directories.
- Use `docs/maintainers/` for engineering decisions, development workflows, and maintenance notes that should be shared and versioned. This directory is tracked in Git but is not part of the user-facing documentation site. Create notes only when requested or useful for future maintenance; never include secrets.
- Write PR descriptions in the `simple-issue-description` format, with no validation logs or per-file changelog. Continue using the dedicated papercut log for repository friction.

## Log papercuts

When small, non-blocking repository friction occurs—a retried tool call, confusing setup step, flaky command, stale cache, misleading error, or non-obvious gotcha—use the `papercuts` skill and append it to `.agents/PAPERCUTS.md` in the moment. Continue the current task. Real bugs and tracked work are not papercuts, and sensitive data must never be logged.

Do not mine an entire session for papercuts or start a broad cleanup unless the user explicitly asks.

## Preserve review learnings

Reviewer context lives in `docs/maintainers/review-guidelines.md`: the hard invariants (tenant scoping, dual-dialect persistence, billing seams, SSRF handling) and the false-positive controls that keep reviewers from flagging intentional behavior. After a merge-ready or other code review verifies a finding, add to that file only when the finding exposes a recurring or high-risk repository invariant that existing context and automated checks do not capture. Do not promote one-off bugs or preferences into permanent review rules.

Changes to `AGENTS.md`, `.claude/CLAUDE.md`, `.agents/skills/**`, `.github/**`, and `docs/maintainers/review-guidelines.md` alter the review control plane and must receive explicit maintainer review. CODEOWNERS requests that review; where repository settings allow, enable GitHub's requirement for code-owner approval.

## Dimatte deployment: using OpenSEO from an agent

This fork is deployed once for all of Nicolás Cerón's companies at https://open-seo.nicocerond.workers.dev, behind Cloudflare Access. Operations live in the README's "Dimatte deployment" section.

- **Claude Code:** the `openseo` MCP server is configured at user scope (every project): `https://open-seo.nicocerond.workers.dev/mcp`, with `headersHelper` `~/.claude/mcp-helpers/openseo-headers.sh`, which reads the Access service token from the macOS keychain. Check it with `claude mcp get openseo`.
- **Other clients:** send `CF-Access-Client-Id` and `CF-Access-Client-Secret` from the keychain items `openseo-access-client-id` and `openseo-access-client-secret` on every request to `/mcp` (Streamable HTTP, JSON-RPC). Never print, log or commit them. Without them Access answers 302 (browser login) or 401.
- **Identity:** the service token acts as its own agent user in the shared workspace, so agents see the same projects as people signed in through Access.
- **Workflow:** call `list_projects`, pick the `projectId` of the site, then use the research, rank-tracking, audit and AI-visibility tools with it. `create_project` and the project-context tools use no credits; anything that calls DataForSEO costs money on the owner's DataForSEO balance, so estimate first (`estimate_rank_tracker_cost`, `estimate_ai_visibility_cost`) and ask before large batches. Until `DATAFORSEO_API_KEY` is set (owner action, `scripts/set-dataforseo-key.sh`) data tools fail with a missing-key error.
- **Markets:** every project starts on United States / English (2840/en). Pass `locationCode`/`languageCode` per call, or change the project's market in its dashboard settings once the owner confirms it.

| Site                | Project ID                             |
| ------------------- | -------------------------------------- |
| dardo.studio        | `5031d822-f577-4897-9849-39dc83e9e687` |
| careta.studio       | `57da6bc0-2567-4578-b0a9-58032aa7c0a0` |
| hyper.exposed       | `77bdde73-7a3f-4852-a6bb-d9f849f0c8af` |
| hypers.dev          | `208061a5-f75c-4ea7-9640-87d465cd3c90` |
| malvavisco.app      | `cc234885-1fd3-48d6-b6c9-e59bad2c5e7e` |
| unpangram.com       | `92ac0513-7478-48a6-9880-e15e9942e32e` |
| amediotonomusic.com | `75b408cd-0f70-4a5e-b388-ad92d87db017` |
| gissimusic.com      | `d074c390-973d-4276-9c70-70e9f7b30555` |

Add a site with `create_project` (name and domain = the bare domain), then add it to this table.
