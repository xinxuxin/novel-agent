export interface PrivacySettings {
  storeFullPrompts: boolean;
  storeFullResponses: boolean;
  storeManuscriptsInLogs: boolean;
  allowSendingFullRecentChapters: boolean;
  recentChapterCount: number;
  maxContextTokenBudget: number;
  enableDebugLogging: boolean;
}

export interface RoutingSettings {
  priceStaleAfterDays: number;
  missingPriceBehavior: "warn" | "block";
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  storeFullPrompts: false,
  storeFullResponses: false,
  storeManuscriptsInLogs: false,
  allowSendingFullRecentChapters: false,
  recentChapterCount: 3,
  maxContextTokenBudget: 120000,
  enableDebugLogging: false
};

export const DEFAULT_ROUTING_SETTINGS: RoutingSettings = {
  priceStaleAfterDays: 90,
  missingPriceBehavior: "warn"
};
