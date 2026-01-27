use env_proxy;
use sysproxy::Sysproxy;
use url::Url;

#[tauri::command]
pub fn get_system_proxy() -> Result<Option<String>, String> {
    // 1. Check environment variables first (common in Linux/Dev environments)
    // We'll check for a common URL like google.com to see if a proxy is configured for HTTPS
    if let Ok(target_url) = Url::parse("https://www.google.com") {
        if let Some(proxy) = env_proxy::for_url(&target_url) {
            return Ok(Some(proxy.to_string()));
        }
    }

    // 2. Check OS-level system proxy settings
    match Sysproxy::get() {
        Ok(proxy) if proxy.enable => {
            let protocol = if proxy.host.contains("socks") {
                "socks5"
            } else {
                "http"
            };
            Ok(Some(format!(
                "{}://{}:{}",
                protocol, proxy.host, proxy.port
            )))
        }
        Ok(_) => Ok(None),
        Err(e) => Err(format!("Failed to detect system proxy: {}", e)),
    }
}
