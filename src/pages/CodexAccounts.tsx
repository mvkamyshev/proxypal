import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { getCachedOrFetch } from "../lib/quotaCache";
import {
  type CodexQuotaResult,
  fetchCodexQuota,
  toggleAuthFile,
} from "../lib/tauri";
import { type ChatGptWebSession, getChatgptWebSession } from "../lib/tauri/chatgpt-session";
import { toastStore } from "../stores/toast";

type CodexAccountsFilter = "all" | "free";

export function CodexAccountsPage() {
  const [accounts, setAccounts] = createSignal<CodexQuotaResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [filter, setFilter] = createSignal<CodexAccountsFilter>("all");
  const [togglingFile, setTogglingFile] = createSignal<string | null>(null);
  const [sessionLoadingFile, setSessionLoadingFile] = createSignal<string | null>(null);
  const [sessionMetaByFile, setSessionMetaByFile] = createSignal<
    Record<
      string,
      {
        accountId: string;
        authProvider: string;
        email: string;
        expires: string;
        fetchedFlag: string;
        planType: string;
        structure: string;
        userId: string;
      }
    >
  >({});

  const loadAccounts = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const results = await getCachedOrFetch("codex", fetchCodexQuota, forceRefresh);
      setAccounts(results);
    } catch (error) {
      setError(String(error));
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    void loadAccounts();
  });

  const normalizePlan = (planType?: string) => (planType || "unknown").trim().toUpperCase();
  const isFreePlan = (planType?: string) => normalizePlan(planType) === "FREE";
  const getRemainingPercent = (usedPercent?: number) =>
    Math.max(0, 100 - Math.round(usedPercent ?? 0));
  const getRemainingColor = (remainingPercent: number) => {
    if (remainingPercent < 10) {
      return "text-red-600 dark:text-red-400";
    }
    if (remainingPercent < 30) {
      return "text-yellow-600 dark:text-yellow-400";
    }
    return "text-emerald-600 dark:text-emerald-400";
  };

  const sortedAccounts = createMemo(() =>
    [...accounts()].sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }
      if (a.disabled !== b.disabled) {
        return a.disabled ? 1 : -1;
      }
      return a.accountEmail.localeCompare(b.accountEmail);
    }),
  );

  const filteredAccounts = createMemo(() =>
    sortedAccounts().filter((account) => {
      if (filter() === "free") {
        return isFreePlan(account.planType);
      }
      return true;
    }),
  );

  const copyUsername = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toastStore.success("Username copied");
    } catch (error) {
      toastStore.error("Failed to copy username", String(error));
    }
  };

  const handleToggleRotation = async (account: CodexQuotaResult) => {
    setTogglingFile(account.authFileName);
    try {
      await toggleAuthFile(account.authFileName, !account.disabled);
      await loadAccounts(true);
    } catch (error) {
      setError(String(error));
    } finally {
      setTogglingFile(null);
    }
  };

  const handleCopySession = async (account: CodexQuotaResult) => {
    setSessionLoadingFile(account.authFileName);
    try {
      const session = await getChatgptWebSession(account.authFileName);
      await navigator.clipboard.writeText(JSON.stringify(session, null, 2));
      setSessionMetaByFile((prev) => ({
        ...prev,
        [account.authFileName]: extractSessionMeta(session),
      }));
      toastStore.success("Session JSON copied");
    } catch (error) {
      toastStore.error("Failed to copy session", String(error));
    } finally {
      setSessionLoadingFile(null);
    }
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

  const extractSessionMeta = (session: ChatGptWebSession) => ({
    accountId: session.account?.id || "unknown",
    authProvider: session.authProvider || "unknown",
    email: session.user?.email || "unknown",
    expires: session.expires || "unknown",
    fetchedFlag: String(session.rumViewTags?.light_account?.fetched ?? "unknown"),
    planType: session.account?.planType || "unknown",
    structure: session.account?.structure || "unknown",
    userId: session.user?.id || "unknown",
  });

  return (
    <div class="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
      <div class="mx-auto max-w-7xl space-y-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div class="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
              Codex
            </div>
            <h1 class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
              Codex Accounts
            </h1>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Account, tariff, live remaining quota, copy username.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <div class="inline-flex rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
              <button
                class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                classList={{
                  "bg-gray-900 text-white dark:bg-white dark:text-gray-900": filter() === "all",
                  "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700":
                    filter() !== "all",
                }}
                onClick={() => setFilter("all")}
                type="button"
              >
                All
              </button>
              <button
                class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                classList={{
                  "bg-amber-500 text-white": filter() === "free",
                  "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700":
                    filter() !== "free",
                }}
                onClick={() => setFilter("free")}
                type="button"
              >
                Free
              </button>
            </div>
            <button
              class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              disabled={loading()}
              onClick={() => void loadAccounts(true)}
              type="button"
            >
              {loading() ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-3">
          <div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Total
            </div>
            <div class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
              {accounts().length}
            </div>
          </div>
          <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <div class="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Free
            </div>
            <div class="mt-2 text-3xl font-semibold text-amber-900 dark:text-amber-200">
              {accounts().filter((account) => isFreePlan(account.planType)).length}
            </div>
          </div>
          <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
            <div class="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Routed Now
            </div>
            <div class="mt-2 truncate text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              {sortedAccounts().find((account) => account.isActive)?.accountEmail || "No routed auth yet"}
            </div>
          </div>
        </div>

        <Show when={error()}>
          <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error()}
          </div>
        </Show>

        <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-900/50">
                <tr class="text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th class="px-4 py-3 font-medium">Account</th>
                  <th class="px-4 py-3 font-medium">Tariff</th>
                  <th class="px-4 py-3 font-medium">Usage Left</th>
                  <th class="px-4 py-3 font-medium">Last Refresh</th>
                  <th class="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                <Show when={!loading() && filteredAccounts().length === 0}>
                  <tr>
                    <td class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400" colSpan={5}>
                      No accounts for this filter.
                    </td>
                  </tr>
                </Show>
                <For each={filteredAccounts()}>
                  {(account) => (
                    <tr class="align-top">
                      <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <div class="font-medium">{account.accountEmail}</div>
                        <div class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                          {account.authFileName}
                        </div>
                      </td>
                      <td class="px-4 py-3">
                        <span
                          class="rounded px-2 py-1 text-[10px] font-medium uppercase"
                          classList={{
                            "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300":
                              isFreePlan(account.planType),
                            "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300":
                              !isFreePlan(account.planType),
                          }}
                        >
                          {normalizePlan(account.planType)}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-[11px] text-gray-600 dark:text-gray-300">
                        <div
                          class={`text-sm font-semibold ${getRemainingColor(getRemainingPercent(account.primaryUsedPercent))}`}
                        >
                          {getRemainingPercent(account.primaryUsedPercent)}% /{" "}
                          <span
                            class={getRemainingColor(
                              getRemainingPercent(account.secondaryUsedPercent),
                            )}
                          >
                            {getRemainingPercent(account.secondaryUsedPercent)}%
                          </span>
                        </div>
                        <div class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                          3h / week left
                        </div>
                        <div class="mt-2 flex flex-wrap gap-1">
                          <Show when={account.isActive}>
                            <span class="rounded bg-emerald-100 px-1.5 py-0.5 font-medium uppercase text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              Routed now
                            </span>
                          </Show>
                          <Show when={account.disabled}>
                            <span class="rounded bg-gray-200 px-1.5 py-0.5 font-medium uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                              Disabled
                            </span>
                          </Show>
                          <Show when={account.warmStatus === "warmed"}>
                            <span class="rounded bg-purple-100 px-1.5 py-0.5 font-medium uppercase text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              Warmed
                            </span>
                          </Show>
                          <Show when={account.warmStatus === "failed"}>
                            <span class="rounded bg-red-100 px-1.5 py-0.5 font-medium uppercase text-red-700 dark:bg-red-900/30 dark:text-red-300">
                              Warm failed
                            </span>
                          </Show>
                        </div>
                        <Show when={account.lastRoutedAt}>
                          <div class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            Last routed: {formatDateTime(account.lastRoutedAt)}
                          </div>
                        </Show>
                      </td>
                      <td class="px-4 py-3 text-[11px] text-gray-600 dark:text-gray-300">
                        {formatDateTime(account.lastRefresh)}
                      </td>
                      <td class="px-4 py-3">
                        <div class="flex flex-wrap gap-2">
                          <button
                            class="rounded border border-gray-300 px-2 py-1 text-[10px] font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                            onClick={() => void copyUsername(account.accountEmail)}
                            type="button"
                          >
                            Copy username
                          </button>
                          <button
                            class="rounded border border-gray-300 px-2 py-1 text-[10px] font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                            disabled={sessionLoadingFile() === account.authFileName}
                            onClick={() => void handleCopySession(account)}
                            type="button"
                          >
                            {sessionLoadingFile() === account.authFileName
                              ? "Loading..."
                              : "Copy Session JSON"}
                          </button>
                          <button
                            class="rounded border border-gray-300 px-2 py-1 text-[10px] font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                            disabled={togglingFile() === account.authFileName}
                            onClick={() => void handleToggleRotation(account)}
                            type="button"
                          >
                            {togglingFile() === account.authFileName
                              ? "Working..."
                              : account.disabled
                                ? "Enable Rotation"
                                : "Disable Rotation"}
                          </button>
                        </div>
                        <Show when={sessionMetaByFile()[account.authFileName]}>
                          {(meta) => (
                            <div class="mt-2 space-y-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                              <div>Email: {meta().email}</div>
                              <div>User ID: {meta().userId}</div>
                              <div>Account ID: {meta().accountId}</div>
                              <div>
                                Plan/Structure: {meta().planType} / {meta().structure}
                              </div>
                              <div>Expires: {formatDateTime(meta().expires)}</div>
                              <div>
                                Provider/Light fetched: {meta().authProvider} / {meta().fetchedFlag}
                              </div>
                            </div>
                          )}
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
