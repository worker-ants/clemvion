# Rationale 연속성 검토

## 검토 대상

`--impl-done` 검토, diff-base `origin/main`. 실제 구현 스코프는 `plan/in-progress/workspace-guard-followups.md`
("경로 워크스페이스 가드 후속 — reflection 골격 · 403 설명 코드 보간 · 서비스 문구", `spec_impact: none`) — 8개 코드 파일 /
291줄, spec 변경 없음. `code:` glob 으로 닿는 관련 spec: `spec/data-flow/12-workspace.md`, `spec/5-system/1-auth.md`,
`spec/2-navigation/9-user-profile.md`, `spec/2-navigation/3-schedule.md`, `spec/2-navigation/4-integration.md`,
`spec/conventions/redis-keys.md`.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** `throwOwnerTransferRequired` 메시지가 가드의 `ROLE_REQUIRED.owner.message` 와 다름 — Rationale 문구와의 거리감 기록
  - target 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `throwOwnerTransferRequired`
    (`{ ...ROLE_REQUIRED.owner, message: 'owner 이양은 현재 owner 만 수행할 수 있습니다.' }`)
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드 (2026-09-25)" — "메시지는 서비스 계층과
    같은 한국어다."
  - 상세: 이 문장만 보면 가드·서비스가 **같은 문자열**을 낸다고 읽힐 여지가 있는데, `throwOwnerTransferRequired` 는
    `ROLE_REQUIRED.owner` 의 기본 메시지("Owner 권한이 필요합니다.")가 아니라 이양 동작 전용 문구를 유지한다. 다만 이것은
    이번 diff 가 새로 만든 결정이 아니다 — 이 메서드는 리팩터 전에도 `code: ROLE_REQUIRED.owner.code` + 커스텀 `message` 조합
    이었고(스프레드로 바뀐 것은 표현 방식뿐, 값은 동일), plan 의 뮤턴트 표 U1 과 `workspaces.service.spec.ts` 신규 주석이
    "가드의 일반 메시지로 바뀌면 e2e 가 어느 층이 막았는지 가르는 근거가 사라진다" 는 근거를 명시적으로 남겼다. 즉 **결정
    번복이 아니라 기존 동작을 가시화한 것**이고, `data-flow/12-workspace.md` 의 문장은 문맥상 가드가 내는 **일반** 역할-미달
    거부(`NOT_A_MEMBER`/`ROLE_REQUIRED` 매트릭스)를 가리키는 것으로 읽는 편이 자연스럽다 — `transferOwnership` 의 트랜잭션 내
    재검사(서비스 고유 2차 방어선, 같은 §Rationale "서비스 계층 검사는 남는다" 절이 이미 별도로 인정)는 그 매트릭스 밖이다.
  - 제안: 조치 불필요. 다만 다음에 "가드 거부의 오류 코드" 절을 갱신할 기회가 있으면, "메시지는 서비스 계층과 같은
    한국어다" 뒤에 "(도메인 고유 재검사 메시지는 예외)" 정도의 한 구절을 보태 신규 검토자의 오독 가능성을 없애면 좋다.

- **[INFO]** reflection 골격 추출(`routeArgEntriesMatching`)이 캐너리 불변식을 실제로 우회하지 않는지 확인함 — 문제 없음, 근거 기록
  - target 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts` (신규 헬퍼), 사용처
    `handlerConsumesWorkspaceId` · `workspaceParamNamesOf`
  - 과거 결정 출처: `spec/5-system/1-auth.md` §Rationale "부트 캐너리 — `@WorkspaceId()` reflection 자가검증" — "판별에는
    `handlerConsumesWorkspaceId` 를 **그대로 호출**한다 — 캐너리가 reflection 을 다시 구현하면 자기 복제본을 검사하게 되어
    정작 막으려던 파손을 통과시킨다."
  - 상세: 이번 diff 는 두 판별 함수 내부를 공용 헬퍼로 합쳤다. 이 리팩터가 위 invariant("캐너리는 판별 함수를 그대로
    호출해야 한다")를 깨지 않는지 `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` 를 직접 확인했다 —
    캐너리는 여전히 `handlerConsumesWorkspaceId`/`workspaceParamNamesOf` 를 import 해 그대로 호출하고, 새 내부 헬퍼
    `routeArgEntriesMatching` 을 재구현하거나 우회하지 않는다. plan 의 뮤턴트 H1/H3/H4(RED)·H2(의도된 생존)도 이 헬퍼가
    두 판별의 동작을 보존함을 뒷받침한다. 위반 없음 — 확인 기록으로만 남긴다.
  - 제안: 없음.

## 요약

이번 diff(8개 파일 / 291줄)는 plan 이 명시한 대로 "동작 불변 정리"이며, 핵심 근거 문서인 `spec/data-flow/12-workspace.md`
§Rationale "멤버십 검증은 가드 1곳에서" · "경로 파라미터 워크스페이스도 가드가 본다" · "가드 거부의 오류 코드"와
`spec/5-system/1-auth.md` §Rationale "부트 캐너리" 가 못박은 불변식(캐너리가 판별 함수를 재구현 없이 그대로 호출해야 한다,
가드·서비스 코드가 같은 표에서 파생해야 한다, 403 설명이 실제 코드를 반영해야 한다)을 전부 유지한 채 코드 표현만
정리했다. `workspaces.service.ts` 의 `transferOwnership` 락 순서 docstring 정정은 실제 구현(`eb009f99c` 부터 순차 락)에
맞춰 잘못된 서술을 고친 것으로, 새 결정의 무근거 번복이 아니라 사실 정정이다. `integrations.service.ts` 의 로컬
`ADMIN_ROLES` → 공용 상수 이관도 값이 동일하고 spec 어디에도 그 로컬 상수를 요구하는 문구가 없어 충돌이 없다. CRITICAL·
WARNING 급 재도입·원칙 위반·무근거 번복은 발견되지 않았고, 유일하게 짚을 만한 지점(owner 이양 전용 메시지가 가드
일반 메시지와 다름)도 이번 PR 이전부터 있던 동작이며 plan 이 근거를 뮤턴트로 실측해 명시했다.

## 위험도

NONE
