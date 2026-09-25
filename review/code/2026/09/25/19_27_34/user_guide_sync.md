# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

- **[INFO]** `auth-session-flow-change` trigger 의 glob(`codebase/backend/src/modules/auth/**`)과 표 항목 "인증·권한·세션 흐름 변경"의 의미 범주에 파일 3(`auth.controller.ts`)이 형식적으로 걸리고, 워크스페이스 권한 판정 로직이 몰려 있는 파일 2/4/6/8(`workspace.decorator.ts`, `executions.controller.ts`, `workspaces.controller.ts`, `workspaces.service.ts`)도 같은 의미 범주("권한 흐름")에 인접하지만, **실제 동작 변화가 없어 갱신 대상 target(`07-workspace-and-team/` + e2e)이 발동하지 않는다**고 판단.
  - 변경 파일: `codebase/backend/src/common/constants/workspace-roles.ts`, `common/decorators/workspace.decorator.ts`, `modules/auth/auth.controller.ts`, `modules/executions/executions.controller.ts`, `modules/integrations/integrations.service.ts`, `modules/workspaces/workspaces.controller.ts`, `modules/workspaces/workspaces.service.ts` (+ spec 파일 `workspaces.service.spec.ts`)
  - 매트릭스 항목: `auth-session-flow-change` — targets: `"codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e"`. PROJECT.md 보조: "인증·권한·세션 흐름 변경 vs 워크스페이스 가이드(`07-workspace-and-team/`) 미갱신 — 흐름 변경 + 가이드 갱신 + e2e 가 한 묶음"
  - 근거 (실측): 각 diff 를 직접 읽어 대조한 결과 전부 **출력 값이 리팩터 전후 바이트 단위로 동일**하다.
    - `auth.controller.ts` L428~446: `description: '...403 ${NOT_A_MEMBER.code}.'` → 보간 전 리터럴이 이미 `NOT_A_MEMBER` 였고 `NOT_A_MEMBER.code === 'NOT_A_MEMBER'` 이므로 렌더된 Swagger 문자열은 리팩터 전후 완전히 동일.
    - `executions.controller.ts` L279~312, `workspaces.controller.ts` L62~74/393~396: 같은 패턴(`ROLE_REQUIRED.editor/admin/owner.code` 보간) — 상수 값이 기존 리터럴과 동일해 OpenAPI 출력 불변.
    - `workspaces.service.ts` L938~943: `code: ROLE_REQUIRED.owner.code` → `{ ...ROLE_REQUIRED.owner, message: '...' }` 로 바뀌었지만 `message` 를 뒤에 명시 override 하므로 최종 `{code, message}` 조합이 종전과 동일.
    - `integrations.service.ts`: 모듈-로컬 `ADMIN_ROLES = new Set(['owner','admin'])` 를 공용 상수 import 로 대체 — 값 동일, 순수 중복 제거.
    - `workspace.decorator.ts`: `handlerConsumesWorkspaceId` / `workspaceParamNamesOf` 의 reflection 골격을 `routeArgEntriesMatching` 헬퍼로 추출 — 외부에 노출된 판정 결과(런타임 인가 여부)는 동일(plan 의 H1~H4 뮤턴트 테이블이 이를 직접 검증: RED 5/32/31, 등가 뮤턴트 H2 는 "의도 표시" 로 별도 확인).
  - 이 changeset 자체가 `plan/in-progress/workspace-guard-followups.md` 에서 "동작 불변 정리(spec_impact: none) · CHANGELOG 항목 없음(응답·에러 코드·OpenAPI 문자열이 바이트 단위로 같음)" 으로 명시돼 있고, 실제 인가 흐름 변경(경로 파라미터 워크스페이스도 `RolesGuard` 가 판정)은 이미 `origin/main` 에 머지된 선행 PR `5ba95e4b8`(#1399, 이번 리뷰 diff 범위 밖 — `origin/main..HEAD` 에 포함 안 됨)에서 이뤄졌다. 그 PR 은 자체 spec 갱신(`spec/data-flow/12-workspace.md` 등 9개 파일)을 이미 수반했으나 `codebase/frontend/src/content/docs/07-workspace-and-team/` 프론트 유저 가이드는 그 커밋 메시지에 나열되지 않음 — 다만 이는 **이번 리뷰의 diff 범위(이 changeset)에 속하지 않는 과거 병합 커밋**이라 이번 판정 대상은 아니다.
  - 상세: 사용자에게 노출되는 에러 코드·메시지·OpenAPI 설명 문자열이 전혀 바뀌지 않았으므로 `07-workspace-and-team/` 가이드나 i18n dict/backend-labels 를 갱신할 대상 자체가 없다.
  - 제안: 조치 불필요. 다만 향후 `NOT_A_MEMBER`/`ROLE_REQUIRED.*` 의 `.code` 값 자체를 바꾸는 PR 이 오면, 이번에 심어둔 보간 덕분에 `auth.controller.ts`/`executions.controller.ts`/`workspaces.controller.ts` 의 Swagger 설명은 자동 동기화되지만 `codebase/frontend/src/content/docs/07-workspace-and-team/` 유저 가이드 본문(사람이 손으로 쓴 산문)은 자동 동기화되지 않는다는 점을 그 때 리뷰어가 놓치지 않도록 유의.

- **[해당 없음]** 나머지 trigger(신규 노드, 노드 schema 변경, 신규 UI 문자열(TSX), 신규 위젯 chrome 문자열, 통합 provider 변경, 신규 유저가이드 섹션 디렉토리, 신규 warningCode/errorCode 발행, backend zod ui.label/hint 신규값, cross-cutting enum 추가, handler output 신규 field, 표현식 언어 변경, 실행·디버깅 흐름 변경) — 이번 8개 변경 파일 중 어느 것도 매칭되지 않음. `.tsx` 파일 없음, `codebase/backend/src/nodes/**` 없음, `error-codes.ts`/`system-status.constants.ts` 없음, `codebase/packages/expression-engine/**` 없음.

## 요약

매트릭스 20개 trigger 행 중 `auth-session-flow-change`(및 인접 `backend-api-change` swagger jsdoc target) 1개만 파일 경로상 매칭됐으나, 8개 변경 파일 전부를 diff 원문 대조로 직접 검증한 결과 모든 변경이 리팩터(reflection 골격 통합·docstring 정정·상수 보간·중복 상수 제거)로 사용자 가시 출력(에러 코드·메시지·OpenAPI 설명)이 바이트 단위로 불변이며, 이는 changeset 자신의 plan 문서(`spec_impact: none`, CHANGELOG 항목 없음 판정)와도 일치한다. 따라서 `07-workspace-and-team/` 유저 가이드·i18n dict·backend-labels 동반 갱신 누락은 없음 — 실제 갱신 대상(target)이 존재하지 않는 케이스.

## 위험도

NONE
