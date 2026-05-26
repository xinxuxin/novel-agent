export interface ContentSecurityPolicyOptions {
  dev: boolean;
}

export interface ContentSecurityPolicy {
  headerValue: string;
  rationale: string;
}

export function buildContentSecurityPolicy({
  dev
}: ContentSecurityPolicyOptions): ContentSecurityPolicy {
  const connectSources = dev
    ? ["'self'", "http://localhost:*", "http://127.0.0.1:*", "ws://localhost:*", "ws://127.0.0.1:*"]
    : ["'self'"];
  const directives = [
    ["default-src", "'self'"],
    ["script-src", "'self'"],
    ["style-src", "'self'", "'unsafe-inline'"],
    ["img-src", "'self'", "data:"],
    ["font-src", "'self'", "data:"],
    ["connect-src", ...connectSources],
    ["object-src", "'none'"],
    ["base-uri", "'none'"],
    ["frame-ancestors", "'none'"],
    ["form-action", "'none'"]
  ];

  return {
    headerValue: directives.map(([name, ...values]) => `${name} ${values.join(" ")}`).join("; "),
    rationale:
      "Tailwind and Vite inject style attributes during development; style-src keeps unsafe-inline while script-src forbids unsafe-eval."
  };
}

export const CSP_HEADER_NAME = "Content-Security-Policy";
