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
    passwordInvalid: "The password is incorrect.",
    totpInvalid: "The verification code is incorrect.",
    sessionNotFound: "Session not found. Refresh the list.",
    cannotRevokeCurrentSession:
      "Use the sign-out button to end your current session.",
    reauthNotAvailable:
      "Set a password or enable 2FA before performing this action.",
    currentSessionRequired:
      "The current session cannot be identified. Sign in again and retry.",
    reauthRequired:
      "Enter your password or two-factor authentication code to continue.",
    totpNotEnabled:
      "Two-factor authentication is not enabled for this account. Sign in again.",
    webauthnRequired: "Authenticate with your Passkey or security key.",
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
    rateLimited: "Too many requests. Please try again in a moment.",
    userNotFound: "The account was not found.",
    totpAlreadyEnabled: "Two-factor authentication is already enabled.",
    recoveryCodeInvalid: "The recovery code is incorrect or already used.",
    challengeInvalid:
      "The sign-in request expired or is invalid. Sign in again from the start.",
    oauthConfigMissing:
      "OAuth is not configured for this service on the server. Contact your administrator.",
    internalError: "A server error occurred. Try again in a moment.",
    workspaceNameInvalid: "Workspace name must be at least 2 characters.",
    cannotAssignOwner: "The owner role cannot be assigned directly.",
    alreadyAMember: "The user is already a member of this workspace.",
    ownerRoleProtected:
      "The owner role can only change through ownership transfer.",
    memberNotFound: "Member not found. Refresh the list.",
    cannotRemoveOwner: "The owner cannot be removed.",
    invalidTimezone: "The time zone is not valid.",
    cannotDeletePersonal: "A personal workspace cannot be deleted.",
    cannotLeavePersonal: "You cannot leave a personal workspace.",
    soleOwnerCannotLeave:
      "The only owner cannot leave. Make another member the owner or delete the workspace.",
    cannotTransferPersonal:
      "Ownership of a personal workspace cannot be transferred.",
    targetIsSelf: "You cannot make yourself the new owner.",
    targetAlreadyOwner: "The member is already the owner.",
    workspaceTypeMismatch:
      "This action is not available for this workspace type.",
    passwordNotSet:
      "This account has no password. Set one first with password reset.",
    invitationNotFound: "Invitation not found. Check the link again.",
    invitationTeamOnly: "Invitations are only available in team workspaces.",
    invitationAlreadyPending:
      "An invitation to this email was sent at the same time. Try again in a moment.",
    invitationAlreadyAccepted: "This invitation has already been accepted.",
    invitationEmailMismatch:
      "The invitation email does not match the signed-in email.",
    invitationAlreadyUsed: "This invitation has already been used.",
    invitationExpired:
      "This invitation has expired. Ask the inviter to send a new one.",
  },
};
