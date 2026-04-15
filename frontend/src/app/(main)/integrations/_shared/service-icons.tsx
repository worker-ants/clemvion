import {
  Globe,
  GitBranch,
  Zap,
  Database,
  Mail,
  Webhook,
  type LucideIcon,
} from "lucide-react";

export const SERVICE_ICONS: Record<string, LucideIcon> = {
  google: Globe,
  github: GitBranch,
  http: Zap,
  database: Database,
  email: Mail,
  webhook: Webhook,
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
  };
  return map[authType] ?? authType;
}
