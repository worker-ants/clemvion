---
title: "spec draft — `error-codes.md` §Overview 적용 범위에 두 surface 병기"
worktree: easy-a-harness-hygiene
started: 2026-09-01
owner: project-planner
status: in-progress
priority: P3
spec_impact:
  - spec/conventions/error-codes.md
  # 아래는 **동반 검토** 대상 — 이번 diff 가 편집하지는 않는다. `Execution.error` 가 두 code
  # family 를 공존시킨다는 사실이 이 문서의 컬럼 표(`:474`)와 맞물린다(cross_spec W1).
  - spec/1-data-model.md
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

§Overview "적용 범위" 문단에 두 surface 를 병기한다:

- `ErrorCode` — 노드 핸들러의 `output.error.code` 가 주 소비처다. **다만 엔진도 종결 시
  `Execution.error.code` 로 쓴다** (예: `EXECUTION_TIME_LIMIT_EXCEEDED` —
  `error-codes.ts:73` 은 `ErrorCode` 소속이고 `execution-engine.service.ts:8270` 이
  `Execution.error.code` 로 싣는다).
- `EngineErrorCode` — **엔진 전용**. 4종(`EXECUTION_QUEUE_WAIT_TIMEOUT` ·
  `WORKER_HEARTBEAT_TIMEOUT` · `SERVER_INTERRUPTED` · `WEBCHAT_IDLE_TIMEOUT`)이고
  `Execution.error` · `NodeExecution.error` 봉투에만 실린다.
- 둘은 **같은 파일의 자매 const** 이고 키가 겹치지 않는다(테스트로 고정).
- **`Execution.error` 는 두 family 가 공존하는 필드다** — "필드로 surface 를 가른다" 고
  읽으면 틀린다. 가르는 축은 **누가 쓰는가**(핸들러 vs 엔진)가 아니라 **누가 쓸 수
  있는가**다: `ErrorCode` 는 양쪽이, `EngineErrorCode` 는 엔진만.

> **초판은 이 공존을 지웠다.** *"`EngineErrorCode` — 엔진이 `Execution.error`·
> `NodeExecution.error` 에 싣는다"* 로만 적어, 그 필드가 `EngineErrorCode` **전용**인 것처럼
> 읽혔다(`--spec` `21_30_10` cross_spec WARNING #1, 실측으로 확인). 규약 문서에 그렇게
> 실리면 다음 사람이 `Execution.error.code` 를 보고 "이건 `EngineErrorCode` 겠지" 라고
> 잘못 좁힌다.

기존 서술("프로젝트 전체의 에러 코드 문자열에 적용")은 **그대로 둔다** — 적용 범위가
넓다는 것이 이 문단의 요지이고, 병기는 그 안에서 대표 surface 를 **하나에서 둘로** 늘리는
것이지 범위를 좁히는 것이 아니다. §Overview 도입부의 "대표 surface"(단수) 표현도 병기에
맞춰 복수로 조정한다(`convention_compliance` INFO #1).

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

착수 근거 plan 의 체크리스트에 이 답을 남겨 **질문이 사라지지 않게** 한다.

**무엇을 안 하나.** §3·§4 의 정규화 파이프라인 서술은 건드리지 않는다 — 그쪽은 "내부 분류
문자열 → 정규화 → public 코드" 형태를 다루는 다른 축이다. 이 draft 가 편집하는 자리는
§Overview 하나이고, 거기서 **대표 surface 열거만** 늘린다.
