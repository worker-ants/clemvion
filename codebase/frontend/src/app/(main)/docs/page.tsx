import { redirect } from "next/navigation";
import { getDocsIndex } from "@/lib/docs/registry";
import { localizedDocsHref } from "@/lib/docs/locale";
import { DOCS } from "@/lib/docs/links";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { readLocaleCookie } from "@/lib/i18n/server-locale";

export default async function DocsIndexPage() {
  const index = getDocsIndex();
  const first = index.sections[0]?.pages[0];
  if (!first) redirect(DOCS.fallbackRedirect);
  const locale = (await readLocaleCookie()) ?? DEFAULT_LOCALE;
  redirect(localizedDocsHref(first.slug, locale));
}
