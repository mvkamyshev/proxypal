#!/usr/bin/env node
// Cross-platform sidecar binary downloader for CLIProxyAPI
// Works on macOS, Linux, and Windows (Node 18+)

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  copyFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BINARIES_DIR = join(__dirname, "..", "src-tauri", "binaries");
const REPO =
  process.env.CLIPROXYAPI_REPO || "router-for-me/CLIProxyAPIPlus";

function getCurrentTarget() {
  const { platform, arch } = process;
  const targets = {
    "darwin-arm64": "cli-proxy-api-aarch64-apple-darwin",
    "darwin-x64": "cli-proxy-api-x86_64-apple-darwin",
    "linux-x64": "cli-proxy-api-x86_64-unknown-linux-gnu",
    "linux-arm64": "cli-proxy-api-aarch64-unknown-linux-gnu",
    "win32-x64": "cli-proxy-api-x86_64-pc-windows-msvc.exe",
    "win32-arm64": "cli-proxy-api-aarch64-pc-windows-msvc.exe",
  };
  const target = targets[`${platform}-${arch}`];
  if (!target) throw new Error(`Unsupported platform: ${platform}-${arch}`);
  return target;
}

function getAssetInfo(target, version) {
  const map = {
    "cli-proxy-api-aarch64-apple-darwin": [
      `CLIProxyAPIPlus_${version}_darwin_arm64.tar.gz`,
      "tar",
    ],
    "cli-proxy-api-x86_64-apple-darwin": [
      `CLIProxyAPIPlus_${version}_darwin_amd64.tar.gz`,
      "tar",
    ],
    "cli-proxy-api-x86_64-unknown-linux-gnu": [
      `CLIProxyAPIPlus_${version}_linux_amd64.tar.gz`,
      "tar",
    ],
    "cli-proxy-api-aarch64-unknown-linux-gnu": [
      `CLIProxyAPIPlus_${version}_linux_arm64.tar.gz`,
      "tar",
    ],
    "cli-proxy-api-x86_64-pc-windows-msvc.exe": [
      `CLIProxyAPIPlus_${version}_windows_amd64.zip`,
      "zip",
    ],
    "cli-proxy-api-aarch64-pc-windows-msvc.exe": [
      `CLIProxyAPIPlus_${version}_windows_arm64.zip`,
      "zip",
    ],
  };
  return map[target] || null;
}

function findBinary(dir) {
  const names = [
    "cli-proxy-api-plus",
    "CLIProxyAPIPlus",
    "CLIProxyAPI",
    "cli-proxy-api",
  ];
  if (process.platform === "win32") {
    names.push(...names.map((n) => n + ".exe"));
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findBinary(fullPath);
      if (found) return found;
    }
    if (names.some((n) => entry.name === n || entry.name.startsWith(n))) {
      return fullPath;
    }
  }
  return null;
}

async function downloadTarget(target, version) {
  const assetInfo = getAssetInfo(target, version);
  if (!assetInfo) throw new Error(`Unknown target: ${target}`);

  const [assetName, archiveType] = assetInfo;
  const url = `https://github.com/${REPO}/releases/download/v${version}/${assetName}`;

  console.log(`Downloading ${assetName}...`);

  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const tempDir = join(BINARIES_DIR, ".tmp-download");
  mkdirSync(tempDir, { recursive: true });

  const archivePath = join(tempDir, assetName);
  writeFileSync(archivePath, buffer);

  try {
    // Extract archive
    if (archiveType === "zip") {
      if (process.platform === "win32") {
        execSync(
          `powershell -Command "Expand-Archive -Force '${archivePath}' '${tempDir}'"`,
          { stdio: "inherit" },
        );
      } else {
        execSync(`unzip -o -q "${archivePath}" -d "${tempDir}"`, {
          stdio: "inherit",
        });
      }
    } else {
      execSync(`tar -xzf "${archivePath}" -C "${tempDir}"`, {
        stdio: "inherit",
      });
    }

    // Find and copy binary
    const binaryPath = findBinary(tempDir);
    if (!binaryPath) throw new Error("Binary not found in archive");

    const destPath = join(BINARIES_DIR, target);
    copyFileSync(binaryPath, destPath);
    if (process.platform !== "win32") {
      chmodSync(destPath, 0o755);
    }

    console.log(`Installed: ${destPath}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  // Fetch latest version
  const apiRes = await fetch(
    `https://api.github.com/repos/${REPO}/releases/latest`,
  );
  if (!apiRes.ok)
    throw new Error(`GitHub API error (${apiRes.status}): ${apiRes.statusText}`);
  const release = await apiRes.json();
  const version = release.tag_name.replace(/^v/, "");
  console.log(`CLIProxyAPI version: ${version}`);

  mkdirSync(BINARIES_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const requestedTarget = args.find((a) => !a.startsWith("--"));
  if (requestedTarget) {
    // Download specific target
    await downloadTarget(requestedTarget, version);
  } else {
    // Download for current platform only
    const target = getCurrentTarget();
    const destPath = join(BINARIES_DIR, target);
    if (existsSync(destPath) && !force) {
      console.log(`Binary exists: ${destPath} (use --force to re-download)`);
      return;
    }
    await downloadTarget(target, version);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
