# Plan 정합성 검토 — `plan/in-progress/workspace-guard-followups.md` (--impl-prep)

## 발견사항

검토 결과 CRITICAL·WARNING 없음.

- **[INFO]** 요구 5 는 naming_collision WARNING 이 제시한 두 처방 중 한쪽만 확정
  - target 위치: `plan/in-progress/workspace-guard-followups.md` 요구 5 (`integrations.service.ts` 의 로컬 `ADMIN_ROLES` 를 공용 상수로)
  - 관련 plan/근거: `review/consistency/2026/09/25/18_42_32/SUMMARY.md` 1행 · `naming_collision.md` — 처방을 "공용 상수를 import 하거나 이유를 주석으로" 양자택일로 열어 뒀다
  - 상세: target 은 "import" 한 갈래만 확정했다. 두 값이 실제로 동일(`{'owner','admin'}`, `ReadonlySet<string>.has()` 만 소비)함을 코드로 확인했으므로 import 가 더 강한 선택지이고 WARNING 이 금지한 방향도 아니다 — 결정 자체는 정당한 개발자 재량 범위 안이다.
  - 제안: 갱신 불필요. 기록 목적의 메모.

- **[INFO]** `--impl-done` spec 연결 목록의 `3-schedule`·`redis-keys` 포함 근거 확인됨
  - target 위치: 체크리스트 `--impl-done(spec 연결: ...)` 행
  - 관련 근거: `spec/2-navigation/3-schedule.md` 의 `code:` 글롭이 `codebase/backend/src/modules/workspaces/workspaces.service.ts` 를 포함(요구 3·4 대상 파일과 일치), `spec/conventions/redis-keys.md` 의 `code:` 글롭이 `codebase/backend/src/modules/integrations/**/*.ts` 를 포함(요구 5 대상 파일과 일치)
  - 상세: 처음엔 리팩터 성격상 무관해 보였으나 doc-sync-matrix 글롭 매칭으로 정합함을 실측 확인 — 스코프 과다 포함 아님.
  - 제안: 갱신 불필요.

## 요약

target(`workspace-guard-followups.md`)의 요구 1~5 는 `review/code/2026/09/25/18_19_47/RESOLUTION.md`(W1·W2·INFO4·6·8, "수렴 예외" 등재)와 `review/consistency/2026/09/25/18_42_32`(naming_collision WARNING, `ADMIN_ROLES`)의 문구·범위를 정확히 그대로 옮겼고, `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커) 4985~4999행의 원 등재 항목과도 완전히 일치한다. 대상 코드(`workspace.decorator.ts`·`workspace-roles.ts`·`workspaces.controller.ts`·`workspaces.service.ts`·`integrations.service.ts`)를 직접 읽어 각 요구의 전제(reflection 골격 중복, 리터럴 설명 상수, `throwOwnerTransferRequired` 의 스프레드 미사용, `transferOwnership` docstring 의 "단일 IN 쿼리" 오기, `ADMIN_ROLES` 동명이인)가 실측과 일치함을 확인했다. `spec/data-flow/12-workspace.md`·`spec/5-system/1-auth.md` 의 관련 Rationale("경로 파라미터 워크스페이스도 가드가 본다", "가드 거부의 오류 코드", "부트 캐너리")에는 이 리팩터와 충돌하는 미해결 결정("결정 필요"로 열어 둔 항목)이 없으며, `spec_impact: none` 도 다섯 요구 모두가 동작·계약 불변 정리임을 볼 때 타당하다. 직접 겹칠 가능성이 있는 `plan/in-progress/auth-guard-reflection-hardening.md`(RolesGuard reflection 경화, `handlerConsumesWorkspaceId` 를 언급)는 이미 체크리스트 전항목 완료·PR #1108 머지 상태라 후속 항목을 만들지 않으며, `plan/in-progress/backend-lint-gate-broken-on-main.md` 도 원 lint-gate 이슈는 이미 해소돼(PR #1104) target 의 TEST WORKFLOW 전제와 충돌하지 않는다. `9-user-profile.md` frontmatter 의 `pending_plans: spec-sync-user-profile-gaps.md` 는 아바타·알림·슬러그 라우팅(frontend 대형 기능) 트랙으로 target 의 backend RBAC 리팩터와 교집합이 없다. 컨텍스트 예산으로 본문이 생략된 나머지 plan(주로 `node-output-redesign/*`·`chat-channel-*`·`cafe24-backlog-residual` 등)은 제목·도메인상 워크스페이스 가드/역할 코드와 교차할 개연성이 낮아 직접 열람 우선순위에서 제외했다 — 전수 확인은 아니라는 점을 밝혀 둔다.

## 위험도
NONE
