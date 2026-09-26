# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

- **[INFO]** `backend-api-change` trigger 가 glob 으로 매칭되나 semantic 판단 결과 갱신 불필요(그레이존 해소, 결함 아님)
  - 변경 파일: `codebase/backend/src/modules/auth/auth.controller.ts`, `codebase/backend/src/modules/executions/executions.controller.ts`, `codebase/backend/src/modules/integrations/integrations.controller.ts`, `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts`, `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (+ 신규 `codebase/backend/src/common/swagger/forbidden-descriptions.ts` 헬퍼, spec 테스트)
  - 매트릭스 항목: `backend-api-change`(`.claude/config/doc-sync-matrix.json` id=`backend-api-change`) — trigger glob `codebase/backend/src/**/*.controller.ts`, match=`semantic`. targets: "(a) controller·DTO 의 swagger jsdoc / (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" (PROJECT.md 169행 동일)
  - 판단: 이번 변경은 기존 403 `@ApiForbiddenResponse` **설명 문장의 이음 구두점**(`, 또는` → ` 또는 `)만 공용 헬퍼 `forbiddenWithService`로 통일한 순수 텍스트 리팩터다. `plan/in-progress/forbidden-helper-sentences.md` 및 `CHANGELOG.md` 신규 항목이 명시하듯 "응답 자체(상태·본문·코드)는 그대로이고 **문서의 설명 문장**만 바뀐다" — 새 엔드포인트·새 응답 스키마·권한 로직 변경 없음. target (a)는 이 변경 자체가 곧 그 작업(swagger jsdoc 갱신)이라 이미 충족. target (b)("API 노출 변경")는 실질적 노출 변경이 없어 해당 사항 없음 — user-guide MDX 갱신 불필요로 판단
  - 상세: glob 은 파일 확장자 패턴만 보므로 걸렸지만, `match:"semantic"` 이 요구하는 "실제 API 계약/노출 변경인가"는 아니다. 오탐 방지 차원의 기록
  - 제안: 조치 불요. 참고로 이 PR 은 스스로 `spec_impact: none` 을 선언했고 `--impl-prep`(`review/consistency/2026/09/26/15_08_57`)도 BLOCK:NO 로 통과함

- **[INFO]** `auth-session-flow-change` trigger 도 경로만 매칭, semantic 판단상 실질 흐름 변경 아님
  - 변경 파일: `codebase/backend/src/modules/auth/auth.controller.ts`
  - 매트릭스 항목: `auth-session-flow-change`(id) — trigger glob `codebase/backend/src/modules/auth/**`, match=`semantic`. targets: "`codebase/frontend/src/content/docs/07-workspace-and-team/` 의 관련 페이지 + e2e"
  - 판단: 유일한 변경은 `switchWorkspace` 라우트의 `@ApiForbiddenResponse({ description: ... })` 인라인 문자열을 기존 공용 상수 `FORBIDDEN_NOT_A_MEMBER` 로 교체한 것(줄 443-446 부근, diff 게이트 기준). 인증·권한·세션 판정 로직, 미들웨어, 가드 자체는 전혀 바뀌지 않았다 — 문자열 SoT 를 상수로 옮긴 것뿐이라 `07-workspace-and-team/` 문서나 e2e 보강 대상이 아니라고 판단
  - 상세: 오탐 방지 기록
  - 제안: 조치 불요

## 검토 절차 요약

`.claude/config/doc-sync-matrix.json`(rows 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(155-183행)을 SSOT 로 적재. 변경 set(코드 8개 backend 파일 + CHANGELOG + plan 문서 3개 + 이전 consistency-check 산출물 8개)을 전수 확인한 결과:

- `codebase/backend/src/nodes/**` 변경 없음 → 새 노드 추가/노드 schema 변경 trigger 없음
- `codebase/frontend/src/**/*.tsx` 변경 없음 → 신규 UI 문자열 i18n parity trigger 없음
- `codebase/channel-web-chat/**` 변경 없음 → 위젯 chrome 문자열 trigger 없음
- 실질적 provider/통합 로직 변경 없음(오직 `integrations.controller.ts` 의 403 설명 문자열 리팩터) → integration-provider-change trigger 없음
- `codebase/frontend/src/content/docs/*/` 신규 디렉토리 없음 → 신규 섹션 locale 등록 trigger 없음
- `codebase/packages/expression-engine/**` 변경 없음 → 표현식 언어 변경 trigger 없음
- 실행/디버깅 엔진 변경 없음(오직 `executions.controller.ts` 의 403 설명 문자열 리팩터) → 실행·디버깅 흐름 변경 trigger 없음
- backend `warningRules` / `error-codes.ts` 변경 없음 → 신규 warningCode/errorCode trigger 없음
- `backend-api-change`, `auth-session-flow-change` 는 glob/경로상 매칭되나 semantic 판단 결과 실질 갱신 불필요(위 INFO 2건 참고)
- `plan/in-progress/*.md`, `review/consistency/**` 변경분은 plan 추적·이전 리뷰 산출물이며 매트릭스 trigger 대상 코드가 아님

## 요약

매트릭스 20개 행 중 glob/semantic 으로 후보에 오른 것은 `backend-api-change`(controller.ts 확장자 매칭)와 `auth-session-flow-change`(auth 모듈 경로 매칭) 2건뿐이며, 두 건 모두 semantic 재검토 결과 "OpenAPI 403 설명 문장의 이음 구두점 통일"이라는 순수 텍스트 리팩터로 확인돼 사용자 가이드(docs MDX)·i18n dict·backend-labels 동반 갱신이 필요한 실질 갭은 없다. 노드·UI 문자열·통합·신규 섹션·표현식 언어·실행 엔진·warning/errorCode 등 나머지 8개 trigger 카테고리는 매칭되는 변경 파일 자체가 없다. 누락 0건.

## 위험도

NONE
