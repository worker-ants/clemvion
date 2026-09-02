---
title: "spec draft — `error-codes.md` §Overview 적용 범위에 두 surface 병기"
worktree: easy-a-harness-hygiene
started: 2026-09-01
owner: project-planner
status: in-progress
priority: P3
spec_impact:
  - spec/conventions/error-codes.md
  # `1-data-model.md` 동반 검토는 **철회한다** — 목적지 필드 서술을 §Overview 에서 빼면서
  # 그 문서와 맞물리는 지점이 없어졌다(2차 convention_compliance W1 반영).
---

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

§Overview "적용 범위" 문단에 두 surface 를 **층(layer)으로** 병기한다:

- `ErrorCode` — **노드 핸들러 층**의 대표 surface
- `EngineErrorCode` — **엔진 층**의 대표 surface
- 둘은 **같은 파일의 자매 const** 이고 키가 겹치지 않는다(테스트로 고정)
- 어느 코드가 어느 필드(`output.error.code` · `Execution.error` · `NodeExecution.error`)에
  실리는지는 **카탈로그 SoT**([`5-system/3-error-handling.md §1`](../5-system/3-error-handling.md))에
  맡긴다 — §Overview 는 그 위임을 이미 선언해 두었다

### 목적지 필드를 여기 안 쓰는 이유 — 두 라운드가 반대로 가리켰다

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

**두 지적이 반대 방향인데 둘 다 옳다.** 1차는 *내가 쓴 매핑이 틀렸다*, 2차는 *매핑을 여기
쓰는 것 자체가 틀렸다* 다. 종합하면 **층으로만 병기하고 목적지는 SoT 로 링크**하는 것이
답이다 — 사실 오류와 SoT 중복을 한 번에 없앤다. 매핑을 정확하게 고쳐 넣었다면 오류는
사라져도 **카탈로그와 조용히 갈리는 사본**이 하나 늘었을 것이다.

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

## 판단 기준은 이번에 안 쓴다 — 결정으로 남긴다

착수 근거 plan 이 *"병기만 하지 말고, '언제 central enum 을 확장하고 언제 자매 const 를
만드는가' 의 판단 기준을 함께 적을지를 planner 가 결정해야 한다 — 그게 이 항목의 실제
무게다"* 라고 요구했다. **초판은 그 질문을 다루지도, 안 다루기로 결정하지도 않고 빠뜨렸다**
(`--spec` `21_30_10` plan_coherence WARNING). 하필 §"무엇을 안 하나" 가 **엉뚱한 두 절**
(§3·§4)을 가리켜 그 누락을 가렸다.

**결정: 이번에는 병기만 한다.** 근거는 규모가 아니라 **순서**다 —

판단 기준을 규약 문서에 쓰면 그 형태가 **규약으로 굳는다.** 그런데 그 형태의 근거인
ARCH#5 ⑤ 가 스스로 "의식적 이탈이고 해석의 여지가 있다" 고 적어 둔 상태다. **아직 유보 중인
결정을 기준으로 승격시키면**, 다음 사람은 유보를 못 보고 규약만 본다 — ARCH#5 ⑤ 가 정확히
막으려던 독법이다. 기준을 쓰려면 먼저 그 유보를 닫아야 하고, 그건 이 병기보다 큰 결정이다.

**이 결정의 SoT 는 착수 근거 plan** 이다 — `spec-conventions-engine-error-code-surface.md`
체크리스트에 답과 재개 신호를 적었고, 여기는 그 포인터다. 같은 결정을 두 문서에 나란히
적으면 한쪽만 갱신되는 자리가 생긴다(2차 `rationale_continuity` INFO #3).

**무엇을 안 하나.** §3·§4 의 정규화 파이프라인 서술은 건드리지 않는다 — 그쪽은 "내부 분류
문자열 → 정규화 → public 코드" 형태를 다루는 다른 축이다. 이 draft 가 편집하는 자리는
§Overview 하나이고, 거기서 **대표 surface 열거만** 늘린다.
