import { openUrl } from "@tauri-apps/plugin-opener";

export function PikaAiBanner() {
  const handleVisit = async () => {
    try {
      await openUrl("https://pikaai.xyz/");
    } catch (error) {
      console.error("Failed to open URL:", error);
      window.open("https://pikaai.xyz/", "_blank");
    }
  };

  return (
    <div class="relative overflow-hidden rounded-xl shadow-xl">
      {/* Background - dark professional theme */}
      <div class="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

      {/* Cyan accent line at top - PikaAI brand color */}
      <div class="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-sky-500 to-cyan-400" />

      {/* Content */}
      <div class="relative flex items-center justify-between gap-4 px-4 py-5 sm:px-6">
        {/* Left: Logo and Text */}
        <div class="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          {/* PikaAI Logo */}
          <div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg sm:h-14 sm:w-14">
            <img
              alt="PikaAI"
              class="h-12 w-12 object-contain sm:h-14 sm:w-14"
              src="/logos/pikaai.svg"
            />
          </div>

          {/* Text Content */}
          <div class="min-w-0 flex-1">
            <div class="mb-1 flex items-center gap-2">
              <h3 class="text-sm font-bold text-white sm:text-base">Pika AI</h3>
              <span class="inline-block rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-bold text-white sm:text-xs">
                BEST VALUE
              </span>
            </div>
            <p class="line-clamp-2 text-xs text-slate-300 sm:text-sm">
              All-in-one AI subscription — every model, every provider, one affordable plan.
            </p>
          </div>
        </div>

        {/* Right: Action Button */}
        <div class="flex flex-shrink-0 items-center">
          <button
            class="whitespace-nowrap rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-white transition-all duration-200 hover:bg-cyan-400 hover:shadow-lg hover:shadow-cyan-500/25 sm:px-4 sm:text-sm"
            onClick={handleVisit}
            type="button"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
