# 테스트(Testing) 리뷰 — 경로 워크스페이스 가드 후속 (2026-09-25)

## 대상

`codebase/backend/src/{common/constants/workspace-roles.ts, common/decorators/workspace.decorator.ts, modules/auth/auth.controller.ts, modules/executions/executions.controller.ts, modules/integrations/integrations.service.ts, modules/workspaces/{workspaces.controller.ts,workspaces.service.spec.ts,workspaces.service.ts}}` 8개 파일. 실제 diff 성격은 세 갈래다.

1. Swagger `@ApiForbiddenResponse`/`@ApiOperation` `description` 문자열을 하드코딩 상수에서 `NOT_A_MEMBER.code`/`ROLE_REQUIRED.*.code` 보간으로 바꿈 (`auth.controller.ts`, `executions.controller.ts`, `workspaces.controller.ts`) — 런타임 관측 가능한 동작 변화 없음.
2. `workspace.decorator.ts` 의 `handlerConsumesWorkspaceId`/`workspaceParamNamesOf` 공통 골격을 `routeArgEntriesMatching` 헬퍼로 추출.
3. `integrations.service.ts` 의 로컬 `ADMIN_ROLES = new Set(['owner','admin'])` 를 공유 상수(`workspace-roles.ts`)로 교체하고, `workspaces.service.ts` 의 `throwOwnerTransferRequired()` 를 `code: ROLE_REQUIRED.owner.code` → `...ROLE_REQUIRED.owner` 로 바꾸면서 `workspaces.service.spec.ts` 에 메시지 단언을 추가. 문서(주석) 정정도 다수 포함.

## 실행 검증

로컬에서 관련 스펙 전부 그린 확인함 (`node --experimental-vm-modules ./node_modules/jest/bin/jest.js --testPathPatterns=...`):
- `workspace-roles.spec.ts`, `workspace.decorator.spec.ts`, `workspace-reflection-canary.spec.ts`, `workspaces.service.spec.ts`, `integrations.service.spec.ts` → 5 suites / 278 tests 통과.
- `auth.controller.spec.ts`, `executions.controller.spec.ts`, `workspaces.controller.spec.ts` → 4 suites / 101 tests 통과.
(주의: 워크스페이스 루트 `npx jest`/`--testPathPattern` 는 이 저장소에서 그대로 안 먹는다 — `package.json` 의 `node --experimental-vm-modules ...` 그대로 호출해야 ESM 로드 에러 없이 돈다. 이건 harness 이슈지 이번 diff 결함 아님.)

## 발견사항

