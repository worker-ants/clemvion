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
};
