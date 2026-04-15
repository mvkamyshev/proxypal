# ProxyPal Codex Rollout Notes

This fork contains local changes for running `Codex` through `ProxyPal`/`CLIProxyAPI` with a multi-account Codex pool.

This document is the only thing you need to reapply the setup on another machine.

## Goal

We patched `ProxyPal` to do the Codex-account operations that upstream did not do well enough:

1. Add a dedicated `Codex Accounts` page in the sidebar.
2. Warm all Codex auth files on a schedule and save a machine-readable report.
3. Let the UI disable individual Codex auth files from rotation.
4. Show the last routed Codex auth without pretending it is a sticky account session.
5. Refresh Codex auth files during quota checks.

That last part is intentionally described as "last routed auth", not "the single current account", because the proxy may rotate across multiple auth files.

## What Changed

### 1. Dedicated Codex Accounts page was added

Patched files:

- [src/pages/CodexAccounts.tsx](/Users/maxkamyshev/dev/proxypal-src/src/pages/CodexAccounts.tsx)
- [src/pages/index.ts](/Users/maxkamyshev/dev/proxypal-src/src/pages/index.ts)
- [src/App.tsx](/Users/maxkamyshev/dev/proxypal-src/src/App.tsx)
- [src/components/Sidebar.tsx](/Users/maxkamyshev/dev/proxypal-src/src/components/Sidebar.tsx)
- [src/stores/app.ts](/Users/maxkamyshev/dev/proxypal-src/src/stores/app.ts)

Behavior:

- `Codex Accounts` is now a first-class sidebar page.
- The app opens on `Codex Accounts` by default.
- The page has `All` and `Free` filters.
- The table columns are:
  - `Account`
  - `Tariff`
  - `Usage Left`
  - `Last Refresh`
  - `Actions`
- `Usage Left` shows remaining quota as:
  - `3h / week left`
  - example: `10% / 7%`
- Color thresholds:
  - `< 10%` remaining -> red
  - `< 30%` remaining -> yellow
  - everything else -> green
- Actions:
  - `Copy username`
  - `Enable Rotation`
  - `Disable Rotation`
- Status badges:
  - `Routed now`
  - `Disabled`
  - `Warmed`
  - `Warm failed`

Important:

- `Usage Left` is derived from `100 - used_percent`.
- The upstream returns percentages, not exact token/message counts.
- This page is for operational account maintenance, not billing truth.

### 2. Codex quota widget was extended

Patched files:

- [src/components/dashboard/quotas/CodexQuotaWidget.tsx](/Users/maxkamyshev/dev/proxypal-src/src/components/dashboard/quotas/CodexQuotaWidget.tsx)
- [src/lib/tauri/quota.ts](/Users/maxkamyshev/dev/proxypal-src/src/lib/tauri/quota.ts)
- [src-tauri/src/commands/quota.rs](/Users/maxkamyshev/dev/proxypal-src/src-tauri/src/commands/quota.rs)
- [src-tauri/src/types/quota.rs](/Users/maxkamyshev/dev/proxypal-src/src-tauri/src/types/quota.rs)

Added fields shown per Codex auth file:

- `Subscription active until`
- `Subscription active since`
- `Subscription checked`
- `Last token refresh`
- `Token expires`
- `Last warmup`
- `Warm status`
- `Warm error`
- `Enable Rotation` / `Disable Rotation`
- `Current Routed Auth`
- `Last routed`

Implementation notes:

- Subscription dates come from `id_token` claims.
- Quota comes from `https://chatgpt.com/backend-api/wham/usage`.
- Rotation toggle uses the management API endpoint `PATCH /v0/management/auth-files/status`.
- The routed-auth banner is derived from proxy logs, not from Codex Desktop state.

Important:

- The dashboard widget no longer owns the account-management table.
- Account maintenance belongs on the dedicated `Codex Accounts` page.

### 3. Quota check refreshes Codex auth files

Patched files:

