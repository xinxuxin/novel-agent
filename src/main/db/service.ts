import type { App } from "electron";
import { join } from "node:path";

import { createDatabaseConnection } from "./connection";
import type { DatabaseConnection, WenForgeDatabase } from "./connection";
import { migrateDatabase } from "./migrate";
import { BookRepository } from "./repositories/book-repository";
import { BudgetPolicyRepository } from "./repositories/budget-policy-repository";
import { ChapterRepository } from "./repositories/chapter-repository";
import { CostRepository } from "./repositories/cost-repository";
import { GenerationRepository } from "./repositories/generation-repository";
import { ManuscriptRepository } from "./repositories/manuscript-repository";
import { MemoryRepository } from "./repositories/memory-repository";
import { ModelPriceTierRepository } from "./repositories/model-price-tier-repository";
import { ModelPriceRepository } from "./repositories/model-price-repository";
import { ModelProfileRepository } from "./repositories/model-profile-repository";
import { ProjectRepository } from "./repositories/project-repository";
import { ProviderCredentialRepository } from "./repositories/provider-credential-repository";
import { ProviderHealthRepository } from "./repositories/provider-health-repository";
import { ProviderQuotaRepository } from "./repositories/provider-quota-repository";
import { SettingsRepository } from "./repositories/settings-repository";
import { StoryBibleRepository } from "./repositories/story-bible-repository";
import { TaskRouteRepository } from "./repositories/task-route-repository";
import { UsageCalibrationRepository } from "./repositories/usage-calibration-repository";
import { VolumeRepository } from "./repositories/volume-repository";
import { createId } from "./id";
import { nowIso } from "./repositories/types";
import { TASK_TYPES, type ProviderId, type TaskType } from "@shared/domain/model-routing";
import { DEFAULT_PRIVACY_SETTINGS, DEFAULT_ROUTING_SETTINGS } from "@contracts/settings";
import { applyPremiumWebnovelPreset } from "@main/providers/premium-webnovel-preset";

export interface RepositoryRegistry {
  projects: ProjectRepository;
  books: BookRepository;
  volumes: VolumeRepository;
  chapters: ChapterRepository;
  manuscripts: ManuscriptRepository;
  storyBible: StoryBibleRepository;
  memory: MemoryRepository;
  cost: CostRepository;
  generation: GenerationRepository;
  settings: SettingsRepository;
  providerCredentials: ProviderCredentialRepository;
  providerHealth: ProviderHealthRepository;
  budgetPolicies: BudgetPolicyRepository;
  modelProfiles: ModelProfileRepository;
  modelPrices: ModelPriceRepository;
  modelPriceTiers: ModelPriceTierRepository;
  usageCalibration: UsageCalibrationRepository;
  providerQuotas: ProviderQuotaRepository;
  taskRoutes: TaskRouteRepository;
}

export interface AppDatabaseService {
  connection: DatabaseConnection;
  repositories: RepositoryRegistry;
}

export function getDatabasePath(app: App): string {
  return join(app.getPath("userData"), "data", "wenforge.sqlite");
}

export function createRepositories(db: WenForgeDatabase): RepositoryRegistry {
  return {
    projects: new ProjectRepository(db),
    books: new BookRepository(db),
    volumes: new VolumeRepository(db),
    chapters: new ChapterRepository(db),
    manuscripts: new ManuscriptRepository(db),
    storyBible: new StoryBibleRepository(db),
    memory: new MemoryRepository(db),
    cost: new CostRepository(db),
    generation: new GenerationRepository(db),
    settings: new SettingsRepository(db),
    providerCredentials: new ProviderCredentialRepository(db),
    providerHealth: new ProviderHealthRepository(db),
    budgetPolicies: new BudgetPolicyRepository(db),
    modelProfiles: new ModelProfileRepository(db),
    modelPrices: new ModelPriceRepository(db),
    modelPriceTiers: new ModelPriceTierRepository(db),
    usageCalibration: new UsageCalibrationRepository(db),
    providerQuotas: new ProviderQuotaRepository(db),
    taskRoutes: new TaskRouteRepository(db)
  };
}

