# 요구사항(Requirement) 충족 리뷰

## 발견사항

- **[CRITICAL]** `applyRetryLastTurn` 의 신규 원자 claim이 "동시 배달 시 하나만 통과"를 목표로 하지만, claim보다 **먼저** 실행되는 `_retryState` 부재 판정 분기가 이 claim 자체가 만들어내는 정상 상태(= 다른 delivery가 이미 원자적으로 claim해 처리 중)와 진짜 corruption(= 애초에 seed되지 않음)을 구분하지 못해, 아직 살아있는 다른 delivery가 정상 처리 중인 row를 파괴적으로 덮어쓸 수 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:293-308` (missing-retryState 판정), 원자 claim은 `:310-339`.
  - 상세:
    실행 순서가 다음과 같다 — (1) `findOneBy` 로 `spawnedRow` 조회, (2) `status !== RUNNING` fast-path (281-291행, "레이스 결정자 아님"이라고 스스로 명시), (3) `seededInput._retryState` 가 없으면 **즉시 `spawnedRow.status = FAILED` 로 세팅해 `save()` 하고 return** (293-308행), (4) 그 다음에야 `input_data - '_retryState'` 조건부 UPDATE(원자 claim, 310-339행)를 실행한다.

    이 순서 때문에 두 delivery A(살아있음, 처리 중)·B(중복 배달) 가 겹치는 시나리오에서:
    - T1: A가 원자 claim에 성공해 DB의 `input_data` 에서 `_retryState` 키를 제거한다. A는 계속 `processAiResumeTurn` 을 실행 중이며 이 턴은 초 단위 이상 걸릴 수 있다(LLM 호출). 이 구간 동안 row의 `status` 는 여전히 `running` 이다(다음 종결 시점까지 바뀌지 않음 — `PARK_RELEASED` 로 재-park 되면 그 상태로 무기한 유지될 수도 있다).
    - T2 (T1 이후, A가 아직 끝나기 전): B가 `findOneBy` 로 같은 row 를 읽는다. `status==='running'` 이므로 (2)의 fast-path는 통과하고, `inputData._retryState` 는 이미 A가 제거했으므로 **없다**. B는 (3)의 "missing → 진짜 손상" 분기로 들어가 `spawnedRow.status=FAILED`, `error`, `finishedAt` 을 세팅해 **`save()` 로 즉시 DB에 쓴다.**
    - 이 `save()` 는 TypeORM의 전체 엔티티 저장이라 A가 이후(T3, 턴 종료 시 `finalizeAiNode`)에 쓰는 정당한 결과를 시간 순서에 따라 덮어쓰거나(반대로 A의 완료 결과가 B의 오기입 이후에 쓰이면 최종 상태는 맞지만 그 사이 잘못된 FAILED 상태가 관측·전파될 수 있음) 데이터 무결성을 해친다.

    B가 도달하는 "이미 claim 됨"이라는 사실은 원래 claim의 `affected!==1` 분기(333-339행, "ack-and-discard (정상 race)")가 조용히 처리하도록 설계된 바로 그 케이스다. 그러나 claim에 도달하기도 전에 (3)의 사전 판정이 가로채 파괴적 write 를 실행해버리므로, 문서화된 "ack-and-discard" 계약이 이 경로에서는 지켜지지 않는다.

    트리거 조건은 사변적이지 않다 — 이 PR의 커밋 메시지·spec Rationale(§7.5, 신설)이 명시하는 바로 그 트리거(BullMQ stalled 재배달, `CONTINUATION_WORKER_CONCURRENCY` 상향, 멀티 인스턴스 배포)이며, spec §Rationale이 "대가(의도된 트레이드오프)"로 명시적으로 수용한 것은 "크래시로 중단된 턴"(worker가 죽어 다시는 처리하지 않는 경우) 뿐이다. "다른 worker가 아직 살아서 처리 중인데 중복 배달된 경우" 는 spec도 코드도 다루지 않은 별개의 케이스다.

    같은 파일의 자매 메서드 `retryLastTurn` 은 동일한 유형의 "missing state" 판정(149-155행)을 두지만 그쪽은 **부수효과 없는 throw** 뿐이다(`RetryLastTurnError.notFound`) — 두 concurrent 호출이 모두 이 지점을 통과해도 이후 원자 consume(193-223행)에서 하나만 승리하고 나머지는 예외만 던진다(DB write 없음). `applyRetryLastTurn` 만 "사전 판정에 파괴적 write"라는, 이 레이스에 취약한 패턴을 갖고 있다 — 설계 의도의 비대칭이 아니라 이번 PR이 새로 만든 취약점으로 보인다(대상 로직 자체가 이 PR에서 신설됐고, 원자 claim 도입 전에는 `_retryState` 를 제거하는 다른 경로가 전혀 없어 "missing" 이 항상 진짜 corruption을 의미했었다 — 원자 claim이 새로 만든 "합법적으로 missing" 케이스를 이 판정이 반영하지 못한 것).
  - 제안: 원자 claim을 fast-path 직후·(3) 판정 이전으로 옮기고, claim이 실패(`affected!==1`)하면 이유를 구분하지 말고 **항상** ack-and-discard(로그만 남기고 return, `save()` 없음)로 통일할 것을 권장한다. `retryState` 값 자체는 claim 이전에 이미 확보해 둔 `spawnedRow.inputData._retryState`(in-memory, DB write와 무관하게 유효)를 그대로 재사용하면 되므로 claim을 먼저 실행해도 이후 로직에 영향이 없다. "한 번도 seed되지 않은 진짜 corruption" 케이스(현재 `retryLastTurn` 의 spawn 로직상 이론상 불가능)를 zombie-row 방지 목적으로 여전히 FAILED 처리하고 싶다면, claim 실패와 별개의 근거(예: `retryLastTurn` spawn 시점부터 `_retryState` 가 존재했는지에 대한 추가 신호)로 구분해야 하며, 현재처럼 "이 delivery 가 본 스냅샷에 없다" 만으로는 구분이 불가능하다. 회귀 테스트로 "claim이 성공(affected=1)하는 delivery가 있고, 그 이후 도착한 두 번째 delivery가 (claim 실패로) 조용히 discard 하며 `save()` 를 호출하지 않는지"를 시뮬레이션하는 케이스를 추가할 것(현재 `retry-turn.service.spec.ts:436`의 "(c) marks spawned row FAILED when _retryState is missing" 테스트는 "처음부터 없었던 경우"만 고정하고 있어 이 시나리오와 구분되지 않는다).

- **[WARNING]** 위 CRITICAL과 직결된 테스트 커버리지 공백 — 원자 claim의 "동시 배달" 목적을 검증하는 신규 테스트 (b2)/(b3)(`retry-turn.service.spec.ts:386`, `:406`)는 모두 **이 delivery 자신의 claim 호출이 `affected:0` 을 반환**하는 경우만 시뮬레이션한다. "다른 delivery가 이미 claim해서 이 delivery의 최초 조회 시점에 이미 `_retryState` 가 없는" 경우(=CRITICAL에서 설명한 실제 레이스 진입점)는 어떤 계층에서도 검증되지 않는다. 이 부재 때문에 회귀가 생겨도 mutation-testing/unit 어느 쪽도 감지하지 못한다(같은 파일 5차 라운드 리뷰가 이미 "e2e에 retry_last_turn 커버리지 0건"을 지적한 바 있고 — `plan/in-progress/retry-turn-terminal-guard.md` 5R W6 — 이번 신규 로직도 동일한 사각지대에 놓인다).
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:386-434` (기존 테스트), `:436` ((c) 테스트).
  - 제안: `findOneBy` mock이 `status: RUNNING` + `inputData: {}` (즉 이미 소비된 것처럼) 를 반환하도록 구성하고, 이때 `save()` 가 호출되지 **않아야** 함을 고정하는 케이스를 추가해 CRITICAL 항목의 수정과 짝을 이루게 할 것.

