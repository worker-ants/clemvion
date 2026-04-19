import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { DocsSearch } from "@/components/docs/docs-search";
import { buildSearchIndex, getDocsIndex } from "@/lib/docs/registry";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const index = getDocsIndex();
  const searchEntries = buildSearchIndex(index);
  return (
    <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 lg:px-8">
      <aside className="hidden w-60 shrink-0 lg:block">
        {/* Sidebar has its own scroll viewport so the TOC does not scroll
            with the article. Search stays pinned at the top of the column;
            the nav underneath fills the remaining height. */}
        <div className="sticky top-6 flex h-[calc(100vh-3rem)] flex-col gap-4">
          <DocsSearch entries={searchEntries} />
          <div className="-mr-2 flex-1 overflow-y-auto pr-2">
            <DocsSidebar sections={index.sections} />
          </div>
        </div>
      </aside>
      <article className="docs-prose min-w-0 flex-1">{children}</article>
    </div>
  );
}
