STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===

### 발견사항

없음.

검토 대상 4개 파일은 모두 `codebase/frontend/src/lib/docs/__tests__/` 아래의 내부 가드/테스트 인프라 코드다:

- `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` (신규) — `plan/` 트리 스캔 + 라이프사이클 불변식(frontmatter 필수 필드, 완료 plan 의 종료 상태) 순수 함수 모음
- `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts` (신규) — 위 함수의 negative-path fixture 테스트
- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` (리팩터) — 실저장소 `plan/` 위에서 `plan-scan.ts`/`spec-links.ts` 를 호출하는 가드
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (리팩터) — `spec/**` + `plan/**` 상대링크 무결성 스캐너, `collectLivePlanMarkdown` 을 `plan-scan.ts` 로부터 재-export

`.claude/config/doc-sync-matrix.json` 의 `rows[]` 21건과 PROJECT.md §변경 유형 → 갱신 위치 매핑 표를 전수 대조했다:

- `codebase/backend/src/nodes/**` (new-node / node-schema-change) — 매칭 없음. 백엔드 노드 변경이 아니다.
- `codebase/frontend/src/**/*.tsx` (new-ui-string) — 매칭 없음. 변경 파일은 전부 `.ts`(비-TSX) 이고, 사용자에게 노출되는 UI 문자열이 아니라 CI 가드 내부의 진단 메시지/주석뿐이다.
- `codebase/frontend/src/content/docs/*/` (new-userguide-section-dir) — 매칭 없음. 경로가 `lib/docs/__tests__/` 이지 `content/docs/` 가 아니다. 신규 섹션 디렉토리 생성이 아니다.
- `codebase/frontend/src/content/docs/06-integrations-and-config/**.mdx` (integration-provider-change / userguide-gui-flow-section) — 매칭 없음.
- `codebase/backend/src/modules/auth/**` (auth-session-flow-change) — 매칭 없음.
- `codebase/packages/expression-engine/**` (expression-language-change) — 매칭 없음.
- backend 실행 엔진·디버그 로깅 (run-debug-flow-change), backend warningRules/`error-codes.ts` (new-warning-code/new-error-code) — 매칭 없음.
- `spec/{2,3,4,5}-**`, `spec/conventions/**` (spec-major-change) — 매칭 없음. `spec/` 변경 없음.

이 4개 파일이 다루는 도메인은 "plan lifecycle 불변식 가드"(worktree/started/owner frontmatter, 완료 plan 의 종료 status, plan 내 상대링크 무결성)로, 제품의 사용자 가시 기능·노드·i18n·통합·문서와 무관한 저장소 내부 CI 툴링이다. `.claude/docs/plan-lifecycle.md` 는 이미 SoT 로 존재하며(코드 주석이 그 문서를 명시적으로 참조), 이번 변경은 그 SoT 를 강제하는 가드 구현을 정리(walker 중복 제거 + fixture 보강)한 것으로 유저 가이드(`content/docs/`)·dict·backend-labels 어느 target 도 건드릴 필요가 없다.

### 요약
매트릭스 21개 trigger 를 전수 대조했으나 매칭된 항목이 없다(0/21). 변경 4개 파일은 모두 `codebase/frontend/src/lib/docs/__tests__/` 아래 plan-lifecycle 내부 가드/테스트 인프라(TS, 비-TSX)로 사용자 가이드·i18n dict·backend-labels·섹션 로케일 어느 target 도 트리거하지 않는다. 동반 갱신 누락 0건.

### 위험도
NONE
