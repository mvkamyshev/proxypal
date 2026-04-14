import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { useI18n } from "../../../i18n";
import { getCachedOrFetch } from "../../../lib/quotaCache";
import {
  type CodexQuotaResult,
  fetchCodexQuota,
  onCodexActiveAuthChanged,
  onCodexWarmupFinished,
  onRequestLog,
  toggleAuthFile,
} from "../../../lib/tauri";

interface CodexQuotaWidgetProps {
  authStatus: { openai: number };
}

// Codex Quota Widget - shows rate limits and credits for OpenAI/Codex accounts
export function CodexQuotaWidget(props: CodexQuotaWidgetProps) {
  const { t } = useI18n();
  const [quotaData, setQuotaData] = createSignal<CodexQuotaResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [expanded, setExpanded] = createSignal(false);
  const [togglingFile, setTogglingFile] = createSignal<string | null>(null);

  const loadQuota = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const results = await getCachedOrFetch("codex", fetchCodexQuota, forceRefresh);
      setQuotaData(results);
    } catch (error) {
      setError(String(error));
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    if (props.authStatus.openai > 0) {
      loadQuota();
    }

    void onCodexActiveAuthChanged(() => {
      void loadQuota(true);
    }).then((unlisten) => onCleanup(unlisten));

    void onCodexWarmupFinished(() => {
      void loadQuota(true);
    }).then((unlisten) => onCleanup(unlisten));

    void onRequestLog(() => {
      if (expanded()) {
        void loadQuota(true);
      }
    }).then((unlisten) => onCleanup(unlisten));
  });

  const formatResetTime = (timestamp?: number) => {
    if (!timestamp) {
      return t("dashboard.quota.unknown");
    }
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff <= 0) {
      return t("dashboard.quota.now");
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDateTime = (value?: string) => {
    if (!value) {
      return "Unknown";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  };

  const handleToggleRotation = async (account: CodexQuotaResult) => {
    setTogglingFile(account.authFileName);
    try {
      await toggleAuthFile(account.authFileName, !account.disabled);
      await loadQuota(true);
    } catch (error) {
      setError(String(error));
    } finally {
      setTogglingFile(null);
    }
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) {
      return "text-red-600 dark:text-red-400";
    }
    if (percent >= 70) {
      return "text-yellow-600 dark:text-yellow-400";
    }
    return "text-green-600 dark:text-green-400";
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 90) {
      return "bg-red-500";
    }
    if (percent >= 70) {
      return "bg-yellow-500";
    }
    return "bg-green-500";
  };

  const sortedQuotaData = createMemo(() =>
    [...quotaData()].sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }
      if (a.disabled !== b.disabled) {
        return a.disabled ? 1 : -1;
      }
      return a.accountEmail.localeCompare(b.accountEmail);
    }),
  );
  const activeAccount = createMemo(() => sortedQuotaData().find((account) => account.isActive));

  if (props.authStatus.openai === 0) {
    return null;
  }

  return (
    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div
        class="flex w-full cursor-pointer items-center justify-between border-b border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
        onClick={() => setExpanded(!expanded())}
      >
        <div class="flex items-center gap-2">
          <img alt="OpenAI" class="h-5 w-5 rounded" src="/logos/openai.svg" />
          <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t("dashboard.quota.codexTitle")}
          </span>
          <Show when={quotaData().length > 0}>
            <span class="text-xs text-gray-500 dark:text-gray-400">
              ({quotaData().length} account{quotaData().length !== 1 ? "s" : ""})
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 dark:hover:text-gray-300"
            disabled={loading()}
            onClick={(e) => {
              e.stopPropagation();
              loadQuota(true);
            }}
            title={t("dashboard.quota.refresh")}
          >
            <svg
              class={`h-4 w-4 ${loading() ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              />
            </svg>
          </button>
          <svg
            class={`h-4 w-4 text-gray-400 transition-transform ${expanded() ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M19 9l-7 7-7-7"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
        </div>
      </div>

      <Show when={expanded()}>
        <div class="space-y-4 p-4">
          <Show when={loading() && quotaData().length === 0}>
            <div class="flex items-center justify-center py-4 text-gray-500">
              <svg class="mr-2 h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  fill="currentColor"
                />
              </svg>
              {t("dashboard.quota.loadingUsage")}
            </div>
          </Show>

          <Show when={error()}>
            <div class="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p class="text-sm text-red-700 dark:text-red-300">{error()}</p>
            </div>
          </Show>

          <Show when={activeAccount()}>
            {(account) => (
              <div class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
                <div class="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Current Active Account
                </div>
                <div class="mt-1 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  {account().accountEmail}
                </div>
                <div class="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                  {account().authFileName}
                </div>
              </div>
            )}
          </Show>

          <Show when={quotaData().length > 0 && !sortedQuotaData().some((account) => account.isActive)}>
            <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              Active account will appear after the next real Codex request goes through rotation.
            </div>
          </Show>

          <For each={sortedQuotaData()}>
            {(account) => (
              <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                <div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-700/50">
                  <div class="flex items-center gap-2">
                    <h4 class="truncate text-sm font-medium text-gray-700 dark:text-gray-300">
                      {account.accountEmail}
                    </h4>
                    <span class="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {account.planType}
                    </span>
                    <Show when={account.isActive}>
                      <span class="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        Active
                      </span>
                    </Show>
                    <Show when={account.disabled}>
                      <span class="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                        Disabled
                      </span>
                    </Show>
                    <Show when={account.warmStatus === "warmed"}>
                      <span class="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        Warmed
                      </span>
                    </Show>
                    <Show when={account.warmStatus === "failed"}>
                      <span class="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        Warm Failed
                      </span>
                    </Show>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      class="rounded border border-gray-300 px-2 py-1 text-[10px] font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                      disabled={togglingFile() === account.authFileName}
                      onClick={() => handleToggleRotation(account)}
                    >
                      {togglingFile() === account.authFileName
                        ? "Working..."
                        : account.disabled
                          ? "Enable Rotation"
                          : "Disable Rotation"}
                    </button>
                    <Show when={account.error}>
                      <span class="text-[10px] font-medium text-red-500">
                        {t("dashboard.quota.apiError")}
                      </span>
                    </Show>
                  </div>
                </div>
                <div class="space-y-3 bg-white p-3 dark:bg-gray-800">
                  <div class="grid gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                    <div>Auth file: {account.authFileName}</div>
                    <Show when={account.subscriptionActiveUntil}>
                      <div>Subscription active until: {formatDateTime(account.subscriptionActiveUntil)}</div>
                    </Show>
                    <Show when={account.subscriptionActiveStart}>
                      <div>Subscription active since: {formatDateTime(account.subscriptionActiveStart)}</div>
                    </Show>
                    <Show when={account.subscriptionLastChecked}>
                      <div>Subscription checked: {formatDateTime(account.subscriptionLastChecked)}</div>
                    </Show>
                    <Show when={account.lastWarmupAt}>
                      <div>Last warmup: {formatDateTime(account.lastWarmupAt)}</div>
                    </Show>
                    <Show when={account.lastRefresh}>
                      <div>Last token refresh: {formatDateTime(account.lastRefresh)}</div>
                    </Show>
                    <Show when={account.accessTokenExpiresAt}>
                      <div>Token expires: {formatDateTime(account.accessTokenExpiresAt)}</div>
                    </Show>
                  </div>

                  {/* Primary Rate Limit (3-hour window) */}
                  <div>
                    <div class="mb-1 flex items-center justify-between">
                      <span class="text-xs text-gray-500">
                        {t("dashboard.quota.primaryLimit3h")}
                      </span>
                      <span
                        class={`text-xs font-medium ${getUsageColor(account.primaryUsedPercent)}`}
                      >
                        {t("dashboard.quota.percentUsed", {
                          count: account.primaryUsedPercent.toFixed(0),
                        })}
                      </span>
                    </div>
                    <div class="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        class={`h-full ${getProgressColor(account.primaryUsedPercent)} transition-all`}
                        style={{
                          width: `${Math.min(account.primaryUsedPercent, 100)}%`,
                        }}
                      />
                    </div>
                    <p class="mt-0.5 text-[10px] text-gray-400">
                      {t("dashboard.quota.resetsIn", {
                        time: formatResetTime(account.primaryResetAt),
                      })}
                    </p>
                  </div>

                  {/* Secondary Rate Limit (weekly window) */}
                  <div>
                    <div class="mb-1 flex items-center justify-between">
                      <span class="text-xs text-gray-500">{t("dashboard.quota.weeklyLimit")}</span>
                      <span
                        class={`text-xs font-medium ${getUsageColor(account.secondaryUsedPercent)}`}
                      >
                        {t("dashboard.quota.percentUsed", {
                          count: account.secondaryUsedPercent.toFixed(0),
                        })}
                      </span>
                    </div>
                    <div class="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        class={`h-full ${getProgressColor(account.secondaryUsedPercent)} transition-all`}
                        style={{
                          width: `${Math.min(account.secondaryUsedPercent, 100)}%`,
                        }}
                      />
                    </div>
                    <p class="mt-0.5 text-[10px] text-gray-400">
                      {t("dashboard.quota.resetsIn", {
                        time: formatResetTime(account.secondaryResetAt),
                      })}
                    </p>
                  </div>

                  {/* Credits (for Pro plans) */}
                  <Show when={account.hasCredits}>
                    <div class="border-t border-gray-100 pt-2 dark:border-gray-700">
                      <div class="flex items-center justify-between">
                        <span class="text-xs text-gray-500">
                          {t("dashboard.quota.creditsBalance")}
                        </span>
                        <span class="text-sm font-bold text-green-600 dark:text-green-400">
                          {account.creditsUnlimited
                            ? t("dashboard.quota.unlimited")
                            : account.creditsBalance !== undefined
                              ? `$${account.creditsBalance.toFixed(2)}`
                              : t("dashboard.quota.notAvailable")}
                        </span>
                      </div>
                    </div>
                  </Show>

                  <Show when={account.error}>
                    <p class="rounded bg-red-50 p-1.5 text-[10px] text-red-500 dark:bg-red-900/20">
                      {account.error}
                    </p>
                  </Show>
                  <Show when={account.warmError}>
                    <p class="rounded bg-amber-50 p-1.5 text-[10px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                      Warmup: {account.warmError}
                    </p>
                  </Show>
                </div>
              </div>
            )}
          </For>

          <Show when={!loading() && quotaData().length === 0 && !error()}>
            <p class="py-2 text-center text-sm text-gray-500">
              {t("dashboard.quota.noCodexAccounts")}
            </p>
          </Show>
        </div>
      </Show>
    </div>
  );
}