- [src-tauri/src/commands/quota.rs](/Users/maxkamyshev/dev/proxypal-src/src-tauri/src/commands/quota.rs)
- [src-tauri/src/helpers/warmup.rs](/Users/maxkamyshev/dev/proxypal-src/src-tauri/src/helpers/warmup.rs)
- [src-tauri/src/types/quota.rs](/Users/maxkamyshev/dev/proxypal-src/src-tauri/src/types/quota.rs)
- [src/lib/tauri/quota.ts](/Users/maxkamyshev/dev/proxypal-src/src/lib/tauri/quota.ts)

Behavior:

- Every forced Codex quota refresh attempts to refresh each `codex-*.json` auth file.
- Refreshed fields are written back to disk:
  - `access_token`
  - `refresh_token`
  - `id_token`
  - `last_refresh`
  - `expired`
- The UI can then show fresher:
  - `Last token refresh`
  - `Token expires`

Important limitation:

- Refreshing tokens does not reliably update subscription-date claims.
- On tested accounts, OpenAI returned a new `id_token`, but these claims stayed stale:
  - `chatgpt_subscription_active_until`
  - `chatgpt_subscription_active_start`
  - `chatgpt_subscription_last_checked`

### 4. Codex test model was updated

Patched file:

- [src/pages/AuthFiles.tsx](/Users/maxkamyshev/dev/proxypal-src/src/pages/AuthFiles.tsx)

Behavior:

- Codex auth-file test now uses `gpt-5.4-mini`.
- `gpt-5.1-codex-mini` was removed because the local proxy catalog no longer recognized it.

Verified live model state at the time of this patch:

- working:
  - `gpt-5.3-codex`
  - `gpt-5.3-codex-spark`
  - `gpt-5.4`
  - `gpt-5.4-mini`
- not working:
  - `gpt-5.1-codex-mini`

### 5. Built-in daily Codex warmup was added

Patched files:

- [src-tauri/src/helpers/warmup.rs](/Users/maxkamyshev/dev/proxypal-src/src-tauri/src/helpers/warmup.rs)
- [src-tauri/src/commands/warmup.rs](/Users/maxkamyshev/dev/proxypal-src/src-tauri/src/commands/warmup.rs)
- [src-tauri/src/config.rs](/Users/maxkamyshev/dev/proxypal-src/src-tauri/src/config.rs)
- [src-tauri/src/lib.rs](/Users/maxkamyshev/dev/proxypal-src/src-tauri/src/lib.rs)
- [src/components/settings/AdvancedSettings.tsx](/Users/maxkamyshev/dev/proxypal-src/src/components/settings/AdvancedSettings.tsx)

Behavior:

- scans `~/.cli-proxy-api/codex-*.json`
- refreshes tokens through `https://auth.openai.com/oauth/token`
- warms each account via `https://chatgpt.com/backend-api/codex/responses`
- fetches quota via `https://chatgpt.com/backend-api/wham/usage`
- writes report to:
  - macOS/Linux: `~/.config/proxypal/warmup/codex-warm-report.json` if the platform resolves `config_dir()` there
  - on the current macOS install it ended up in:
    - `~/Library/Application Support/proxypal/warmup/codex-warm-report.json`

Runtime settings added to app config:

- `codexWarmupEnabled`
- `codexWarmupTime`

Default values:

- enabled: `true`
- time: `12:00`

### 6. Proxy routing strategy is surfaced and persisted

Relevant files:

- [src/components/settings/ProxySettings.tsx](/Users/maxkamyshev/dev/proxypal-src/src/components/settings/ProxySettings.tsx)
- [src-tauri/src/config.rs](/Users/maxkamyshev/dev/proxypal-src/src-tauri/src/config.rs)
- [src-tauri/src/commands/config.rs](/Users/maxkamyshev/dev/proxypal-src/src-tauri/src/commands/config.rs)
- [src-tauri/src/commands/proxy.rs](/Users/maxkamyshev/dev/proxypal-src/src-tauri/src/commands/proxy.rs)

What matters:

- `ProxyPal` writes `routing.strategy` into `proxy-config.yaml`
- current UI exposes:
  - `round-robin`
  - `fill-first`
