---
title: "`system_error` 재시도 배너가 라이브 WS 경로에서 안 뜬다 — 프런트가 정정 전 spec 을 믿고 있다"
status: in-progress
worktree: system-error-banner
started: 2026-08-28
owner: developer
spec_impact: none
---

# `system_error` 배너 — 라이브 WS 경로 복구

정본 트래커의 🔴 항목(`12_24_55` cross_spec **CRITICAL**). **문서 정합이 아니라 실제 기능
결함**이다. spec 은 2026-08-24 에 이미 정정됐고 **코드만 옛 문구를 믿고 있다**.

## 결함 — 실측으로 재확인 (2026-08-28)

`extractNodeErrorPayload(payload.error, undefined)` 가 **항상 `null`** 을 돌려준다:

| 축 | 실측 |
| --- | --- |
| `payload.error` | emit **4곳 전수**가 `string`(message only) — `execution-engine.service.ts:6297·6372·8013`, `ai-turn-orchestrator.service.ts:1532` |
| 헬퍼의 `direct` 분기 | `rawError` 가 **객체일 때만** 잡는다 → 문자열이라 `null` |
| 헬퍼의 `nested` 분기 | `rawOutput` 이 **`undefined`** 로 넘어온다 → `null` |

→ `source` 가 없어 `system_error` APPEND 블록이 **한 번도 실행되지 않는다**.

## 그런데 `nested` 분기도 한 겹 얕다 — 자매 호출부까지 깨져 있다

헬퍼는 `rawOutput.error` 를 본다. 하지만 emit 이 싣는 `output` 은 **`NodeHandlerOutput`
래퍼**(`nodeExec.outputData`)이고 도메인 에러는 **한 겹 더 아래**다:

- `ai-turn-orchestrator.service.ts:1450-1458` — `outputData = {...finalAdapted}` (래퍼)
- `execution-engine.service.ts:6360` — `outputData = rawOutput` (래퍼), 에러는 `finalOutput.error`
- 백엔드 자신이 `nodeExec.outputData?.**output**?.error` 로 읽는다(`:1513-1516`)
- spec §4.1-a 도 *"구조화 객체는 **`output.output.error`** 에만 있다"* 로 명시

따라서 `:804`(`node.completed`, `port:'error'`) 호출부도 `payload.output` 을 넘기지만
**한 겹 얕은 곳을 봐서 못 찾는다**. 트래커가 적은 것보다 **표면이 하나 넓다**.

## 테스트가 결함을 가리고 있었다

`use-execution-events.test.ts` 의 fixture 가 **production 에 없는 shape** 이다:

- CT-S9 / CT-S10 — `error` 를 **객체**로 보낸다 (production: 문자열)
- CT-S15 — `output` 에 **도메인 출력**을 넣는다 (production: 래퍼)

즉 테스트는 **정정 전 spec 문구를 인코딩**했고, 그래서 결함이 있는 채로 초록이었다.
fixture 를 production shape 으로 바꾸는 것이 이 작업의 절반이다.

## 처방 — 프런트 전용

spec 은 이미 옳다. 백엔드를 바꾸면 8/24 에 정정한 방향을 되돌리는 것이므로 **건드리지
않는다**.

- [x] `extractNodeErrorPayload` 의 `nested` 를 **`rawOutput.output.error`** 로 (래퍼 한 겹 통과)
- [x] `handleNodeFailed` 가 `payload.output` 을 넘긴다 (`undefined` → 실제 값)
- [x] 헬퍼 주석의 정정 전 §4.1 인용 교체 (그 주석이 이 결함의 출처다)
- [x] fixture 를 production shape 으로 — CT-S9·CT-S10·CT-S15·completed 네 곳
- [x] **캐너리**: 문자열 `error` + 래퍼 `output` 조합에서 배너가 뜬다
- [x] **캐너리**: `output` 미동봉 경로는 배너가 **안** 뜬다 (기존 테스트의 라벨·사유를 정정해 재사용)
- [x] 뮤테이션 2건 — **예측보다 넓게 물었다**(M1 예측 1/실측 3, M2 예측 2/실측 4). 예측이 fixture 정정 **전** 기준이라 낡았던 것이고, CT-S9/S10 이 이제 실제 경로를 타는(=공허하지 않게 된) 증거다. M2 에서 `node.completed` 가 RED 인 것이 **자매 호출부도 깨져 있었다**는 증거.
- [x] TEST WORKFLOW 4단계 PASS — 이 스위트 **86→95** · e2e 285
      (라운드마다 늘어 87→92→95 였다 — **PR 이 닫히는 시점의 값**으로 갱신)
- [x] `/ai-review` **6라운드 수렴** — `01_26_11`(W4) → `01_44_22`(W3) → `02_02_18`(W1) →
      `02_21_19`(W1) → `02_39_10`(W1) → `02_57_18` **전원 NONE · CRITICAL 0 · WARNING 0**.
      1~5 라운드는 RESOLUTION.md 동봉, 6라운드는 clean 이라 불요.
      > 발견의 성격이 **실질 결함 → 테스트 정밀도 → 없음** 으로 이동했다. 라운드마다
      > 반증된 것이 대개 **직전 라운드에서 내가 쓴 수정**이었다 — JSDoc 을 대상에서
      > 떼어 놓기(2회) · 자기모순 주석 · 분기를 못 가르는 fixture · 등가 뮤턴트를
      > 가른다고 주장하기.
- [x] push · PR

## 스코프 밖

- **`output` 미동봉 2경로에 `output` 을 싣기** — spec §4.1-a 가 *"경로에 따라 실린다"* 를
  **정상**으로 규정한다. 싣게 하려면 payload 계약 변경이라 planner 턴이고, 이 결함과 직교다.
- **`error` 를 객체로 바꾸기** — 8/24 정정의 역방향.
