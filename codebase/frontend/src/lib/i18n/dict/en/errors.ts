import type { Dict } from "../types";

export const errors: Dict["errors"] = {
  generic: "Something went wrong",
  network: "Network error",
  unauthorized: "Sign in required",
  forbidden: "You don't have permission",
  notFound: "Not found",
  validation: "Please check your input",
  server: "Server error",
  unknown: "An unknown error occurred",
  codes: {
    notAMember: "You are not a member of this workspace.",
    workspaceNotFound: "Workspace not found.",
    editorRequired: "Editor role or higher is required.",
    adminRequired: "Admin role or higher is required.",
    ownerRequired: "Owner role is required.",
    sessionNotFound: "Session not found. Refresh the list.",
    currentSessionRequired:
      "The current session cannot be identified. Sign in again and retry.",
    reauthRequired:
      "Enter your password or two-factor authentication code to continue.",
    totpNotEnabled:
      "Two-factor authentication is not enabled for this account. Sign in again.",
    challengeMethodMismatch:
      "This request is for a different authentication method. Sign in again from the start.",
    webauthnDisabled:
      "Passkeys and security keys are turned off on this server. Contact your administrator.",
    webauthnNotRegistered: "No Passkey or security key is registered.",
    webauthnCounterRegression:
      "An abnormal signal was detected from the authenticator, so it was removed. Register it again.",
    invalidOptionsToken:
      "The authentication request expired or is invalid. Try again.",
    serviceUnavailable:
      "The service is temporarily unavailable. Try again in a moment.",
  },
};