export function createAppDatabaseService(app: App): AppDatabaseService {
  const connection = createDatabaseConnection(getDatabasePath(app));
  migrateDatabase(connection.sqlite);
  const repositories = createRepositories(connection.db);
  seedDemoData(connection.db, repositories);
  seedModelRoutingData(repositories);
  return { connection, repositories };
}

export function seedDemoData(db: WenForgeDatabase, repositories: RepositoryRegistry): void {
  if (repositories.projects.list().length > 0) {
    return;
  }

  const project = repositories.projects.create({
    name: "演示：都市异能爽文",
    description: "Phase 2 demo data for local-first project hierarchy and manuscript versioning.",
    genre: "都市异能",
    targetReader: "喜欢快节奏升级、悬念钩子和情绪爽点的读者"
  });
  const book = repositories.books.create({
    projectId: project.id,
    title: "觉醒之后",
    logline: "灵气复苏前夜，普通青年在雨夜觉醒异常感知。",
    genre: "都市异能",
    targetLengthChapters: 120
  });
  const volume = repositories.volumes.create({
    bookId: book.id,
    title: "灵气复苏前夜",
    volumeIndex: 1,
    summary: "世界变化露出第一道裂缝。"
  });
  const chapterOne = repositories.chapters.create({
    bookId: book.id,
    volumeId: volume.id,
    chapterIndex: 1,
    title: "雨夜异响",
    targetWords: 3000
  });
  repositories.chapters.create({
    bookId: book.id,
    volumeId: volume.id,
    chapterIndex: 2,
    title: "旧楼里的光",
    targetWords: 3000
  });
  repositories.chapters.create({
    bookId: book.id,
    volumeId: volume.id,
    chapterIndex: 3,
    title: "第一次失控",
    targetWords: 3200
  });
  repositories.manuscripts.saveManualVersion({
    chapterId: chapterOne.id,
    title: "雨夜异响",
    contentMarkdown:
      "雨声砸在窗沿上，像有人隔着玻璃轻轻敲门。\n\n林澈在凌晨三点醒来，听见整座城市的电流都在低语。",
    isCanonical: true
  });
  repositories.storyBible.createEntry({
    bookId: book.id,
    entryType: "world_rule",
    title: "雨夜感知规则",
    content: "雨夜会放大主角对灵气潮汐的异常感知，但持续时间有限。"
  });
  repositories.memory.createChunk({
    bookId: book.id,
    chapterId: chapterOne.id,
    sourceType: "manual_seed",
    title: "开篇钩子",
    content: "主角在雨夜听见城市电流低语，暗示灵气复苏和能力觉醒。",
    importance: 7
  });

  const now = nowIso();
  db.sqlite
    .prepare(
      "insert into characters (id, book_id, name, role, summary, current_state, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      createId("character"),
      book.id,
      "林澈",
      "protagonist",
      "普通青年，觉醒异常感知。",
      "尚未理解自己的能力。",
      now,
      now
    );
  db.sqlite
    .prepare(
      "insert into style_guides (id, book_id, title, content, created_at, updated_at) values (?, ?, ?, ?, ?, ?)"
    )
    .run(createId("style"), book.id, "爽文节奏", "短段落、强钩子、章节末保留悬念。", now, now);
  db.sqlite
    .prepare(
      "insert into unresolved_hooks (id, book_id, chapter_id, title, content, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      createId("hook"),
      book.id,
      chapterOne.id,
      "城市低语来源",
      "林澈听见的电流低语究竟来自灵气潮汐还是某个外部存在？",
      now,
      now
    );
}

