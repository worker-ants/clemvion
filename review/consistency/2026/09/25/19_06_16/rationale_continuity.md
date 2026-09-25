# Rationale 연속성 검토 — workspace-guard-followups (--impl-prep)

대상: `plan/in-progress/workspace-guard-followups.md` 의 요구 1~5 (spec_impact: none, 순수 리팩터).
직접 열람: `codebase/backend/src/common/decorators/workspace.decorator.ts` ·
`workspace-reflection-canary.ts` · `workspace.decorator.spec.ts` ·
`modules/workspaces/{workspaces.service.ts,workspaces.controller.ts}` ·
`modules/integrations/integrations.service.ts`. 대조 Rationale:
`spec/data-flow/12-workspace.md`(§"멤버십 검증은 가드 1곳에서" · §"경로 파라미터 워크스페이스도 가드가
본다" · §"가드 거부의 오류 코드"), `spec/5-system/1-auth.md`(§"부트 캐너리" · §3.1/3.2 RBAC).

## 발견사항

- **[INFO]** 요구 1(reflection 골격 공통화)은 fail-closed invariant 의 "부분 파손" 블라인드 스팟과 접한다
  - target 위치: `plan/in-progress/workspace-guard-followups.md` 요구 1, 체크리스트 "뮤턴트(새 헬퍼 · 보간)"
  - 과거 결정 출처: `spec/5-system/1-auth.md` §"부트 캐너리 — `@WorkspaceId()` reflection 자가검증" (a) —
    "판별에는 `handlerConsumesWorkspaceId` 를 **그대로 호출**한다 — 캐너리가 reflection 을 다시 구현하면
    자기 복제본을 검사하게 되어 정작 막으려던 파손을 통과시킨다" · "**알려진 한계**: 부분 파손(일부
    라우트만 인식 실패)은 잡지 못한다". `workspace-reflection-canary.ts` 도 동일 문장을 반복한다.
  - 상세: `assertWorkspaceIdReflectionWorks` 는 `handlerConsumesWorkspaceId`·`workspaceParamNamesOf` 를
    직접 import 해서 부르므로(재구현 아님), 이 원칙 자체는 이번 리팩터로 깨지지 않는다 — 캐너리 파일은
    변경 범위 밖이다. 다만 두 함수가 공유하게 될 골격(메서드명 가드 → `ROUTE_ARGS_METADATA` 조회 →
    팩토리 identity 필터)에 리팩터 버그가 생기면(예: 두 팩토리 identity 를 착오로 뒤섞는 것) 캐너리의
    "합계 > 0" 단언은 **한쪽만** 깨져도 통과시킨다 — 이것이 바로 위 인용의 "부분 파손" 시나리오다.
    기존 `workspace.decorator.spec.ts` 에 이 정확한 실패 모드를 겨냥한
    `'두 판별은 서로의 팩토리를 세지 않는다'` 테스트가 이미 있어 회귀 위험은 상당히 낮지만, 요구 1의
    "뮤턴트" 항목은 현재 대상이 "새 헬퍼" 로만 적혀 있어 두 wrapper 함수 표면만 겨눌지, 추출된 공용
    skeleton 헬퍼 내부(팩토리 인자 위치 착오·`argsMetadata` undefined 분기·`methodName` 빈 문자열 분기)까지
    겨눌지 불명확하다.
  - 제안: 구현 시 (1) `workspace.decorator.spec.ts` 의 `'두 판별은 서로의 팩토리를 세지 않는다'` 를 그대로
    보존(리팩터 후에도 GREEN)하고, (2) 뮤턴트 대상에 추출된 공용 헬퍼를 명시적으로 포함해 "팩토리 인자가
    바뀌면 죽는다"·"`methodName` 빈 문자열/`argsMetadata` 부재 시 각각 false/[] 를 낸다" 를 개별 확인.
    새 Rationale 을 쓸 필요는 없다 — 기존 invariant 를 그대로 보존하는 절차 보강 제안이다.

- **[INFO]** 요구 5(`ADMIN_ROLES` 통합)는 기존 통합 Rationale 의 연장선 — 문서 갱신은 선택
  - target 위치: `plan/in-progress/workspace-guard-followups.md` 요구 5
  - 과거 결정 출처: `codebase/backend/src/common/constants/workspace-roles.ts` 상단 주석 — "종전엔
    가드의 숫자 서열과 두 서비스(`workspaces.service.ts` · `workspace-invitations.service.ts`)의
    `ADMIN_ROLES` 집합이 각자 따로 있었다 ... 서열 하나에서 파생한다." (같은 취지가
    `spec/5-system/1-auth.md` §3.2 "Integration (Org) | CRUD | CRUD | R | R" 매트릭스로도 뒷받침됨 —
    `integrations.service.ts` 의 로컬 `ADMIN_ROLES = new Set(['owner','admin'])` 값이 이 매트릭스와
    이미 일치.)
  - 상세: 요구 5 는 이 "서열 하나에서 파생" 원칙을 세 번째 소비처(`integrations.service.ts`)로 확장하는
    것이라 방향이 일치한다 — 기각된 대안 재도입도, 무근거 번복도 아니다. 다만 위 주석은 "두 서비스" 라고
    과거형으로 못박혀 있어, 리팩터 후에도 그 문장만 읽으면 소비처가 둘뿐이라고 오해할 수 있다.
  - 제안: 필수는 아니나, 같은 김에 그 docstring 에 "이후 `integrations.service.ts` 도 합류(2026-09-25
    followups)" 한 줄만 보태면 다음 독자가 소비처 목록을 다시 grep 하지 않아도 된다.

## 요약

이번 요구 1~5 는 전부 동작 불변 리팩터(`spec_impact: none`)이고, 실제 코드(`workspace.decorator.ts`·
`workspace-reflection-canary.ts`·`workspaces.service.ts`·`integrations.service.ts`)를 직접 열어 대조한
결과 기각된 대안의 재도입이나 합의 원칙 위반은 발견되지 않았다. 특히 우려했던 지점 — 캐너리가
`handlerConsumesWorkspaceId`/`workspaceParamNamesOf` 를 "그대로 호출"해야 한다는 invariant, `transferOwnership`
의 "동시 IN 쿼리 락" 서술 정정이 실제 구현(순차 개별 `pessimistic_write` 락)과 일치하는지, `ADMIN_ROLES`
통합이 §3.2 권한 매트릭스와 값이 맞는지 — 모두 확인했고 전부 정합했다. 유일한 잔여 리스크는 fail-closed
reflection 골격을 공유시키는 리팩터가 Rationale 이 명시한 "부분 파손은 캐너리가 못 잡는다" 는 알려진
한계 표면과 겹친다는 점인데, 기존 회귀 테스트가 이미 그 실패 모드를 겨냥하고 있어 INFO 수준의 절차
보강 제안에 그친다.

## 위험도

LOW
