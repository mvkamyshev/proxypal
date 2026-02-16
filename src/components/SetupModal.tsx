import { createSignal, Show } from "solid-js";
import { useI18n } from "../i18n";
import { toastStore } from "../stores/toast";
import { Button } from "./ui";

type Tool = "cursor" | "cline" | "continue";

interface SetupModalProps {
	tool: Tool | null;
	endpoint: string;
	onClose: () => void;
}

interface ToolInfo {
	name: string;
	logo: string;
	description: string;
	steps: { title: string; content: string; copyable?: boolean }[];
}

function getToolInfo(
	t: (key: string, params?: Record<string, string | number>) => string,
): Record<Tool, ToolInfo> {
	return {
		cursor: {
			name: "Cursor",
			logo: "/logos/cursor.svg",
			description: t("setupModal.description.cursor"),
			steps: [
				{
					title: t("setupModal.steps.cursor.openSettings.title"),
					content: t("setupModal.steps.cursor.openSettings.content"),
				},
				{
					title: t("setupModal.steps.cursor.setApiBaseUrl.title"),
					content: "",
					copyable: true,
				},
				{
					title: t("setupModal.steps.cursor.setApiKey.title"),
					content: t("setupModal.steps.cursor.setApiKey.content"),
					copyable: false,
				},
				{
					title: t("setupModal.steps.cursor.selectModel.title"),
					content: t("setupModal.steps.cursor.selectModel.content"),
				},
			],
		},
		cline: {
			name: "Cline",
			logo: "/logos/cline.svg",
			description: t("setupModal.description.cline"),
			steps: [
				{
					title: t("setupModal.steps.cline.openClineSettings.title"),
					content: t("setupModal.steps.cline.openClineSettings.content"),
				},
				{
					title: t("setupModal.steps.cline.selectApiProvider.title"),
					content: t("setupModal.steps.cline.selectApiProvider.content"),
				},
				{
					title: t("setupModal.steps.cline.setBaseUrl.title"),
					content: "",
					copyable: true,
				},
				{
					title: t("setupModal.steps.cline.setApiKey.title"),
					content: t("setupModal.steps.cline.setApiKey.content"),
				},
			],
		},
		continue: {
			name: "Continue",
			logo: "/logos/continue.svg",
			description: t("setupModal.description.continue"),
			steps: [
				{
					title: t("setupModal.steps.continue.openConfig.title"),
					content: t("setupModal.steps.continue.openConfig.content"),
				},
				{
					title: t("setupModal.steps.continue.addModelConfiguration.title"),
					content: "",
					copyable: true,
				},
				{
					title: t("setupModal.steps.continue.saveAndReload.title"),
					content: t("setupModal.steps.continue.saveAndReload.content"),
				},
			],
		},
	};
}

export function SetupModal(props: SetupModalProps) {
	const { t } = useI18n();
	const [copiedIndex, setCopiedIndex] = createSignal<number | null>(null);

	const handleCopy = async (text: string, index: number) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedIndex(index);
			toastStore.success(t("common.copied"));
			setTimeout(() => setCopiedIndex(null), 2000);
		} catch {
			toastStore.error(t("common.copyFailed"));
		}
	};

	const getCopyableContent = (tool: Tool, stepIndex: number): string => {
		const endpoint = props.endpoint;

		if (tool === "cursor" && stepIndex === 1) {
			return endpoint;
		}
		if (tool === "cline" && stepIndex === 2) {
			return endpoint;
		}
		if (tool === "continue" && stepIndex === 1) {
			return JSON.stringify(
				{
					models: [
						{
							title: "ProxyPal",
							provider: "openai",
							model: "gpt-4",
							apiBase: endpoint,
							apiKey: "proxypal",
						},
					],
				},
				null,
				2,
			);
		}
		return "";
	};

	return (
		<Show when={props.tool}>
			{(tool) => {
				const info = getToolInfo(t)[tool()];
				return (
					<div
						class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
						onClick={(e) => e.target === e.currentTarget && props.onClose()}
					>
						<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden animate-scale-in">
							{/* Header */}
							<div class="flex items-center gap-4 p-6 border-b border-gray-200 dark:border-gray-800">
								<div class="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
									<img src={info.logo} alt={info.name} class="w-8 h-8" />
								</div>
								<div class="flex-1">
									<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
										{t("setupModal.setupTool", { name: info.name })}
									</h2>
									<p class="text-sm text-gray-500 dark:text-gray-400">
										{info.description}
									</p>
								</div>
								<button
									class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
									onClick={props.onClose}
								>
									<svg
										class="w-6 h-6"
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

							{/* Steps */}
							<div class="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
								{info.steps.map((step, index) => (
									<div class="flex gap-4">
										<div class="flex-shrink-0 w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center text-sm font-bold">
											{index + 1}
										</div>
										<div class="flex-1 min-w-0">
											<h3 class="font-medium text-gray-900 dark:text-gray-100 mb-1">
												{step.title}
											</h3>
											{step.content && (
												<p class="text-sm text-gray-600 dark:text-gray-400">
													{step.content}
												</p>
											)}
											{step.copyable && (
												<div class="mt-2 relative">
													<pre class="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-xs text-gray-800 dark:text-gray-200 overflow-x-auto font-mono">
														{getCopyableContent(tool(), index)}
													</pre>
													<button
														class="absolute top-2 right-2 p-1.5 rounded-md bg-white dark:bg-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
														onClick={() =>
															handleCopy(
																getCopyableContent(tool(), index),
																index,
															)
														}
													>
														{copiedIndex() === index ? (
															<svg
																class="w-4 h-4 text-green-500"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	stroke-width="2"
																	d="M5 13l4 4L19 7"
																/>
															</svg>
														) : (
															<svg
																class="w-4 h-4 text-gray-500"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	stroke-width="2"
																	d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
																/>
															</svg>
														)}
													</button>
												</div>
											)}
										</div>
									</div>
								))}
							</div>

							{/* Footer */}
							<div class="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
								<div class="flex items-center justify-between">
									<p class="text-xs text-gray-500 dark:text-gray-400">
										{t("setupModal.needHelpDocumentation")}
									</p>
									<Button variant="primary" onClick={props.onClose}>
										{t("setupModal.done")}
									</Button>
								</div>
							</div>
						</div>
					</div>
				);
			}}
		</Show>
	);
}
