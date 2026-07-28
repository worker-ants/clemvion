---
title: retry-turn 종결 2경로의 무가드 terminal 쓰기 차단 (#1022 동일 클래스)
worktree: retry-turn-cancel-guard-ba75a2
started: 2026-07-27
owner: developer
status: in-progress
priority: P1
spec_impact:
  - spec/5-system/4-execution-engine.md
  - spec/conventions/node-cancellation.md
---

> **`spec_impact` 주의** — 이 PR 자체는 `spec/` 을 1줄도 바꾸지 않았다(코드 전용).
> 그럼에도 `none` 이 아닌 이유: consistency-check `--impl-done`(2026-07-28,
> `review/consistency/2026/07/28/01_26_40`) WARNING #4 — 본문이 project-planner 위임으로
> **spec 정정 필요를 스스로 명시**하는데 frontmatter 가 `none` 이면, 이 plan 이
> `complete/` 로 이동할 때 Gate C(`spec-plan-completion.test.ts`)가 그 값을 그대로 신뢰해
> "spec 영향 없음" 이 잘못 확정된다. 아래 §project-planner 위임 항목이 반영되기 전에는
> 완료 처리하지 말 것.

## Overview

`#1022` 가 `execution-engine.service.ts` 에서 닫은 **무가드 terminal 쓰기** 결함 클래스가
`retry-turn.service.ts` 에 그대로 남아 있다. 출처: `#1022` 최종 라운드 리뷰 INFO 8
(`review/code/2026/07/27/01_09_42`) — diff 밖이라 그 PR 범위에서 제외하고 후속으로 등재했다.

## 프로브로 확정한 사실 (2026-07-27)

**티켓이 지목한 것은 1곳(`failRetryExecution`)이었으나 실측 결과 2곳이다.**
`#1022` 에서 "blast radius 를 호출부 개수로 정의해 우회 경로를 못 봤다" 는 실수를 반복하지
않으려고 파일 전체의 terminal 쓰기를 전수 확인했다.

| # | 지점 | 현재 | 위험 |
|---|---|---|---|
| 1 | `failRetryExecution` (`:636`) | `execution.status = CANCELLED\|FAILED` → 무가드 `save()` | 동시 Stop 이 이미 `CANCELLED` 로 마감한 실행을 **FAILED 로 덮어씀** (retryable 재실패 분기) |
| 2 | `completeRetryExecution` (`:435`) | `execution.status = COMPLETED` → 무가드 `save()` | **더 나쁨** — 취소된 실행을 `COMPLETED` 로 덮고 `EXECUTION_COMPLETED` 까지 발행 |

`completeRetryExecution` 은 티켓에 없었다. `@internal` 로 "defensive fallback 에서만 호출" 이라
표기돼 있으나 도달 가능한 경로이고, 결과는 "취소한 실행이 성공으로 보고됨" 이라 오히려 심각하다.

**같은 파일에 이미 guarded 선례가 있다** (`:614`, `resumeGraphAfterRetry` 종결):

```ts
const completed = await this.driver.updateExecutionStatus(savedExecution, ExecutionStatus.COMPLETED);
if (completed) { await this.eventEmitter.emitExecution(...); }
```

즉 신규 패턴 도입이 아니라 **같은 파일 안의 기존 패턴을 두 곳에 마저 적용**하는 작업이다.

## 작업 항목

- [x] 두 지점을 `driver.updateExecutionStatus` 경유 guarded 전이로 교체.
      `false`(동시 cancel 선점) 반환 시 **저장·이벤트 emit 을 모두 skip**.
- [x] 회귀 테스트 — 각 지점에서 DB 가 이미 terminal 이면 (a) 상태를 덮어쓰지 않고
      (b) `EXECUTION_COMPLETED`/`EXECUTION_FAILED` 를 발행하지 않는지. 가드 제거 시 RED.
- [x] TEST WORKFLOW (lint / unit / build / e2e) — 전부 PASS (unit: execution-engine 41 suite / 1,097, e2e 260)
- [x] `/ai-review` — **파일 명시 + `--route=all`** 로 전수 검토할 것
      (증분 changeset 은 직전 라운드 결함을 구조적으로 못 본다 — `#1022` 에서 실측).
      **5라운드 수행, 5R 에서 수렴** (이 PR 이 바꾼 라인의 결함 0).
- [x] `/consistency-check --impl-done` — **BLOCK: NO** (Critical 0), scope `spec/5-system/`,
      `review/consistency/2026/07/28/01_26_40`. WARNING 6건은 BLOCK:NO 여도 반영해
      아래 §5차 라운드 이후 위생 정리에 처분을 기록했다.

## 주의

- `failRetryExecution` 의 `isCancelled` 분기는 유지한다 — 취소 시 `execution.error` 를 DB 에
  저장하지 않는 것은 W16(2026-07-26)의 의도된 결정이다.
- `#1022` 가 `finalizeFailedExecution` 에서 겪은 함정: `ALLOWED_TRANSITIONS[PENDING]` 이
  의도적으로 `FAILED` 를 제외한다(`state-machine.spec.ts` 에 명시 테스트). 여기서도 전이
  전 상태가 `PENDING` 일 수 있는지 확인하고, 그렇다면 상태머신을 넓히지 말고 흡수할 것.

## 체크리스트

- [x] 두 지점 guarded 전환
- [x] 회귀 테스트 (mutation 13/13 RED — 1R~4R 가드 전량, 5R 시점 재실측)
- [x] TEST WORKFLOW
- [x] `/ai-review` (전수, 5라운드 — 5R 수렴)
- [x] `/consistency-check --impl-done` (BLOCK: NO)
- [x] PR 머지 — [#1024](https://github.com/worker-ants/clemvion/pull/1024), `771801e3e` (2026-07-28)

> 🚫 **`complete/` 로 옮기지 말 것** — 코드 측은 머지됐으나 아래 §project-planner 위임
> (spec 자기모순 정정)이 미반영이고 `spec_impact` 가 그 2개 파일을 가리킨다. 지금 옮기면
> Gate C(`spec-plan-completion.test.ts`)가 그 값을 신뢰해 잘못 확정한다. 위임 반영 후 이동.

## ai-review 결과 (2026-07-27, `review/code/2026/07/27/21_07_03`)

Critical 2 / Warning 3. **Critical 1건은 전제가 반증됐다** — 실측으로 확인하고 그 사실을
회귀 테스트로 고정했다.

### CRITICAL#1 (architecture) — 반증

> "자연 종결(happy-path) 경로가 신규 가드를 우회해 stale `failed` 로 `FAILED→COMPLETED`
> 자기전이 throw 를 일으키고, retry 성공이 **구조적으로 항상** FAILED 로 오분류된다"

실측: `processAiResumeTurn(execution, …)` 에 넘기는 것은 orchestrator 가 상태를 갱신하는
**바로 그 객체**다. 성공 턴이면 `finalizeAiNode` 의 else 분기가
`updateExecutionStatus(savedExecution, RUNNING, …)` 로 그 객체를 `running` 으로 만들고,
따라서 `resumeGraphAfterRetry` 는 `running → completed` 를 본다. 자기 전이가 아니다.

다만 **"그 경로를 덮는 회귀 테스트가 없다" 는 지적 자체는 옳았다** — 성공 턴 + 그래프 완주
케이스를 실제로 도달시키는 테스트를 추가해 이 불변식을 고정했다.

### CRITICAL#2 (documentation) — 수정

`finalizeGuarded` 추출 시 `completeRetryExecution` 의 JSDoc 이 그 위에 고아로 남아,
(a) `completeRetryExecution` 이 무문서가 되고 (b) 고아 블록의 "defensive fallback 에서만
호출" 문구가 `finalizeGuarded`(호출부 2곳) 설명으로 오독될 수 있었다. 원 소유 메서드 위로
되돌렸다.

### 후속 (본 PR 밖)

- [ ] **W1 (concurrency)** — `applyRetryLastTurn` 진입부의 `spawnedRow.status !== RUNNING`
      체크가 **원자 claim 이 아니다**(`continuation-execution.processor.ts` 가 `retry_last_turn`
      을 원자 claim 대상에서 명시적으로 제외). 중복 continuation job 전달 시 중복 LLM 턴·공유
      context mutation·중복 종결 이벤트를 완전히 막지 못한다. 조건부 UPDATE(CAS)로 강화하거나
      중복-job 시뮬레이션 테스트로 현 한계를 명시 검증할 것. **이 PR 이 겨냥한 "동시 Stop 이
      다른 target 을 덮어쓰는" 레이스와는 별개**이며 그쪽은 닫혔다.
- [ ] **W3 (maintainability)** — "spawn 된 row 를 FAILED 로 마감" 로직이
      `applyRetryLastTurn` 3개 분기에 문자 그대로 반복(DRY). `markSpawnedRowFailed` 추출.
- [ ] **INFO 1** — `AiTurnOrchestrator` forwardRef 근거 주석이 이미 제거된 역방향 의존성을
      순환 근거로 인용 중일 가능성. forwardRef 존속 필요성 재확인 후 주석 갱신.
- [ ] **INFO 2** — `finalizeGuarded` 가 호출자 소유 `execution.status` 를 부수효과로 재대입.
      현재 두 호출부는 재사용하지 않아 안전하나 시그니처만으로는 드러나지 않는다.

## 2차 라운드 추가 후속 (`review/code/2026/07/27/21_39_25`)

- [ ] **W2 (architecture)** — `AiTurnOrchestrator` forwardRef 근거 주석이 같은 파일
      docstring·모듈 등록 주석("engine→Retry 역방향 주입 제거, 단방향 정리")과 **정반대로
      모순**된다. grep 상 엔진도 orchestrator 도 `RetryTurnService` 를 주입하지 않아,
      forwardRef 가 실제로 방어하는 순환이 무엇인지 주석만으로는 검증 불가. 존속 필요성
      재확인 후 주석 갱신 또는 forwardRef 제거 검토.
- [ ] **W3 (maintainability)** — `finalizeGuarded` 가 `boolean` 반환과 동시에 인자
      `execution.status` 를 in-place 로 덮어쓰는 숨은 side-channel. `{ persisted, live }`
      반환으로 명시화하거나 최소한 `@param` 에 명시.
- [x] **W4 (testing)** — spec 헤더 주석이 "deep-integration 은 엔진 thin delegator 경유로
      엔진 spec 에 잔류" 라 서술하나 그 delegator 는 이미 제거됐고 엔진 spec 이 실
      `RetryTurnService` 인스턴스를 직접 구동한다. 문서 drift 정정.
      **3차 라운드에서 해소** — Critical #2 로 재지적됐고 헤더를 2계층 구조 서술로 정정
      (`084f96a51`).
- [ ] **INFO 2** — `resumeGraphAfterRetry` 자연 종결 분기는 `finalizeGuarded` 를 거치지 않고
      `driver.updateExecutionStatus` 를 직접 호출한다. 현재는 "`execution` 참조 동일성"
      불변식 덕에 안전하고 회귀 테스트로 고정했으나, orchestrator 가 엔티티를 재조회/교체하는
      형태로 바뀌면 같은 stale-전이 결함이 재발할 수 있다. 통일 적용 또는 불변식 주석 추가.
- [ ] **INFO 14** — 멱등 분기의 CANCELLED 타깃 대칭 테스트, `retryLastTurn` 의 `!nodeExec`
      서브분기·`retryAfterSec` fallback/타임스탬프 부재 분기 미검증.
- [ ] **INFO 13** — WS 프로토콜 문서에 "동시 취소 시 후발 종결 시도는 이벤트 없이 폐기" 계약
      한 줄 추가(planner 범위).

## 3차 라운드 (`review/code/2026/07/27/22_36_40`) — resolution-applier 처리 완료

8/14 reviewer 가 `finalizeGuarded` 멱등 분기의 동일 코드 라인에서 새 CRITICAL 을 독립
수렴 확인(2차 라운드 수정 자체가 남긴 잔여 비대칭). 처분표대로만 집행, RESOLUTION:
`review/code/2026/07/27/22_36_40/RESOLUTION.md`.

- [x] **Critical #1** — 멱등 분기 guarded UPDATE 가 `.execute()` 의 `affected` 를 확인하지
      않고 무조건 `true` 반환하던 결함. `FAILED→RUNNING` 은 `allowRetryReentry` opt-in 으로
      허용되는 전이라 동시 재진입이 0행을 실제로 만들 수 있다 — 확인해 대칭 처리 + 회귀
      테스트(`c946a46b7`, 포맷 fixup `d871a055c`).
- [x] **Critical #2** — 위 W4(2차 라운드) 항목과 동일 건, 재지적으로 확정 해소(`084f96a51`).
- [x] **Warning #1(testing)** — 2차 라운드 CRITICAL 회귀 테스트가 `error` 만 assert 하고
      `finishedAt`/`durationMs` 는 vacuous 하던 구간 해소, 양쪽 케이스 관계식 단언 추가
      (`679039667`).
- [x] **Warning #2(documentation)** — `CHANGELOG.md` #7 항목 stale 문구를 2R/3R 최종 구현에
      맞게 갱신(`1237c18a3`).
- [x] **Warning #4(maintainability)** — mock 리터럴 9회 반복을 `mkLiveExecution(status)` 로
      추출(`cc98374ff`).
- [ ] **Warning #3(architecture)** — 위 2차 라운드 W2(forwardRef 근거 주석 모순)와 동일 건,
      **이번 라운드도 defer** — 모듈 레벨 import 순환 실측이 필요해 범위 밖. 계속 열어둔다.

나머지(2차 라운드 W1·W3·INFO2·INFO14·INFO13, 1차 라운드 항목)는 이번 라운드 SUMMARY 에서도
재지적되지 않았거나(W1=INFO8, W3=INFO6, INFO2=INFO7 로 재확인만 됨) 범위 밖으로 유지 —
변경 없음. TEST WORKFLOW 전량 재통과(lint/unit/build/e2e 전부 PASS, e2e: backend 46 suites/
260 tests + playwright 51 tests).

## 4차 라운드 (`review/code/2026/07/27/23_46_36`) — resolution-applier 처리 완료

side_effect 리뷰어가 `finalizeGuarded` 멱등 분기의 `target=CANCELLED` 케이스에서 새 CRITICAL 을
발견(2R/3R 수정이 남긴 또 다른 잔여 비대칭 — CANCELLED 만 FAILED 와 동일하게 무조건 재기록되고
있었다). 처분표대로만 집행, RESOLUTION: `review/code/2026/07/27/23_46_36/RESOLUTION.md`.

- [x] **Critical #1 (side_effect)** — 멱등 분기가 `target=CANCELLED` 일 때도 FAILED 와 동일하게
      `finishedAt`/`durationMs`/`error` 를 무조건 새 값으로 재기록해, `stop()` 이 이미 커밋한
      정확한 취소 시각(T1)을 재진입 catch 시각(T2)으로 덮어썼다(`finalizeCancelledExecution`
      의 `??` 병합 계약과 불일치). `finishedAt`/`durationMs` 를 SQL `COALESCE(col, :new)` 로
      전환(SELECT~UPDATE 사이 창을 신뢰하지 않기 위해 UPDATE 문 자체에서 그 순간의 DB 값을
      재평가), `error` 는 SET 절에서 아예 제외(`34f3dd051`). FAILED/COMPLETED 분기는
      무수정(2R/3R 수정 그대로 보존).
- [x] **Warning #1 (testing)** — `mkLiveExecution(CANCELLED)` + `target=CANCELLED` 조합이
      한 번도 실행되지 않던 갭 해소. COALESCE 표현 확인 + stale error 미기록 확인(fixture 에
      사전 채운 stale error 로 관측 가능하게 함) + affected=0 대칭 회귀 테스트 추가(`2c5930ded`).
- [x] **Warning #7 (documentation)** — `completeRetryExecution`/`failRetryExecution` JSDoc
      최상단에 guarded-skip 계약 한 줄씩 추가(`34f3dd051`, 주석만 변경).
- **Warning #2 (architecture)** — 멱등 분기의 driver choke point 우회 — defer(self-transition
  capability 신설은 구조 변경이라 이 PR 범위 밖).
- **Warning #3 (security)** — 멱등 분기 ABA 왕복 창 — defer(발생가능성 낮음, 이 PR 이 이미
  닫은 창보다 좁음).
