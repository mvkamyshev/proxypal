import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// Antigravity Quota
export interface ModelQuota {
  displayName: string;
  model: string;
  remainingPercent: number;
  resetTime?: string;
}

export interface AntigravityQuotaResult {
  accountEmail: string;
  error?: string;
  fetchedAt: string;
  quotas: ModelQuota[];
}

export interface CodexQuotaResult {
  accessTokenExpiresAt?: string;
  authFileName: string;
  accountEmail: string;
  creditsBalance?: number;
  creditsUnlimited: boolean;
  disabled: boolean;
  error?: string;
  fetchedAt: string;
  hasCredits: boolean;
  isActive: boolean;
  lastRefresh?: string;
  lastWarmupAt?: string;
  planType: string;
  primaryResetAt?: number;
  primaryUsedPercent: number;
  secondaryResetAt?: number;
  secondaryUsedPercent: number;
  subscriptionActiveStart?: string;
  subscriptionActiveUntil?: string;
  subscriptionLastChecked?: string;
  warmError?: string;
  warmStatus?: string;
}

export interface CodexWarmupReportEntry {
  email?: string;
  error?: string;
  file: string;
  planType?: string;
  primaryResetAt?: number;
  primaryUsedPercent?: number;
  quotaFetched: boolean;
  refreshed: boolean;
  secondaryResetAt?: number;
  secondaryUsedPercent?: number;
  warmed: boolean;
}

export interface CodexWarmupReport {
  authDir: string;
  failed: number;
  generatedAt: string;
  quotaFetched: number;
  refreshed: number;
  results: CodexWarmupReportEntry[];
  total: number;
  warmed: number;
}

export interface CopilotQuotaResult {
  accountLogin: string;
  chatPercent: number;
  error?: string;
  fetchedAt: string;
  plan: string;
  premiumInteractionsPercent: number;
}

export interface ClaudeQuotaResult {
  accountEmail: string;
  error?: string;
  extraUsageLimit?: number;
  extraUsageSpend?: number;
  fetchedAt: string;
  fiveHourPercent: number;
  fiveHourResetAt?: number;
  plan: string;
  sevenDayPercent: number;
  sevenDayResetAt?: number;
}

export interface KiroQuotaResult {
  accountEmail: string;
  bonusCreditsExpiresDays?: number;
  bonusCreditsTotal: number;
  bonusCreditsUsed: number;
  error?: string;
  fetchedAt: string;
  plan: string;
  resetsOn?: string;
  totalCredits: number;
  usedCredits: number;
  usedPercent: number;
}

export async function fetchAntigravityQuota(): Promise<AntigravityQuotaResult[]> {
  return invoke("fetch_antigravity_quota");
}

export async function fetchCodexQuota(): Promise<CodexQuotaResult[]> {
  return invoke("fetch_codex_quota");
}

export async function getCodexWarmupReport(): Promise<CodexWarmupReport> {
  return invoke("get_codex_warmup_report");
}

export async function runCodexWarmup(): Promise<CodexWarmupReport> {
  return invoke("run_codex_warmup");
}

export async function onCodexWarmupFinished(
  callback: (report: CodexWarmupReport) => void,
): Promise<UnlistenFn> {
  return listen<CodexWarmupReport>("codex-warmup-finished", (event) => {
    callback(event.payload);
  });
}

export async function onCodexActiveAuthChanged(
  callback: (authFileName: string) => void,
): Promise<UnlistenFn> {
  return listen<string>("codex-active-auth-changed", (event) => {
    callback(event.payload);
  });
}

export async function fetchCopilotQuota(): Promise<CopilotQuotaResult[]> {
  return invoke("fetch_copilot_quota");
}

export async function fetchClaudeQuota(): Promise<ClaudeQuotaResult[]> {
  return invoke("fetch_claude_quota");
}

export async function fetchKiroQuota(): Promise<KiroQuotaResult[]> {
  return invoke("fetch_kiro_quota");
}
