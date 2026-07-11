# 요구사항(Requirement) 충족 리뷰 — EIA-RL-07 공개 위젯 idle-wait execution 회수 reaper

## 검토 범위

핵심 구현: `execution-engine.service.ts markWebchatIdleTimeout`, `interaction-token.service.ts
findIdleWebchatExecutionIds`, 신규 `webchat-idle-reaper.{service,types}.ts`, DI 배선
(`external-interaction.module.ts`, `system-status.constants.ts`), 단위/e2e 테스트, `.env.example`,
CHANGELOG, plan 항목 종결, 그리고 spec 5문서(EIA §3.4, widget-app §3.1, auth-session, data-flow
0-overview/15-external-interaction) 동시 flip.

검증 방법: diff 뿐 아니라 실제 저장소 소스(`Read`/`Grep`)로 직접 대조 — 형제 패턴
(`cancelParkedExecution`/`markQueueWaitTimeout`/`reconcileTerminalRevocations`/
`TerminalRevokeReconcilerService`)과의 합성 정합성, 엔티티·마이그레이션 스키마(특히
`node_execution.status` CHECK 제약에 `cancelled` 포함 여부 — V069 확인), `MONITORED_QUEUES` ↔
`system-status.e2e-spec.ts` ↔ `data-flow/0-overview.md` 큐 카운트(17/18) 정합을 직접 재계산해 확인.

## 발견사항

- **[WARNING]** `markWebchatIdleTimeout` 의 outer catch(DB 예외 시 `false` 반환) 및 emit 실패
  warn-경로(그래도 `true` 반환)가 신규 유닛 테스트에서 커버되지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:218-280`
    (구현), `execution-engine.service.spec.ts:2732-2820`(테스트 — affected:0/affected:1 두 분기만)
  - 상세: 동일 파일의 형제 메서드 `cancelParkedExecution`(W10/W11 다수 분기 테스트)·
    `markQueueWaitTimeout` 대비, 신규 `markWebchatIdleTimeout` 은 성공 2분기(affected:0 → false,
    affected:1 → true+emit+release)만 검증되고 "Execution UPDATE 자체가 throw"·"emit 이 reject 해도
    cancel 은 유지되고 true 반환" 두 에러 시나리오는 미검증. 로직 자체는 기존에 검증된 패턴을
    그대로 복제한 것이라 위험도는 낮으나, 요구사항 관점 "에러 시나리오" 체크리스트 상 커버리지 갭.
  - 제안: `execute()` 를 reject 시키는 mock 과 `emitExecution` 을 reject 시키는 mock 두 케이스를
    추가해 (a) DB 예외 시 `false` 반환 + 로그, (b) emit 실패해도 `true` 반환(cancel 은 DB 유지)을
    명시적으로 고정.

- **[INFO]** `findIdleWebchatExecutionIds` 쿼리가 `LIMIT` 을 쓰면서 `ORDER BY` 가 없어, 후보가
  `batchLimit`(기본 500, 상한 1000)을 초과하는 시점에는 매 tick 마다 어떤 500건이 선택될지
  Postgres 플랜상 보장되지 않음(이론상 일부 row 기아 가능)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:443-456`
  - 상세: 다만 이는 **신규 결함이 아니라** 형제 메서드 `reconcileTerminalRevocations`(같은 파일,
    `:383-392`)의 기존 패턴을 그대로 답습한 것이며, 대상 규모(idle 상태로 완전히 유기된 공개 위젯
    execution)가 통상 batchLimit 을 상시 초과할 가능성은 낮다. 차단 사유 아님.
  - 제안: 필요 시 `ORDER BY et."executionId"`(또는 `MIN(et.expAt)`) 추가로 결정적 순서 보장 —
    `reconcileTerminalRevocations` 와 동시에 처리하는 편이 일관적(별도 후속 항목으로 족함).

## 기능 완전성 / 비즈니스 로직 / 에러 시나리오 정합성 (근거 요약)

- `markWebchatIdleTimeout` 은 docstring 이 명시한 대로 `cancelParkedExecution`(WAITING 가드 조건부
  UPDATE + 동반 NodeExecution cancel + `finalizeRehydrationCleanup`)과 `markQueueWaitTimeout`
  (`error.code` 동봉 + `cancelledBy:'timeout'` + `releaseExecutionRouting`)의 정확한 합성 —
  실제 두 형제 메서드 본문과 라인 단위 대조해 필드 누락 없음을 확인.
- TOCTOU 안전성: `findIdleWebchatExecutionIds`(SELECT)와 `markWebchatIdleTimeout`(조건부 UPDATE
  `WHERE status='waiting_for_input'`)사이 race 는 affected=0 → no-op 로 흡수되며, 이 경우
  `WebchatIdleReaperService.reapOne` 이 `revokeAllForExecution` 을 호출하지 않아 활성 세션의
  토큰을 실수로 revoke 하는 사고를 방지 — 정확.
  익명 위젯은 만료된 토큰으로 refresh 가 불가(스펙 §5.5 401 선차단 전제)하므로 "모든 토큰 만료"↔
  "activity 불가능" 동치가 실제로 성립.
- 부분 실패 복원력: `reapOne` 에서 engine cancel 은 성공했으나 `revokeAllForExecution` 이 실패하는
  경우, execution 은 이미 terminal(cancelled)이라 `TerminalRevokeReconcilerService`(EIA-RL-06,
  동일 분 단위 스윕)가 잔존 `execution_token` 을 다음 tick 에 회수 — 이중 안전망이 실제로 성립함을
  두 서비스 코드를 대조해 확인(경합 없음: EIA-RL-06 은 `status IN (terminal)`, 본 reaper 는
  `status = waiting_for_input` 이라 대상 상태가 상호 배타).
