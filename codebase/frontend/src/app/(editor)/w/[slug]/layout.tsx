import { WorkspaceSlugGate } from "@/lib/workspace/workspace-slug-gate";

/**
 * `(editor)/w/[slug]/...` 워크스페이스 컨텍스트 layout (에디터 chrome).
 *
 * slug 해소·reconcile(URL 우선)·무효-slug redirect·정합 전 gate 는 공용
 * `<WorkspaceSlugGate>` 가 담당한다((main)/w/[slug] 와 공유). `EditorContent` 풀스크린
 * chrome 은 상위 `(editor)/layout.tsx`(AuthProvider+Sidebar+EditorContent) 에서 상속한다.
 *
 * 슬러그 라우팅 phase 2: 에디터 캔버스(`/workflows/[id]`)를 `/w/<slug>/workflows/<id>` 로 편입.
 */
export default function EditorWorkspaceSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceSlugGate>{children}</WorkspaceSlugGate>;
}
