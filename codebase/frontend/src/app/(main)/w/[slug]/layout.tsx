import { WorkspaceSlugGate } from "@/lib/workspace/workspace-slug-gate";

/**
 * `/w/[slug]/...` 워크스페이스 컨텍스트 layout ((main) chrome).
 *
 * slug 해소·reconcile(URL 우선)·무효-slug redirect·정합 전 gate 는 공용
 * `<WorkspaceSlugGate>` 가 담당한다((editor)/w/[slug] 와 공유). 사이드바·`MainContent`
 * chrome 은 상위 `(main)/layout.tsx` 에서 상속한다.
 */
export default function WorkspaceSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceSlugGate>{children}</WorkspaceSlugGate>;
}
