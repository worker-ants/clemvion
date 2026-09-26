# Plan 정합성 검토 — forbidden-helper-sentences (`--impl-prep`)

대상 구현 plan: `plan/in-progress/forbidden-helper-sentences.md` (403 설명의 가드 문장을 공용 헬퍼 `forbiddenWithService(guard, service)` 로 통일 — 13 자리, spec 변경 없음). target 문서 번들의 실질 SoT 는 `spec/conventions/swagger.md` §5-4 (이미 존재하는 "문장은 공용 헬퍼로 만들고 서비스 문장은 뒤에 덧붙인다" 규칙 — 이번 plan 은 그 규칙에 코드를 맞추는 것뿐).

## 발견사항

- **[INFO]** `integrations.controller.ts` 모듈 상수 편집이 다른 in-progress plan 의 미해소 항목과 같은 문장을 건드림
  - target 위치: 구현 plan `forbidden-helper-sentences.md` "실측" 표 — "모듈 상수 5(`integrations` 3 · …)" 중 `integrations.controller.ts:96` `FORBIDDEN_EDITOR_OR_ORG_ADMIN = \`${forbiddenForRole('editor')}, 또는 …\``
  - 관련 plan: `plan/in-progress/integration-personal-owner-followup.md` 항목 3 "Viewer 가 자기 personal 을 만들고 · … 못한다" — "(2026-09-26 보탬) 가드를 내리면 이 네 라우트(`create`·`update`·`rotate`·`remove`)의 `@ApiForbiddenResponse` 설명(`forbiddenForRole('editor')` 로 시작)도 **손으로** 바꿔야 한다"
  - 상세: `FORBIDDEN_EDITOR_OR_ORG_ADMIN` 은 정확히 그 네 라우트(`create`/`update`/`rotate`/`remove`)가 공유하는 상수이고, 이번 plan 이 그 상수의 내부 결합(`, 또는` → `forbiddenWithService(...)`)을 고친다. 두 plan 이 결정하는 축(구두점 통일 vs Viewer 권한 완화 여부)은 서로 다르고 실제 충돌은 없다 — 이번 plan 은 `@Roles()` 를 건드리지 않고, 상수 식별자(`FORBIDDEN_EDITOR_OR_ORG_ADMIN`)도 존속할 것으로 보이며 `forbiddenForRole('editor')` 로 시작한다는 성질도 그대로 유지된다. 다만 코드 형태가 (리터럴 템플릿 → 헬퍼 호출) 바뀌므로, 나중에 Viewer 권한 결정이 내려져 이 상수를 편집할 때 "그 지점이 무엇으로 바뀌어 있는지" 를 다시 확인해야 한다.
  - 제안: 차단 사유 아님. `integration-personal-owner-followup.md` 항목 3 을 나중에 착수할 때 `forbiddenWithService` 호출 형태를 전제로 확인하라는 한 줄만 있으면 재조사 비용이 준다 — 급하지 않으면 생략 가능.

- **[INFO]** 같은 컨트롤러의 다른 미해결 성공-코드 결정과 인접
  - target 위치: 구현 plan "바꿀 자리" — `workspaces.controller.ts`(`leave`·`removeMember`)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` L4867 "`workspaces.controller.ts` 만 삭제 성공에 204 대신 `200 {ok:true}` 를 쓴다" (planner 결정 미해소, `DELETE /:id/members/:memberId` = `removeMember` 포함)
  - 상세: `removeMember` 는 이번 plan 이 403 설명(`FORBIDDEN_NOT_A_MEMBER`+서비스 문장 이음)을 고치는 자리이자, 동시에 다른 트래커 항목이 그 라우트의 **성공** 상태 코드(200 vs 204)를 아직 결정하지 못한 자리다. 두 축(403 설명 vs 2xx 상태 코드)은 서로 다른 데코레이터·서로 다른 관심사라 실질적 충돌·선행조건 문제는 없다 — 이번 plan 이 `@HttpCode`/`@ApiOkResponse` 류를 건드리지 않는다.
  - 제안: 조치 불요. 참고용으로만 기록.

기타 검토 — 미해결 결정과의 정면 충돌, 선행 plan 미해소는 발견되지 않았다:
- `plan/in-progress/spec-draft-nullable-notation-followups.md` L5081-5089 항목("403 설명 3곳이 공용 헬퍼를 거치지 않고 코드를 손으로 보간한다")이 이번 plan 이 닫으려는 바로 그 트래커 항목이며, 처방("`FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole('editor')` 뒤에 서비스 문장을 덧붙이는 형태로 + 구두점(INFO15) 통일")과 plan 의 방향이 정확히 일치한다. 체크리스트에 "트래커 항목 닫기" 도 포함돼 있다.
- 구두점 통일(`, 또는` → ` 또는 `, `forbiddenWithService` 헬퍼 신설)은 `spec/conventions/swagger.md` §5-4 가 이미 "문장은 공용 헬퍼로 만들고 서비스 문장은 그 뒤에 덧붙인다" 는 규칙만 두고 정확한 이음 문자열은 규정하지 않으므로, `spec_impact: none` 이 타당하다 — spec 을 고치지 않고도 결정할 수 있는 구현 세부다.
- "안 하는 것" 절이 명시적으로 미루는 두 가지(형식 가드 확장 · 서비스 문장 표기 전면 통일)에 대해 다른 in-progress plan 이 반대 결정을 이미 내렸거나 요구하는 곳은 없다 — `swagger.md` §Rationale "§5-4 … 가드로 세는가" 가 이미 "가드는 빠진 코드만 잡는다 · 서비스 거부는 안내만 한다" 는 설계 경계를 스스로 적어 뒀으므로, 이 유예는 그 경계를 따른 것이지 새로운 일방적 결정이 아니다.
- `auth-guard-reflection-hardening.md`(RolesGuard reflection 경화, `@WorkspaceId()` fail-open/메모이제이션)는 `RolesGuard` 의 판정 결과(코드 종류)를 바꾸지 않는 범위라 이번 plan 의 "가드와 같은 함수(`lowestRequiredRole`)를 쓴다" 는 전제와 충돌하지 않는다.
- 다른 47개 in-progress plan 은 grep 상 이번 plan 이 건드리는 파일(`auth.controller.ts` `switchWorkspace`, `executions.controller.ts` `reRun`/`getChain`, `integrations.controller.ts`, `workspaces.controller.ts`, `workflow-test-datasets.controller.ts`)이나 `forbidden-descriptions.ts`/`forbiddenForRole`/`FORBIDDEN_NOT_A_MEMBER`/`forbidden-response-codes` 키워드와 무관하다.

## 요약
구현 plan `forbidden-helper-sentences.md` 는 이미 트래커(`spec-draft-nullable-notation-followups.md` L5081)에 등재된 항목을 그 처방대로 정확히 닫는 작업이고, `spec/conventions/swagger.md` §5-4 의 기존 규칙에 코드를 맞추는 것뿐이라 spec 변경도 없다. 미해결 결정을 우회하거나 선행 조건을 건너뛰는 지점은 찾지 못했다. 같은 컨트롤러 파일(`integrations.controller.ts`, `workspaces.controller.ts`)의 인접 코드에 걸린 다른 미해결 결정(Viewer 권한 완화, 204/200 전환)이 있으나 편집 축이 달라(403 설명 vs 역할 가드/성공 코드) 실질 충돌은 없고, 추적 메모 수준의 INFO 둘만 남긴다.

## 위험도
LOW
