export type ImplAnchorKind =
  | "ui-entry"
  | "component"
  | "api-endpoint"
  | "e2e-scenario";

export interface ImplAnchorProps {
  kind: ImplAnchorKind;
  file: string;
  symbol: string;
  describes: string;
}

export function ImplAnchor(_props: ImplAnchorProps) {
  return null;
}
