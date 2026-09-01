---
title: "spec draft — `error-codes.md` §Overview 적용 범위에 두 surface 병기"
worktree: easy-a-harness-hygiene
started: 2026-09-01
owner: project-planner
status: applied
completed: 2026-09-01
priority: P3
spec_impact:
  - spec/conventions/error-codes.md
  # `1-data-model.md` 동반 검토는 **철회한다** — 목적지 필드 서술을 §Overview 에서 빼면서
  # 그 문서와 맞물리는 지점이 없어졌다(2차 convention_compliance W1 반영).
---

> ✅ **적용 완료 (2026-09-01).** `spec/conventions/error-codes.md` §Overview "적용 범위"
> 문단 뒤에 두 문단을 추가했다 — 대표 surface 가 둘이라는 사실 + 비대칭 경계.
> `--spec` 게이트 **6라운드**를 돌았고 마지막이 **BLOCK: NO · Critical 0 · WARNING 0** 이다.
> 라운드마다 실재하는 오류가 나왔고 **전부 내가 방금 쓴 문장에서** 나왔다 — 경위는
> §"세 번 고쳤다" 참조.

## Overview

`spec/conventions/error-codes.md` §Overview "적용 범위" 문단이 `ErrorCode` **하나만** 대표
surface 로 지목한다. 실제로는 엔진이 싣는 코드가 별 const(`EngineErrorCode`)로 존재하고,
그 사실이 규약 문서 어디에도 없다.

착수 근거는 `plan/in-progress/spec-conventions-engine-error-code-surface.md` 이고, 그 문서가
이 병기를 planner 턴으로 지정했다 — developer 의 자기-반증형 소정정 예외에 **해당하지 않는다**
(규약 서술이고, developer 가 쓴 문장도 아니다).

## 실측

| 확인 | 결과 |
|---|---|
| `ErrorCode` 선언 | `codebase/backend/src/nodes/core/error-codes.ts:8` |
| `EngineErrorCode` 선언 | **같은 파일** `:147` |
| 키 중첩 | `error-codes.spec.ts:59` 가 `overlap` 을 단언 — 두 집합이 겹치지 않음을 테스트가 고정 |

**"파일은 하나, const 는 둘"** 이 이 설계의 핵심이다. 문서가 두 파일로 읽히면 오해가 되므로
병기할 때 그 점을 함께 적는다.

## 변경 제안

§Overview "적용 범위" 문단에 두 surface 가 **존재한다는 사실만** 적는다:

- 대표 surface 는 **둘**이다 — `ErrorCode` 와 `EngineErrorCode`
- 둘은 **같은 파일의 자매 const**(`nodes/core/error-codes.ts`)이고 키가 겹치지 않는다
  (테스트로 고정)
- 경계는 **비대칭**이다 — `EngineErrorCode` 는 **엔진만** 발행하고, `ErrorCode` 는 노드
  핸들러가 주로 쓰되 **엔진도 쓴다**(`EXECUTION_TIME_LIMIT_EXCEEDED`). 그래서 카탈로그의
  "엔진 수준 에러" 분류와 **1:1 대응하지 않는다**

목적지 필드(`output.error.code` · `Execution.error` · `NodeExecution.error`)는 **아무 말도
하지 않는다.** 4판까지는 "카탈로그 SoT(`3-error-handling.md §1`)에 맡긴다" 는 위임 문장을
달았는데, **그 문서에 그 정보가 없다** (5차 `--spec` `21_49_21` cross_spec W1, 실측 확인 —
진짜 SoT 는 `1-data-model.md:557-563` 의 "Execution.error ↔ NodeExecution.error 관계" 표다).
**잘못 가리키는 위임은 위임을 안 하느니만 못하다** — 독자를 없는 답으로 보낸다. 포인터를
고치는 대신 **문장을 없앴다**: §Overview 가 목적지를 말하지 않으면 오도할 것도 없다.

