use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use reqwest::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE, USER_AGENT};
use serde::{Deserialize, Serialize};

use crate::config::{get_proxypal_config_dir, load_config};

const TOKEN_URL: &str = "https://auth.openai.com/oauth/token";
const USAGE_URL: &str = "https://chatgpt.com/backend-api/wham/usage";
const CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CodexWarmReportEntry {
    pub file: String,
    pub email: Option<String>,
    pub refreshed: bool,
    pub warmed: bool,
    pub quota_fetched: bool,
    pub plan_type: Option<String>,
    pub primary_used_percent: Option<f64>,
    pub secondary_used_percent: Option<f64>,
    pub primary_reset_at: Option<i64>,
    pub secondary_reset_at: Option<i64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CodexWarmReport {
    pub generated_at: String,
    pub auth_dir: String,
    pub total: usize,
    pub refreshed: usize,
    pub warmed: usize,
    pub quota_fetched: usize,
    pub failed: usize,
    pub results: Vec<CodexWarmReportEntry>,
}

#[derive(Debug, Clone, Deserialize)]
struct TokenRefreshResponse {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    id_token: Option<String>,
    #[serde(default)]
    expires_in: Option<i64>,
}

#[derive(Debug, Clone, Deserialize, Default)]
struct WarmupClaimsAuth {
    #[serde(default)]
    chatgpt_account_id: Option<String>,
    #[serde(default)]
    account_id: Option<String>,
    #[serde(default)]
    org_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
struct WarmupClaims {
    #[serde(default)]
    email: Option<String>,
    #[serde(rename = "https://api.openai.com/auth", default)]
    auth: Option<WarmupClaimsAuth>,
    #[serde(default)]
    account_id: Option<String>,
    #[serde(default)]
    org_id: Option<String>,
}

pub fn codex_warm_report_path() -> PathBuf {
    get_proxypal_config_dir().join("warmup").join("codex-warm-report.json")
}

pub fn load_codex_warm_report() -> Option<CodexWarmReport> {
    let content = std::fs::read_to_string(codex_warm_report_path()).ok()?;
    serde_json::from_str(&content).ok()
}

pub async fn run_codex_warmup_job(running: Arc<AtomicBool>) -> Result<CodexWarmReport, String> {
    if running.swap(true, Ordering::SeqCst) {
        return Err("Codex warmup is already running".to_string());
    }

    let result = run_codex_warmup_job_inner().await;
    running.store(false, Ordering::SeqCst);
    result
}

async fn run_codex_warmup_job_inner() -> Result<CodexWarmReport, String> {
    let auth_dir = dirs::home_dir()
        .ok_or("Could not determine home directory")?
        .join(".cli-proxy-api");

    if !auth_dir.exists() {
        return Ok(CodexWarmReport {
            generated_at: chrono::Utc::now().to_rfc3339(),
            auth_dir: auth_dir.to_string_lossy().to_string(),
            ..CodexWarmReport::default()
        });
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let mut entries = Vec::new();
    let mut files: Vec<_> = std::fs::read_dir(&auth_dir)
        .map_err(|e| format!("Failed to read auth dir: {}", e))?
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .map(|name| name.starts_with("codex-") && name.ends_with(".json"))
                    .unwrap_or(false)
        })
        .collect();
    files.sort();

    for path in files {
        let file = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string();
        let mut payload = match read_auth_json(&path) {
            Ok(payload) => payload,
            Err(error) => {
                entries.push(CodexWarmReportEntry {
                    file,
                    email: None,
                    refreshed: false,
                    warmed: false,
                    quota_fetched: false,
                    plan_type: None,
                    primary_used_percent: None,
                    secondary_used_percent: None,
                    primary_reset_at: None,
                    secondary_reset_at: None,
                    error: Some(error),
                });
                continue;
            }
        };

        let email = payload
            .get("email")
            .and_then(|v| v.as_str())
            .map(|v| v.to_string());
        let refresh_result = refresh_tokens(&client, &mut payload).await;
        let (refreshed, refresh_error) = match refresh_result {
            Ok(_) => {
                let _ = atomic_write_json(&path, &payload);
                (true, None)
            }
            Err(error) => (false, Some(error)),
        };

        let mut warmed = false;
        let mut warm_error = None;
        let mut quota_entry = None;

        if refreshed {
            match fetch_quota(&client, &payload).await {
                Ok(entry) => {
                    quota_entry = Some(entry);
                    warmed = true;
                }
                Err(error) => {
                    warm_error = Some(error);
                }
            }
        }

        let quota_fetched = quota_entry.is_some();
        let entry = CodexWarmReportEntry {
            file,
            email: payload
                .get("email")
                .and_then(|v| v.as_str())
                .map(|v| v.to_string())
                .or(email),
            refreshed,
            warmed,
            quota_fetched,
            plan_type: quota_entry
                .as_ref()
                .and_then(|quota| quota.get("plan_type"))
                .and_then(|v| v.as_str())
                .map(|v| v.to_string()),
            primary_used_percent: quota_entry
                .as_ref()
                .and_then(|quota| quota.get("rate_limit"))
                .and_then(|v| v.get("primary_window"))
                .and_then(|v| v.get("used_percent"))
                .and_then(|v| v.as_f64()),
            secondary_used_percent: quota_entry
                .as_ref()
                .and_then(|quota| quota.get("rate_limit"))
                .and_then(|v| v.get("secondary_window"))
                .and_then(|v| v.get("used_percent"))
                .and_then(|v| v.as_f64()),
            primary_reset_at: quota_entry
                .as_ref()
                .and_then(|quota| quota.get("rate_limit"))
                .and_then(|v| v.get("primary_window"))
                .and_then(|v| v.get("reset_at"))
                .and_then(|v| v.as_i64()),
            secondary_reset_at: quota_entry
                .as_ref()
                .and_then(|quota| quota.get("rate_limit"))
                .and_then(|v| v.get("secondary_window"))
                .and_then(|v| v.get("reset_at"))
                .and_then(|v| v.as_i64()),
            error: refresh_error.or(warm_error),
        };
        entries.push(entry);
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    }

    let report = CodexWarmReport {
        generated_at: chrono::Utc::now().to_rfc3339(),
        auth_dir: auth_dir.to_string_lossy().to_string(),
        total: entries.len(),
        refreshed: entries.iter().filter(|item| item.refreshed).count(),
        warmed: entries.iter().filter(|item| item.warmed).count(),
        quota_fetched: entries.iter().filter(|item| item.quota_fetched).count(),
        failed: entries.iter().filter(|item| item.error.is_some()).count(),
        results: entries,
    };

    atomic_write_json(&codex_warm_report_path(), &serde_json::to_value(&report).map_err(|e| e.to_string())?)?;
    Ok(report)
}

pub fn should_run_daily_codex_warmup() -> bool {
    let config = load_config();
    if !config.codex_warmup_enabled {
        return false;
    }

    let Some((target_hour, target_minute)) = parse_hh_mm(&config.codex_warmup_time) else {
        return false;
    };

    let now = chrono::Local::now();
    if now.hour() != target_hour as u32 || now.minute() != target_minute as u32 {
        return false;
    }

    let last_run = load_codex_warm_report()
        .and_then(|report| chrono::DateTime::parse_from_rfc3339(&report.generated_at).ok())
        .map(|dt| dt.with_timezone(&chrono::Local).date_naive());

    last_run != Some(now.date_naive())
}

fn parse_hh_mm(value: &str) -> Option<(u8, u8)> {
    let mut parts = value.split(':');
    let hour: u8 = parts.next()?.parse().ok()?;
    let minute: u8 = parts.next()?.parse().ok()?;
    if parts.next().is_some() || hour > 23 || minute > 59 {
        return None;
    }
    Some((hour, minute))
}

pub(crate) fn read_auth_json(path: &Path) -> Result<serde_json::Value, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("read failed: {}", e))?;
    let payload: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("invalid auth json: {}", e))?;
    if !payload.is_object() {
        return Err("auth file root is not an object".to_string());
    }
    Ok(payload)
}