- `NodeExecutionStatus.CANCELLED`('cancelled') 사용이 `node_execution` CHECK 제약과 충돌하지
  않는지 마이그레이션까지 추적 확인(V001 최초 CHECK 에는 'cancelled' 부재 → V069 가 추가) — 문제
  없음.
- 스키마 필드 정합: `ExecutionToken.execution`(관계)·`expAt`·`executionId`, `Execution.trigger`·
  `status`, `Trigger.authConfigId` 필드명이 QueryBuilder 조인/조건과 정확히 일치.

## 데이터 유효성

- `resolveWebchatIdleReapGraceMs`: 정규식 `^\d+$` 선검증 + `parsed > 0` 이중 가드로 음수·0·소수·
  공학표기·빈문자열을 전부 기본값(1h)으로 fallback — `.env.example` 주석("Non-integer/0/negative
  values fall back to the default")과 실제 구현·유닛 테스트(6 케이스) 가 정확히 일치.
- `findIdleWebchatExecutionIds` 의 `batchLimit`/`graceMs` 는 `Math.max(1, Math.floor(...))`/
  `Math.max(0, ...)` 로 clamp — 다만 이 파라미터는 항상 내부 호출(reaper)에서만 공급되고 외부
  HTTP 입력 경로가 없어 NaN 등 극단값 유입 가능성은 실질적으로 없음(리스크 낮음, 지적하지 않음).

## 반환값

모든 경로 확인: `markWebchatIdleTimeout` → 4개 반환 지점(early false, outer catch false, 정상
true) 전부 boolean 반환 보장. `findIdleWebchatExecutionIds` → repository 미주입 시 `[]`, 정상 시
`string[]` — 모든 분기 명시적 반환. `reap()`/`reapOne()` 은 각각 `Promise<void>`/`Promise<boolean>`
계약을 모든 경로에서 지킴(catch 블록도 값 없이 종료 또는 boolean 반환).

## TODO/FIXME/HACK/XXX

신규 파일 전체(`webchat-idle-reaper.service.ts`, `.types.ts`, engine/token service 변경분)에서
TODO/FIXME/HACK/XXX 계열 주석 0건.

## Spec Fidelity (line-level)

- `spec/5-system/14-external-interaction-api.md` §3.4 EIA-RL-07 행이 "(구현 상태: Planned)" →
  "(구현됨 — `WebchatIdleReaperService`, BullMQ repeatable 분 단위)" 로 flip — 서비스명·grace
  window·판정 기준(`MAX(exp_at) < now-grace`)·`error.code='WEBCHAT_IDLE_TIMEOUT'`·
  `cancelledBy='timeout'` 문구가 코드와 라인 단위로 일치.
- `spec/7-channel-web-chat/1-widget-app.md`, `3-auth-session.md` 의 "Planned/PR-2 대기" 배너도
  동일 커밋에서 함께 flip — 코드·spec 비동기(drift) 없음.
- `spec/data-flow/0-overview.md` §4 큐 카탈로그: 큐 개수 "17개"→"18개" + `webchat-idle-reaper` 행
  신설. 실제 `MONITORED_QUEUES` 배열(17개, 신규 포함)·`system-status.e2e-spec.ts`
  `EXPECTED_QUEUE_NAMES`(17개, 신규 포함) 를 직접 카운트해 대조 — 정확히 일치(`agent-memory-extraction`
  은 애초 `MONITORED_QUEUES` 비대상이라 시스템-상태 e2e 목록에 없는 것이 기존부터 맞는 상태 — 본
  PR 이 만든 불일치 아님).
- `spec/data-flow/15-external-interaction.md` BullMQ 표: 서비스명·큐명·판정 쿼리 요약·이벤트
  경로가 실제 구현(`WebchatIdleReaperService.reap`/`InteractionTokenService.findIdleWebchatExecutionIds`
  /`ExecutionEngineService.markWebchatIdleTimeout`)과 일치.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 항목이 `[~]`(부분 완료) →
  `[x]`(완료) 로 정확히 갱신되고 서술도 실제 구현 내용(멱등 조건부 UPDATE·형제 sweep·§7.4 정합)과
  부합.
- 별도 SPEC-DRIFT 없음 — 이번 PR 은 "코드가 spec 을 새로 만족시키며 spec 배너도 같은 커밋에서
  동기화"된 이상적 케이스.

## 요약

EIA-RL-07 공개 위젯 idle-wait execution 회수 reaper 는 기존 EIA-RL-06(`TerminalRevokeReconcilerService`)
과 execution-engine 의 검증된 park-cancel/queue-timeout 패턴을 정확히 합성한 신규 backstop이다.
TOCTOU·부분 실패·멱등성 모두 코드 레벨에서 실제로 안전하게 처리됨을 형제 메서드·마이그레이션
스키마까지 추적해 확인했고, 관련 spec 5문서가 동일 커밋에서 "Planned"→"구현됨"으로 정확히
flip 되어 spec-코드 정합성도 라인 단위로 일치한다(SPEC-DRIFT 없음). CRITICAL 발견 없음 — 유일한
지적은 신규 메서드의 에러-경로 유닛 테스트 커버리지 갭(WARNING 1건)과, 기존에도 있던 비결정적
LIMIT 쿼리 패턴을 그대로 답습한 점(INFO 1건, 신규 결함 아님)뿐이다.

## 위험도

LOW
