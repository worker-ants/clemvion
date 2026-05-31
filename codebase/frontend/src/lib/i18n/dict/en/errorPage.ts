import type { Dict } from "../types";

export const errorPage: Dict["errorPage"] = {
  sessionExpired: {
    title: "Your session has expired",
    description: "You were signed out automatically for security. Please sign in again.",
    cta: "Sign in again",
  },
  forbidden: {
    title: "Access denied",
    description: "You don't have permission to access this page. Contact your workspace admin.",
    cta: "Go to dashboard",
  },
  notFound: {
    title: "Page not found",
    description: "The page you requested doesn't exist or has been moved.",
    cta: "Go to dashboard",
  },
  server: {
    title: "Something went wrong",
    description: "An unexpected server error occurred. Please try again in a moment.",
    retry: "Try again",
    dashboard: "Go to dashboard",
  },
  network: {
    title: "Can't connect to the network",
    description: "Check your internet connection and try again.",
    retry: "Try again",
  },
};