### 기각한 대안 — §Overview 에 목적지 필드 매핑

**기각.** 매핑은 §Overview 의 책임이 아니고(카탈로그 SoT 위임이 이미 선언돼 있다),
`EngineErrorCode` 는 코드마다 목적지가 다르며, 애초에 내가 쓴 매핑이 사실과 달랐다.

### 기각한 대안 — 층(layer) 기반 이분법

**기각.** `EXECUTION_TIME_LIMIT_EXCEEDED`(=`ErrorCode`)를 **엔진이** 싣는다 — 내 §실측이
직접 반증한다. 표기도 저장소가 이미 "레이어"/"레벨" 로 굳어 있어 "층" 은 신조어였다.

### 세 번 고쳤다 — 매번 같은 데이터가 내 분류를 부정했다

초판은 *"`EngineErrorCode` — 엔진이 `Execution.error`·`NodeExecution.error` 에 싣는다"* 로
적었다. **1차 `--spec`(`21_30_10`) cross_spec** 이 그것을 반박했다 — `Execution.error` 는
**두 family 가 공존**하는 필드다(`EXECUTION_TIME_LIMIT_EXCEEDED` 는 `ErrorCode` 소속인데
`execution-engine.service.ts:8270` 이 `Execution.error.code` 로 싣는다, 실측 확인).

그래서 2판은 공존을 **명시**하는 쪽으로 고쳤는데, **2차 `--spec`(`21_36_28`)
convention_compliance** 가 반대 방향을 지적했다 — 목적지 필드는 §Overview 의 책임이 아니라
`3-error-handling.md §1` 에 **이미 위임된** 사실이고, 게다가 `EngineErrorCode` 는 **코드마다
목적지가 다르다.** 그 const 의 JSDoc 자신이 그렇게 적는다:

| 코드 | 목적지 |
|---|---|
| `SERVER_INTERRUPTED` | *"Execution·NodeExecution **양쪽** 봉투에 실린다"* |
| `EXECUTION_QUEUE_WAIT_TIMEOUT` | admission 에서 막혀 **시작조차 못 한** 경우 — NodeExecution 이 아직 없다 |

즉 뭉뚱그린 "둘 다에 싣는다" 는 4종 중 최소 2종에 대해 틀린다.

**두 지적이 반대 방향인데 둘 다 옳았다.** 1차는 *내가 쓴 매핑이 틀렸다*, 2차는 *매핑을 여기
쓰는 것 자체가 틀렸다* 다. 그래서 3판은 **층(layer)으로** 병기했다 — 그런데 **4차
(`21_46_05`)가 그 층 이분법도 반박했다.**

반박의 근거가 **내가 위 §실측에 직접 적어 둔 데이터**다. `EXECUTION_TIME_LIMIT_EXCEEDED` 는
`ErrorCode` 소속인데 **엔진이** `Execution.error.code` 로 싣는다. 그러니 "`ErrorCode` = 노드
핸들러 층" 은 성립하지 않는다 — **틀린 필드 분류를 틀린 층 분류로 바꿨을 뿐**이고, 둘 다
같은 한 줄이 부정한다.

**세 번 다 같은 실수다**: 두 const 를 **깔끔한 이분법으로 설명하려 했다.** 실제 경계는
"누가 발행하는가" 하나뿐이고 그것도 카탈로그 분류와 1:1 이 아니다. 그래서 최종판은 분류를
**아예 하지 않는다** — 존재·자매 관계·키 disjoint 만 적고, 나머지는 SoT 로 보낸다.
draft 자신의 Rationale 이 이미 그렇게 적고 있었다(*"두 surface 가 존재한다는 사실만 적는다"*)
— **내 변경 제안이 내 Rationale 을 안 따랐다.**

