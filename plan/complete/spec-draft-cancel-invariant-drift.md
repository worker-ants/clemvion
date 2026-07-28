---
title: "spec draft — retry_last_turn 재진입 cancel 불변식 정정 + node-cancellation §6 소비자 등재"
worktree: spec-cancel-invariant-drift-8b41d2
started: 2026-07-28
owner: project-planner
status: complete
priority: P1
spec_impact:
  - spec/5-system/4-execution-engine.md
  - spec/conventions/node-cancellation.md
---

## Overview

`spec-update-node-cancellation-shutdown-classification.md` **#8** 의 이행 draft.

> **용어 disambiguation** — 본 draft 에서 "replay" 는 `execution.retry_last_turn` 의 **turn
> 재실행**만 가리킨다. 같은 spec 트리의 다른 두 "replay" 와 무관하다: §6.3 Replay Policy
> ("Multi-turn resume 은 replay 가 아님")와 WS seq 버퍼-replay(`execution.replay_unavailable`).
> canonical 식별자는 `execution.retry_last_turn` 이다.

`spec/5-system/4-execution-engine.md` 가 같은 문서 안에서 **서로 모순되는 두 진술**을 담고 있다.
`#1021`~`#1024` 가 코드를 고치는 동안 §1.1 전이표 행과 Rationale 절의 옛 서술이 갱신되지 않아,
**이미 폐기된 동작을 여전히 계약으로 단언**한다. 코드가 옳고 spec 이 낡은 SPEC-DRIFT 역류다.

발견 경로: `--impl-done` 일관성 검토(`review/consistency/2026/07/28/01_26_40`) WARNING #1·#2 —
5개 checker 중 **4개가 서로 다른 각도에서 독립 수렴**했고, `rationale_continuity` 는 이 결함
클래스(Stop 이 조용히 소실)가 `#1021`~`#1023` **3 PR 연속 재발**한 이력을 근거로 HIGH 를 매겼다.

## 착수 전 실측 (코드가 진실임을 확인)

리뷰어 주장을 그대로 받지 않고 구현을 직접 읽어 확인했다.

| # | 확인 대상 | 실측 결과 |
|---|---|---|
| 1 | 사용자 Stop 의 실제 경로 | `ExecutionsService.stop(id)` 은 **두 갈래**다 — `WAITING_FOR_INPUT` 이면 `cancel` continuation job 발행(→ `cancelParkedExecution`, 가드 `status = 'waiting_for_input'`), **`RUNNING`/`PENDING` 이면 즉시 guarded UPDATE** 로 `status=cancelled` + `finishedAt` + `durationMs` 를 커밋(`status IN (:...stoppable)`). `executions.service.ts` |
| 2 | retry replay 중 Execution 상태 | `failed → running`(`allowRetryReentry`) 이므로 replay 중에는 `running`. 따라서 Stop 은 **1번의 즉시 경로**를 탄다 |
| 3 | replay 가 park 없이 성공 종결하면? | `resumeGraphAfterRetry` → `updateExecutionStatus(COMPLETED)` → guarded UPDATE `status IN (비-terminal)` → **affected=0** → 쓰기·emit 모두 skip. 행은 `cancelled` 로 남는다 |
| 4 | replay 가 park 없이 실패 종결하면? | `failRetryExecution` → `finalizeGuarded` 가 행을 재조회 → `canTransition('cancelled', …) === false` → **쓰기·emit 모두 skip**. 행은 `cancelled` 로 남는다 |
| 5 | 취소 시각이 보존되는가 | `finalizeGuarded` 의 `target=CANCELLED` 멱등 분기가 `finishedAt`/`durationMs` 를 SQL `COALESCE(col, :new)` 로 병합해 `stop()` 이 쓴 값을 보존. `error` 는 SET 절에서 제외 |

**결론**: 3·4번 때문에 "park 없이 종결되면 cancel 은 무효과" 는 **성립하지 않는다.** 취소는
1번에서 이미 DB 에 커밋되고, 이후 어떤 자연 종결도 그것을 덮지 못한다. 그 서술은
`#1021`/`#1022`/`#1024` **이전의(무가드 `save()`) 동작**을 옮겨 적은 것이고, 세 PR 의 커밋
메시지는 그 동작을 명시적으로 **결함**으로 규정했다.

## 변경 1 — `spec/5-system/4-execution-engine.md` §1.1 전이표 `failed → running` 행

### 현재 (문제)