const MODEL_SEEDS: Array<{
  provider: ProviderId;
  model: string;
  alias?: string | undefined;
  displayName: string;
  recommendedTasks: TaskType[];
}> = [
  {
    provider: "openai",
    model: "gpt-5.5",
    alias: "gpt-5.5",
    displayName: "GPT-5.5",
    recommendedTasks: ["draft_chapter", "revise_chapter"]
  },
  {
    provider: "openai",
    model: "gpt-5.4",
    displayName: "GPT-5.4",
    recommendedTasks: ["chapter_outline", "draft_chapter"]
  },
  {
    provider: "openai",
    model: "gpt-5.4-mini",
    displayName: "GPT-5.4 mini",
    recommendedTasks: ["brainstorm", "summarize_chapter"]
  },
  {
    provider: "openai",
    model: "gpt-5.4-nano",
    displayName: "GPT-5.4 nano",
    recommendedTasks: ["embedding_or_memory_indexing"]
  },
  {
    provider: "anthropic",
    model: "claude-opus-4.7",
    alias: "claude-opus-4.7",
    displayName: "Claude Opus 4.7",
    recommendedTasks: ["draft_chapter", "continuity_audit"]
  },
  {
    provider: "anthropic",
    model: "claude-sonnet-4.6",
    displayName: "Claude Sonnet 4.6",
    recommendedTasks: ["webnovel_style_rewrite", "revise_chapter"]
  },
  {
    provider: "gemini",
    model: "gemini-3.1-pro-preview",
    displayName: "Gemini 3.1 Pro Preview",
    recommendedTasks: ["volume_outline", "state_settlement"]
  },
  {
    provider: "gemini",
    model: "gemini-3.5-flash",
    displayName: "Gemini 3.5 Flash",
    recommendedTasks: ["brainstorm", "summarize_chapter"]
  },
  {
    provider: "deepseek",
    model: "deepseek-v4-pro",
    alias: "deepseek-v4-pro",
    displayName: "DeepSeek V4-Pro",
    recommendedTasks: ["draft_chapter", "scene_cards"]
  },
  {
    provider: "deepseek",
    model: "deepseek-v4-flash",
    displayName: "DeepSeek V4-Flash",
    recommendedTasks: ["summarize_chapter"]
  },
  {
    provider: "dashscope_qwen",
    model: "qwen3.7-max",
    alias: "qwen3.7-max",
    displayName: "Qwen3.7-Max",
    recommendedTasks: ["draft_chapter", "story_bible"]
  },
  {
    provider: "dashscope_qwen",
    model: "qwen3-max",
    alias: "qwen3-max",
    displayName: "Qwen3-Max",
    recommendedTasks: ["draft_chapter", "webnovel_style_rewrite"]
  },
  {
    provider: "moonshot_kimi",
    model: "kimi-k2.6",
    alias: "kimi-k2.6",
    displayName: "Kimi K2.6",
    recommendedTasks: ["story_bible", "continuity_audit"]
  },
  {
    provider: "xai",
    model: "grok-4.3",
    displayName: "Grok 4.3",
    recommendedTasks: ["brainstorm", "suspense_hook_audit"]
  },
  {
    provider: "openrouter",
    model: "openrouter-auto",
    displayName: "OpenRouter generic route",
    recommendedTasks: ["draft_chapter"]
  },
  {
    provider: "generic_openai_compatible",
    model: "custom-model",
    displayName: "Generic OpenAI-compatible custom model",
    recommendedTasks: ["brainstorm"]
  }
];

