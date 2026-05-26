import type { JSX } from "react";
import React from "react";

import type { ModelRouteResolution } from "@contracts/model-routing";

export function ModelRouteCard({
  routeResolution
}: {
  routeResolution: ModelRouteResolution | null;
}): JSX.Element {
  return (
    <section className="rounded-lg border border-white/10 bg-graphite-900/60 p-4">
      <h3 className="text-sm font-semibold text-white">模型路线</h3>
      {routeResolution ? (
        <div className="mt-3 space-y-2 text-sm">
          <p className="text-slate-300">
            {routeResolution.modelProfile?.displayName ?? "无可用路线"}
          </p>
          <p className="text-xs text-slate-500">
            起草正文 / 均衡 · {routeResolution.available ? "就绪" : "待配置"}
          </p>
          {[...routeResolution.warnings, ...routeResolution.errors].slice(0, 3).map((message) => (
            <p
              className="rounded-lg border border-forge-amber/25 bg-forge-amber/10 px-3 py-2 text-xs text-forge-amber"
              key={message}
            >
              {message}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">未加载路线。</p>
      )}
    </section>
  );
}