- **Warning #4 (concurrency)** — 위 1차 라운드 W1 과 동일 건. 이미 등재됨, 추가 조치 없음.
- **Warning #5 (maintainability)** — 위 1차 라운드 W3 과 동일 건. 이미 등재됨, 추가 조치 없음.
- [ ] **Warning #6 (maintainability, 신규 등재)** — 회귀 테스트의 `createQueryBuilder`
      guarded-update mock 리터럴(`{update,set,where,andWhere,execute}` 체이너)이 스파이 배선만
      다른 채 근접 중복(이번 라운드 2곳 추가로 누적 6곳). 공유 팩토리
      (`mockGuardedUpdateBuilder({affected, setSpy?, andWhereSpy?, setParameterSpy?})`)로
      통합 검토.
- **Warning #8 (documentation/spec)** — 위 2차 라운드 INFO 13 과 동일 건, `project-planner`
  범위. 추가 조치 없음.
- [ ] **INFO 2 (requirement, 신규 등재)** — `execution.error` 가 retry 시작 시점의 옛 실패
      메시지를 비우지 않아, 취소 종결뿐 아니라 **성공(COMPLETED) 종결에서도** 옛 값이 그대로
      재기록될 수 있다(`status:'completed'` 인데 `error` non-null 인 모순 레코드). 취소 경로는
      이미 별도 계열로 추적 중이었으나, 성공 경로도 동일 문제라는 점은 이번 라운드 신규 확인.
      `applyRetryLastTurn` 진입 시 또는 자연종결 직전 `execution.error = null` 명시적 세팅 검토.
      이번 diff 의 신규 회귀는 아님(diff 이전부터 동일 동작).
