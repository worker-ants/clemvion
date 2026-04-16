import { redirect } from "next/navigation";
import { getDocsIndex } from "@/lib/docs/registry";
import { DOCS } from "@/lib/docs/links";

export default function DocsIndexPage() {
  const index = getDocsIndex();
  const first = index.sections[0]?.pages[0];
  redirect(first?.href ?? DOCS.fallbackRedirect);
}
