use crate::helpers::warmup::{atomic_write_json, refresh_tokens};

#[tauri::command]
pub async fn get_chatgpt_web_session(file_name: String) -> Result<serde_json::Value, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let auth_dir = home.join(".cli-proxy-api");
    let normalized = file_name
        .strip_suffix(".disabled")
        .unwrap_or(file_name.as_str())
        .to_string();
    let auth_path = auth_dir.join(&normalized);
    let disabled_auth_path = auth_dir.join(format!("{}.disabled", normalized));
    let existing_path = if auth_path.exists() {
        auth_path
    } else if disabled_auth_path.exists() {
        disabled_auth_path
    } else {
        return Err(format!("Auth file not found: {}", file_name));
    };

    let content = std::fs::read_to_string(&existing_path)
        .map_err(|e| format!("Failed to read auth file {}: {}", existing_path.display(), e))?;
    let mut payload: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Invalid auth file JSON: {}", e))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    if let Err(error) = refresh_tokens(&client, &mut payload).await {
        eprintln!(
            "Failed to refresh credential file {} before fetching session: {}",
            normalized, error
        );
    } else if let Err(error) = atomic_write_json(&existing_path, &payload) {
        eprintln!(
            "Failed to persist refreshed credential file {}: {}",
            normalized, error
        );
    }

    let session_token = payload
        .get("session_token")
        .and_then(|v| v.as_str())
        .or_else(|| payload.get("sessionToken").and_then(|v| v.as_str()))
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
        .ok_or("No session_token in auth file")?;

    let access_token = payload
        .get("access_token")
        .and_then(|v| v.as_str())
        .or_else(|| payload.get("accessToken").and_then(|v| v.as_str()))
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string);

    let mut request = client
        .get("https://chatgpt.com/api/auth/session")
        .header("Accept", "application/json")
        .header("Referer", "https://chatgpt.com/")
        .header(
            "Cookie",
            format!(
                "__Secure-next-auth.session-token={}; next-auth.session-token={}",
                session_token, session_token
            ),
        );

    if let Some(token) = access_token.as_ref() {
        request = request.header("Authorization", format!("Bearer {}", token));
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Session request failed: {}", e))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read session response body: {}", e))?;

    if !status.is_success() {
        let snippet = if body.len() > 600 { &body[..600] } else { &body };
        return Err(format!("Session endpoint returned {}: {}", status, snippet));
    }

    serde_json::from_str::<serde_json::Value>(&body)
        .map_err(|e| format!("Invalid JSON from session endpoint: {}", e))
}
