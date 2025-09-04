#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{AppHandle, Manager};
use std::process::Command;

#[tauri::command]
async fn run_foundry(app: AppHandle, args: Vec<String>) -> Result<String, String> {
    let root = app.path().resolve("../../cli/dist/bin.js", tauri::path::BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;
    let output = Command::new("node")
        .arg(root)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![run_foundry])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