pub(crate) fn atomic_write_json(path: &Path, payload: &serde_json::Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("failed to create dir: {}", e))?;
    }
    let tmp_path = path.with_extension(format!(
        "{}tmp",
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| format!("{}.", ext))
            .unwrap_or_default()
    ));
    let data = serde_json::to_string_pretty(payload).map_err(|e| format!("serialize failed: {}", e))?;
    std::fs::write(&tmp_path, format!("{}\n", data)).map_err(|e| format!("write failed: {}", e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&tmp_path, std::fs::Permissions::from_mode(0o600));
    }
    std::fs::rename(&tmp_path, path).map_err(|e| format!("rename failed: {}", e))?;
    Ok(())
}

pub(crate) async fn refresh_tokens(
    client: &reqwest::Client,
    payload: &mut serde_json::Value,
) -> Result<(), String> {
    let refresh_token = payload
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .filter(|v| !v.trim().is_empty())
        .ok_or("missing refresh_token")?;

    let response = client
        .post(TOKEN_URL)
        .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
        .header(ACCEPT, "application/json")
        .form(&[
            ("client_id", CLIENT_ID),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token.trim()),
            ("scope", "openid profile email"),
        ])
        .send()
        .await
        .map_err(|e| format!("refresh request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("refresh failed ({}): {}", status, truncate(&body)));
    }

    let body: TokenRefreshResponse = response
        .json()
        .await
        .map_err(|e| format!("invalid refresh response: {}", e))?;

    let object = payload
        .as_object_mut()
        .ok_or("auth payload is not an object")?;
    object.insert("type".to_string(), serde_json::Value::String("codex".to_string()));
    object.insert(
        "access_token".to_string(),
        serde_json::Value::String(body.access_token.clone()),
    );
    if let Some(refresh_token) = body.refresh_token.filter(|v| !v.trim().is_empty()) {
        object.insert(
            "refresh_token".to_string(),
            serde_json::Value::String(refresh_token),
        );
    }
    if let Some(id_token) = body.id_token.filter(|v| !v.trim().is_empty()) {
        object.insert("id_token".to_string(), serde_json::Value::String(id_token.clone()));
        let claims = parse_jwt_claims(&id_token);
        if let Some(email) = claims.email.filter(|v| !v.trim().is_empty()) {
            object.insert("email".to_string(), serde_json::Value::String(email));
        }
        let account_id = claims
            .auth
            .and_then(|auth| auth.chatgpt_account_id.or(auth.account_id).or(auth.org_id))
            .or(claims.account_id)
            .or(claims.org_id);
        if let Some(account_id) = account_id.filter(|v| !v.trim().is_empty()) {
            object.insert("account_id".to_string(), serde_json::Value::String(account_id));
        }
    }
    object.insert(
        "last_refresh".to_string(),
        serde_json::Value::String(chrono::Utc::now().to_rfc3339()),
    );
    if let Some(expires_in) = body.expires_in.filter(|v| *v > 0) {
        object.insert(
            "expired".to_string(),
            serde_json::Value::String(
                (chrono::Utc::now() + chrono::Duration::seconds(expires_in)).to_rfc3339(),
            ),
        );
    }

    Ok(())
}