- **[INFO]** `routeArgEntriesMatching` 추출은 동작 보존 리팩터고 기존 스펙이 이미 양쪽 공개 함수(`handlerConsumesWorkspaceId`, `workspaceParamNamesOf`)를 통해 골격을 충분히 커버한다.
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts` 함수 `routeArgEntriesMatching` (변경된 코드 블록 게이트 64~80행)
  - 상세: `workspace.decorator.spec.ts` 는 익명 핸들러(메서드명 없음) · 메타데이터 없는 클래스 · 두 판별이 서로의 팩토리를 안 세는 것 · 여러 파라미터 등 이 헬퍼가 지나는 모든 분기를 이미 공개 API 경유로 커버한다. 새 스펙을 추가할 필요는 없다고 판단.
  - 제안: 없음 — 회귀 없음 확인.

- **[INFO]** `workspaces.service.spec.ts` 에 추가된 `OWNER_REQUIRED` 메시지 단언은 실제로 판별력 있는(non-vacuous) 테스트다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `transferOwnership — 워크스페이스 %s 여도 비-owner 멤버는 OWNER_REQUIRED...` (변경된 코드 블록 게이트 1049~1056행)
  - 상세: `throwOwnerTransferRequired()` 는 `{ ...ROLE_REQUIRED.owner, message: '...' }` 형태라 스프레드 뒤에 `message` 를 얹는 **순서**가 맞아야 서비스 고유 문구가 가드의 `ROLE_REQUIRED.owner.message`('Owner 권한이 필요합니다.')를 덮어쓴다. 두 문구가 다르므로(각각 확인함) 순서를 뒤집는 뮤턴트(예: `{ message: '...', ...ROLE_REQUIRED.owner }`)가 있으면 이 단언이 RED 로 잡는다 — 실제로 킬 조건이 있는 테스트.
  - 제안: 없음 — 좋은 회귀 가드.

- **[INFO]** `throwOwnerTransferRequired()` 는 사전검사(트랜잭션 밖, `transferOwnership` 진입 직후)와 트랜잭션 내부 재검사(락 획득 후 stale role) 두 호출부가 있는데, 새로 추가된 메시지 단언은 사전검사 경로만 exercised — 재검사 경로(요청 중간에 owner 역할을 잃는 경합)로 도달하는 케이스는 이 diff 전후로 여전히 테스트가 없다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `transferOwnership` 733행(사전검사)과 761행(트랜잭션 내 재검사), 둘 다 같은 `throwOwnerTransferRequired()` 를 호출
  - 상세: 같은 private 메서드를 재사용하므로 메시지 포맷 자체는 사전검사 테스트로 충분히 검증되지만, "동시에 owner 가 강등된 뒤 도착한 이양 요청이 실제로 트랜잭션 내부에서 걸리는가" 라는 동시성 분기는 이번 diff 범위 밖의 기존 갭이라 이 PR 이 새로 만든 결함은 아니다. `renameWorkspace`/`updateWorkspaceSettings` 류와 달리 `transferOwnership` 만 사전+락 이중 검사 구조라 락 재검사 분기가 유일하게 미검증 상태로 남는다.
  - 제안: 이번 PR 범위는 아니지만, 후속으로 `memberRepo.findOne` 을 `mockImplementationOnce` 두 번 체이닝해 "사전검사는 owner 통과, 트랜잭션 내부 재조회는 admin 으로 강등됨" 시나리오를 넣으면 그 분기도 닫힌다.

- **[INFO]** `integrations.service.ts` 의 로컬 `ADMIN_ROLES` → 공유 상수 교체는 값이 완전히 동일(`{'admin','owner'}`)하고, `isAdmin()`/`assertCanRotate()` 를 exercise 하는 기존 회귀 테스트(`rejects organization scope for non-admin`, `it('락 안에서 권한을 다시 본다...')` 등)가 그대로 통과해 동작 보존을 확인했다. 새 테스트 불필요.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` 16행 import, 실사용은 1568행 `isAdmin()` (프롬프트 크기 제한으로 diff 컨텍스트에는 안 실렸음 — `Read` 로 직접 확인)
  - 제안: 없음.

- **[INFO]** `auth.controller.ts`/`executions.controller.ts`/`workspaces.controller.ts` 의 `description` 템플릿 리터럴 보간은 Swagger 문서 텍스트에만 영향을 주고 응답 바디·상태 코드를 바꾸지 않는다. 이 문자열을 단언하는 테스트가 저장소에 없음을 확인했다(grep 0건) — 그대로가 맞다. 다만 이 변경으로 코드 상수(`NOT_A_MEMBER.code` 등)가 바뀌면 설명도 자동으로 따라가므로, 향후 `workspace-roles.ts` 의 코드명이 바뀌는 리팩터가 있어도 이 세 컨트롤러 파일을 별도로 동기화할 필요가 없어졌다 — 이는 유지보수성 개선이지 테스트 갭은 아니다.
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts`(432행), `codebase/backend/src/modules/executions/executions.controller.ts`(282·311행), `codebase/backend/src/modules/workspaces/workspaces.controller.ts`(71~73·396행)
  - 제안: 없음.

## 요약

이번 diff 는 관찰 가능한 런타임 동작을 사실상 보존하는 리팩터·정정 묶음이다(Swagger 문구 보간, reflection 헬퍼 추출, 중복 상수 통합, 예외 객체 스프레드 방식 변경). 각 갈래마다 기존 회귀 테스트(특히 `workspace-roles.spec.ts`·`workspace.decorator.spec.ts`·`workspace-reflection-canary.spec.ts`·`integrations.service.spec.ts`)가 이미 동일 계약을 검증하고 있어 실제로 로컬에서 전부 그린임을 확인했다. 유일하게 새로 추가된 어서션(`OWNER_REQUIRED` 메시지)은 스프레드-순서 뮤턴트를 실제로 킬하는 non-vacuous 테스트였다. 발견한 갭(`transferOwnership` 의 트랜잭션 내부 재검사 분기 미검증)은 이 PR 이 새로 만든 것이 아니라 기존부터 있던 좁은 동시성 케이스이고, 심각도도 낮다(같은 헬퍼를 재사용하므로 메시지 포맷 자체는 이미 검증됨).

## 위험도

LOW
