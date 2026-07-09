/**
 * 워크스페이스 공용 타입. `workspace-store` 에서 분리해 `resolve-fallback` 등 하위 유틸이
 * store 를 import 하지 않고도 타입을 참조하게 한다 — store ↔ util 순환 참조를 구조적으로 제거.
 * `workspace-store` 는 하위호환을 위해 이 타입들을 그대로 re-export 한다.
 */
export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

export interface WorkspaceSummary {
  id: string;
  name: string;
  type: "personal" | "team";
  slug: string;
  role: WorkspaceRole;
}
