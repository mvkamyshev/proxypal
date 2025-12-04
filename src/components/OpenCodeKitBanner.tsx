import { createSignal } from "solid-js";

interface OpenCodeKitBannerProps {
  onDismiss?: () => void;
}

export function OpenCodeKitBanner(props: OpenCodeKitBannerProps) {
  const [dismissed, setDismissed] = createSignal(false);

  const handleDismiss = () => {
    setDismissed(true);
    props.onDismiss?.();
  };

  const handleVisit = () => {
    window.open("https://opencodekit.xyz/", "_blank");
  };

  if (dismissed()) return null;

  return (
    <div class="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 dark:from-brand-600 dark:to-brand-700 overflow-hidden shadow-lg">
      <div class="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <div class="flex-shrink-0">
            <svg
              class="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div class="min-w-0">
            <h3 class="text-sm sm:text-base font-bold text-white truncate">
              Discover OpenCodeKit
            </h3>
            <p class="text-xs sm:text-sm text-white/90 mt-0.5 line-clamp-2">
              Your all-in-one platform for AI-powered code assistance. Explore
              unlimited possibilities.
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleVisit}
            class="px-3 sm:px-4 py-2 bg-white text-brand-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors text-xs sm:text-sm whitespace-nowrap"
          >
            Visit Website
          </button>
          <button
            onClick={handleDismiss}
            class="p-1.5 text-white hover:bg-white/20 rounded-lg transition-colors"
            title="Dismiss"
            aria-label="Dismiss banner"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