- [ ] **후속 (신규 등재)** — **COMPLETED 타깃 멱등 분기도 CANCELLED 와 같은 시각 부풀림 소지가
      있다.** 이번 라운드는 리뷰어가 CANCELLED 만 Critical 로 지목했고 §2.3 같은 명명된 계약도
      CANCELLED 에만 있어 그 범위로 한정해 고쳤다. 후속 라운드에서 "자연 성공 종결이 이미 다른
      경로로 COMPLETED 를 커밋한 뒤 이 멱등 분기가 재도달하는 시나리오가 실제로 가능한가" 부터
      실측하고, 가능하면 COMPLETED 도 동일한 COALESCE 전환 검토.

나머지(INFO 1·3~26)는 이번 라운드에서 조치 대상 아님(이미 추적 중이거나 범위 밖 재확인) —
변경 없음. TEST WORKFLOW 전량 재통과 — 실제 수치는
`review/code/2026/07/27/23_46_36/RESOLUTION.md` 참조.

## 5차 라운드 (`review/code/2026/07/28/00_44_54`) — **수렴 판정, 코드 변경 0건**

RESOLUTION: `review/code/2026/07/28/00_44_54/RESOLUTION.md`.

**수렴 근거는 "발견 0" 이 아니라 발견의 성격 전환이다.** 1R~4R 은 매 라운드 *이 PR 이 바꾼
라인* 에서 결함이 나왔다(JSDoc 고아 → lifecycle 필드 유실 → `affected` 미확인 → CANCELLED
취소 시각 오염). **5R 은 이 diff 안에서 결함 0** 이고, CRITICAL 1 + WARNING 8 이 전부 diff
밖(인접 pre-existing 코드 / 기존 등재 후속 / planner 범위)이다. `--route=all` 로 파일 전체를
보기 때문에 표면화됐을 뿐이다. `scope` 리뷰어 판정 NONE("무관 변경 없음"), `database` 신규
발견 0, `concurrency` 외 13개 reviewer 전원 LOW/NONE.

