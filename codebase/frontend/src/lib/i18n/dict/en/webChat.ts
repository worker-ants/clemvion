import type { Dict } from "../types";

export const webChat: Dict["webChat"] = {
  title: "Web Chat",
  description:
    "Create an embeddable web chat widget, style it, grab the install script for your site, and preview it",
  create: "New web chat",
  empty: {
    title: "No web chats yet",
    description:
      "Create a web chat linked to a workflow and install it on your site",
  },
  list: {
    workflowLabel: "Workflow",
    manage: "Manage",
    active: "Active",
    inactive: "Inactive",
    loadError: "Failed to load web chats",
  },
  createDialog: {
    title: "New web chat",
    workflowLabel: "Workflow",
    workflowPlaceholder: "Select a workflow to link",
    noWorkflows: "Create a workflow first",
    nameLabel: "Name",
    namePlaceholder: "e.g. Support bot",
    submit: "Create",
    cancel: "Cancel",
    success: "Web chat created",
    error: "Failed to create web chat",
  },
  appearance: {
    title: "Appearance & content",
    note: "These settings are baked into the install script (not stored on the server)",
    primaryColor: "Primary color",
    position: "Position",
    positionBottomRight: "Bottom right",
    positionBottomLeft: "Bottom left",
    headerTitle: "Bot name",
    headerTitlePlaceholder: "e.g. AI Assistant",
    welcomeText: "Welcome message",
    welcomeTextPlaceholder: "e.g. Hi! How can I help you?",
    suggestions: "Suggested questions",
    suggestionsHint: "One per line",
    disclaimer: "Disclaimer",
    disclaimerPlaceholder: "e.g. AI responses are based on limited data",
  },
  snippet: {
    title: "Install script",
    description: "Paste this script right before </body> on your site",
    copy: "Copy",
    copied: "Install script copied",
    copyError: "Failed to copy",
  },
  preview: {
    title: "Live preview",
    unavailable:
      "Live preview becomes available once the widget bundle is co-deployed",
  },
};
