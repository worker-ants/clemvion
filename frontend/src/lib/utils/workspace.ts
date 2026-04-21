import type { TranslationKey } from "@/lib/i18n";
import type { WorkspaceRole } from "@/lib/stores/workspace-store";

/**
 * Map a workspace role to its i18n label key. Single source of truth so that
 * role additions or renames only need to touch this file.
 */
export function roleLabelKey(role: WorkspaceRole): TranslationKey {
  switch (role) {
    case "owner":
      return "workspace.roleOwner";
    case "admin":
      return "workspace.roleAdmin";
    case "editor":
      return "workspace.roleMember";
    case "viewer":
      return "workspace.roleViewer";
  }
}