- the generated live config on this machine is:
  - `routing.strategy = "round-robin"`

Important architecture fact:

- `ProxyPal` does not pick the Codex auth itself.
- It writes config for `CLIProxyAPI`.
- `CLIProxyAPI` performs the actual auth selection during routing.

## Files And Runtime Locations

### Source

- repo: [proxypal-src](/Users/maxkamyshev/dev/proxypal-src)
- branch: `codex-warmup-runtime`

### Installed app on this machine

- current app: [ProxyPal.app](/Users/maxkamyshev/Applications/ProxyPal.app)
- previous backups: [Archives/ProxyPal](/Users/maxkamyshev/Archives/ProxyPal)

### Runtime data on this machine

- app config: [config.json](/Users/maxkamyshev/Library/Application%20Support/proxypal/config.json)
- generated proxy config: [proxy-config.yaml](/Users/maxkamyshev/Library/Application%20Support/proxypal/proxy-config.yaml)
- logs: [logs](/Users/maxkamyshev/Library/Application%20Support/proxypal/logs)
- warmup report: [codex-warm-report.json](/Users/maxkamyshev/Library/Application%20Support/proxypal/warmup/codex-warm-report.json)
- auth pool used by proxy: `~/.cli-proxy-api/codex-*.json`

### Current installed bundle workflow

On this machine, macOS packaging often fails at the `.dmg` step while the `.app` bundle is already valid.

The replacement workflow is:

```bash
ANTIGRAVITY_CLIENT_ID=dummy ANTIGRAVITY_CLIENT_SECRET=dummy pnpm tauri build
```

Then copy:

```text
src-tauri/target/release/bundle/macos/ProxyPal.app
```

to:

```text
~/Applications/ProxyPal.app
```

Old local bundles are archived under:

```text
~/Archives/ProxyPal
```

## Codex Config On Client Machines

For Codex to talk to the local proxy, the client machine uses a `~/.codex/config.toml` that points the provider at local `ProxyPal`:

```toml
model_provider = "cliproxyapi"
model = "gpt-5.4"
model_reasoning_effort = "xhigh"

[model_providers.cliproxyapi]
name = "cliproxyapi"
base_url = "http://127.0.0.1:8317/v1"
wire_api = "responses"
```

Optional feature block we enabled locally:

```toml
[features]
apps = true
codex_hooks = true
unified_exec = true
shell_snapshot = true
undo = true
multi_agent = true
personality = true
shell_tool = true
enable_request_compression = true
smart_approvals = true
skill_mcp_dependency_install = true
fast_mode = true
prevent_idle_sleep = true

[apps._default]
enabled = true

[apps.linear]
enabled = true
default_tools_enabled = true
default_tools_approval_mode = "auto"
```

Do not hardcode a single `[projects."..."]` entry unless you want to trust exactly one repo path. That was a mistake during local setup.

## Linux Rollout

### 1. Prerequisites

Install:

- `Node.js`
- `pnpm`
- `Rust`
- Linux desktop deps required by Tauri v2

Typical Ubuntu/Debian packages:

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

Install Rust if missing:

```bash
curl https://sh.rustup.rs -sSf | sh
```

Enable `pnpm`:

```bash
corepack enable
```

### 2. Clone the fork

```bash
git clone https://github.com/mvkamyshev/proxypal.git
cd proxypal
git checkout codex-warmup-runtime
pnpm install
```

### 3. Dev run

`cargo check` in this repo currently hard-fails without Antigravity env vars because upstream used `env!()` in quota code for a different provider. That is unrelated to Codex but it still breaks compilation.

Use:

```bash
ANTIGRAVITY_CLIENT_ID=dummy ANTIGRAVITY_CLIENT_SECRET=dummy pnpm tauri dev
```

Or for a pure compile check:

```bash
ANTIGRAVITY_CLIENT_ID=dummy ANTIGRAVITY_CLIENT_SECRET=dummy cargo check --manifest-path src-tauri/Cargo.toml
```

### 4. Production build

