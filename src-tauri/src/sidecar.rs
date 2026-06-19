use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct Request {
    pub id: String,
    #[serde(rename = "type")]
    pub msg_type: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Response {
    pub id: String,
    #[serde(rename = "type")]
    pub msg_type: String,
    pub payload: serde_json::Value,
}

pub struct SidecarManager {
    child: Option<CommandChild>,
}

impl SidecarManager {
    pub fn new() -> Self {
        Self { child: None }
    }

    pub fn spawn(&mut self, app: &AppHandle) -> Result<(), String> {
        let sidecar_command = app
            .shell()
            .sidecar("koring-sidecar")
            .map_err(|e| format!("Failed to create sidecar command: {}", e))?;

        let (mut rx, child) = sidecar_command
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

        self.child = Some(child);

        let app_handle = app.clone();

        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line_bytes) => {
                        let line = String::from_utf8_lossy(&line_bytes);
                        for line in line.lines() {
                            let trimmed = line.trim();
                            if trimmed.is_empty() {
                                continue;
                            }
                            if let Ok(response) = serde_json::from_str::<Response>(trimmed) {
                                let _ = app_handle.emit("sidecar-response", &response);
                            }
                        }
                    }
                    CommandEvent::Stderr(line_bytes) => {
                        let line = String::from_utf8_lossy(&line_bytes);
                        eprintln!("[sidecar stderr] {}", line);
                    }
                    CommandEvent::Error(err) => {
                        eprintln!("[sidecar error] {}", err);
                    }
                    CommandEvent::Terminated(status) => {
                        eprintln!("[sidecar] terminated with status: {:?}", status);
                    }
                    _ => {}
                }
            }
        });

        Ok(())
    }

    pub fn send_request(&mut self, request: &Request) -> Result<(), String> {
        let child = self.child.as_mut().ok_or("Sidecar not running")?;
        let json = serde_json::to_string(request).map_err(|e| format!("Serialize error: {}", e))?;
        child
            .write((json + "\n").as_bytes())
            .map_err(|e| format!("Write error: {}", e))
    }

    pub fn kill(&mut self) -> Result<(), String> {
        if let Some(child) = self.child.take() {
            child.kill().map_err(|e| format!("Kill error: {}", e))?;
        }
        Ok(())
    }
}
