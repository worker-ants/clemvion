# 신규 식별자 충돌 검토 — `spec-draft-ws-types-canonical-location.md`

## 검토 방법

target 은 7+1(§4.4 rationale) 개 변경안을 제시하는데, 전부 **이미 존재하는 식별자**(`KbEventType`,
`NodeEventType`, `ExecutionChannelEvent`, `WebsocketService`, `WebsocketService.emitKbEvent`,
`websocket.service.ts`, `websocket-events.types.ts`)의 **정본 소재 서술을 정정**하는 것이고, 새
요구사항 ID·엔티티명·endpoint·이벤트명·ENV var·spec 파일 경로를 **하나도 신설하지 않는다**. 따라서
"신규 식별자 충돌" 관점에서는 검토 대상 표면 자체가 거의 없다. 대신 target 이 "이미 존재한다"고
주장하는 식별자·경로가 실제로 존재하고 의미가 일치하는지를 코드베이스와 대조해 사실관계를 검증했다
(신원 오인이 곧 충돌의 씨앗이 되므로).

## 검증 결과 (사실관계 대조)

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — 실존 확인. `KbEventType`
  (L254), `NodeEventType`(enum, L185), `ExecutionChannelEvent`(interface, L30, JSDoc 에
  `[Spec EIA §R10]` 인용 포함)가 정확히 이 파일에 선언돼 있음. target 의 "정본이 옮겨졌다" 주장과
  일치.
- `spec/5-system/14-external-interaction-api.md` §R10 (L1262 "R10. WebsocketService 단일 sink
  정책의 확장") 실존 확인 — 항목 ⑦이 인용하려는 절이 실제로 존재.
- frontmatter `code:` 비대칭 확인 — `spec/5-system/6-websocket-protocol.md` (L6-15) 는 이미
  `websocket-events.types.ts` 를 등재하고 있으나, `spec/3-workflow-editor/3-execution.md` (L4-14)
  는 등재하지 않음. target 항목 ①이 이 비대칭을 정확히 지목했고, 추가하려는 항목은 자매 spec 의
  기존 패턴을 단순히 미러링하는 것 — frontmatter 다른 어떤 entry 와도 중복/충돌 없음.
- `WebsocketService.emitKbEvent` 는 `websocket.service.ts` (L296) 에 여전히 존재 — target 이
  "메서드는 안 옮겼다"고 한 주장과 일치, ④⑤에서 메서드명을 그대로 둔 것도 맞다.

이상 전부 target 의 사실 주장과 코드 상태가 일치하며, "정본을 옮긴 것"과 "동작 주체(메서드·facade)"
를 가른 target 의 구분도 실제 코드 구조(타입은 `.types.ts`, 메서드는 `.service.ts`)와 부합한다.

## 관점별 판정

1. **요구사항 ID 충돌** — 신규 ID 없음. 해당 없음.
2. **엔티티/타입명 충돌** — 신규 타입명 없음. `KbEventType`/`NodeEventType`/`ExecutionChannelEvent`
   모두 기존 식별자이며 의미도 그대로(선언 위치만 정정). 해당 없음.
3. **API endpoint 충돌** — 신규 endpoint 없음. 해당 없음.
4. **이벤트/메시지명 충돌** — 신규 이벤트명 없음(`execution.node.*`, `document:embedding_*`,
   `document:graph_*` 등 전부 기존). 해당 없음.
5. **환경변수·설정키 충돌** — 신규 ENV/설정키 없음. 해당 없음.
6. **파일 경로 충돌** — target 은 새 spec 파일을 생성하지 않는다(오히려 "새 문서 신설" 대안을
   Rationale 에서 명시적으로 기각했다). frontmatter `code:` 에 추가하는 경로
   (`websocket-events.types.ts`)는 실존 파일이고 자매 spec 에 이미 등재된 것과 동일 경로라 충돌
   없음. 해당 없음.

### 발견사항

없음 — 신규 식별자 충돌 관점에서 flag 할 항목이 없다.

- **[INFO]** target 은 신규 식별자를 도입하지 않는 순수 포인터 정정 문서
  - target 신규 식별자: (없음)
  - 기존 사용처: `KbEventType`/`NodeEventType`/`ExecutionChannelEvent`/`WebsocketService`/
    `WebsocketService.emitKbEvent` 모두 `codebase/backend/src/modules/websocket/` 하위에
    이미 존재하는 식별자이며, target 은 이들의 spec 상 "정본 소재" 서술만 갱신한다.
  - 상세: 요구사항 ID·엔티티·endpoint·이벤트명·ENV var·spec 파일 경로 6개 관점 전부 신규 도입이
    없어 충돌 표면 자체가 존재하지 않는다. 코드 대조 결과 target 의 사실 주장(파일 실존, 타입 선언
    위치, frontmatter 비대칭, R10 절 실존)도 전부 정확했다.
  - 제안: 조치 불필요.

## 요약

target 문서(`spec-draft-ws-types-canonical-location.md`)는 #1175 리팩터(WS 이벤트 값·타입을
`websocket-events.types.ts` 로 이관)에 맞춰 spec 7곳의 "정본 소재" 서술과 §4.4 rationale 한 문단을
갱신하는 순수 포인터 정정 작업이며, 신규 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·
spec 파일 경로를 전혀 신설하지 않는다. 언급되는 모든 식별자(`KbEventType`, `NodeEventType`,
`ExecutionChannelEvent`, `WebsocketService`, `WebsocketService.emitKbEvent`, R10 절, frontmatter
`code:` 비대칭)를 코드베이스·spec 원문과 직접 대조해 사실관계가 정확함을 확인했다. 신규 식별자
충돌 관점에서 검토 대상 표면 자체가 없으므로 CRITICAL/WARNING 은 발생하지 않는다.

## 위험도

NONE