- **[INFO]** spec 동반 갱신 자체는 코드와 일치한다 — `spec/5-system/4-execution-engine.md` §4.2 각주(PR2b+ 재진입 경로 재검증), §7.4 "메시지 타입"·"Worker 동시성" 두 행(claim 지점이 타입마다 다름을 명시), 신설 Rationale "retry 재진입의 원자 claim"(§7.5 대칭) 모두 이번 diff의 코드 변경(조건부 UPDATE `status='running' AND jsonb_exists(input_data, '_retryState')`)과 line-level로 부합한다. 다만 이 Rationale이 선언하는 "동일 turn 이중 실행 0" 불변식은 위 CRITICAL이 지적하는 좁은 창에서는 아직 완전히 성립하지 않는다 — CRITICAL을 코드로 닫은 뒤에야 spec의 이 선언이 문자 그대로 참이 된다(스펙을 되돌릴 필요는 없음 — 코드 fix 대상).

## 요약

이번 diff는 `applyRetryLastTurn` 의 재진입 가드를 read-then-branch(`status !== RUNNING`)에서 `status='running' AND jsonb_exists(input_data, '_retryState')` 조건부 UPDATE 원자 claim으로 교체해, PR이 목표한 "두 delivery가 모두 `processAiResumeTurn`/LLM 호출까지 진행하는" 주 결함 클래스를 정확히 닫았고, 동반 spec(`4-execution-engine.md` §4.2/§7.4/§7.5)과 `continuation-execution.processor.ts` 주석 정정도 코드와 line-level로 일치한다. 그러나 원자 claim 이전에 위치한 "`_retryState` 부재 → FAILED 마킹" 분기(293-308행)가, 그 원자 claim이 정상적으로 만들어내는 "이미 다른 delivery가 claim한 상태"를 "복구 불가능한 손상"과 구분하지 못해, 여전히 처리 중인 다른 delivery의 row를 파괴적으로 덮어쓸 수 있는 좁지만 현실적인(멀티 인스턴스·BullMQ stalled 재배달이라는, 이 PR 자신이 명시한 트리거와 동일한 조건의) 레이스가 남아 있다. 이 경로는 unit/e2e 어느 계층에서도 검증되지 않는다. 나머지 범위(엣지 케이스·에러 코드·반환값·비즈니스 로직)는 기존 다회 리뷰 라운드에서 이미 상세히 검증·수정된 상태이며 이번 diff와 직결되는 새로운 결함은 발견되지 않았다.

## 위험도

HIGH
