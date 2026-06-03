import {
  Globe,
  GitBranch,
  Zap,
  Database,
  Mail,
  Webhook,
  Plug,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

export const SERVICE_ICONS: Record<string, LucideIcon> = {
  google: Globe,
  github: GitBranch,
  http: Zap,
  database: Database,
  email: Mail,
  webhook: Webhook,
  mcp: Plug,
  cafe24: ShoppingBag,
  makeshop: ShoppingBag,
};

export function getServiceIcon(type: string): LucideIcon {
  return SERVICE_ICONS[type] ?? Zap;
}

export function ServiceIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const Comp = SERVICE_ICONS[type] ?? Zap;
  return <Comp className={className} />;
}

export function prettyAuthType(authType: string): string {
  const map: Record<string, string> = {
    oauth2: "OAuth 2.0",
    api_key: "API Key",
    bearer_token: "Bearer Token",
    basic: "Basic Auth",
    connection_string: "Connection",
    smtp: "SMTP",
    webhook_outbound: "Webhook Outbound",
    none: "No Auth",
  };
  return map[authType] ?? authType;
}
