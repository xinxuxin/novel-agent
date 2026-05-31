import "tsx/esm";

import { app, safeStorage } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SETTINGS_DOCX =
  process.env.WENFORGE_SETTINGS_DOCX ?? "/Users/macbook/Downloads/全民航海_详细设定集.docx";
const OUTLINE_DOCX =
  process.env.WENFORGE_OUTLINE_DOCX ?? "/Users/macbook/Downloads/全民航海_详细大纲.docx";
const BUDGET_CAP_USD = Number(process.env.WENFORGE_REAL_TEST_BUDGET_USD ?? "2");
const TARGET_WORDS = Number(process.env.WENFORGE_REAL_TEST_TARGET_WORDS ?? "1800");
const MAX_OUTPUT_TOKENS = Number(process.env.WENFORGE_REAL_TEST_MAX_OUTPUT_TOKENS ?? "2600");

app.setName("wenforge-studio");

process.on("uncaughtException", (error) => {
  console.error("真实十章测试异常：", error);
  app.quit();
});
process.on("unhandledRejection", (error) => {
  console.error("真实十章测试拒绝：", error);
  app.quit();
});

app.whenReady().then(async () => {
  try {
    console.log("真实十章测试：Electron 已就绪。");
    const report = await run();
    console.log(report.summary);
    console.log(`报告：${report.reportPath}`);
  } catch (error) {
    console.error("真实十章测试失败：", error);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});

async function run() {
  console.log("真实十章测试：检查 docx 文件。");
  for (const file of [SETTINGS_DOCX, OUTLINE_DOCX]) {
    if (!existsSync(file)) {
      throw new Error(`找不到文件：${file}`);
    }
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("safeStorage 不可用，无法读取本机加密保存的 API 密钥。");
  }

  console.log("真实十章测试：加载主进程模块。");
  const { extractDocxText } = await importWithLog("docx 解析", "../src/shared/domain/outline-document.ts");
  const { createDefaultProviderAdapters } = await importWithLog("模型适配器", "../src/main/ai/adapters/index.ts");
  const { AiGateway } = await importWithLog("AI 网关", "../src/main/ai/ai-gateway.ts");
  const { createDatabaseConnection } = await importWithLog("数据库连接", "../src/main/db/connection.ts");
  const { createRepositories, seedModelRoutingData } = await importWithLog("数据库仓库", "../src/main/db/service.ts");
  const { migrateDatabase } = await importWithLog("数据库迁移", "../src/main/db/migrate.ts");
  const { CredentialService } = await importWithLog("密钥服务", "../src/main/providers/credential-service.ts");
  const { RedactionService } = await importWithLog("脱敏服务", "../src/main/security/redaction-service.ts");
  const { SecretEncryptionService } = await importWithLog("加密服务", "../src/main/security/secret-encryption-service.ts");
  const { MultiDraftService } = await importWithLog("候选稿服务", "../src/main/workflows/multi-draft-service.ts");

  console.log("真实十章测试：解析 docx。");
  const settingsText = await extractDocxText(readFileSync(SETTINGS_DOCX));
  const outlineText = await extractDocxText(readFileSync(OUTLINE_DOCX));
  const chapterSpecs = parseFirstChapterSpecs(outlineText, 10);
  if (chapterSpecs.length < 10) {
    throw new Error(`只解析到 ${chapterSpecs.length} 个章节细纲，无法进行十章测试。`);
  }

  const dbPath = join(homedir(), "Library/Application Support/wenforge-studio/data/wenforge.sqlite");
  console.log(`真实十章测试：打开数据库 ${dbPath}`);
  const connection = createDatabaseConnection(dbPath);
  migrateDatabase(connection.sqlite);
  const repositories = createRepositories(connection.db);
  seedModelRoutingData(repositories);

  const credentialService = new CredentialService({
    repository: repositories.providerCredentials,
    encryption: new SecretEncryptionService(safeStorage),
    redaction: new RedactionService()
  });
  const aiGateway = new AiGateway({
    repositories,
    credentialService,
    adapters: createDefaultProviderAdapters()
  });
  const multiDraft = new MultiDraftService({ repositories, aiGateway });

  const credential = chooseCredential(repositories.providerCredentials.list());
  const profile = chooseProfile(repositories.modelProfiles.list(), credential.provider);
  console.log(`真实十章测试：使用 ${credential.provider}/${profile.model}`);
  const source = persistPlanningContext({
    repositories,
    settingsText,
    outlineText,
    chapterSpecs,
    targetWords: TARGET_WORDS
  });

  const results = [];
  let spent = 0;
  for (const chapter of source.chapters) {
    console.log(`真实十章测试：生成第 ${chapter.chapterIndex} 章 ${chapter.title}`);
    const remainingBudget = Math.max(0, BUDGET_CAP_USD - spent);
    if (remainingBudget <= 0) {
      results.push({
        chapterIndex: chapter.chapterIndex,
        title: chapter.title,
        status: "skipped",
        cost: 0,
        versionId: null,
        error: `预算上限 ${BUDGET_CAP_USD} USD 已达到`
      });
      continue;
    }

    const group = multiDraft.createGroup({
      chapterId: chapter.id,
      presetName: "真实测试：十章单稿",
      targetWords: TARGET_WORDS,
      userInstruction: "根据用户上传设定集与详细大纲生成正文，保存为非正式候选版本。"
    });
    const detail = await multiDraft.generateCandidates({
      groupId: group.id,
      executionMode: "provider",
      confirmed: true,
      budgetCapUsd: remainingBudget,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      candidates: [
        {
          provider: credential.provider,
          model: profile.model,
          modelProfileId: profile.id,
          displayName: profile.displayName,
          roleLabel: "主笔：按已确认细纲生成正文"
        }
      ]
    });
    const candidate = detail.candidates[0];
    const cost = candidate?.cost ?? 0;
    spent += cost;
    if (!candidate || candidate.status !== "succeeded") {
      results.push({
        chapterIndex: chapter.chapterIndex,
        title: chapter.title,
        status: candidate?.status ?? "failed",
        cost,
        versionId: null,
        error: candidate?.errorMessage ?? "未生成候选稿"
      });
      continue;
    }
    const version = multiDraft.saveCandidateAsVersion({
      candidateId: candidate.id,
      title: `真实测试稿：${chapter.title}`
    });
    results.push({
      chapterIndex: chapter.chapterIndex,
      title: chapter.title,
      status: "saved_noncanonical",
      cost,
      versionId: version.id,
      words: candidate.wordCount,
      llmRunId: candidate.llmRunId,
      sample: candidate.contentMarkdown.slice(0, 180)
    });
  }

  const reportPath = writeReport({
    dbPath,
    provider: credential.provider,
    model: profile.model,
    book: source.book,
    budgetCapUsd: BUDGET_CAP_USD,
    totalCost: spent,
    results
  });
  connection.sqlite.close();
  return {
    reportPath,
    summary: `真实十章测试完成：成功 ${results.filter((item) => item.status === "saved_noncanonical").length}/10，模型 ${credential.provider}/${profile.model}，记录成本 $${spent.toFixed(6)}`
  };
}

async function importWithLog(label, specifier) {
  console.log(`真实十章测试：加载 ${label}`);
  return import(specifier);
}

function chooseCredential(credentials) {
  const configured = credentials.filter((credential) => credential.isConfigured);
  const preferred =
    configured.find((credential) => credential.provider === "moonshot_kimi") ?? configured[0];
  if (!preferred) {
    throw new Error("没有可用的已配置模型密钥。");
  }
  return preferred;
}

function chooseProfile(profiles, provider) {
  const profile = profiles.find(
    (item) => item.provider === provider && item.enabled && item.alias === "kimi-k2.6"
  ) ?? profiles.find((item) => item.provider === provider && item.enabled);
  if (!profile) {
    throw new Error(`服务商 ${provider} 没有启用的模型配置。`);
  }
  return profile;
}

function persistPlanningContext({ repositories, settingsText, outlineText, chapterSpecs, targetWords }) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const project = repositories.projects.create({
    name: `真实测试：全民航海 ${timestamp}`,
    description: "由用户上传的设定集与详细大纲创建，用于真实十章生成测试。",
    genre: "全民航海求生 / 系统文 / 交易经营",
    targetReader: "喜欢快节奏升级、信息差交易、船只经营和文明争霸的男频读者"
  });
  const book = repositories.books.create({
    projectId: project.id,
    title: "全民航海：我的系统能看见隐藏词条",
    logline:
      "全民降临无尽海，江临靠隐藏词条从废品里看见未来，用淡水、船只升级与交易秩序建立不浪商会。",
    genre: "全民求生 · 航海升级 · 隐藏词条系统",
    targetLengthChapters: 350
  });
  const volume = repositories.volumes.create({
    bookId: book.id,
    title: "第一卷：别浪号起航",
    volumeIndex: 1,
    summary: "江临从破船求生起步，建立淡水优势、不浪互助会与商会雏形。"
  });
  const settingsSource = repositories.planning.createOutlineSource({
    projectId: project.id,
    bookId: book.id,
    sourceType: "file",
    title: "全民航海_详细设定集.docx",
    originalText: settingsText,
    parsedAt: new Date().toISOString(),
    parserModel: "local-docx"
  });
  repositories.planning.createOutlineSource({
    projectId: project.id,
    bookId: book.id,
    sourceType: "file",
    title: "全民航海_详细大纲.docx",
    originalText: outlineText,
    parsedAt: new Date().toISOString(),
    parserModel: "local-docx"
  });
  const outlineVersion = repositories.planning.createOutlineVersion({
    bookId: book.id,
    title: "用户上传详细大纲",
    contentJson: JSON.stringify({ first_10_chapters: chapterSpecs }, null, 2),
    contentMarkdown: chapterSpecs
      .map((chapter) => `第 ${chapter.index} 章：${chapter.title}\n${chapter.summary}\n钩子：${chapter.hook}`)
      .join("\n\n"),
    sourceId: settingsSource.id,
    isActive: true
  });
  repositories.planning.createMaterialDigest({
    bookId: book.id,
    outlineVersionId: outlineVersion.id,
    acceptedAt: new Date().toISOString(),
    sourceSummaryJson: JSON.stringify({
      settings_docx_chars: settingsText.length,
      outline_docx_chars: outlineText.length,
      source: "用户上传 docx"
    }),
    digestJson: JSON.stringify({
      book_premise:
        "全民降临无尽海，每人开局破船。江临能看见隐藏词条，靠信息差、淡水、图纸和交易秩序升级船只与文明。",
      genre: "全民航海求生 + 隐藏词条系统 + 交易经营 + 船只升级",
      target_reader: "免费阅读男频爽文读者",
      core_hook: "别人嫌弃的废品，在江临眼里是未来暴涨资产和升级路线。",
      style_constraints: ["简体中文", "快节奏", "稳健老六", "轻喜剧吐槽", "章末具体钩子"]
    }),
    missingInformationJson: "[]",
    ambiguityWarningsJson: "[]",
    warningsJson: "[]"
  });

  const globalNotes = settingsText.slice(0, 2400);
  const chapters = chapterSpecs.map((spec) => {
    const chapter = repositories.chapters.create({
      bookId: book.id,
      volumeId: volume.id,
      chapterIndex: spec.index,
      title: spec.title,
      targetWords,
      minWords: Math.max(800, targetWords - 300),
      maxWords: targetWords + 400,
      wordCountPriority: "normal",
      summary: spec.summary,
      outlineJson: JSON.stringify(spec)
    });
    repositories.planning.upsertChapterPlan({
      bookId: book.id,
      volumeId: volume.id,
      chapterId: chapter.id,
      outlineVersionId: outlineVersion.id,
      chapterIndex: spec.index,
      title: spec.title,
      targetWords,
      minWords: Math.max(800, targetWords - 300),
      maxWords: targetWords + 400,
      wordCountPriority: "normal",
      chapterSummary: spec.summary,
      chapterPromise: `推进“${spec.title}”的开局爽点，让读者看到江临的信息差优势。`,
      openingHook: spec.index === 1 ? "从破船醒来和系统宣告开场。" : "承接上一章钩子，用具体危机开场。",
      mainConflict: spec.summary,
      conflictEscalation: "生存压力、交易误判和频道舆论逐步升级。",
      keyEventsJson: JSON.stringify([spec.summary]),
      sceneCardsJson: JSON.stringify([
        `开场：${spec.title}`,
        `推进：${spec.summary}`,
        `章末：${spec.hook}`
      ]),
      emotionalTurn: "江临从观察风险转为主动利用信息差。",
      payoff: "读者看到隐藏词条或稳健交易带来的实际收益。",
      endingHook: spec.hook,
      continuityDependenciesJson: JSON.stringify([
        "江临：稳健老六、信息差交易流",
        "别浪号：开局破旧木船，逐步升级",
        "缺水潮：七日后到来，是前十章第一桶金核心压力"
      ]),
      charactersInvolvedJson: JSON.stringify(["江临", "区域频道玩家"]),
      storyBibleFactsUsedJson: JSON.stringify(["全民航海", "隐藏词条系统", "交易频道", "别浪号"]),
      foreshadowingSeededJson: JSON.stringify([spec.hook]),
      unresolvedHooksCarriedForwardJson: JSON.stringify([spec.hook]),
      userNotes: `参考设定集摘要：\n${globalNotes}`,
      riskNotes: "不要写成纯说明书；每章必须有行动、交易或危机推进。",
      status: "accepted",
      acceptedBy: "real-docx-test"
    });
    return chapter;
  });
  return { project, book, volume, chapters };
}