> … replay 가 RUNNING 으로 도는 중 도착한 cancel 은 graceful no-op 이며(full B3 — RUNNING
> resume/replay drive 에는 깨울 in-memory 코루틴이 없다), **취소는 다음 `waiting_for_input`
> park 에서 비로소 발효된다**(`cancelParkedExecution` 의 WAITING 가드가 `cancelled` 로 마킹 …)

두 곳이 틀렸다:

- "취소는 다음 park 에서 **비로소 발효**" — DB 는 `stop()` 의 RUNNING 경로에서 **즉시**
  `cancelled` 가 된다. park 는 발효 시점이 아니다.
- `cancelParkedExecution` 을 유일 마킹 지점으로 지목 — 그 함수의 가드는
  `status = 'waiting_for_input'` 이라 **RUNNING replay 에는 애초에 매칭되지 않는다.**

"graceful no-op" 자체는 유지한다 — 진행 중 turn 을 Execution 상태 차원에서 즉시 끊지 않는다는
뜻이고 그건 사실이다(full B3).

### 변경 후

> … replay 가 RUNNING 으로 도는 중 도착한 cancel 은 **진행 중 turn 을 즉시 끊지 않는다**
> (full B3 — RUNNING resume/replay drive 에는 깨울 in-memory 코루틴이 없다). 그러나 취소
> **기록은 지연되지 않는다** — `stop()` 의 RUNNING/PENDING 경로가 조건부 UPDATE
> (`status IN (비-terminal)`)로 `cancelled` + `finishedAt`/`durationMs` 를 즉시 커밋한다.
> replay 는 다음 **turn 경계**에서 `assertExecutionNotCancelled`
> ([node-cancellation §2.4](../conventions/node-cancellation.md))로 이를 관측해 종결하며,
> park 에 도달하는 경우엔 `cancelParkedExecution` 이 짝 `NodeExecution` 까지 `cancelled` 로
> 마킹한다. **park 없이 그 turn 에서 종결되어도 cancel 은 보존된다** — 자연 종결
> (`completed`/`failed`)은 **정본 상태에서의 전이 불가 또는 조건부 UPDATE `affected=0`** 으로
> 무효화되고 종결 이벤트 발행도 함께 skip 된다(두 갈래 판정의 상세는
> [node-cancellation §2.4/§6](../conventions/node-cancellation.md)).

## 변경 2 — 같은 파일 Rationale `failed → running` 재진입 전이 절

### 현재 (문제)

> … 취소는 replay 가 다음 `waiting_for_input` park 에 도달했을 때 `cancelParkedExecution` 의
> `status = WAITING_FOR_INPUT` 가드가 Execution + 동반 WAITING NodeExecution 을 `cancelled` 로
> 마킹하면서 발효된다. **(replay 가 park 없이 그 turn 에서 종결되면 cancel 은 무효과로
> 흘려보내진다.)**

### 변경 후

> … 진행 중 turn 을 즉시 끊지는 않는다(full B3 — RUNNING replay/resume drive 에는 즉시 깨울
> in-memory 코루틴이 없다). 다만 **취소 기록 자체는 즉시**다 — `stop()` 의 RUNNING/PENDING
> 경로가 조건부 UPDATE 로 `cancelled` 를 커밋하고, replay 는 다음 turn 경계의
> `assertExecutionNotCancelled` 에서 이를 관측한다. park 에 도달하면 `cancelParkedExecution`
> 이 짝 WAITING `NodeExecution` 까지 마킹한다.
>
> **park 없이 종결되는 경우에도 cancel 이 우선한다** — 종결 경로가 모두 조건부 UPDATE 를
> 거치므로(`status IN (비-terminal)`) 이미 `cancelled` 인 행은 `completed`/`failed` 로
> 덮이지 않고, 그 종결 이벤트도 발행되지 않는다. 취소 시각(`finishedAt`/`durationMs`)은
> `stop()` 이 쓴 값이 정본으로 보존된다.

### Rationale 에 추가할 근거 (폐기 이력)

섹션 제목에도 번복 태그를 붙인다(이 저장소 관례 — §Multi-turn 재시작 ·
`2-navigation/6-config.md` 의 "R-3 (번복)" 선례. **2차 검토 WARNING #3** — 초판은 "§R-3" 을
파일 없이 인용했는데 저장소에 무관한 동명 "R-3" 라벨이 10곳 이상 있어 집행자가 엉뚱한 곳에
착지한다):
`### \`failed → running\` 재진입 전이 (R1 의 retry 실행 경로) (옛 "park 도달 후 발효" 번복 — 2026-07-28)`

