---
title: retry-turn 종결 2경로의 무가드 terminal 쓰기 차단 (#1022 동일 클래스)
worktree: retry-turn-cancel-guard-ba75a2
started: 2026-07-27
owner: developer
status: in-progress
priority: P1
spec_impact: none
---

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
      (증분 changeset 은 직전 라운드 결함을 구조적으로 못 본다 — `#1022` 에서 실측)
- [ ] `/consistency-check --impl-done`

## 주의

- `failRetryExecution` 의 `isCancelled` 분기는 유지한다 — 취소 시 `execution.error` 를 DB 에
  저장하지 않는 것은 W16(2026-07-26)의 의도된 결정이다.
- `#1022` 가 `finalizeFailedExecution` 에서 겪은 함정: `ALLOWED_TRANSITIONS[PENDING]` 이
  의도적으로 `FAILED` 를 제외한다(`state-machine.spec.ts` 에 명시 테스트). 여기서도 전이
  전 상태가 `PENDING` 일 수 있는지 확인하고, 그렇다면 상태머신을 넓히지 말고 흡수할 것.

## 체크리스트

- [x] 두 지점 guarded 전환
- [x] 회귀 테스트 (mutation 5/5 RED)
- [x] TEST WORKFLOW
- [ ] `/ai-review` (전수)
- [ ] `/consistency-check --impl-done`

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