export function seedModelRoutingData(repositories: RepositoryRegistry): void {
  repositories.settings.set(
    "privacy",
    repositories.settings.get("privacy") ?? DEFAULT_PRIVACY_SETTINGS
  );
  repositories.settings.set(
    "routing",
    repositories.settings.get("routing") ?? DEFAULT_ROUTING_SETTINGS
  );

  for (const seed of MODEL_SEEDS) {
    const profile = repositories.modelProfiles.upsert({
      provider: seed.provider,
      model: seed.model,
      alias: seed.alias,
      displayName: seed.displayName,
      supportsStreaming: true,
      supportsJson: true,
      defaultTemperature: 0.7,
      recommendedTasks: seed.recommendedTasks,
      enabled: true
    });
    if (!repositories.modelPrices.findActive(seed.provider, seed.model)) {
      repositories.modelPrices.upsert({
        provider: seed.provider,
        model: seed.model,
        inputPricePerMillion: 0,
        outputPricePerMillion: 0,
        cachedInputPricePerMillion: null,
        currency: "USD",
        effectiveDate: "2026-05-25",
        sourceNote:
          seed.alias === "qwen3.7-max" || seed.alias === "kimi-k2.6"
            ? "Editable placeholder price. User must confirm in provider console."
            : "Placeholder seed price. User must verify and edit provider pricing before relying on cost estimates.",
        enabled: true
      });
    }

    for (const taskType of seed.recommendedTasks) {
      const existing = repositories.taskRoutes.find(taskType, "balanced");
      if (!existing) {
        repositories.taskRoutes.upsert({
          taskType,
          qualityMode: "balanced",
          primaryModelProfileId: profile.id,
          temperature: 0.7,
          maxOutputTokens: 4000,
          enabled: true
        });
      }
    }
  }

  seedEditablePriceTiers(repositories);
  const fallbackProfile = repositories.modelProfiles.find("openai", "gpt-5.4-mini");
  if (fallbackProfile) {
    for (const taskType of TASK_TYPES) {
      if (!repositories.taskRoutes.find(taskType, "economy")) {
        repositories.taskRoutes.upsert({
          taskType,
          qualityMode: "economy",
          primaryModelProfileId: fallbackProfile.id,
          temperature: 0.7,
          maxOutputTokens: 3000,
          enabled: true
        });
      }
      if (!repositories.taskRoutes.find(taskType, "premium")) {
        repositories.taskRoutes.upsert({
          taskType,
          qualityMode: "premium",
          primaryModelProfileId: fallbackProfile.id,
          temperature: 0.7,
          maxOutputTokens: 6000,
          enabled: true
        });
      }
    }
  }
  applyPremiumWebnovelPreset(repositories);
}

function seedEditablePriceTiers(repositories: RepositoryRegistry): void {
  const seeds: Array<{
    provider: ProviderId;
    model: string;
    deploymentModes: Array<string | null>;
    note: string;
  }> = [
    {
      provider: "dashscope_qwen",
      model: "qwen3.7-max",
      deploymentModes: ["global"],
      note:
        "User must confirm in provider console. Editable Qwen3.7-Max placeholder tier; not authoritative."
    },
    {
      provider: "dashscope_qwen",
      model: "qwen3-max",
      deploymentModes: ["global", "chinese_mainland", "international", "hong_kong", "eu"],
      note:
        "User must confirm in provider console. Editable Qwen3-Max regional/deployment placeholder tier; not authoritative."
    },
    {
      provider: "moonshot_kimi",
      model: "kimi-k2.6",
      deploymentModes: ["global"],
      note:
        "User must confirm in provider console. Editable Kimi K2.6 placeholder tier; not authoritative."
    },
    {
      provider: "deepseek",
      model: "deepseek-v4-pro",
      deploymentModes: ["global"],
      note:
        "User must confirm in provider console. Editable DeepSeek V4 Pro placeholder tier; not authoritative."
    },
    {
      provider: "openai",
      model: "gpt-5.5",
      deploymentModes: ["global"],
      note:
        "User must confirm in provider console. Editable GPT-5.5 placeholder tier; not authoritative."
    },
    {
      provider: "anthropic",
      model: "claude-opus-4.7",
      deploymentModes: ["global"],
      note:
        "User must confirm in provider console. Editable Claude Opus 4.7 placeholder tier; not authoritative."
    }
  ];

  for (const seed of seeds) {
    const price = repositories.modelPrices.findActive(seed.provider, seed.model);
    if (!price) continue;
    for (const deploymentMode of seed.deploymentModes) {
      const exists = repositories.modelPriceTiers
        .list({ provider: seed.provider, model: seed.model })
        .some((tier) => tier.deploymentMode === deploymentMode);
      if (exists) continue;
      repositories.modelPriceTiers.upsert({
        modelPriceId: price.id,
        provider: seed.provider,
        model: seed.model,
        deploymentMode,
        minInputTokens: 0,
        maxInputTokens: null,
        inputPricePerMillion: price.inputPricePerMillion,
        outputPricePerMillion: price.outputPricePerMillion,
        cachedInputPricePerMillion: price.cachedInputPricePerMillion,
        cacheWritePricePerMillion: null,
        currency: price.currency,
        effectiveDate: price.effectiveDate,
        sourceNote: seed.note,
        enabled: true
      });
    }
  }
}