> **옛 서술 철회 (2026-07-28)**: 본 절은 최초 작성(`5e0c5e449`, 2026-06-06) 당시 "replay 가
> park 없이 종결되면 cancel 은 무효과로 흘려보내진다" 고 단언했다. 그것은 당시 구현(무가드
> full-entity `save()`)의 사실 서술이었으나, `#1021`(하류 dispatch 계속) ·
> `#1022`(엔진 무가드 terminal 쓰기 5경로) · `#1024`(retry-turn 종결 2경로)가 그 동작을
> **결함으로 규정하고 차단**했다. 세 PR 모두 "사용자 Stop 이 지연이 아니라 **소실**된다" 를
> 수정 사유로 명시했다. 따라서 park 도달 여부는 cancel 의 발효 조건이 아니며, 이 문서가 그
> 반대를 계약으로 남겨 두면 향후 구현이 가드를 되돌리는 근거로 오인될 수 있다. 실측 근거는
> 본 정정 PR 의 설명과 `plan/complete/` 로 이동한 draft 의 "착수 전 실측" 표.

**날짜는 커밋 해시로 앵커링한다.** 이 draft 초판은 이 문단을 "2026-06-10 작성" 으로 적었는데
그건 §1.1 전이표 77행(`db496a3c2`)의 날짜였다 — Rationale 1454행은 `5e0c5e449`(2026-06-06)다.
`--spec` 검토(WARNING #1)가 `git blame` 으로 잡았고 실측으로 확인했다. 두 지점의 날짜가
가깝고 서로 참조하는 관계라 사람이 맞바꾸기 쉬우므로, **spec 본문에는 날짜 대신 커밋 해시를
남긴다**(#8 집계 문서의 같은 오기도 함께 정정).

> **자기참조 경로 주의 (WARNING #2 반영)**: 초판은 spec 본문에 
> `plan/in-progress/spec-draft-…` 경로를 backtick 으로 인용했다. 그 경로는 draft 가
> `plan/complete/` 로 이동하면 stale 이 되는데, markdown 링크가 아니라
> `spec-link-integrity.test.ts` 도 스캔하지 못해 **build 가드보다 더 조용히** 깨진다
> (선례: `4-execution-engine.md:1362` 은 완료 후 손으로 정정해야 했다). 그래서 시점-불변
> 표현으로 바꿨다.

## 변경 3 — `spec/conventions/node-cancellation.md` §6 표 + frontmatter `code:`

§2.4 가드의 **3번째 소비자**가 빠져 있다. 현재 §6 의 "§2.4 park↔resume 짝 전이 terminal 가드"
행은 `execution-engine.service.ts` 만 나열한다.

### 표에 추가할 행 — 삽입 위치 명시

`§2.4 park↔resume 짝 전이 terminal 가드` 행(현 `:184`) **바로 다음**, 마지막
`Workflow 단위 timeout / graceful shutdown 의 노드 abort` 행(현 `:185`) **앞**에 삽입한다.
같은 §2.4 계열 행이 연속되도록 두고 미구현(—) 행이 표 끝에 남는 현재 배치를 유지한다.

| §2.4 retry 재진입 종결 경로 terminal 가드 | ✓ | `retry-turn.service.ts` — `completeRetryExecution`/`failRetryExecution` 이 공용 `finalizeGuarded` 로 **행을 재조회해 정본 상태를 확인한 뒤** 전이한다. 선점이 관측되면(전이 불가 또는 조건부 UPDATE `affected=0`) **저장·종결 이벤트 emit 을 모두 skip**. mutation 13/13 검증 |

### frontmatter `code:` 에 추가

```yaml
  - codebase/backend/src/modules/execution-engine/retry-turn.service.ts
```

## 변경 3b — §2.4 프로즈에 4번째 bullet (2차 검토 WARNING #2)

§6 표에만 행을 추가하면 **프로즈-표 대응이 깨진다.** §2.4 프로즈는 현재 bullet 3개
(노드 경계 / turn 경계 / park↔resume 짝 전이)가 §6 표의 §2.4 행 3개와 1:1 대응하는 구조다.
`node-cancellation.md` 자신의 선례(`#6 보강(3)`)가 "표 제안에만 근거를 담으면 영구 누락된다"
고 명시했다. `park↔resume 짝 전이 terminal 가드` bullet **다음**에 추가한다:

> - **retry 재진입 종결 경로 terminal 가드** (구현됨 2026-07-28) — `execution.retry_last_turn`
>   재진입의 종결(`completed`/`failed`/`cancelled`)은 in-memory 엔티티를 신뢰하지 않는다.
>   재진입 전이(`failed → running`)가 **다른 엔티티 인스턴스**에 적용되므로 종결 시점의
>   in-memory `status` 는 stale 할 수 있다. 그래서 종결 직전 **행을 재조회해 정본 상태를
>   확인**하고, 그 상태에서 목표로의 전이가 불가하거나 조건부 UPDATE 가 0행이면
>   **저장·종결 이벤트 발행을 모두 skip** 한다. 확인 없이 쓰면 턴 진행 중 도착한 Stop 이
>   `failed`/`completed` 로 덮여 **취소가 소실**된다.

## 변경 4 — 메커니즘 차이 근거는 `## Rationale` 로 (2차 검토 WARNING #2)

초판은 이 근거를 §6 표 각주로 두려 했으나, 위와 같은 이유로 **`## Rationale` 신규 서브섹션**
으로 이관하고 §6 표에는 짧은 상호참조만 남긴다.

`### 왜 취소 시각 보존 메커니즘이 두 가지인가 (2026-07-28)`

같은 §2.4 계약을 **두 가지 메커니즘**이 구현하고 있어, 표만 보면 동일 구현으로 오인된다.

> **취소 시각 보존 메커니즘이 두 가지다.** 이미 `cancelled` 인 행에 종결 경로가 재도달할 때
> `stop()` 이 쓴 `finishedAt`/`durationMs` 를 보존하는 방식이 소비자별로 다르다 —
> `execution-engine.service.ts` 의 `finalizeCancelledExecution` 은 **앱 레벨 `??` 병합**
> (in-memory 값이 비어 있을 때만 채움) 이고, `retry-turn.service.ts` 의 `finalizeGuarded` 는
> **SQL `COALESCE(col, :new)`** 다. 후자를 택한 이유는 재조회(`SELECT`)와 `UPDATE` 사이의 창을
> 신뢰하지 않기 위함이다 — UPDATE 문 자체에서 그 순간의 DB 값을 재평가하므로 그 사이 다른
> 트랜잭션이 값을 채워도 덮지 않는다. 두 방식 모두 "먼저 커밋된 취소 시각이 정본" 이라는
> 동일 계약을 만족한다. 취소 시 `error` 를 저장하지 않는 것도 양쪽 공통이다.

## 변경 5 — §6 표 상단 "코드 대조 갱신일" 배너

`node-cancellation.md:164` 의 `> 2026-07-26 코드 대조로 갱신.` 을 `2026-07-28` 로 갱신한다.
신규 행의 근거 구현일(§2.4 계열 "구현됨 2026-07-27")과 이번 반영일이 배너보다 뒤라, 그대로
두면 배너가 "이 표는 그 구현 이전에 대조됐다" 는 잘못된 신호를 준다.

## 집행 시 함께 처리 (포인터 갱신)

`--spec` 검토 WARNING #3 — 직전 선례(`spec-draft-node-cancellation-chat-channel-correction.md`,
#5 이행)에서 이미 같은 누락이 지적됐던 패턴이다. spec 반영과 **같은 커밋**에서 처리한다.

- [ ] `spec-update-node-cancellation-shutdown-classification.md` 의
      `## 추가 위임 (2026-07-28 #8)` 헤딩을 취소선 + `→ **이행 완료 (2026-07-28)**` 로 갱신
      (같은 문서 #5·§6 표 선례와 동일 형식). 하위 체크박스 3개도 `[x]`.
- [ ] 같은 문서 #8 표의 **날짜 오기 정정** — 467행 `:77 (2026-06-06)` → `2026-06-10
      (db496a3c2)`, 468행 `:1454 (2026-06-10)` → `2026-06-06 (5e0c5e449)`. 아울러 467행이
      "무효과" 인용을 전이표에 귀속시킨 것도 정정한다 — **그 문장은 Rationale(1454)에만 있고**
      전이표(77)의 문제는 "취소는 다음 park 에서 비로소 발효된다" 다.
- [ ] `retry-turn-terminal-guard.md` 상단 🚫 note 의 **사유만** 갱신 — "spec 위임 미반영" →
      "spec 위임 #8 반영 완료. 남은 차단 사유는 통합 목록 P1(원자 claim)". **`complete/` 로
      옮기지는 않는다** — P1 이 열려 있어 여전히 시기상조다.
- [ ] 같은 파일 `spec_impact` 는 **유지**한다. spec 이 이 PR 로 정정되므로 완료 시점에
      Gate C 가 참조할 값으로 계속 유효하다.
- [ ] **`spec-update-node-cancellation-shutdown-classification.md` 에 경량 후속 위임 `#9` 등재**
      — (a) `6-websocket-protocol.md:375` "조기 종료" 표현 정밀도, (b)
      `3-workflow-editor/3-execution.md §4` "강제 중단(Force, 3초 이상 누르기)" 미구현 서술에
      Planned 마커. **2차 `--spec` 검토 WARNING #1** — 초판은 이 약속을 "비목표" 절 산문에만
      적었고, 그건 **이 draft 가 스스로 예방하려던 prose-only 유실 패턴의 자기 반복**이었다
      (같은 클래스가 1차 검토에서 이미 WARNING 으로 지적·해소됐는데 두 번째로 재발). 체크박스로
      승격해 집행 대상에 편입한다.
- [ ] `retry-turn-terminal-guard.md` 🚫-note 는 **문자열 부분치환이 아니라 문단 전체 교체**로
      처리한다 (2차 검토 INFO 4 — 위 지시가 인용한 부분 문자열이 원문에 그대로 없어 완전일치
      치환은 실패한다).

## 비목표 (이 draft 범위 밖)

- **`6-websocket-protocol.md:375` "replay 중 cancel" 의 "진행 중 turn 을 조기 종료" 표현** —
  이 문서가 주장하는 결론(취소가 존중되고 `execution.cancelled` 만 발사된다)은 **옳고** 위
  변경과 모순되지 않는다. 다만 "조기 종료" 는 Execution 상태 차원의 즉시 중단으로 읽힐 여지가
  있고, 실제로는 turn 경계 관측이다(진행 중 I/O 는 §4 cascade 의 `abortSignal` 로 중단될 수
  있어 부분적으로는 맞다). 정밀도 문제이지 모순이 아니므로 본 draft 에서 건드리지 않고
  후속으로 남긴다 — 무리해서 같은 턴에 넓히면 검증 범위가 흐려진다.
  **단 "비목표" 절에만 적어 두면 draft 가 `complete/` 로 이동한 뒤 조용히 유실된다**
  (`--spec` 검토 INFO 3 — 공교롭게도 이 draft 의 근거인 #8 자신이 한때 그 유실 사례였다).
  집행 시 `spec-update-node-cancellation-shutdown-classification.md` 에 **경량 후속 위임 #9**
  로 등재한다.
- `3-workflow-editor/3-execution.md §4` 의 "강제 중단(Force, 3초 이상 누르기)" 미구현 서술이
  이 draft 가 명문화하는 "진행 중 turn 즉시 중단 불가" 제약과 어긋난다(2026-03-26 PRD 이후
  미갱신, 사전 존재 drift, `--spec` 검토 INFO 4). target 파일이 아니므로 이번엔 손대지 않고
  위 #9 와 함께 등재한다.
- 코드 변경 없음. `#8` 은 순수 spec 정정이다.

## Rationale

**왜 코드를 spec 에 맞추지 않고 spec 을 코드에 맞추는가.** 통상은 spec 이 SoT 이므로 불일치는
코드 결함이다. 여기서는 반대인 근거가 셋이다:

1. 옛 서술이 기술한 동작을 **세 개의 PR 이 각각 독립적으로 결함으로 판정하고 수정**했다
   (`#1021`/`#1022`/`#1024`). 커밋 메시지가 사유를 명시한다.
2. **같은 문서 안의 최신 절이 이미 반대 원칙을 기술**한다 — `#1023` 이 §1.1 각주로 추가한
   "짝 전이는 방향과 무관하게 no-op 이 될 수 있다" 블록. 즉 문서 자체가 이미 새 원칙으로
   이동했고, 두 옛 지점만 갱신에서 누락됐다.
3. 자매 컨벤션(`node-cancellation.md` §2.4)과 WS 프로토콜(`6-websocket-protocol.md:375`)도
   새 원칙 쪽이다. 옛 서술이 **소수 의견**이다.

**왜 §1.1 각주를 지우고 통합하지 않는가.** `#1023` 각주는 짝 전이(park↔resume)를 다루고, 이번
정정은 retry replay 종결을 다룬다. 둘은 같은 원칙의 다른 적용면이라 전이표의 해당 행에서
각각 서술하는 편이 찾기 쉽다. 각주를 비대하게 만들지 않는다.

**기각한 대안 — "park 없이 종결" 케이스를 spec 에서 아예 삭제.** 서술을 지우면 독자가 그 경우를
미정의로 받아들여 구현이 다시 갈릴 수 있다. `#1022` 가 닫은 5경로 중 일부가 정확히 "문서가
침묵한 우회 경로" 였다. 명시적으로 "cancel 이 보존된다" 를 적는다.