async fn fetch_quota(
    client: &reqwest::Client,
    payload: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let access_token = payload
        .get("access_token")
        .and_then(|v| v.as_str())
        .filter(|v| !v.trim().is_empty())
        .ok_or("missing access_token")?;

    let mut req = client
        .get(USAGE_URL)
        .header(AUTHORIZATION, format!("Bearer {}", access_token.trim()))
        .header(USER_AGENT, "ProxyPal Codex Warmer")
        .header(ACCEPT, "application/json");

    if let Some(account_id) = payload
        .get("account_id")
        .and_then(|v| v.as_str())
        .filter(|v| !v.trim().is_empty())
    {
        req = req.header("ChatGPT-Account-Id", account_id.trim());
    }

    let response = req
        .send()
        .await
        .map_err(|e| format!("quota request failed: {}", e))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("quota failed ({}): {}", status, truncate(&body)));
    }

    response
        .json()
        .await
        .map_err(|e| format!("invalid quota response: {}", e))
}

fn parse_jwt_claims(token: &str) -> WarmupClaims {
    let Some(payload) = token.split('.').nth(1) else {
        return WarmupClaims::default();
    };

    let decoded = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload)
        .or_else(|_| base64::engine::general_purpose::URL_SAFE.decode(payload));

    decoded
        .ok()
        .and_then(|bytes| serde_json::from_slice::<WarmupClaims>(&bytes).ok())
        .unwrap_or_default()
}

fn truncate(value: &str) -> String {
    value.chars().take(300).collect()
}

use base64::Engine;
use chrono::Timelike;
