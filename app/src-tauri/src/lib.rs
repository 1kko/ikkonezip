// Prevents additional console window on Windows (no-op on macOS but required for cross-compile).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Second-instance launch (e.g., user double-clicks another .zip while app is open).
            // Re-emit any file argv into the existing window.
            if let Some(path) = argv.iter().skip(1).find(|a| !a.starts_with('-')) {
                if let Some(window) = app.get_webview_window("main") {
                    // TODO(Stage 2A): hot-reopen uses Tauri IPC event "file-opened".
                    // Cold-start (see setup() below) uses a DOM CustomEvent "tauri-file-opened"
                    // because the WebView isn't ready for IPC events at setup() time.
                    // Consider unifying both paths once the SPA's listener wiring is in place.
                    let _ = window.emit("file-opened", path.clone());
                    let _ = window.set_focus();
                }
            } else if let Some(window) = app.get_webview_window("main") {
                // No file path — just bring the existing window to front.
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // First-instance launch (cold start with file argv).
            let argv: Vec<String> = std::env::args().skip(1).collect();
            if let Some(path) = argv.iter().find(|a| !a.starts_with('-')) {
                let path = path.clone();
                let window = app.get_webview_window("main")
                    .expect("'main' window not found — label must match tauri.conf.json");
                // TODO(Stage 2A): cold-start uses DOM CustomEvent (not Tauri IPC) because
                // the WebView's IPC bridge isn't initialized yet at setup() time.
                // Hot-reopen path uses the IPC event "file-opened" — see single_instance callback above.
                // Defer until the WebView is ready to receive events.
                let _ = window.eval(&format!(
                    "window.addEventListener('DOMContentLoaded', () => {{ window.dispatchEvent(new CustomEvent('tauri-file-opened', {{ detail: {} }})); }});",
                    serde_json::to_string(&path).unwrap_or_else(|_| "null".to_string())
                ));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