### CRITICAL #1 (concurrency) — pre-existing 실측 확인, defer. **단 심각도 승격 반영**

`applyRetryLastTurn` 재진입 가드(`spawnedRow.status !== RUNNING`)의 비원자성 = 아래 **W1 과
동일 건**. 리뷰어 provenance 주장을 그대로 받지 않고 직접 실측했고 주장이 맞았다:

- 이 PR 의 diff hunk (`@@ -20 / -414 / -429 / -436 / -631 / -640 / -655`) 중 문제 라인
  **272~287 을 포함하는 hunk 가 없다.**
- `git blame -L 272,287 origin/main` → 전 행 `0c275dd7f0` 소유(= origin/main 기존 코드).
- 최초 도입 `3213a4a55` (`#361`).

**2~4R 에서 WARNING 이던 것이 5R 파일 전체 검토에서 CRITICAL 로 승격됐다.** 착수 시 이 근거를
전제로 삼을 것:

- 트리거(사변적이지 않음): BullMQ stalled-job 복구(멀티턴 LLM 이 길어 lock 갱신을 놓치는 경우),
  `CONTINUATION_WORKER_CONCURRENCY` 상향(문서가 정상 운영 시나리오로 명시), multi-instance
  배포에서 같은 row 에 대한 중복 continuation job 발행.
