---
title: retry-turn 종결 2경로의 무가드 terminal 쓰기 차단 (#1022 동일 클래스)
worktree: retry-atomic-claim-4d9e77
# ↑ 2026-07-28 갱신 — 최초 worktree(retry-turn-cancel-guard-ba75a2)는 #1024 로 머지됐다.
#   plan_guard.py 는 `worktree:` basename 을 현재 worktree 디렉터리명과 매칭하므로, 머지된
#   값을 두면 P1 코드 push 시 가드가 '연결된 plan 없음(ad-hoc)'으로 오판해 **무장 해제**된다
#   (--impl-prep 19_51_18 WARNING #1 실측). 이 plan 의 잔여 P1 이 여기서 진행되므로 갱신한다.
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

> 🚫 **`complete/` 로 옮기지 말 것** — 코드 측은 머지됐고 **spec 위임(#8)도 2026-07-28 반영
> 완료**(`spec-update-node-cancellation-shutdown-classification.md` #8 → 이행 완료).
> §5차 라운드 이후 위생 정리의 **통합 후속 목록 P1(`applyRetryLastTurn` 원자 claim)** 은
> `b351731f0` 로 코드화된 뒤 6R 에서 삽입 위치 결함 2건까지 발견·수정 완료됐으나, P2/P3
> 항목(#2~#17)이 다수 열려 있어 여전히 시기상조다. `spec_impact` 는 그대로 유지한다 — spec
> 이 이 위임으로 정정됐으므로 완료 시점에 Gate C(`spec-plan-completion.test.ts`)가 참조할
> 값으로 유효하다.

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
| 1 | `applyRetryLastTurn` 재진입 가드를 **원자 claim** 으로 전환 — **구현 완료** `b351731f0`. 단 claim **삽입 위치** 결함 2건(CRITICAL#1: "손상 판정" 이 claim 보다 앞에 있어 살아있는 delivery 오판·FAILED 오마킹, CRITICAL#2: claim 성공 후 not-found 분기의 stale full-entity `save()` 가 claim 이 지운 `_retryState` 를 TypeORM jsonb diff 로 부활)이 후속 ai-review 에서 발견돼 **6R 에서 수정 완료** | **P1 완료** | 1R W1 → 5R **CRITICAL 승격** → 코드화 `b351731f0` → 6R 결함 발견·수정 |
| 2 | `EXECUTION_CANCELLED` payload 에 spec §4.1 필수 `cancelledBy` 추가 (`emitCancellationEvent` 재사용). `retry-turn.service.spec.ts` 의 deep-equality 단언 동반 갱신 | P2 | 5R W1 (+ impl-done cross_spec 독립 확인) |
| 3 | atomic-consume SQL(JSONB `-` + `jsonb_exists`) 실 Postgres 검증 — unit·e2e 어느 계층에도 없음. **6R 이후 범위 확장**: `retryLastTurn` 의 원본 claim 뿐 아니라 `applyRetryLastTurn`/`claimSpawnedRetryRow` 의 2차 claim 도 동일 갭 — mock 이 SQL 조건을 평가하지 않아 실 DB 의 `jsonb_exists`/`status` 매칭 결과(동시 UPDATE 상황의 정확한 1/0 반환)를 검증하지 못한다 | P2 | 5R W6 → 6R W7 |
| 4 | COALESCE 경로 실 DB e2e — 신규 패턴이고 현재 근거는 TypeORM 소스 정적 확인뿐 | P2 | 5R (RESOLUTION 한계 명시) |
| 5 | `execution.error` 미클리어 — **성공(COMPLETED) 종결에서도** 옛 실패 메시지 재기록 가능 | P3 | 4R INFO 2 |
| 6 | COMPLETED 타깃 멱등 분기도 CANCELLED 와 같은 시각 부풀림 소지 — 대칭 검토 | P3 | 4R 신규 |
| 7 | `!nodeExec` · `retryAfterSec` fallback · 타임스탬프 부재 분기 미검증 | P3 | 2R INFO 14 = 5R W7 |
| 8 | `forwardRef` 근거 주석 모순 — 모듈 순환 실측 후 주석 정정 또는 제거 | P3 | 1R INFO 1 = 2R W2 = 3R W3 = 5R W3 (**4회**) |
| 9 | `markSpawnedRowFailed` 추출 (3곳 반복) | P3 | 1R W3 = 5R W5 = **7R W8 재지적**(`review/code/2026/07/30/11_41_20`) |
| 10 | `finalizeGuarded` in-place 변이 은닉 — `{persisted, live}` 또는 `@param` 명시 | P3 | 1R INFO 2 = 2R W3 |
| 11 | `resumeGraphAfterRetry` 자연 종결이 `finalizeGuarded` 미경유 (참조 동일성 불변식 의존) | P3 | 2R INFO 2 |
| 12 | 멱등 분기 회고 주석 약 40줄 정리 (실제 제어흐름 6~7줄) | P3 | 5R W4 |
| 13 | 테스트 `createQueryBuilder` mock 팩토리 통합 (6곳) | P3 | 4R W6 = 5R |
| 14 | 멱등 분기의 driver choke point 우회 흡수 — self-transition capability 승격. `emitTerminalExecutionMetrics` 미경유도 함께 | P3 | 4R W2 = 5R W2 |
| 15 | **(6R 신규)** 백스톱 갭 — claim 실패 discard 후 spawn row 가 RUNNING orphan 으로 영구 잔류 가능. 실측: `failOrphanRunningNodeExecutions` 는 `recoverStuckExecutions` 의 stale RUNNING **Execution** 재구동 경로에서만 호출되는데, discard 후 Execution 은 이미 `failed`(terminal) 로 남아 그 경로 대상이 아니다. 트레이드오프상 discard 가 옳지만(활성 작업을 죽이지 않음) orphan row 자체(타임라인/진행률 집계 오염)는 별도 백스톱이 없다 | P2 | 6R developer 실측 (`claimSpawnedRetryRow` JSDoc 인용) |
| 16 | `continuation-execution.processor.ts` 의 claim 대상 제외 목록(`type !== 'retry_last_turn'`)이 여전히 프로즈 주석으로만 `applyRetryLastTurn` 자체 claim 존재에 의존 — 타입/공유 상수 레벨 강제 없음(같은 결합이 5R 이전 CRITICAL 로 1회 이미 깨진 이력) | P3 | 6R side_effect/architecture WARNING #2 (구조 변경, defer) |
| 17 | claim ~ try 진입 전 구간(Promise.all/rehydrateContext/buildRetryReentryState/setNodeOutput/emitNode)의 "크래시 트레이드오프" 서술 범위가 이번 claim 전진 배치로 넓어짐(프로세스 크래시뿐 아니라 이 구간의 일반 예외까지 동일 적용) — Critical#1 수정으로 범위가 확정된 뒤 재평가 필요. `recoverStuckExecutions` 가 이 특유 spawn-row 시나리오까지 실제로 복구하는지도 미검증 | P3 | 6R side_effect WARNING #4 |
| 18 | **(7R 신규)** `claimSpawnedRetryRow`(DB `input_data` 원자 제거)와 `spawnedRow.inputData`(in-memory) 사이의 동기화 불변식이 타입/캡슐화가 아니라 "이 delete 줄을 지우거나 순서를 바꾸지 말 것"이라는 프로즈 관례에만 의존 — CRITICAL #2 와 정확히 같은 결함 클래스의 재발 가능 경로가 구조적으로 열려 있음. `claimSpawnedRetryRow` 가 `spawnedRow`(또는 `inputData`)를 인자로 받아 성공 시 직접 mutate 하거나 `{claimed, retryState?}` 형태로 이미 동기화된 결과를 반환하도록 구조 변경 검토 | P2 | 7R WARNING #5(architecture), `review/code/2026/07/30/11_41_20` |
| 19 | **(7R 신규)** `applyRetryLastTurn` 이 claim 블록 추출에도 불구하고 claim 성공 후 필수가 된 새 판정 2개가 추가되며 순 길이·복잡도가 오히려 늘었다(184→188줄, early-return 가드 7개). `:308-356`(in-memory retryState 확보 → claim → 판정 → in-memory 동기화)을 `claimAndSyncRetryState(spawnedRow): Promise<RetryState \| null>` 로 추출해 본문을 "null 이면 discard, 아니면 계속" 한 줄로 축약 검토 | P3 | 7R WARNING #7(maintainability), `review/code/2026/07/30/11_41_20` |

### spec — project-planner 위임

`spec-update-node-cancellation-shutdown-classification.md` **#8**(이행 완료) · **#10**(P1 코드와
동반 필수 — 별 PR 금지) 에 등재됨(단일 진실).
이 plan 의 §project-planner 위임 절은 그쪽 포인터로만 쓴다.

**(7R 신규)** `spec-update-retry-claim-backstop-gap.md` — §7.5 대칭 Rationale 이 "복구는
`recoverStuckExecutions` 백스톱이 담당한다"고 무조건 서술하나, 이 2차 claim(`claimSpawnedRetryRow`)
경로는 그 백스톱이 닿지 않는다는 실측(위 §코드 표 #15 와 동일 근거)이 코드/plan 에는 이미
반영됐고 spec 문구만 낡았다([SPEC-DRIFT], `review/code/2026/07/30/11_41_20` WARNING #1).

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

## 6차 라운드 (`review/code/2026/07/28/20_32_57`) — 원자 claim **삽입 위치** 결함 2건, 발견·수정 완료

5R 이 CRITICAL 로 승격했던 §5차 라운드 이후 위생 정리 P1 항목(원자 claim 전환)이
`b351731f0` 로 코드화됐다. 이 커밋을 대상으로 한 후속 ai-review(전 14명 reviewer, forced
화이트리스트 전원 포함)가 **claim 자체의 SQL/설계는 견고하나 삽입 위치 때문에 이 PR 이
없애려는 결함 클래스가 두 경로로 재도입**됐음을 발견했다. RESOLUTION:
`review/code/2026/07/28/20_32_57/RESOLUTION.md`.

### CRITICAL #1 (architecture/concurrency/requirement, 3개 reviewer 독립 수렴) — 수정

신규 claim(당시 `:310-339`)보다 **먼저** 실행되는 기존 "`_retryState` 부재 → 무조건 FAILED"
판정(`:293-308`, 이 diff 가 손질하지 않은 pre-existing 코드)이 claim 이 정상적으로 만들어내는
상태("다른 delivery 가 이미 claim 해 `_retryState` 는 사라졌지만 `status` 는 여전히
RUNNING")를 "복구 불가능한 손상"과 구분하지 못해, **아직 처리 중인 살아있는 row 를 즉시
FAILED 로 덮어썼다.** concurrency reviewer 는 진짜 동시성 없이도 BullMQ 기본
`attempts` 재시도만으로 결정적 재현이 가능함을 코드 경로로 논증했다(claim 성공 후 try 진입
전 구간이 try/catch 밖이라, 거기서 일시 예외 → 재배달 → fresh 조회가 이미 지워진
`_retryState` 를 관측 → 원래 회복 가능했을 일시 오류가 영구 FAILED 로 오확정).

**수정**: claim 을 `_retryState` 부재 판정보다 앞으로 이동 + 그 판정 분기 자체를 삭제하고
claim 실패(`affected!==1`)를 원인 구분 없이 항상 ack-and-discard 로 통일
(`retry-turn.service.ts` `applyRetryLastTurn`). `jsonb_exists` 조건이 "이미 소비됨" 과
"한 번도 seed 안 된 진짜 corruption"(구조적으로 발생하지 않음 — `retryLastTurn` 이 항상
seed) 을 모두 흡수하므로 별도 종결 분기가 불필요했다. W6 동반: claim 블록을
`claimSpawnedRetryRow` private 메서드로 추출.

**백스톱 갭(리뷰어 제안과 다름, 실측으로 확정 — 위 §코드 표 #15 신규 등재)**: 리뷰어는
"진짜 corruption 방어는 `recoverStuckExecutions` 류 backstop 에 위임" 하라 했으나, 실측
결과 그 백스톱은 이 케이스에 닿지 않는다 — `failOrphanRunningNodeExecutions` 는
`recoverStuckExecutions` 의 stale RUNNING **Execution** 재구동 경로에서만 호출되는데,
discard 후 Execution 은 이미 `failed`(terminal) 라 재구동 대상이 아니다. 그래도 discard 가
옳다: 살아있는 작업을 죽이는 것(이전 코드)이 이론적 orphan row(discard) 보다 항상 더
나쁘다.

### CRITICAL #2 (side_effect) — 수정

claim 은 DB `input_data` 에서만 `_retryState` 를 원자 제거하고 in-memory `spawnedRow` 는
그대로였다. claim 성공 후 execution/node not-found 분기가 `save(spawnedRow)`(full-entity)
를 호출하면, TypeORM 0.3.30 의 jsonb diff 가 DB 를 재-SELECT 해 stale in-memory(키 있음)와
비교하고 옛 값을 다시 써 **claim 이 지운 `_retryState` 를 부활**시킨다 — 결과는
`status=FAILED` 인데 `_retryState` 가 살아있는 모순 row. mock 기반 유닛 테스트로는 이
Postgres 재-SELECT 상호작용을 구조적으로 검출할 수 없다(리뷰어 지적, 실측으로 확인).

**수정**: claim 성공 직후 `delete spawnedRow.inputData[RETRY_STATE_KEY]` 한 줄로 in-memory
를 DB 와 동기화 — 이 메서드의 모든 하위 `save(spawnedRow)` 호출을 함께 보호한다.

### 함께 조치 (저비용)

- **W1(requirement/concurrency)** — 회귀 테스트 2건: (i) 최초 조회부터 이미 다른 delivery
  가 claim 한 상태(status:RUNNING + `_retryState` 없음) → discard, save() 미호출, (ii) claim
  성공 후 try 진입 전 예외 → FAILED 미마킹 + 재배달 시뮬레이션까지 안전 확인.
- **W3(architecture/maintainability)** — `RETRY_STATE_KEY` 상수화, raw SQL 리터럴 4곳(신규
  2 + 기존 2) + TS 프로퍼티 접근 통합.
- **W8(testing)** — `execution-engine.service.spec.ts` 통합 레벨에 claim 실패(affected=0)
  케이스 신규 추가(기존엔 그 레이어가 이 분기를 한 번도 실행하지 않았음) + "missing
  _retryState" 케이스를 discard 로 갱신.
- **W9(documentation)** — 클래스 docstring "책임" 문단 + `applyRetryLastTurn` "재진입 절차"
  목록에 2차 claim 단계 반영.

### 조치하지 않음 (defer, plan 등재 — 위 §코드 표 #16·#17 신규)

- **W2(architecture)** — `continuation-execution.processor.ts` 의 claim 제외 목록이 여전히
  프로즈 주석으로만 `applyRetryLastTurn` 자체 claim 존재에 의존. 타입/공유 상수 강제는
  구조 변경이라 이 턴 범위 밖(§코드 표 #16).
- **W4(side_effect)** — claim 전진 배치로 "크래시 트레이드오프" 실제 적용 범위(일반 예외
  포함)가 서술보다 넓어짐. Critical#1 수정으로 범위가 확정된 뒤 재평가 대상(§코드 표 #17).
- **W5(scope)** — 무관 plan 문서 편집 2건이 이미 `b351731f0` 에 같은 커밋으로 포함됨.
  되돌리지 않음, 기록만.
- **W7(testing/database)** — 실 Postgres 기반 동시성 e2e 부재. 기존 §코드 표 #3 범위를
  `applyRetryLastTurn`/`claimSpawnedRetryRow` 의 2차 claim 까지 확장(위 표 갱신 완료).
- **W10·W11·W12(documentation)** — 처분표 범위 밖으로 명시 지정돼 이번 라운드에서
  건드리지 않음(`runAiConversationLoop` stale 참조, `ContinuationExecutionProcessor`
  "처리 흐름" stale 서술, CHANGELOG.md 미갱신). 다음 문서-정리 턴으로 이월.

### 검증

**mutation 5/5 RED** (`retry-turn.service.ts` 대상, 원복은 `cp` 절대경로 — 사전 저장한
fixed 스냅샷과 diff 없음 확인):

| 뮤턴트 | 대상 가드 | 결과 |
|---|---|---|
| (a) claim 을 손상 판정 뒤로 되돌림(pre-fix 전체 복원, `b351731f0` 원본) | Critical#1 순서 자체 | RED (retry-turn.service.spec.ts 4건 + execution-engine.service.spec.ts 1건) |
| (b) in-memory `delete _retryState` 제거 | Critical#2 | RED ((d)/(e) 2건) |
| (c) claim 실패 시 discard 대신 FAILED save | claim 실패 discard 불변식 | RED ((b2)/(c)/재배달 테스트 3건) |
| (d) `status = :running` 조건 제거 | claim SQL status CAS | RED ((b3) 1건) |
| (e) `jsonb_exists(...)` 조건 제거 | claim SQL 레이스 결정자 | RED ((b3) 1건) |

각 뮤턴트는 사전 `grep -c` 로 치환 앵커 매칭 건수 1건을 확인한 뒤 적용했다(이 파일 5R
RESOLUTION 이 명시한 "들여쓰기만 다른 부분문자열 비유일 매칭" 함정 재발 방지).

TEST WORKFLOW 전량 재통과: lint PASS(49s) · unit PASS(backend 412 suites/8336 tests[1
skipped], frontend 281 files/5747[1 skipped], web-chat 3/48, channel-web-chat 23 files/409,
내부 packages 9 suites/218 — 전부 0 실패) · build PASS(Dockerfile 이미지 검증 포함) ·
e2e PASS(backend jest 46 suites/260 tests + Playwright 51 tests, 전부 0 실패).

## 7차 라운드 (`review/code/2026/07/30/11_41_20`) — resolution-applier 처리 완료

Critical 0 / Warning 9(6R 수정의 정확한 적용을 14명 전원이 확인한 수렴 라운드 — documentation
reviewer 만 MEDIUM). 처분표대로 5건만 집행하고 나머지는 defer/등재. RESOLUTION:
`review/code/2026/07/30/11_41_20/RESOLUTION.md`.

- [x] **W1(SPEC-DRIFT)** — spec §7.5 대칭 Rationale 이 "복구는 `recoverStuckExecutions`
      백스톱이 담당한다"고 무조건 서술하나, 이 2차 claim 경로는 그 백스톱이 닿지 않는다는
      실측(코드 JSDoc + 위 §코드 표 #15)이 이미 반영됐는데 spec 문구만 낡아 있었다. 코드
      무수정 — draft `plan/complete/spec-update-retry-claim-backstop-gap.md` 신설(2026-07-30 반영 완료),
      project-planner 위임(`consistency-check --spec` 대기).
- [x] **W2(documentation)** — `claimSpawnedRetryRow` JSDoc 내부 자기모순(구 문단 "백스톱이
      담당한다" vs 신규 문단 "백스톱이 닿지 않는다") 정정 — 두 문단이 같은 결론을 가리키게
      함(`7a05c6ec8`).
- [x] **W3(architecture/documentation)** — 재진입 절차 JSDoc 2곳(`:122-123`,`:272-273`)이
      이미 제거된 `runAiConversationLoop` 를 여전히 협력 컴포넌트로 서술하던 stale 참조를
      `processAiResumeTurn`/`PARK_RELEASED` re-park 흐름으로 정정(`7a05c6ec8`). 6R "조치하지
      않음" 목록의 W10 과 동일 건 — 이번 라운드에 해소.
- [x] **W4(testing/requirement)** — claim 성공(`affected:1`) + in-memory `_retryState` 부재
      "이론상 도달 불가능" 방어 분기가 어떤 테스트로도 안 잠겨 있던 갭. mutation 사전검증
      (블록 삭제 → 신규 테스트 RED, 원복 → 43/43 GREEN) 후 회귀 테스트 추가(`886ca9395`).
- [x] **W6(side_effect)** — claim 직후로 앞당겨진 `delete` 가 `NODE_STARTED` emit 의 `input`
      payload 도 조용히 바꾼(`_retryState` 미포함) 사실을 JSDoc 에 명시 + 회귀 테스트 추가
      (mutation 사전검증: delete 비활성화 → 신규 테스트 + 기존 (d)/(e) 동반 RED)(`7a05c6ec8`,
      `886ca9395`).
- **W5(architecture, defer)** — claim↔in-memory 동기화 불변식이 타입/캡슐화가 아니라 프로즈
  관례에만 의존. §코드 표 **#18**(P2, 신규)로 등재 — 구조 변경이라 범위 밖.
- **W7(maintainability, defer)** — `claimAndSyncRetryState` 추출. §코드 표 **#19**(P3, 신규)
  로 등재.
- **W8(maintainability, defer)** — not-found 2블록 `markSpawnedRowFailed` 중복 — §코드 표
  **#9**(1R W3 = 5R W5)와 동일 건, "7R 재지적" 만 덧붙임(신규 등재 없음).
- **W9(dependency, 선택 허용분만 집행)** — typeorm 0.3.30 인용 주석을 "이후 patch 버전에서도
  유지하는 버전-불문 방어" 로 다듬음(`7a05c6ec8`). 체크리스트 신설은 지시대로 하지 않음.
- INFO 20건 — 조치 없음(지시 범위 밖).

### 검증

- W4 mutation: 방어 분기(`if (!retryState) {...}`) 블록 삭제 → 신규 테스트 RED
  (`row.status`: expected `running`, received `failed`) → `cp` 원복(diff 없음 확인) → 43/43
  GREEN 재확인.
- W6 mutation: `delete spawnedRow.inputData[RETRY_STATE_KEY]` 비활성화 → 신규 테스트 +
  기존 CRITICAL#2 회귀 테스트 (d)/(e) 동반 RED(payload/inputData 에 `_retryState` 잔존 관측)
  → `cp` 원복(diff 없음 확인) → 43/43 GREEN 재확인.
- 두 mutation 모두 사전 `grep -c` 로 치환 앵커 매칭 건수 1건 확인 후 적용.

TEST WORKFLOW 전량 재통과: lint PASS(45s) · unit PASS(backend 412 suites/8338 tests[1
skipped, 신규 2건 포함], frontend 281 files/5751[1 skipped], web-chat 3/48, channel-web-chat
23 files/409, 내부 packages 9 suites/218 — 전부 0 실패) · build PASS(123s, Dockerfile 이미지
검증 포함) · e2e PASS(260s, backend jest 46 suites/260 tests + Playwright 51 tests, 전부 0
실패).

> spec draft(`spec-update-retry-claim-backstop-gap.md`)가 반영되기 전까지 이 plan 의
> `spec_impact` frontmatter(`spec/5-system/4-execution-engine.md`)는 그대로 유효 — 완료
> 처리하지 말 것(§코드 표 #1~#19 대부분 여전히 open).
