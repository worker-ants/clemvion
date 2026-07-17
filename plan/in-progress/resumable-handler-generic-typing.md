---
worktree: .claude/worktrees/resumable-handler-generic-typing-3918dd
started: 2026-07-17
owner: developer
---

# `ResumableNodeHandler` 제네릭화 — endReason 계약을 타입으로 잠그기

> 발견 경위: PR #968 의 architecture 리뷰가 후속 과제로 **권고**(강제 아님). #968 자체는
> 넓히기를 기각하고 JSDoc 에 계약의 실제 강도를 명시하는 최소안만 적용했다.

## Overview

`ResumableNodeHandler.endMultiTurnConversation` 의 `endReason` 이 `AiAgentEndReason` 하나로
고정돼 IE 고유값(`completed`/`max_retries`)을 표현하지 못한다. 그런데 **어느 구현체도
`implements` 를 선언하지 않아** tsc 가 이 계약을 전혀 검사하지 않았다 — 안전은 타입이 아니라
**호출 패턴**(범용 호출부가 두 도메인의 교집합인 `user_ended`/`error` 만 넘김) + IE 의 런타임
방어(`default: 'error'`)가 지키고 있었다.

**왜 `implements` 가 없었는지가 핵심**(본 작업에서 실측): 두 유니온은 서로 부분집합이 아니라
(`condition` ∉ IE, `completed` ∉ Agent) 메서드 파라미터 bivariance 가 **양방향 모두 실패**해,
IE 가 `implements` 를 선언하는 순간 **TS2416** 이 난다. 즉 제네릭화 없이는 이 계약이 구현 불가였다.

## 결정

| # | 결정 | 근거 |
| --- | --- | --- |
| 1 | `ResumableNodeHandler<TEndReason extends ConversationEndReason = UniversalEndReason>` | 각 구현체가 자기 도메인으로 좁혀 `implements` 가능 |
| 2 | 기본 타입 인자 = **교집합**(`UniversalEndReason`), 합집합 아님 | 타입 인자 없이 쓰는 자리 = 노드 타입 모르는 범용 호출부. 합집합을 기본값으로 두면 #968 이 기각한 위험(계약만 넓어지고 구현은 좁은 채 통과 → port switch 조용히 fallthrough)이 **기본값**이 된다 |
| 3 | 교집합은 패키지에서 **파생**(`AiAgentEndReason & InformationExtractorEndReason`) | 값 도메인 SoT = `@workflow/ai-end-reason`. 손으로 유지하면 drift — 어느 유니온이 바뀌면 자동으로 좁아진다 |
| 4 | 가드 반환 = `ResumableNodeHandler<UniversalEndReason>` | 런타임 typeof 검사라 노드 타입을 모른다 → 정직하게 줄 수 있는 계약은 교집합뿐. 좁히기는 sound(교집합 ⊆ 각 도메인) |
| 5 | `AssertEndReasonDomain` 단언을 각 핸들러에 추가 | **`implements` 만으로는 부족**(실측): 파라미터 bivariance 로 구현이 도메인을 좁혀도 통과 → 타입 인자가 검사 안 되는 주석으로 전락. backend 는 `strictFunctionTypes` 가 꺼져 있어 property 문법으로도 못 막는다 |
| 6 | 검증 장치는 spec 이 아니라 **소스**에 배치 | 실측: backend ts-jest 는 `isolatedModules` 로 **타입을 검사하지 않고**(일부러 넣은 `const n: number = '문자열'` 이 통과), `nest build` 는 spec 을 exclude → **backend spec 안의 타입 테스트는 no-op**. 패키지의 `_exhaustive` 가 `index.ts`(소스)에 있는 이유와 동일 |

## 범위 밖 (관측만)

- IE 의 `endMultiTurnConversation` 은 `errorPayload` 를 받지 않는데 engine 의 `handleAiTurnError`
  는 전달한다 → 런타임에서 그냥 버려진다. 선재 동작이며 타입 작업의 범위 밖. IE spec §5.6 의
  `max_retries` 는 `output.error` 병존을 규정하므로 별도 판정 필요.
- `AiTurnExecutor` 는 `validate`/`execute` 가 없어 `ResumableNodeHandler`(= `NodeHandler` 확장)를
  구현할 수 없다 → `implements` 는 레지스트리에 등록되는 두 핸들러에만 부착.

## 체크리스트

- [x] 파급 범위 실측 (호출부 2 · 구현체 3 · 가드 1)
- [x] 설계 프로브로 TS 가정 실증 (교집합 reduce · TS2416 · 가드 sound · 고유값 차단)
- [x] 패키지: `UniversalEndReason` 파생 + non-empty 단언
- [x] 인터페이스: 제네릭화 + 가드 narrow + `AssertEndReasonDomain`
- [x] 두 핸들러: 자기 도메인 `implements` + 도메인 잠금
- [x] 비-vacuity 역실증 4축 (A 범용 호출부 고유값 / B 구현 좁히기 / C 구현 넓히기 / D 교집합 붕괴)
- [x] TEST: lint
- [x] TEST: unit
- [x] TEST: build
- [x] TEST: e2e — PASS 256 tests (`_test_logs/e2e-20260717-225316.log`, 마지막 코드 커밋 `0aa8b83f6` 이후)
- [x] `/ai-review` — CRITICAL 0 / WARNING 4 / RISK LOW (`review/code/2026/07/17/22_58_45/SUMMARY.md`). ⚠️ classifier 장애로 라우터 미실행, main 이 8명 수동 선별(강제 7 전원 + architecture) — SUMMARY §라우터 결정에 정정 기록
- [x] WARNING 4건 fix — resolution-applier (커밋 `b612cae74`·`580a615dd`·`b742f341d`·`a8bb062f6`). RESOLUTION.md 작성됨
  - #1 testing: `assert-end-reason-domain.type-fixture.ts` 신설 (소스 트리 — spec 은 ts-jest `isolatedModules` 로 타입 미검사·`nest build` 는 spec exclude). **main 이 직접 역실증: `@ts-expect-error` 제거 시 실제 TS2322 재현, 복원 후 0 에러 — non-vacuous 확인**. sanity 케이스로 "항상 never 붕괴" 자기확증 함정도 차단
  - #2 side_effect: 풀빌드 재확인 (fix 대상 아님)
  - #3 maintainability: bivariance/TS2416 근거를 `AssertEndReasonDomain` docblock SoT 로 통합, 나머지 `{@link}` 축약
  - #4 documentation: README Exports 절에 `UniversalEndReason` 추가

## 잔여 후속 (범위 밖, INFO)

- IE `endMultiTurnConversation` 이 `errorPayload`/`failedUserMessage`/`failedUserMessageSource` 미수용 → 엔진 호출 시 조용히 버려짐 (선재 갭). IE spec §5.6 `max_retries` 의 `output.error` 병존 규정과의 정합 판정은 별도 plan.
- `AssertEndReasonDomain` lock 의 수동 opt-in 성격 — 3번째 resumable 노드가 lock 을 빠뜨리면 조용히 회귀. 지금은 구현체 2개뿐이라 즉시 조치 불요, handler-registry 순회 기반 강제는 향후 검토.

## spec 영향

없음. 값 도메인·의미·port 매핑 무변경 — 순수 타입 안전성 작업.
`interaction-type-registry.md §4` 가 "패키지가 SoT, 매트릭스·AST 가드 불필요" 로 규정한 경계를 그대로 따른다.