- 영향: 두 concurrent 흐름이 락 없는 **인스턴스-로컬 `ExecutionContext`(`Map`)** 를 공유해
  대화 상태(messages/turnCount) 훼손, 중복 LLM 호출·과금, downstream 실 부수효과 도구
  (Cafe24/MakeShop/MCP) 중복 실행.
- 자기모순 근거: `continuation-execution.processor.ts` 가 다른 4개 continuation 타입에는
  원자 `claimResumeEntry` 를 적용하면서 `retry_last_turn` 만 제외하는데, 그 processor 의
  JSDoc 자신이 "비원자 SELECT 재검증과 달리 check-then-act 창이 없어야 이중 실행 0 을
  기계적으로 보장한다"고 원자성의 필요조건을 명시한다.
- 해법 후보: 같은 파일 `retryLastTurn` 이 이미 쓰는 조건부 UPDATE + `affected` 확인 패턴
  재사용(`UPDATE ... WHERE id=:id AND status='running' RETURNING id`). 회귀 테스트는
  "claim 0행 → ack-and-discard, `rehydrateContext`/`processAiResumeTurn` 미호출".

### 5R 신규 등재 후속

- [ ] **W1(api_contract) — `EXECUTION_CANCELLED` payload 에 `cancelledBy` 누락.**
      spec §4.1 이 `'user'|'system'|'timeout'` 닫힌 union 을 필수로 요구하는데
      `failRetryExecution` 의 payload 는 `{ status }` 뿐이다. **pre-existing 확인** — 이 PR 은
      `status: execution.status` → `finalStatus` 만 바꿨고 `cancelledBy` 는 원래부터 없었다.
      자매 경로는 `emitCancellationEvent` 공유 헬퍼로 이미 통합돼 있다(`cancelledBy` 계약 W3).
      소비자(`chat-channel.dispatcher.ts`)는 `result` 부재를 `{}` 로 방어해 크래시는 없으나 값이
      유실된다. 수정 시 `retry-turn.service.spec.ts` 의 deep-equality 단언도 함께 갱신 필요.
