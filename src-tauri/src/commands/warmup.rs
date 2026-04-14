use tauri::{Emitter, State};

use crate::helpers::warmup::{load_codex_warm_report, run_codex_warmup_job, CodexWarmReport};
use crate::state::AppState;

#[tauri::command]
pub fn get_codex_warmup_report() -> Result<CodexWarmReport, String> {
    load_codex_warm_report().ok_or("No codex warmup report found".to_string())
}

#[tauri::command]
pub async fn run_codex_warmup(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<CodexWarmReport, String> {
    let report = run_codex_warmup_job(state.codex_warmup_running.clone()).await?;
    let _ = app.emit("codex-warmup-finished", report.clone());
    Ok(report)
}
