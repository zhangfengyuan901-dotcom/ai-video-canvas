// =========================================================================
// Database connection — SQLite via Drizzle
// =========================================================================

import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

// Resolve from this file's location (apps/server/src/db/) up to repo root
const DB_PATH = resolve(import.meta.dirname, "../../../../local-data/database.sqlite");

// Ensure parent directory exists
const dir = resolve(DB_PATH, "..");
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite);

// ---- Auto-migrate: 确保新表/列存在 --------------------------------
// 在开发阶段自动同步 schema 变更，避免手动跑 drizzle-kit push

try {
  // 添加 video_clips 的 input_panel_ids_json 列（如果不存在）
  sqlite.exec(`ALTER TABLE video_clips ADD COLUMN input_panel_ids_json TEXT NOT NULL DEFAULT '[]'`);
} catch {
  // 列已存在，忽略
}

try {
  // 创建 jobs 表（如果不存在）
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'queued',
      progress INTEGER NOT NULL DEFAULT 0,
      result_json TEXT,
      error TEXT,
      task_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
} catch (e) {
  console.warn("[DB] Auto-migration warning:", e);
}

try {
  // 添加 storyboard_panels 的 version 列（如果不存在）
  sqlite.exec(`ALTER TABLE storyboard_panels ADD COLUMN version INTEGER NOT NULL DEFAULT 1`);
} catch {
  // 列已存在，忽略
}

try {
  // 添加 scenes 的 current_clip_id 列（如果不存在）
  sqlite.exec(`ALTER TABLE scenes ADD COLUMN current_clip_id TEXT`);
} catch {
  // 列已存在，忽略
}

try {
  // 添加 scenes 的 storyboard 审核字段
  sqlite.exec(`ALTER TABLE scenes ADD COLUMN storyboard_review_status TEXT NOT NULL DEFAULT 'pending'`);
} catch {
}

try {
  sqlite.exec(`ALTER TABLE scenes ADD COLUMN storyboard_review_note TEXT`);
} catch {
}

try {
  sqlite.exec(`ALTER TABLE scenes ADD COLUMN storyboard_approved_at TEXT`);
} catch {
}

try {
  // 添加 video_clips 的审核字段
  sqlite.exec(`ALTER TABLE video_clips ADD COLUMN review_status TEXT NOT NULL DEFAULT 'pending'`);
} catch {
}

try {
  sqlite.exec(`ALTER TABLE video_clips ADD COLUMN review_note TEXT`);
} catch {
}

try {
  sqlite.exec(`ALTER TABLE video_clips ADD COLUMN approved_at TEXT`);
} catch {
}

try {
  sqlite.exec(`ALTER TABLE video_clips ADD COLUMN rejected_at TEXT`);
} catch {
}


// ---- storyboard_panels 唯一约束 + 清理重复数据 -------------------------

try {
  // 删除重复记录：每组 (project_id, scene_id, panel_index) 只保留 version 最大的那条
  sqlite.exec(`
    DELETE FROM storyboard_panels WHERE id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY project_id, scene_id, panel_index
          ORDER BY version DESC
        ) AS rn FROM storyboard_panels
      ) WHERE rn = 1
    )
  `);
} catch (e) {
  console.warn("[DB] storyboard_panels cleanup warning:", e);
}

try {
  // 创建唯一索引（避免应用层 UPSERT 并发问题）
  sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_storyboard_panels_unique ON storyboard_panels(project_id, scene_id, panel_index)`);
} catch (e) {
  console.warn("[DB] storyboard_panels unique index warning:", e);
}

export type DbClient = typeof db;
