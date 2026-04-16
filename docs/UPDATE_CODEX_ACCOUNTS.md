# Update Codex Accounts On `maximus-dev`

This project includes a helper command to sync local Codex auth files to the remote server and optionally rebuild the app there.

## Command

From repo root:

```bash
./update-codex-accounts
```

What it does:

1. Reads local auth files from `~/.cli-proxy-api` matching:
   - `codex-*.json`
   - `codex-*.json.disabled`
2. Connects to `maximus-dev` over SSH.
3. Replaces remote files in `~/.cli-proxy-api` using `rsync` (`--delete` enabled for these Codex files).

## Update + Rebuild Remote App

Run:

```bash
./update-codex-accounts --deploy
```

This additionally:

1. Finds remote repo directory (`~/dev/proxypal-src` first, then fallback paths).
2. Updates remote `main` to latest `origin/main` (`git pull --ff-only`).
3. Installs dependencies (`pnpm install`).
4. Rebuilds app on remote:

```bash
ANTIGRAVITY_CLIENT_ID=dummy ANTIGRAVITY_CLIENT_SECRET=dummy pnpm tauri build
```

## Useful Options

```bash
./update-codex-accounts --host maximus-dev
./update-codex-accounts --repo-dir ~/dev/proxypal-src --deploy
./update-codex-accounts --dry-run
```

Environment overrides:

- `REMOTE_HOST`
- `LOCAL_AUTH_DIR`
- `REMOTE_AUTH_DIR`
- `REMOTE_REPO_DIR`

## Notes

- Script fails fast if SSH is unreachable.
- Script aborts deploy when remote repo has uncommitted changes.
- File permissions are set to secure mode on transfer (`F600`, `D700`).
