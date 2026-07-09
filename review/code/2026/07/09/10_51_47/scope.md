# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** B-2 리팩터에 latent 버그 픽스 3건이 함께 번들됨
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/dashboard/page.tsx` (recent-executions row-click), `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/page.tsx` (row-click), `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/[executionId]/page.tsx` (prev/next 네비게이션)
  - 상세: "실행경로 리터럴 15곳을 `buildExecutionHref` 로 통합"이라는 순수 리팩터 작업 도중, 그중 3곳은 slug 를 붙이지 않는 latent broken-link 버그였던 것으로 드러나 동일 커밋에서 함께 수정됨. 순수 리팩터(동작 무변경) 커밋에 실질적 동작 변경(버그 수정)이 섞인 형태.
  - 제안: 코드 변경 자체는 타당하고 커밋 메시지("3곳은 slug 누락 latent broken-link 였음")·plan 문서(B-2 항목 설명)에 명시적으로 기록되어 있어 은폐된 스코프 확장은 아님. 액션 불요 — 문서화가 되어 있으므로 그대로 두되, 참고용으로만 기록.

- **[INFO]** 없음 그 외 — 전 파일이 선언된 4개 항목(B-1/B-2/B-3/B-4)에 정확히 대응

## 점검 결과 상세

전체 18개 변경 파일을 plan 문서(`plan/in-progress/slug-routing-hardening.md`)의 4개 선언 항목과 1:1 대조한 결과:

- **B-2 (`buildExecutionHref` 헬퍼 도입, 실행경로 리터럴 통합)**: `dashboard/page.tsx`, `workflows/[id]/executions/page.tsx`, `workflows/[id]/executions/[executionId]/page.tsx`, `workflows/page.tsx`, `execution-history-panel.tsx`, `run-results-drawer.tsx`, `rerun-modal.tsx`, `trigger-history-dialog.tsx`, `lib/workspace/href.ts`(헬퍼 본체), `lib/workspace/__tests__/href.test.ts`(신규 테스트) — 전부 `buildWorkspaceHref(slug, \`/workflows/...\`)` 리터럴 조합을 `buildExecutionHref(slug, workflowId, executionId?)` 호출로 교체하는 동일 패턴. 무관한 로직 변경 없음.
- **B-1 (raw 리터럴 금지 guard)**: `lib/workspace/__tests__/no-raw-execution-href.test.ts` 신규 — 소스 텍스트 스캔 가드만 추가, 범위 외 로직 없음.
- **B-3 (safe-path 공용 정규화)**: `lib/workspace/safe-path.ts`(신규) + `lib/workspace/href.ts`(정규화 로직 위임) + `components/ui/error-page.tsx`(`isSafeRedirectPath` 를 공용 함수로 위임) + `lib/workspace/__tests__/safe-path.test.ts`(신규 테스트). 로직 이동만 있고 동작 변경 없음(정규화 규칙 동일 유지, 오히려 두 곳이 별도 구현이던 것을 하나로 합쳐 갭 강화).
- **B-4 (WorkspaceSummary/WorkspaceRole 타입 이동)**: `lib/workspace/types.ts`(신규) + `lib/stores/workspace-store.ts`(타입 정의 제거·re-export 로 대체) + `lib/workspace/resolve-fallback.ts`(import 경로만 변경). 16개 소비처는 `workspace-store` re-export 덕에 무변경 — 커밋 메시지·plan 문서 설명과 일치, 실제로 diff 에도 그 16곳에 대한 변경은 없음(범위 확장 없음 확인).
- `plan/in-progress/slug-routing-hardening.md`: 이번 작업 자체의 plan 추적 문서 신규 생성 — 워크플로 규약상 정당.

무관한 파일·기능 확장·불필요 리팩터·의미 없는 포맷팅·주석 churn·미사용 임포트·설정 파일 변경은 발견되지 않았다. 주석 변경은 전부 구조 변경(순환 제거·safe-path 공유·헬퍼 도입)을 설명하는 목적 부합 갱신이었다. ESLint 설정 변경은 없음 — 커밋 메시지가 명시한 대로 "AST 매칭 취약성 회피" 사유로 lint rule 대신 소스 텍스트 guard 테스트를 택한 결정이 실제로 지켜짐(별도 `.eslintrc` 등 diff 없음).

## 요약

18개 변경 파일 전부가 plan 문서에 사전 선언된 B-1~B-4 네 항목에 정확히 매핑되며, 각 항목의 실제 diff 도 해당 항목의 목적(실행경로 헬퍼 통합·raw 리터럴 guard·safe-path 공유·타입 순환 제거)을 벗어나지 않는다. B-2 리팩터 도중 발견된 3건의 latent broken-link 버그 수정이 동일 커밋에 섞여 있으나, 커밋 메시지와 plan 문서 양쪽에 명시적으로 기록되어 있어 은폐된 스코프 확장이 아니다. 무관한 파일 수정, 과잉 리팩터링, 기능 확장(over-engineering), 의미 없는 포맷팅/주석/임포트/설정 변경은 발견되지 않았다.

## 위험도

NONE
