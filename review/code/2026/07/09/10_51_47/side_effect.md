# 부작용(Side Effect) Review — 슬러그 라우팅 하드닝 B (PR #865 후속)

## 발견사항

- **[INFO]** `isSafeRedirectPath` 판정 강화로 redirect 대상 분류가 엄격해짐 (의도된 변경)
  - 위치: `codebase/frontend/src/components/ui/error-page.tsx` (`isSafeRedirectPath` → `isSafeInternalPath` 위임)
  - 상세: 기존 구현은 `pathname.startsWith("/") && !pathname.startsWith("//")` 만 검사해 `/\evil.com`, `/\t/evil.com` 같은 백슬래시·제어문자 우회 경로를 "안전"으로 오판했다. 변경 후에는 `toSafeInternalPath(pathname) === pathname` 동치 검사로 바뀌어 그런 입력은 이제 안전하지 않다고 판정되고, `ErrorPage` 의 `redirectTarget` 은 `DASHBOARD_PATH` 로 폴백된다. 이는 공개 함수(`isSafeRedirectPath`)의 **동작(behavior) 변경**이며, 극히 드물게라도 백슬래시/탭 문자가 포함된 실제 경로에 의존하던 흐름이 있었다면 로그인 후 복귀 target 이 대시보드로 바뀐다.
  - 제안: 커밋 메시지·docstring 에 의도가 명확히 문서화되어 있고 방향이 open-redirect 방어 강화(보안 개선)이므로 별도 조치 불요. 참고용으로만 표시.

- **[INFO]** 실행경로(execution href) 3곳의 실제 네비게이션 목적지 변경 (의도된 버그 수정)
  - 위치: `dashboard/page.tsx` (recent executions row-click), `workflows/[id]/executions/page.tsx` (row-click), `workflows/[id]/executions/[executionId]/page.tsx` (prev/next 버튼)
  - 상세: 기존 코드는 `router.push(\`/workflows/${id}/executions/${executionId}\`)` 형태로 slug 없는 절대경로를 생성했다(3곳 모두 "latent broken-link"로 plan 에 명시). `buildExecutionHref(slug, ...)` 로 교체되며 이제 `/w/<slug>/workflows/...` 형태로 실제 push 되는 URL 이 달라진다. `(main)/[...rest]` catch-all 이 slug 없는 경로를 흡수해 최종 목적지는 동일했겠지만, 클라이언트 사이드 네비게이션 경로(추가 리다이렉트/렌더 사이클)가 변한다.
  - 제안: PR 설명·plan 에 "3곳 slug 누락 회귀 수정"으로 명확히 기록돼 있고 unit test(`href.test.ts`, `no-raw-execution-href.test.ts`)로 커버됨. 문제 없음 — side-effect 관점에서는 "의도치 않은" 변경이 아니라 문서화된 의도적 수정임을 확인.

- **[INFO]** 신규 guard 테스트가 매 실행마다 `src/` 트리 전체를 동기 `fs.readFileSync` 로 스캔
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/no-raw-execution-href.test.ts`
  - 상세: 파일시스템 부작용은 read-only 이며 상태를 변경하지 않으나, 리뷰 관점(파일시스템 부작용) 체크리스트 상 기록해 둔다. 소스 텍스트 정규식 검사이므로 소스 파일이 늘어날수록 테스트 시간이 소폭 증가할 수 있다(기능적 문제 아님).
  - 제안: 조치 불요 (guard 테스트로서 표준적인 패턴).

- **[INFO]** `WorkspaceSummary`/`WorkspaceRole` 타입 위치 이동 + re-export (인터페이스 표면 유지)
  - 위치: `codebase/frontend/src/lib/stores/workspace-store.ts`, `codebase/frontend/src/lib/workspace/types.ts`, `resolve-fallback.ts`
  - 상세: 타입 정의 자체를 `lib/workspace/types.ts` 로 옮기고 `workspace-store.ts` 는 `export type { WorkspaceRole, WorkspaceSummary } from "@/lib/workspace/types"` 로 재노출한다. 인터페이스(타입)이므로 런타임 값이 없고, 컴파일 타임에만 존재해 16개 기존 importer 의 `import type`/일반 import 는 그대로 동작한다. 런타임 부작용·시그니처 변경 없음 — 구조적 순환 참조 제거 목적의 순수 리팩터로 확인.

- **[INFO]** `buildExecutionHref` 신규 함수 — 순수 추가(additive), 기존 시그니처 영향 없음
  - 위치: `codebase/frontend/src/lib/workspace/href.ts`
  - 상세: 완전히 새 export 이며 기존 `buildWorkspaceHref` 시그니처·동작은 변경 없음(내부 정규화 로직을 `safe-path.ts` 로 위임했을 뿐, `href.test.ts` 의 기존 assertion 은 그대로 유지되어 회귀 없음 확인). 전역 변수·환경 변수·네트워크 호출 없음.

## 요약

이번 diff 는 실행경로 조립을 `buildExecutionHref` 헬퍼로 단일화하고, open-redirect 방어 정규화를 `safe-path.ts` 로 공용화하며, `WorkspaceSummary`/`WorkspaceRole` 타입을 별도 모듈로 분리하는 순수 FE 리팩터다. 전역 상태·환경 변수·네트워크 호출·파일시스템 쓰기 등 고전적 부작용은 발견되지 않았다. 유일하게 주목할 부분은 (1) `isSafeRedirectPath` 가 이전보다 더 많은 입력을 "unsafe" 로 판정하게 되어 일부 edge-case redirect 목적지가 달라지는 점과 (2) 3곳의 실행경로 네비게이션이 이제 slug 를 포함한 다른 URL 로 push 되는 점인데, 둘 다 커밋 메시지·plan 문서에 "의도된 하드닝/버그 수정"으로 명시돼 있고 대응 unit test 로 커버되어 있어 문제로 분류하지 않는다. 타입 이동(B-4)은 re-export 로 하위호환을 유지해 16개 importer 에 시그니처/런타임 영향이 없음을 확인했다.

## 위험도

NONE
