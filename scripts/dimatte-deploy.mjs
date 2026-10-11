// Dimatte deployment: builds OpenSEO and deploys it to the shared Cloudflare
// account (free plan) with plain Wrangler. Run from the repo root:
//
//   pnpm install && node scripts/dimatte-deploy.mjs
//
// Upstream's wrangler.jsonc / wrangler.audit.jsonc stay untouched (so weekly
// upstream syncs merge cleanly): this script rewrites the configs that
// `vite build` generates under dist/ with the resources below, applies the D1
// migrations, deploys the audit worker and then the app worker, and finally
// checks that Cloudflare Access still blocks anonymous requests.
//
// Nothing here is secret. Secrets (DATAFORSEO_API_KEY, ...) are Worker
// secrets set with scripts/set-dataforseo-key.sh; `wrangler deploy` keeps them.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIMATTE = {
  accountId: "290e6974d5ab11e9b3563b1c6f9b4584",
  url: "https://open-seo.nicocerond.workers.dev",
  d1: { name: "open-seo", id: "1a22842f-49df-4df1-8406-b1ca887c6c17" },
  kv: {
    KV: "6e5542bab76a4e198661b830067fc551",
    OAUTH_KV: "c189a585435740409887336cab947a09",
  },
  r2Bucket: "open-seo",
  // The free plan allows 5 cron triggers per account. Upstream's daily
  // "17 3 * * *" trigger only purges hosted-mode OAuth data, a no-op under
  // Cloudflare Access, so only the 5-minute scheduler is kept.
  crons: ["*/5 * * * *"],
  vars: {
    AUTH_MODE: "cloudflare_access",
    // Zero Trust team and the audience tag of the "OpenSEO (Dimatte shared)"
    // Access application that guards every hostname of the app worker.
    TEAM_DOMAIN: "https://floral-rice-2cd8.cloudflareaccess.com",
    POLICY_AUD:
      "5ae39a04847853afe71287f6bfc9e81876a892621826d1d948f53c97244f0641",
    OPENSEO_TELEMETRY_DISABLED: "1",
  },
};

const root = process.cwd();
const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: DIMATTE.accountId };
const run = (command, args) => {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { stdio: "inherit", env });
};
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, value) =>
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

const args = new Set(process.argv.slice(2));
// --hidden deploys with the workers.dev and preview URLs turned off.
const exposeUrls = !args.has("--hidden");

if (!args.has("--skip-build")) {
  run("pnpm", ["run", "build"]);
}

const serverConfigPath = path.join(root, "dist/server/wrangler.json");
const auditConfigPath = path.join(root, "dist/open_seo_audit/wrangler.json");

const withResources = (config) => ({
  ...config,
  d1_databases: config.d1_databases.map((db) => ({
    ...db,
    database_name: DIMATTE.d1.name,
    database_id: DIMATTE.d1.id,
    migrations_dir: path.join(root, "drizzle/sqlite"),
  })),
  kv_namespaces: config.kv_namespaces.map((kv) => {
    const id = DIMATTE.kv[kv.binding];
    if (!id) throw new Error(`No Dimatte KV namespace for ${kv.binding}`);
    return { ...kv, id };
  }),
  r2_buckets: config.r2_buckets.map((bucket) => ({
    ...bucket,
    bucket_name: DIMATTE.r2Bucket,
  })),
});

const server = withResources(readJson(serverConfigPath));
server.vars = { ...server.vars, ...DIMATTE.vars };
server.triggers = { ...server.triggers, crons: DIMATTE.crons };
server.workers_dev = exposeUrls;
server.preview_urls = exposeUrls;
writeJson(serverConfigPath, server);

const audit = withResources(readJson(auditConfigPath));
audit.vars = {
  ...audit.vars,
  AUTH_MODE: DIMATTE.vars.AUTH_MODE,
  OPENSEO_TELEMETRY_DISABLED: DIMATTE.vars.OPENSEO_TELEMETRY_DISABLED,
};
audit.workers_dev = false;
audit.preview_urls = false;
writeJson(auditConfigPath, audit);

// Fail closed: never ship the app worker without Access validation wired in.
for (const name of ["AUTH_MODE", "TEAM_DOMAIN", "POLICY_AUD"]) {
  if (!server.vars[name]) throw new Error(`${name} is not set`);
}

const wrangler = (...wranglerArgs) =>
  run("pnpm", ["exec", "wrangler", ...wranglerArgs]);
wrangler(
  "d1",
  "migrations",
  "apply",
  DIMATTE.d1.name,
  "--remote",
  "-c",
  serverConfigPath,
);
// The app worker binds the audit worker's workflow and entrypoint, so the
// audit worker goes first.
wrangler("deploy", "-c", auditConfigPath);
wrangler("deploy", "-c", serverConfigPath);

if (exposeUrls) {
  // Cloudflare Access must answer before the Worker does: an anonymous
  // request has to be redirected to the Access login (or refused), never
  // served by the app.
  const response = await fetch(`${DIMATTE.url}/api/health`, {
    redirect: "manual",
  });
  const location = response.headers.get("location") ?? "";
  const gated =
    (response.status === 302 && location.includes(".cloudflareaccess.com")) ||
    response.status === 401 ||
    response.status === 403;
  if (!gated) {
    console.error(
      `\nACCESS CHECK FAILED: anonymous GET ${DIMATTE.url}/api/health returned ${response.status}. ` +
        "Turning the workers.dev and preview URLs off again; fix the Access application, then redeploy.",
    );
    writeJson(serverConfigPath, {
      ...server,
      workers_dev: false,
      preview_urls: false,
    });
    wrangler("deploy", "-c", serverConfigPath);
    process.exit(1);
  }
  console.log(
    `\nAccess check passed: anonymous requests get ${response.status}.`,
  );
}
console.log(`\nDeployed ${DIMATTE.url}`);
