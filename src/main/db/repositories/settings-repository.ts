import type { WenForgeDatabase } from "@main/db/connection";
import { nowIso } from "./types";

export class SettingsRepository {
  constructor(private readonly db: WenForgeDatabase) {}

  get<T>(key: string): T | null {
    const row = this.db.sqlite
      .prepare("select value_json from app_settings where key = ?")
      .get(key) as { value_json: string } | undefined;
    return row ? (JSON.parse(row.value_json) as T) : null;
  }

  set(key: string, value: unknown): void {
    this.db.sqlite
      .prepare(
        `insert into app_settings (key, value_json, updated_at) values (?, ?, ?)
        on conflict(key) do update set value_json = excluded.value_json, updated_at = excluded.updated_at`
      )
      .run(key, JSON.stringify(value), nowIso());
  }
}