- [ ] **W6(testing) — `retryLastTurn` atomic-consume SQL 이 어느 계층에서도 미검증.**
      JSONB `-` 키 제거 + `jsonb_exists` 동시성 가드가 unit(mock 체이너가 인자 미검증)·e2e
      (`grep -rl "retry_last_turn" test/` 0건) 모두에서 평가되지 않는다. 리뷰어가 커버리지
      리포트로 해당 행 uncovered 실측(branch 78.87%). 이 메서드의 핵심 불변식("동시 retry 의
      중복 spawn 차단")을 뒷받침하는 테스트가 전무하다.
- [ ] **W4(maintainability) — 멱등 분기 회고 주석 누적 정리.** 2~4R 소견이 삭제 없이 누적돼
      회고 주석 약 40줄 > 실제 제어흐름 6~7줄. **지적은 타당하다.** 다만 수렴 판정 규칙(Critical
      해소 후 코드를 더 건드리지 않는다)에 따라 이번 턴에는 손대지 않았다 — 여기서 주석을
      정리하면 리뷰가 다시 stale 이 되어 6라운드가 열린다. 안정화 후 "왜 이렇게 처리하는가"의
      최종 결론만 남기고 라운드별 서사는 커밋 메시지/PR 본문/본 plan 으로 이관.
- [ ] **COALESCE 경로의 실 DB 검증 부재.** 4R 이 도입한
      `.set({ col: () => 'COALESCE(col, :p)' })` + `setParameter` 는 코드베이스에 선례가 없는
      신규 패턴이고(기존 `.set()` raw 식은 전부 `NOW()` 등 파라미터 없는 형태), 단위 테스트는
      query builder 를 mock 하므로 SQL 유효성을 검증하지 못한다. TypeORM 0.3.30 소스로 세 고리
      (raw 식의 `column.databaseName` 매핑 / `setParameter` → `expressionMap.parameters` /
      `getQueryAndParameters` 의 전체 SQL 파라미터 치환)를 확인했으나 **정적 근거이고 docker
      미기동으로 실 DB 실행은 못 했다.** 이 경로를 실제 DB 로 밟는 e2e 를 추가할 것.

### 5R defer (기존 등재 항목의 재지적 — 추가 조치 없음)

- **W2(architecture)** driver choke point 우회 = 4R W2 동일 건.
- **W3(documentation)** forwardRef stale 주석 = 2R W2 / 3R W3 동일 건.
- **W5(maintainability)** `markSpawnedRowFailed` 추출 = 1R W3 동일 건.
- **W7(testing)** `!nodeExec` / `retryAfterSec` fallback / 타임스탬프 부재 분기 = INFO 14 동일 건.
- **W8(SPEC-DRIFT)** = 2R INFO 13 의 확장. `project-planner` 위임 — 아래 별도 항목 참조.
- INFO 23건 — 조치 없음.

### project-planner 위임 (developer 권한 밖)

- [ ] **spec 자기모순 정정.** `spec/5-system/4-execution-engine.md` 줄 77(전이표)·1454(상세
      산문)는 2026-06-06 작성 그대로 "park 없이 그 turn 에서 종결되면 cancel 은 무효과로
      흘려보내진다"고 하는데, 줄 79-92(2026-07-27 `#1023` 신설)는 "park 여부 무관 cancel 은
      항상 보존"이라고 정반대로 서술한다. **코드·테스트가 후자를 증명하므로 코드는 유지하고
      spec 을 정정해야 한다**(이 PR 의 회귀 테스트 "정본이 이미 CANCELLED 면 FAILED 로 전이를
      시도조차 하지 않는다" + `#1021`/`#1022` 커밋 메시지가 구 동작을 명시적으로 결함으로 규정).
      함께 `spec/conventions/node-cancellation.md:184` §6 구현 현황 표에 `retry-turn.service.ts`
      (`finalizeGuarded`) 행 추가.

## 5차 라운드 이후 위생 정리 (2026-07-28, PR 머지 후)

위 라운드별 섹션은 **발견 이력(증거)** 이라 그대로 둔다. 다만 같은 항목이 라운드마다 다시
등재돼 **고유 14건이 체크박스 20개로 흩어졌다**(`forwardRef` 3회, `finalizeGuarded` in-place
변이 2회 등) — 착수 시 같은 걸 두 번 잡게 되므로 아래를 **단일 진실 목록**으로 삼는다.
각 항목의 발견 근거는 괄호 안 라운드 섹션 참조.

### 코드 — 우선순위 순

| # | 항목 | 우선 | 근거 라운드 |
|---|---|---|---|
| 1 | `applyRetryLastTurn` 재진입 가드를 **원자 claim** 으로 전환 (`retryLastTurn` 의 조건부 UPDATE + `affected` 패턴 재사용). 회귀 테스트: "claim 0행 → ack-and-discard, `rehydrateContext`/`processAiResumeTurn` 미호출" | **P1** | 1R W1 → 5R **CRITICAL 승격** |
| 2 | `EXECUTION_CANCELLED` payload 에 spec §4.1 필수 `cancelledBy` 추가 (`emitCancellationEvent` 재사용). `retry-turn.service.spec.ts` 의 deep-equality 단언 동반 갱신 | P2 | 5R W1 (+ impl-done cross_spec 독립 확인) |
| 3 | `retryLastTurn` atomic-consume SQL(JSONB `-` + `jsonb_exists`) 검증 — unit·e2e 어느 계층에도 없음 | P2 | 5R W6 |
| 4 | COALESCE 경로 실 DB e2e — 신규 패턴이고 현재 근거는 TypeORM 소스 정적 확인뿐 | P2 | 5R (RESOLUTION 한계 명시) |
| 5 | `execution.error` 미클리어 — **성공(COMPLETED) 종결에서도** 옛 실패 메시지 재기록 가능 | P3 | 4R INFO 2 |
| 6 | COMPLETED 타깃 멱등 분기도 CANCELLED 와 같은 시각 부풀림 소지 — 대칭 검토 | P3 | 4R 신규 |
| 7 | `!nodeExec` · `retryAfterSec` fallback · 타임스탬프 부재 분기 미검증 | P3 | 2R INFO 14 = 5R W7 |
| 8 | `forwardRef` 근거 주석 모순 — 모듈 순환 실측 후 주석 정정 또는 제거 | P3 | 1R INFO 1 = 2R W2 = 3R W3 = 5R W3 (**4회**) |
| 9 | `markSpawnedRowFailed` 추출 (3곳 반복) | P3 | 1R W3 = 5R W5 |
| 10 | `finalizeGuarded` in-place 변이 은닉 — `{persisted, live}` 또는 `@param` 명시 | P3 | 1R INFO 2 = 2R W3 |
| 11 | `resumeGraphAfterRetry` 자연 종결이 `finalizeGuarded` 미경유 (참조 동일성 불변식 의존) | P3 | 2R INFO 2 |
| 12 | 멱등 분기 회고 주석 약 40줄 정리 (실제 제어흐름 6~7줄) | P3 | 5R W4 |
| 13 | 테스트 `createQueryBuilder` mock 팩토리 통합 (6곳) | P3 | 4R W6 = 5R |
| 14 | 멱등 분기의 driver choke point 우회 흡수 — self-transition capability 승격. `emitTerminalExecutionMetrics` 미경유도 함께 | P3 | 4R W2 = 5R W2 |

### spec — project-planner 위임

`spec-update-node-cancellation-shutdown-classification.md` **#8** 에 등재됨(단일 진실).
이 plan 의 §project-planner 위임 절은 그쪽 포인터로만 쓴다.

### 착수 시 주의

- **착수 직전 `git log origin/main` + 해당 파일 grep 으로 항목별 재판정**하라 — 병렬 세션이
  먼저 닫을 수 있다(특히 8·9·14 는 리팩터 성격이라 다른 PR 이 지나갈 확률이 있다).
- 1번은 `continuation-execution.processor.ts` 의 claim 제외 목록도 같은 턴에 손봐야 한다
  (지금 `retry_last_turn` 만 명시 제외되어 있고, 그 파일 JSDoc 이 원자성의 필요조건을 스스로
  명시해 자기모순 상태다).
- 이 파일 종결부는 5라운드에 걸쳐 "한 겹 고칠 때마다 인접 가정이 깨지는" 이력이 있다.
  수정 전에 **그 변경이 어떤 기존 가정을 건드리는지** 먼저 확인할 것 — 형제 헬퍼
  (`finalizeCancelledExecution`) JSDoc 이 계약을 명시하고 있는 경우가 많다.

### consistency-check `--impl-done` WARNING 처분 (BLOCK: NO 였으나 전량 반영)

세션 `review/consistency/2026/07/28/01_26_40`, scope `spec/5-system/`. Critical 0.

| # | checker | 처분 | 반영 위치 |
|---|---|---|---|
| 1 | cross_spec · rationale_continuity · convention_compliance · plan_coherence (**4개 독립 수렴**) | planner 위임 등재 | `spec-update-node-cancellation-shutdown-classification.md` **#8** 신규 |
| 2 | 동일 4개 | planner 위임 등재 | 같은 #8 (§6 표 + frontmatter `code:`) |
| 3 | plan_coherence | **수정** — 이 PR 이 해소한 항목이 원 plan 에 미체크로 남아 있었다 | `ie-resume-turn-boundary-cancel.md` 체크 + 양방향 교차 링크 |
| 4 | convention_compliance | **수정** — `spec_impact: none` 이 본문과 자기모순 | 이 파일 frontmatter → 2개 파일 목록 + 완료 금지 주의 |
| 5 | cross_spec | 코드 후속 등재 (pre-existing) | 위 통합 목록 #2 (`cancelledBy`) |
| 6 | naming_collision | **하네스 결함** — 기존 백로그로 흡수 | `harness-consistency-summary-downgrade-rule.md` (natural sort + 관측 가능성 항목 추가) |

> #6 은 처음에 `harness-consistency-impl-done-bundle-sort.md` 로 별도 등재했으나, 기존
> `harness-consistency-summary-downgrade-rule.md` 가 **같은 결함**("알파벳순 폴더 dump 가
> 예산을 선점")을 이미 기록하고 있었다. 등재 전에 harness 백로그를 확인하지 않은 실수다.
> 새로 얻은 진단(사전순 정렬로 두 자리 번호가 한 자리를 앞선다)만 그쪽으로 옮기고 별도
> 파일은 폐기했다.
