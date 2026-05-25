import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@components/StatusBadge";
import { credentialDisplayFields } from "@features/settings/credential-display";

describe("renderer component smoke tests", () => {
  it("renders status badges with visible text labels", () => {
    const markup = renderToStaticMarkup(createElement(StatusBadge, { status: "drafting" }));

    expect(markup).toContain("Drafting");
    expect(markup).toContain("aria-label");
  });

  it("does not expose decrypted credential fields to the settings UI", () => {
    const fields = credentialDisplayFields({
      id: "cred_1",
      provider: "openai",
      displayName: "OpenAI",
      baseUrl: null,
      isConfigured: true,
      redactedKeyLabel: "sk-...1234",
      lastTestedAt: null,
      lastStatus: "configured",
      createdAt: "2026-05-25T00:00:00.000Z",
      updatedAt: "2026-05-25T00:00:00.000Z"
    });

    expect(JSON.stringify(fields)).not.toContain("apiKey");
    expect(JSON.stringify(fields)).not.toContain("encrypted");
    expect(fields.keyLabel).toBe("sk-...1234");
  });
});
