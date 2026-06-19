use serde::{Deserialize, Serialize};
use tauri::State;
use crate::sidecar::{Request, SidecarManager};

#[derive(Debug, Serialize, Deserialize)]
pub struct CommandResult {
    pub success: bool,
    pub data: Option<serde_json::Value>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn sidecar_request(
    sidecar: State<'_, std::sync::Mutex<SidecarManager>>,
    msg_type: String,
    payload: serde_json::Value,
) -> Result<CommandResult, String> {
    let id = uuid::Uuid::new_v4().to_string();

    let request = Request {
        id: id.clone(),
        msg_type,
        payload,
    };

    let mut manager = sidecar.lock().map_err(|e| e.to_string())?;
    manager.send_request(&request)?;

    Ok(CommandResult {
        success: true,
        data: Some(serde_json::json!({ "requestId": id })),
        error: None,
    })
}

#[tauri::command]
pub async fn install_minecraft(
    sidecar: State<'_, std::sync::Mutex<SidecarManager>>,
    version: String,
    game_path: String,
    java_path: Option<String>,
    download_threads: Option<u32>,
) -> Result<CommandResult, String> {
    let id = uuid::Uuid::new_v4().to_string();

    let request = Request {
        id: id.clone(),
        msg_type: "install:minecraft".to_string(),
        payload: serde_json::json!({
            "version": version,
            "gamePath": game_path,
            "javaPath": java_path,
            "downloadThreads": download_threads,
        }),
    };

    let mut manager = sidecar.lock().map_err(|e| e.to_string())?;
    manager.send_request(&request)?;

    Ok(CommandResult {
        success: true,
        data: Some(serde_json::json!({ "requestId": id })),
        error: None,
    })
}

#[tauri::command]
pub async fn install_mod_loader(
    sidecar: State<'_, std::sync::Mutex<SidecarManager>>,
    mc_version: String,
    game_path: String,
    loader_type: String,
    loader_version: Option<String>,
    java_path: Option<String>,
) -> Result<CommandResult, String> {
    let id = uuid::Uuid::new_v4().to_string();

    let request = Request {
        id: id.clone(),
        msg_type: "install:mod-loader".to_string(),
        payload: serde_json::json!({
            "mcVersion": mc_version,
            "gamePath": game_path,
            "loaderType": loader_type,
            "loaderVersion": loader_version,
            "javaPath": java_path,
        }),
    };

    let mut manager = sidecar.lock().map_err(|e| e.to_string())?;
    manager.send_request(&request)?;

    Ok(CommandResult {
        success: true,
        data: Some(serde_json::json!({ "requestId": id })),
        error: None,
    })
}

#[tauri::command]
pub async fn get_version_list(
    sidecar: State<'_, std::sync::Mutex<SidecarManager>>,
    version_type: Option<String>,
) -> Result<CommandResult, String> {
    let id = uuid::Uuid::new_v4().to_string();

    let request = Request {
        id: id.clone(),
        msg_type: "install:version-list".to_string(),
        payload: serde_json::json!({
            "type": version_type,
        }),
    };

    let mut manager = sidecar.lock().map_err(|e| e.to_string())?;
    manager.send_request(&request)?;

    Ok(CommandResult {
        success: true,
        data: Some(serde_json::json!({ "requestId": id })),
        error: None,
    })
}

#[tauri::command]
pub async fn launch_game(
    sidecar: State<'_, std::sync::Mutex<SidecarManager>>,
    game_path: String,
    java_path: String,
    version: String,
    username: String,
    uuid: String,
    access_token: Option<String>,
    memory: Option<serde_json::Value>,
    jvm_args: Option<Vec<String>>,
    game_args: Option<Vec<String>>,
    server: Option<serde_json::Value>,
    detached: Option<bool>,
) -> Result<CommandResult, String> {
    let id = uuid::Uuid::new_v4().to_string();

    let request = Request {
        id: id.clone(),
        msg_type: "launch:launch".to_string(),
        payload: serde_json::json!({
            "gamePath": game_path,
            "javaPath": java_path,
            "version": version,
            "username": username,
            "uuid": uuid,
            "accessToken": access_token,
            "memory": memory,
            "jvmArgs": jvm_args,
            "gameArgs": game_args,
            "server": server,
            "detached": detached,
        }),
    };

    let mut manager = sidecar.lock().map_err(|e| e.to_string())?;
    manager.send_request(&request)?;

    Ok(CommandResult {
        success: true,
        data: Some(serde_json::json!({ "requestId": id })),
        error: None,
    })
}

#[tauri::command]
pub async fn offline_login(
    sidecar: State<'_, std::sync::Mutex<SidecarManager>>,
    username: String,
) -> Result<CommandResult, String> {
    let id = uuid::Uuid::new_v4().to_string();

    let request = Request {
        id: id.clone(),
        msg_type: "auth:offline-login".to_string(),
        payload: serde_json::json!({
            "username": username,
        }),
    };

    let mut manager = sidecar.lock().map_err(|e| e.to_string())?;
    manager.send_request(&request)?;

    Ok(CommandResult {
        success: true,
        data: Some(serde_json::json!({ "requestId": id })),
        error: None,
    })
}

#[tauri::command]
pub async fn search_mods(
    sidecar: State<'_, std::sync::Mutex<SidecarManager>>,
    query: Option<String>,
    game_version: Option<String>,
    loader: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
    source: String,
) -> Result<CommandResult, String> {
    let id = uuid::Uuid::new_v4().to_string();

    let request = Request {
        id: id.clone(),
        msg_type: "mods:search".to_string(),
        payload: serde_json::json!({
            "query": query,
            "gameVersion": game_version,
            "loader": loader,
            "limit": limit,
            "offset": offset,
            "source": source,
        }),
    };

    let mut manager = sidecar.lock().map_err(|e| e.to_string())?;
    manager.send_request(&request)?;

    Ok(CommandResult {
        success: true,
        data: Some(serde_json::json!({ "requestId": id })),
        error: None,
    })
}

#[tauri::command]
pub async fn install_mod(
    sidecar: State<'_, std::sync::Mutex<SidecarManager>>,
    project_id: String,
    version_id: Option<String>,
    game_path: String,
    source: String,
) -> Result<CommandResult, String> {
    let id = uuid::Uuid::new_v4().to_string();

    let request = Request {
        id: id.clone(),
        msg_type: "mods:install".to_string(),
        payload: serde_json::json!({
            "projectId": project_id,
            "versionId": version_id,
            "gamePath": game_path,
            "source": source,
        }),
    };

    let mut manager = sidecar.lock().map_err(|e| e.to_string())?;
    manager.send_request(&request)?;

    Ok(CommandResult {
        success: true,
        data: Some(serde_json::json!({ "requestId": id })),
        error: None,
    })
}

#[tauri::command]
pub async fn create_instance(
    sidecar: State<'_, std::sync::Mutex<SidecarManager>>,
    name: String,
    game_path: String,
    mc_version: String,
    loader_type: Option<String>,
    loader_version: Option<String>,
    java_path: Option<String>,
    memory: Option<serde_json::Value>,
) -> Result<CommandResult, String> {
    let id = uuid::Uuid::new_v4().to_string();

    let request = Request {
        id: id.clone(),
        msg_type: "instance:create".to_string(),
        payload: serde_json::json!({
            "name": name,
            "gamePath": game_path,
            "mcVersion": mc_version,
            "loaderType": loader_type,
            "loaderVersion": loader_version,
            "javaPath": java_path,
            "memory": memory,
        }),
    };

    let mut manager = sidecar.lock().map_err(|e| e.to_string())?;
    manager.send_request(&request)?;

    Ok(CommandResult {
        success: true,
        data: Some(serde_json::json!({ "requestId": id })),
        error: None,
    })
}

#[tauri::command]
pub async fn list_instances(
    sidecar: State<'_, std::sync::Mutex<SidecarManager>>,
    instances_path: String,
) -> Result<CommandResult, String> {
    let id = uuid::Uuid::new_v4().to_string();

    let request = Request {
        id: id.clone(),
        msg_type: "instance:list".to_string(),
        payload: serde_json::json!({
            "instancesPath": instances_path,
        }),
    };

    let mut manager = sidecar.lock().map_err(|e| e.to_string())?;
    manager.send_request(&request)?;

    Ok(CommandResult {
        success: true,
        data: Some(serde_json::json!({ "requestId": id })),
        error: None,
    })
}
