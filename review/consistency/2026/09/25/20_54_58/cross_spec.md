# Cross-Spec 일관성 검토 — canary-readme-recheck-test (--impl-done)

## 검토 대상 요약

- 구현 diff: 2개 파일 / 91줄
  - `codebase/backend/README.md` — 워크스페이스 reflection 캐너리 절 문구를 "`@WorkspaceId()` 단일 판별" 설명에서 "`@WorkspaceId()` + `@WorkspaceParam(...)` 두 판별 합산" 설명으로 정정 (운영자 문서, spec 아님).
  - `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `transferOwnership()` 의 트랜잭션 안 락 재검사 분기(요청자가 무락 선행에선 owner 였지만 락을 잡고 다시 보니 `role !== 'owner'` 이거나 멤버십 자체가 사라진 두 OR 가지)를 고정하는 unit 테스트 2건 추가.
- scope(`spec/**`) 델타: 0개 파일. plan(`plan/in-progress/canary-readme-recheck-test.md`)이 명시하는 대로 **동작 변경 없음·spec 변경 없음**(`spec_impact: none`) — README 문서 정정 + 기존 로직의 테스트 커버리지 보강.
- 코드 확인: `workspaces.service.ts` `transferOwnership()` (line 723-808)을 직접 Read로 재확인. 무락 선행 인가(731-733) → 트랜잭션 내 워크스페이스 조회+타입 체크(739-754) → 락 재검사(756-762, `!requesterMembership || requesterMembership.role !== 'owner'` → `OWNER_REQUIRED`)까지 확인했고, 추가된 두 테스트(`admin` 강등 가지·`null` 멤버십 소멸 가지)는 이 762행 OR 조건의 두 갈래를 각각 겨냥한다.

## 발견사항

없음.

target 변경분(README 문구 정정 + 재검사 분기 unit 테스트)을 아래 세 위치와 대조했으며 전부 부합한다.

- `spec/data-flow/12-workspace.md` §1.6(역할 변경/소유권 이전 표) — `POST .../transfer-ownership` 이 "owner (`@Roles('owner')` 가드 + service 재검증)"으로 명시돼 있고, 테스트가 고정하는 재검사 로직과 일치.
- `spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다 (2026-09-25)" — "트랜잭션 안에서 락을 잡고 재검사하는 자리(`leaveWorkspace` · `transferOwnership`)는 그 재검사를 남기고, 앞에 무락 인가 선행을 둔다"는 서술이 diff의 서비스 코드 구조·신규 테스트와 정확히 일치.
- `spec/5-system/1-auth.md` §Rationale "부트 캐너리 — `@WorkspaceId()` reflection 자가검증" (a)/(b) — README가 새로 서술하는 "`@WorkspaceId()`·`@WorkspaceParam(...)` 합산 판별, 각각 깨질 때의 실패 모드, 부팅 로그에 두 수치가 따로 남는다"는 내용이 이 Rationale 절의 2026-09-25 보탬 문단과 1:1 대응.

데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 중 어느 관점에서도 target이 새 정의를 도입하지 않으며, 기존 spec 문구를 반증하거나 재해석하지도 않는다 — 이미 spec에 기록된 2026-09-25 결정(경로 파라미터 가드 도입)을 운영 문서(README)에 뒤늦게 반영하고, 그 결정이 만든 재검사 분기를 테스트로 고정한 것뿐이다.

## 참고 (제약)

- 이번 번들은 컨텍스트 예산으로 `spec/1-data-model.md`를 포함해 112개 spec 파일의 본문이 절단되었다(목록은 prompt 하단 참조). 그러나 이 diff가 실제로 관련된 세 문서(`2-navigation/9-user-profile.md`, `5-system/1-auth.md`, `data-flow/12-workspace.md`)는 전문이 번들에 포함되어 있었고 위와 같이 직접 대조했다. diff의 성격(운영 README 문구 정정 + 기존 로직 unit 테스트 추가, 신규 엔티티·엔드포인트·상태·권한 없음)상 절단된 나머지 spec 영역(노드·워크플로우 에디터·채널 웹챗 등)과 교차할 표면이 없다.

## 요약

이번 target 변경은 spec 변경(`spec_impact: none`)이 없는 순수 운영 문서 정정 + 기존 `transferOwnership` 락 재검사 로직에 대한 unit 테스트 보강이며, 두 내용 모두 이미 `spec/data-flow/12-workspace.md`·`spec/5-system/1-auth.md`에 2026-09-25자로 기록된 "경로 파라미터 워크스페이스 가드" 결정을 그대로 반영한다. 코드(`workspaces.service.ts` `transferOwnership`)를 직접 대조한 결과 spec 서술·신규 테스트·구현이 전부 일치하며, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 다른 spec 영역과 충돌하지 않는다.

## 위험도

NONE
