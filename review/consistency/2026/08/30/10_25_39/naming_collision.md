# 신규 식별자 충돌 검토 — spec-draft-followups-drain-2026-08-30

## 검토 범위 재확인

target 문서(`plan/in-progress/spec-draft-followups-drain-2026-08-30.md`)의 4개 항목(§1~§4)을
"새 식별자를 도입하는가" 관점에서 재분류했다.

| 항목 | 성격 | 새 ID 도입 여부 |
| --- | --- | --- |
| §1 (`statusCode` Rationale 정정) | 기존 서술을 실측에 맞춰 교체 | 없음 — `isHttpStatusCode()` 등은 기존 코드 인용 |
| §2 (Redis 각주 주어 명시) | 기존 각주 문장 보강 | 없음 — 링크 대상(`redis-keys.md`)도 기존 파일 |
| §3 (egress-masking 캐비엇 회수 + plan 이동) | 캐비엇 텍스트 교체 + 파일 이동 | 없음 — `redactTerminalError`/`deepRedactSecrets` 는 기존 코드·문서에 이미 광범위 사용 |
| §4 (`<도메인>EventType` 명명 규칙을 Rationale 에 문서화) | 신규 `spec/conventions/` 파일 없이 기존 파일 Rationale 에 문단 추가 | 새 명명 **규칙**은 문서화되지만, 규칙이 가리키는 5개 enum 은 전부 기존 식별자 |

넷 다 **신규 요구사항 ID·엔티티·endpoint·이벤트명·ENV var·spec 파일**을 만들지 않는다.
그래서 이 검토자의 6개 관점 중 5개(요구사항 ID/엔티티·타입명/API endpoint/이벤트·메시지명/
환경변수)는 target 자체에 해당 사항이 원천적으로 없다. 아래는 실측으로 확인한 근거다.

## 실측 근거

- `grep -rn "EventType" spec/conventions/` → 0건 (target §4 의 "규칙이 어디에도 없다" 주장과 일치).
  `spec/conventions/` 에 `websocket-events.md` 도 존재하지 않는다 — target 이 신설을 피하고
  기존 `spec/5-system/6-websocket-protocol.md` 의 `## Rationale` 에 문단만 얹는 설계라 새
  spec 파일 경로 충돌 자체가 없다.
- `codebase/backend/src/modules/websocket/websocket-events.types.ts` 실제 열거형 5개 확인:
  `ExecutionEventType`(83행) · `NodeEventType`(185행) · `BackgroundRunEventType`(204행) ·
  `InAppNotificationEventType`(226행) · `KbEventType`(261행, `type` alias). target 이 나열한
  "다섯 enum" 과 정확히 일치.
- 같은 파일 222~223행 JSDoc 주석이 이미 **"`<도메인>EventType` 규칙"** 이라는 문구를 코드 안에
  갖고 있다 — target §4 는 이 코드 주석을 spec 레이어로 끌어올리는 것이지, 새 규칙을
  발명하는 게 아니다. 충돌 근거를 코드가 이미 뒷받침한다.
- `grep -rn "NotificationEventType"` → `codebase/backend/src/modules/triggers/dto/
  notification-config.dto.ts` 와 옛 `websocket-events.types.ts` 양쪽에서 실제로 동명이의로
  쓰였던 이력이 `plan/complete/spec-draft-ws-types-canonical-location.md:119`
  ("`NotificationEventType` 개명 (동명 충돌) — 별도 백로그")에도 남아 있다. target 이 §4 에서
  드는 예시(도메인 접두 없는 일반명이 다른 영역과 충돌)는 **이미 실제로 벌어졌던 충돌의
  사후 기록**이지, target 이 새로 만드는 충돌이 아니다.
- `redactTerminalError`/`deepRedactSecrets` 는 `CHANGELOG.md`·`plan/complete/
  eia-terminal-error-sanitize.md`·`plan/complete/spec-draft-eia-error-masking-catalog.md`·
  `plan/in-progress/ws-event-types-extract.md` 등 다수 기존 문서에 이미 같은 의미로
  등장한다 — target §3 이 도입하는 새 이름이 아니라 기존 정본 식별자를 인용한 것이다.
- `plan/complete/` 디렉터리에 `ws-event-types-extract*` 이름의 파일이 존재하지 않음을
  확인했다 — target §3 이 지시하는 `plan/in-progress/ws-event-types-extract.md` →
  `plan/complete/` 이동이 기존 파일과 경로 충돌을 일으키지 않는다.
- `spec/conventions/redis-keys.md:59` 가 `iext:blacklist:<jti>` ·
  `interaction:idempotency:<executionId>:<route>:<key>` 를 실제로 등재하고 있음을 확인 —
  target §2 가 가리키는 앵커(`conventions/redis-keys.md §3` = "## 3. 전역 인벤토리")와
  `4-execution-engine.md#91-키-패턴`(실제 헤딩 "## 9. Redis 키 네이밍 컨벤션" → "### 9.1
  키 패턴") 둘 다 실존해 새 앵커가 기존 것과 충돌하거나 깨지지 않는다.

## 발견사항

없음 — CRITICAL/WARNING 급 신규 식별자 충돌을 찾지 못했다.

- **[INFO]** §4 새 Rationale 문단이 코드 주석(JSDoc)과 내용이 겹친다
  - target 신규 식별자: 없음(문서화 문단 자체는 식별자가 아님)
  - 기존 사용처: `codebase/backend/src/modules/websocket/websocket-events.types.ts:222-223`
    JSDoc 이 이미 "`<도메인>EventType` 규칙" 을 명시
  - 상세: 충돌은 아니지만, spec Rationale 문단과 코드 JSDoc 이 같은 규칙을 두 곳에 서로
    다른 문구로 유지하게 된다. 코드 쪽이 나중에 문구를 바꾸면 spec 쪽만 낡을 수 있다.
  - 제안: 필수는 아니나, 새 Rationale 문단 끝에 "코드 쪽 근거:
    `websocket-events.types.ts` `InAppNotificationEventType` JSDoc" 형태로 상호 포인터를
    남기면 향후 drift 탐지가 쉬워진다. (신규 식별자 충돌은 아니므로 차단 사유는 아님.)

## 요약

target 문서 4개 항목은 전부 **기존 서술의 정정·회수·재문서화**이며, 신규 요구사항 ID·
엔티티/DTO·API endpoint·이벤트명·ENV var·config key·spec 파일 경로 중 어느 것도 새로
만들지 않는다. §3 이 인용하는 `redactTerminalError`/`deepRedactSecrets`, §4 가 언급하는
5개 WS 이벤트 enum, §4 의 `<도메인>EventType` 규칙 자체까지 전부 코드·기존 문서에 이미
실재하는 식별자를 그대로 참조하거나 끌어올린 것으로 실측 확인됐다. §3 의 plan 파일 이동
대상 경로도 `plan/complete/` 에 동명 파일이 없어 경로 충돌이 없다. 신규 식별자 충돌
관점에서 이 target 은 사실상 무해하다.

## 위험도

NONE