기존 서술("프로젝트 전체의 에러 코드 문자열에 적용")은 **그대로 둔다** — 적용 범위가 넓다는
것이 이 문단의 요지이고, 병기는 그 안에서 대표 surface 를 **하나에서 둘로** 늘리는 것이지
범위를 좁히는 것이 아니다. §Overview 도입부의 "대표 surface"(단수) 표현도 병기에 맞춰
복수로 조정한다(1차 `convention_compliance` INFO #1).

§3 예외 레지스트리의 `WORKER_HEARTBEAT_TIMEOUT` 행이 이미 `EngineErrorCode` 멤버를 다루고
있다 — 이 병기가 **새 규칙이 아니라 기존 실무의 명문화**임을 보이는 자리라 각주로 건다
(2차 `rationale_continuity` INFO #2).

### 범위 한정 — 일반 원칙 선언이 아니다

`spec/5-system/4-execution-engine.md` §Rationale 은 2026-06-14 에 **"신규 코드는 중앙
`ErrorCode` 확장"** 을 결정했다. 이 병기는 그 결정과 **경쟁하지 않는다** — 지금 존재하는
`EngineErrorCode` 4종을 **사후에 문서화**할 뿐, 향후 신규 엔진 코드가 어느 쪽으로 가야
하는지는 말하지 않는다. 그 판정은 아래 §판단 기준 절이 별도 트랙으로 분리한 질문이다.
(`--spec` `21_30_10` cross_spec WARNING #2)

## Rationale

**왜 지금인가.** 이 병기가 없으면 규약 문서를 읽고 `EngineErrorCode` 를 새로 만드는 사람이
"규약 밖" 이라 판단할 수 있다. §1 적용 범위가 "프로젝트 전체" 라 실제로는 안에 있는데,
대표 surface 열거가 하나뿐이라 그 넓은 서술보다 좁은 예시가 먼저 읽힌다.

**왜 자매 const 인가 — 선례를 평평하게 만들지 않는다.** 초판은 *"노출 경계가 다르기
때문"* 한 문장으로 정리했는데 **그것이 틀렸다.** `exec-intake-followups.md` ARCH#5 ⑤ 는
그 결정을 **유보와 함께** 남겼다:

> 이 논리는 `RETRY_*` 에도 똑같이 적용될 수 있었고 **그때는 채택되지 않았다.** 즉 중립적
> 선택이 아니라 **형태의 의식적 이탈**이다. … 다음 사람이 "언제 central enum 을 확장하고
> 언제 자매 const 를 만드는가" 를 판단할 때, **내 근거가 선례를 이겼다고 읽지 않도록.**
> … 해석의 여지가 있다는 사실 자체를 여기 남긴다.

정착된 선례가 아니라 **해석이 열린 이탈**이다. 그래서 이 병기는 그 형태를 규약으로 굳히는
서술을 쓰지 않는다 — 두 surface 가 **존재한다**는 사실만 적는다.

### 판단 기준은 이번에 안 쓴다 — 결정으로 남긴다

착수 근거 plan 이 *"판단 기준을 함께 적을지를 planner 가 결정해야 한다 — 그게 이 항목의
실제 무게다"* 라고 요구했다. **초판은 그 질문을 다루지도, 안 다루기로 결정하지도 않고
빠뜨렸다**(1차 `--spec` `21_30_10` plan_coherence).

**결정: 이번에는 병기만 한다.** 근거·재개 신호·`WsErrorCode` 선례의 모호성은
[`spec-conventions-engine-error-code-surface.md`](../in-progress/spec-conventions-engine-error-code-surface.md)
체크리스트가 **SoT** 다 — 여기 전문을 복제하면 한쪽만 갱신되는 자리가 생긴다
(6차 `plan_coherence` INFO #6, 이 draft 가 스스로 지적한 위험을 스스로 반복한 것).

한 줄로: **유보 중인 결정을 규약 기준으로 승격시키면 다음 사람은 유보를 못 보고 규약만 본다.**
