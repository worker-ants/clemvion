/** Single source of truth for the locale cookie name. Shared between the
 *  client store (where it's written to `document.cookie`) and the server
 *  reader (where it's read via `next/headers`). Kept in a standalone module
 *  so the client bundle does not pick up `next/headers`. */
export const LOCALE_COOKIE_NAME = "idea-workflow.locale";
