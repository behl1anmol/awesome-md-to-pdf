import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import * as logger from './logger';

export type SessionValueType = 'boolean' | 'number' | 'string' | 'json';

export interface SessionSetting {
  key: string;
  value: string;
  value_type: SessionValueType;
}

let dbInstance: Database.Database | null = null;

function getDbPath(): string {
  const configDir = path.join(os.homedir(), '.awesome-md-to-pdf');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  return path.join(configDir, 'session.db');
}

export function getDb(): Database.Database | null {
  if (dbInstance) return dbInstance;
  try {
    const dbPath = getDbPath();
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');

    const schemaQuery = dbInstance.prepare("PRAGMA table_info(session_settings)").all() as any[];

    // If table exists but schema is incorrect (e.g. missing columns), drop it.
    if (schemaQuery.length > 0) {
      const colNames = schemaQuery.map((c) => c.name);
      const expected = ['key', 'value', 'value_type', 'updated_at'];
      const hasAll = expected.every(c => colNames.includes(c));
      if (!hasAll) {
        dbInstance.exec("DROP TABLE session_settings;");
      }
    }

    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS session_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        value_type TEXT NOT NULL CHECK (value_type IN ('boolean','number','string','json')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Initialize defaults on first use / if missing.
    const defaults = [
      { key: 'toc', value: 'false', type: 'boolean' },
      { key: 'cover', value: 'false', type: 'boolean' },
      { key: 'pageNumbers', value: 'false', type: 'boolean' },
      { key: 'singleFile', value: 'false', type: 'boolean' },
      { key: 'recursive', value: 'false', type: 'boolean' }
    ];

    const insertStmt = dbInstance.prepare(`
      INSERT OR IGNORE INTO session_settings (key, value, value_type)
      VALUES (?, ?, ?)
    `);

    const insertMany = dbInstance.transaction((settings: typeof defaults) => {
      for (const setting of settings) {
        insertStmt.run(setting.key, setting.value, setting.type);
      }
    });

    insertMany(defaults);

    return dbInstance;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Failed to initialize session database: ${message}`);
    return null;
  }
}

export function loadSessionSettings(): Record<string, any> {
  const db = getDb();
  if (!db) return {};

  try {
    const rows = db.prepare('SELECT key, value, value_type FROM session_settings').all() as SessionSetting[];
    const settings: Record<string, any> = {};

    for (const row of rows) {
      try {
        switch (row.value_type) {
          case 'boolean':
            settings[row.key] = row.value === 'true';
            break;
          case 'number':
            settings[row.key] = Number(row.value);
            break;
          case 'json':
            settings[row.key] = JSON.parse(row.value);
            break;
          case 'string':
          default:
            settings[row.key] = row.value;
            break;
        }
      } catch (err) {
        logger.warn(`Failed to parse session setting for key "${row.key}"`);
      }
    }
    return settings;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Failed to load session settings: ${message}`);
    return {};
  }
}

export function saveSessionSetting(key: string, value: any, valueType: SessionValueType): void {
  const db = getDb();
  if (!db) return;

  try {
    let stringValue = '';
    if (valueType === 'boolean') {
      stringValue = value ? 'true' : 'false';
    } else if (valueType === 'number') {
      stringValue = String(value);
    } else if (valueType === 'json') {
      stringValue = JSON.stringify(value);
    } else {
      stringValue = String(value);
    }

    const stmt = db.prepare(`
      INSERT INTO session_settings (key, value, value_type, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        value_type = excluded.value_type,
        updated_at = excluded.updated_at
    `);
    stmt.run(key, stringValue, valueType);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Failed to save session setting "${key}": ${message}`);
  }
}
