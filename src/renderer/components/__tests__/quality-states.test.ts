import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { QualityStatePanel } from "@components/QualityStatePanel";
import { getQualityStateAction, redactRenderableText } from "@components/quality-state-model";

describe("quality state panels", () => {
  it("routes provider and price setup states to settings", () => {
    expect(getQualityStateAction("no_provider_configured").targetView).toBe("settings");
    expect(getQualityStateAction("missing_price").targetView).toBe("settings");
    expect(getQualityStateAction("stale_price").targetView).toBe("settings");
  });

  it("redacts key-like text before rendering", () => {
    expect(redactRenderableText("provider failed with sk-secret-1234567890")).not.toContain(
      "sk-secret"
    );
  });

  it("renders accessible state text without leaking secrets", () => {
    const markup = renderToStaticMarkup(
      createElement(QualityStatePanel, {
        state: "no_provider_configured",
        detail: "Missing key sk-secret-1234567890",
        onPrimaryAction: () => undefined
      })
    );

    expect(markup).toContain("No provider configured");
    expect(markup).toContain("aria-label");
    expect(markup).not.toContain("sk-secret");
  });
});