function parseFirstChapterSpecs(text, count) {
  const sectionStart = text.indexOf("第 001 章");
  const section = sectionStart >= 0 ? text.slice(sectionStart) : text;
  const regex =
    /第\s*0*(\d{1,3})\s*章[：:](.+?)\n剧情推进[：:](.+?)\n章尾钩子[：:](.+?)(?=\n第\s*0*\d{1,3}\s*章[：:]|$)/gs;
  const specs = [];
  for (const match of section.matchAll(regex)) {
    const index = Number(match[1]);
    if (index < 1 || index > count) continue;
    specs.push({
      index,
      title: match[2].trim(),
      summary: match[3].trim(),
      hook: match[4].trim()
    });
  }
  return specs.sort((a, b) => a.index - b.index).slice(0, count);
}

function writeReport({ dbPath, provider, model, book, budgetCapUsd, totalCost, results }) {
  const dir = join(process.cwd(), "reports");
  mkdirSync(dir, { recursive: true });
  const reportPath = join(dir, `real-ten-chapter-docx-test-${Date.now()}.md`);
  const lines = [
    "# 真实十章生成测试报告",
    "",
    `- 数据库：${dbPath}`,
    `- 书籍：${book.title}`,
    `- 模型：${provider}/${model}`,
    `- 预算上限：$${budgetCapUsd.toFixed(2)}`,
    `- 记录总成本：$${totalCost.toFixed(6)}`,
    `- 正式正文是否自动修改：否`,
    `- 故事圣经是否自动修改：否`,
    "",
    "## 章节结果",
    "",
    ...results.map((item) =>
      [
        `### 第 ${item.chapterIndex} 章：${item.title}`,
        `- 状态：${item.status}`,
        `- 成本：$${(item.cost ?? 0).toFixed(6)}`,
        item.versionId ? `- 非正式版本：${item.versionId}` : null,
        item.llmRunId ? `- llm_run：${item.llmRunId}` : null,
        item.words ? `- 字数估计：${item.words}` : null,
        item.error ? `- 错误：${item.error}` : null,
        item.sample ? `- 开头摘录：${item.sample.replace(/\n/g, " ").slice(0, 180)}` : null
      ]
        .filter(Boolean)
        .join("\n")
    )
  ];
  writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
  return reportPath;
}
