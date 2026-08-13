# 신규 식별자 충돌 검토 — spec-draft-eia-notification-payload-contract.md

## 검토 범위·방법

target 은 `spec/5-system/14-external-interaction-api.md` §6.3~§6.5 와
`spec/5-system/6-websocket-protocol.md` §4.1 을 **실제 emit 동작에 맞춰 재작성**하는
spec draft plan 이다. 두 spec 파일의 현재 §6.3~§6.6(EIA), §4.1(WS) 원문을 직접 읽고
target 이 언급하는 식별자(이벤트명·필드명·요구사항 ID·"미구현(Planned)" 마커)를
기존 spec 전역 사용처와 대조했다. 결과: **target 이 순수하게 새로 도입하는 식별자는
사실상 없다** — 이미 존재하는 이벤트명(`execution.completed`/`execution.failed`/
`execution.cancelled`)의 **payload 필드 구성을 실측(코드)에 맞게 재작성**하는 것이 핵심이며,
필드는 대부분 삭제(`finalNodeId`/`finalPort`)되거나 기존 fanout 봉투 필드(`payload`,
`type`, `seq` 등, `execution-engine.service.ts` emit 자리에 이미 존재)를 문서에 반영하는
형태다.

## 항목별 확인

1. **요구사항 ID** — target 이 새 `EIA-XX-NN` ID 를 신설하지 않는다. 유일하게 인용하는
   기존 ID `EIA-IN-04`(`GET /api/external/executions/:executionId`)는
   `spec/5-system/14-external-interaction-api.md:74` 의 정의와 정확히 일치 — 오용 없음.
2. **엔티티/타입명** — 새 DTO·인터페이스명 도입 없음. 유일하게 언급된 기존 타입
   `EiaCompletedEvent` 는 `codebase/backend/src/modules/chat-channel/types.ts:386` 에
   이미 정의된 타입이며 target 은 이를 재정의하지 않고 "spec 초안을 그대로 옮긴 타입"
   이라는 서술로만 인용한다.
3. **API endpoint** — 새 endpoint 없음. 재조회 경로로 언급하는 EIA-IN-04 는 기존 정의
   그대로.
4. **이벤트/메시지명** — `execution.completed`/`execution.failed`/`execution.cancelled`/
   `execution.ai_message` 모두 EIA §6.3~§6.5, WS §4.1 에 이미 존재하는 이름이고 target 은
   이름을 바꾸지 않는다(payload shape 만 재작성). 신규 이벤트명 도입 없음.
5. **환경변수·설정키** — 없음. `notification.retry.maxAttempts`, `NOTIFICATION_BACKOFF_TYPE`
   등 §6.6 의 기존 설정키는 target 범위(§6.3~§6.5) 밖이라 손대지 않는다.
6. **파일 경로** — target 은 신규 spec 파일을 만들지 않고 기존 2개 파일만 수정한다.
   plan 파일 자체의 경로 `plan/in-progress/spec-draft-eia-notification-payload-contract.md`
   도 `spec-draft-eia-r8-alignment.md`, `spec-draft-eia-context-schema-absence-convention.md`
   (`spec-sync-external-interaction-api-gaps.md:18` 인용) 등 동일 worktree 의 `spec-draft-*`
   명명 컨벤션과 정합하며 기존 파일과 겹치지 않는다.

### 부가 확인 — "미구현 (Planned)" 마커

target 은 §6.3 의 `result.outputs`/`durationMs` 를 **"미구현 (Planned)"** 로 표기하겠다고
적는다. 이 문구가 이 spec 영역에서 처음 쓰이는 것이라면 기존 관용구
(`_(계획·미구현)_`, "현재 미구현 문서 필드다" 등)와 형태가 갈려 WARNING 감이었을 것이나,
실측 결과 **같은 파일에 이미 동일 문구가 존재**한다
(`spec/5-system/14-external-interaction-api.md:1117`
"Redis pub/sub 발행은 미구현 (Planned)", `:1118` 도 동일 패턴). 즉 target 의 표기는
**기존 컨벤션 재사용**이며 충돌·불일치가 아니다 — 오히려 정합적이다.

### 부가 확인 — 자매 plan 과의 동시 편집 범위

동일 worktree 에 `spec/5-system/14-external-interaction-api.md` 를 함께 건드리는
자매 plan `spec-draft-eia-r8-alignment.md` 가 있으나, 그 문서는 §R8(idempotency 캐시
대상)·§5.5(410 분기) 만 다루고 이미 체크리스트가 전부 완료 상태다. target 의 편집
대상(§6.3~§6.5)과 라인 범위가 겹치지 않아 실질적 충돌 없음.

## 발견사항

없음 — CRITICAL/WARNING/INFO 등급의 신규 식별자 충돌을 찾지 못했다. target 은 새 식별자를
도입하지 않고 기존 식별자(이벤트명·필드명·요구사항 ID)의 **문서상 payload 구성**을
실측에 맞춰 정정하는 성격의 draft 이며, 유일하게 신설되는 표기 요소("미구현 (Planned)"
마커)도 같은 spec 파일 내 기존 용례를 그대로 재사용한다.

## 요약

target 문서는 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·spec 파일
경로 중 어느 것도 신규로 도입하지 않는다 — `execution.completed`/`execution.failed`/
`execution.cancelled` 라는 기존 이벤트명의 payload 필드 구성을 코드 실측에 맞춰
재작성(주로 필드 삭제·"Planned" 마킹)하는 문서 정합 draft 이다. 유일하게 신규 표기로
보였던 "미구현 (Planned)" 마커도 같은 파일 §7 데이터 모델 절 인근에 이미 동일 문구가
쓰이고 있어 컨벤션과 정합한다. EIA-IN-04 등 인용된 기존 ID·타입도 실제 정의와 정확히
일치한다. 신규 식별자 충돌 관점에서는 처리할 항목이 없다.

## 위험도

NONE
