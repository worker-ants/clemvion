import type { Dict } from "../types";

export const invitations: Dict["invitations"] = {
  title: "Invitations",
  accept: {
    title: "Workspace invitation",
    message: "You've been invited to '{{workspace}}'",
    accept: "Accept",
    decline: "Decline",
    accepted: "Invitation accepted",
    declined: "Invitation declined",
    acceptFailed: "Failed to accept invitation",
    declineFailed: "Failed to decline invitation",
    invalid: "Invalid invitation link",
    expired: "Invitation expired",
    alreadyMember: "You're already a member of this workspace",
    joined: "Joined the workspace.",
    acceptFailedDefault: "Failed to accept invitation.",
    statusAccepting: "Verifying your invitation…",
    statusSuccess: "Joined the workspace!",
    statusError: "Failed to accept invitation",
    statusMissing: "No invitation token found",
    missingHint: "Please use the link exactly as it appears in your invitation email.",
    goDashboard: "Go to Dashboard",
    redirectingDashboard: "Redirecting to the dashboard…",
  },
};
