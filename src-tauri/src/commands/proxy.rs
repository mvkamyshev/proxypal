use env_proxy;
use sysproxy::Sysproxy;
use url::Url;

#[tauri::command]
pub fn get_system_proxy() -> Result<Option<String>, String> {
    // 1. Check environment variables first (common in Linux/Dev environments)
    // We'll check for a common URL like google.com to see if a proxy is configured for HTTPS
    if let Ok(target_url) = Url::parse("https://www.google.com") {
        let proxy = env_proxy::for_url(&target_url);
        if let Some((host, port)) = proxy.host_port() {
            return Ok(Some(format!("http://{}:{}", host, port)));
        }
    }

    // 2. Check OS-level system proxy settings
    let sys_proxy = Sysproxy::get_system_proxy();

    match sys_proxy {
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
