import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { getDocsIndex } from "@/lib/docs/registry";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const index = getDocsIndex();
  return (
    <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 lg:px-8">
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-6">
          <DocsSidebar sections={index.sections} />
        </div>
      </aside>
      <article className="docs-prose min-w-0 flex-1">{children}</article>
    </div>
  );
}
