import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

/**
 * Synchronizes the operating system window title and document title.
 * Uses both Tauri v2 window API and custom Rust backend command to guarantee
 * that the correct product edition name is always shown in the Windows titlebar.
 */
export function syncWindowTitle(title: string) {
  if (typeof document !== "undefined") {
    document.title = title;
  }

  // 1. Tauri v2 JavaScript API
  try {
    const win = getCurrentWindow();
    if (win && typeof win.setTitle === "function") {
      win.setTitle(title).catch(() => {});
    }
  } catch {
    // Non-tauri browser preview mode
  }

  // 2. Custom Rust command invoke fallback
  try {
    invoke("set_window_title", { title }).catch(() => {});
  } catch {
    // Non-tauri fallback
  }
}
