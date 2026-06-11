---
worktree: ws-resumed-ack-spec
started: 2026-06-10
owner: planner
spec_impact:
  - spec/5-system/6-websocket-protocol.md
  - spec/5-system/4-execution-engine.md
---

# spec 정정 — WS `resumed` ack 의미 + 엔진 §7.5↔§7.5.1 내부 모순 해소

> 출처: `plan/in-progress/refactor/06-concurrency.md` M-1 (✅ 2026-06-10 사용자 승인 — 권고안 A 확정).
> developer `spec/` read-only 위반(impl-prep WARNING)으로 planner 트랙 분리됐던 항목.
> 본 항목은 **코드 변경 없음** — spec 이 코드의 실제 동작(always-enqueue 모델)을 정직하게 기술하도록 정정.

## 배경 — 모순 2건

코드는 Phase 2 "모든 진입점 항상 BullMQ enqueue" 모델이다. continuation 4종 핸들러
(`click_button`/`submit_form`/`submit_message`/`end_conversation`)는 enqueue 성공 시
`resumed: true` 를 **하드코딩**하고(`websocket.gateway.ts:437/511/584/654`), publish 실패는
`queued: false` 에러로 표면화한다 — `resumed: false` 를 내지 않는다. 즉 동기 ack 의 `resumed`
는 "재개 성공" 이 아니라 "재개 시작 수락(enqueue)" 을 의미한다.

- **모순 ①** — WS §4.2 표(line 241): `resumed | boolean | 재개 성공 여부`. always-enqueue
  모델에서 동기 ack 시점엔 재개 성공을 알 수 없으므로 정의가 코드와 불일치.
- **모순 ②** — 엔진 §7.5(line 967): "rehydration 실패 3케이스(`RESUME_*`)는 모두 ack 에
  `resumed: false` + error 로 노출" ↔ §7.5.1(line 995): "`RESUME_*` 는 후행
  `EXECUTION_CANCELLED` 이벤트(ack 동기 응답 아님)". spec **내부** 직접 충돌. 코드상 4종
  핸들러는 `RESUME_*` 에 대해 `resumed: false` 를 내지 않으므로 §7.5.1 이 옳고 §7.5 가 드리프트.

## 변경안

### 1. WS `6-websocket-protocol.md` §4.2 — `resumed` 정의 정정

표(line 241) `resumed` 행을 "재개 성공 여부" → "재개 시작 수락(enqueue) 여부" 로.
정상 enqueue 시 항상 `true`, 실패는 `queued: false` 로 표면화. 최종 재개 성공은 후행
`execution.resumed`/`execution.node.*` 이벤트로 확인하고, rehydration 실패(`RESUME_*`)는
후행 `EXECUTION_CANCELLED` 이벤트로 통지(동기 ack 아님)임을 명시.

`queued` 설명 단락(line 232) 뒤에 짧은 해설 노트 1개 추가 — always-enqueue 모델에서
ack 의 `resumed`/`queued` 는 enqueue 수락 신호이며 최종 재개 확인은 후행 이벤트라는 점,
그리고 `RESUME_*` 가 ack 가 아닌 후행 `EXECUTION_CANCELLED` 로 온다는 점(엔진 §7.5.1 cross-link).

> retry_last_turn(별 명령)의 `resumed: false` 분기(gateway:708/732/770/814)는 publisher 측
> 동기 검증 실패(INVALID state / queued=false)이지 `RESUME_*` 가 아니다 — WS §4.2 표 라인
> "retry 는 `RESUME_*` 적용 대상 아님" 과 일관. 본 정정은 4종 continuation ack 한정.

### 2. 엔진 `4-execution-engine.md` §7.5(line 967) — §7.5.1 과 일치

"이 셋 모두 … ack 에 `resumed: false` + error 객체로 노출된다" 를, 이 셋은 worker 측
**비동기**(post-enqueue) 실패라 동기 ack 가 아니라 후행 `EXECUTION_CANCELLED` 이벤트
(`error.code = RESUME_*`)로 통지된다로 정정. 동기 ack 는 publisher 측 사전 검증
(§7.5.1 `INVALID_EXECUTION_STATE`)만 담는다는 §7.5.1 직교 서술과 일치시킨다.

## 검증·후속

- [x] **WS §4.2 `resumed` 정의 정정** — 표 행 + always-enqueue 해설 노트 + 이름 충돌 cross-ref 적용.
- [x] **엔진 §7.5 line 967 ↔ §7.5.1 일치** — 후행 `execution.cancelled` 비동기 통지로 정정.
- [x] **양 파일 §Rationale 보강** — WS "`resumed` 의미 재정의", 엔진 "`RESUME_*` 동기 ack 노출 폐기" (각 `spec/0-overview.md §Rationale "실행 엔진"` cross-link).
- [x] **이벤트명 정확화** — 실제 wire 이벤트는 `execution.cancelled`(§4.1) 이므로 touched 범위의 `EXECUTION_CANCELLED` 표기를 `execution.cancelled` 로 통일(§7.5.1 line 995 포함).
- [x] **프론트 가드 확인**(읽기) — `use-execution-interaction-commands.ts` `emitWithAck` 는 ack 의 `success === false` 만 소비하고 `resumed` 를 상태 전이(waiting UI 해제) 근거로 쓰지 않음을 확인. `use-execution-events.ts`/`apply-execution-snapshot.ts` 등 어디에도 ack `resumed:true` 를 전이 트리거로 쓰는 곳 없음 → **developer 후속 항목 불요, 본 항목으로 종결**.
- **코드 변경**: 없음. spec-only.
- **회귀 위험**: 없음(문서·확인 수준).
- **consistency**: `/consistency-check --spec` → **BLOCK: NO** (`review/consistency/2026/06/10/23_32_08/SUMMARY.md`). WARNING(resumed 동명)·INFO(event 표기) 모두 반영 완료.

## Rationale

`resumed` 의 "재개 성공" 정의는 always-enqueue 모델에서 동기적으로 충족 불가능한 약속이므로,
충족 가능한 정의("enqueue 수락")로 정정하고 최종 확인을 후행 이벤트로 일원화하는 것이 §7.5.1
("RESUME_* 는 후행 이벤트")과의 유일한 일관 해법이다. gateway 가 동기 resumed 판정을 반환하는
대안(B)은 worker 처리를 동기 대기해야 해 큐 도입 취지·§7.5.1 후행 이벤트 설계와 정면 충돌하므로
기각(refactor/06 M-1 옵션표 B). 본 정정은 코드 동작을 바꾸지 않고 spec 을 코드에 맞춘다.
