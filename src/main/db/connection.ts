import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import * as schema from "./schema";

export type SqliteDatabase = Database.Database;
export type DrizzleDatabase = ReturnType<typeof drizzle<typeof schema>>;

export interface WenForgeDatabase {
  orm: DrizzleDatabase;
  sqlite: SqliteDatabase;
}

export interface DatabaseConnection {
  db: WenForgeDatabase;
  sqlite: SqliteDatabase;
}

export function createDatabaseConnection(filePath: string): DatabaseConnection {
  mkdirSync(dirname(filePath), { recursive: true });
  const sqlite = new Database(filePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");

  return {
    sqlite,
    db: {
      orm: drizzle(sqlite, { schema }),
      sqlite
    }
  };
}