```bash
ANTIGRAVITY_CLIENT_ID=dummy ANTIGRAVITY_CLIENT_SECRET=dummy pnpm tauri build
```

If packaging fails but the binary/app bundle is already produced, inspect:

- `src-tauri/target/release/`
- `src-tauri/target/release/bundle/`

On macOS the `.dmg` step failed while the `.app` bundle itself was already valid. Do not confuse packaging failure with application build failure.

## Auth Pool Migration

The proxy expects auth files here:

- `~/.cli-proxy-api`

Codex auth files are individual files:

- `codex-<account>.json`

Disabled auth files are represented by suffix:

- `codex-<account>.json.disabled`

We also created a local importer from `~/.codex-switcher/accounts.json` into this format during local setup, because direct use of the switcher file is not compatible with `CLIProxyAPI`.

## Known Limitations

### 1. Subscription dates are not live truth

`Subscription active until/since/checked` comes from `id_token` claims.

Observed behavior:

- OAuth refresh returns fresh tokens.
- `Last token refresh` and `Token expires` can update.
- subscription claims may remain stale.

`wham/usage` provides live quota and plan data, but not subscription end date.

Do not represent these fields as a live billing/subscription check.

### 2. Raw ChatGPT session export is intentionally not implemented

The user-facing browser route:

```text
https://chatgpt.com/api/auth/session
```

returns highly sensitive fields:

- `accessToken`
- `sessionToken`

Those values grant account access. The app must not add a one-click raw session-token export button.

Safe future shape:

- browser-backed `Check Web Session`
- show/copy redacted summary only:
  - `user.email`
  - `user.id`
  - `account.id`
  - `account.planType`
  - `account.structure`
  - `expires`
  - `checkedAt`
- keep raw tokens in-memory only if they are needed to call a live endpoint
- never log, persist, or copy raw `accessToken/sessionToken`

### 3. `Current Routed Auth` is only `last routed auth`

It is not a permanent session binding.

If `routing.strategy = "round-robin"`, the proxy can use:

- request 1 -> auth A
- request 2 -> auth B
- request 3 -> auth C

So the honest thing we can show is:

- last routed auth

Not:

- a forever-current Codex account

### 4. Quota and routed auth are different signals

The widget currently puts them close together, but they are not the same thing:

- routed auth comes from proxy logs
- quota snapshot comes from `wham/usage`
- quota view is cached in frontend for 5 minutes

So a just-routed auth does not guarantee visible percentage movement immediately.

### 5. Launchpad duplicates on macOS are cached by Dock

Removing stale app bundles is not always enough. `lsregister` cleanup helps, but `killall Dock` may be blocked by the environment that performs the rollout.

## Verification Commands

### Frontend

```bash
pnpm check:ts
pnpm build
```

### Rust

```bash
ANTIGRAVITY_CLIENT_ID=dummy ANTIGRAVITY_CLIENT_SECRET=dummy cargo check --manifest-path src-tauri/Cargo.toml
```

### Generated runtime config

Check the live proxy YAML after app startup:

```bash
cat ~/Library/Application\\ Support/proxypal/proxy-config.yaml
```

On Linux that path will usually be:

```bash
cat ~/.config/proxypal/proxy-config.yaml
```

### Warmup report

macOS:

```bash
cat ~/Library/Application\\ Support/proxypal/warmup/codex-warm-report.json
```

Linux:

```bash
cat ~/.config/proxypal/warmup/codex-warm-report.json
```

## Minimal Reapply Checklist

1. Clone the fork and checkout `codex-warmup-runtime`.
2. Install Tauri prerequisites for the target OS.
3. Build with dummy Antigravity env vars until that upstream compile-time stupidity is removed.
4. Put Codex auth files into `~/.cli-proxy-api`.
5. Point `Codex` at `http://127.0.0.1:8317/v1`.
6. Start `ProxyPal`.
7. Verify:
   - `routing.strategy`
   - warmup report generation
   - auth files visible in UI
   - `Codex Accounts` is the default page
   - `All/Free` filters work
   - quota remaining colors work
   - Codex requests appear in proxy logs
