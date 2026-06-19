mod sidecar;
mod commands;

use sidecar::SidecarManager;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(SidecarManager::new()))
        .invoke_handler(tauri::generate_handler![
            commands::sidecar_request,
            commands::install_minecraft,
            commands::install_mod_loader,
            commands::get_version_list,
            commands::launch_game,
            commands::offline_login,
            commands::search_mods,
            commands::install_mod,
            commands::create_instance,
            commands::list_instances,
        ])
        .setup(|app| {
            // Hide main window initially
            if let Some(main) = app.get_webview_window("main") {
                main.hide().ok();
            }

            // After splash animation, close splash and show main
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_secs(4)).await;

                // Close splash screen
                if let Some(splash) = handle.get_webview_window("splashscreen") {
                    splash.close().ok();
                }

                // Show main window
                if let Some(main) = handle.get_webview_window("main") {
                    main.show().ok();
                    main.set_focus().ok();
                }
            });

            #[cfg(debug_assertions)]
            {
                eprintln!("[koring] dev mode: sidecar spawn skipped (compile sidecar first)");
                return Ok(());
            }
            #[cfg(not(debug_assertions))]
            {
                let handle = app.handle().clone();
                let state = app.state::<Mutex<SidecarManager>>();
                let mut sidecar = state.inner().lock().map_err(|e| e.to_string())?;
                sidecar.spawn(&handle)?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
