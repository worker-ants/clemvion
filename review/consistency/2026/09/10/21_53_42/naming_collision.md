# 신규 식별자 충돌 검토 — `spec-draft-telegram-signing-carveout.md`

## 검토 범위 요약

target draft(변경안 A~E)가 실제로 **새로 도입하는 식별자**는 다음 하나뿐이다:

- `ChatChannelUpdateConfigDto` (구현 턴 명명 예고, spec 사안 아님 — draft 자체가 "이 턴에 하지 않는 것"으로 명시)

나머지(A/B/C/D/E)는 모두 **기존 식별자의 스코프를 좁히는 산문 수정**이다 — `R-CC-21`,
`CCH-AD-02`, `botTokenRef`, `inboundSigningPlaintext`, `issuedInboundSigning`,
`inboundSigningRef` 는 전부 `spec/5-system/15-chat-channel.md` · `spec/data-flow/14-chat-channel.md`
에 이미 존재하는 식별자이며, target 은 이들에 새 의미를 부여하는 것이 아니라 기존 산문이
빠뜨린 예외를 명시적으로 적어 넣는다. 따라서 "요구사항 ID 충돌"·"엔티티/API/이벤트/ENV" 다섯
관점에서 실제 신규 도입은 사실상 없다.

## 관점별 확인 내역

### 1. 요구사항 ID 충돌 — 해당 없음

변경안 A~E 는 새 ID 를 발급하지 않는다. `R-CC-21`(§15-chat-channel.md:734)·`CCH-AD-02`(:54)는
기존 ID 를 그대로 참조/확장할 뿐이다. `grep -n "^### R-CC-"` 결과 `R-CC-10`~`R-CC-21` 까지 연속
발급되어 있고 target 은 이 시퀀스에 새 번호를 추가하지 않는다(기존 R-CC-21 본문 내 소절 신설
— 소절은 서술적 `####` 제목이지 ID 가 아니다). 충돌 없음.

### 2. 엔티티/타입명 충돌 — INFO (이미 target 자체가 올바르게 처리)

- **target 신규 식별자**: `ChatChannelUpdateConfigDto` (draft "이 턴에 하지 않는 것" 절에서
  언급, 구현 턴에 명명 예정)
- **기존 사용처**: 저장소 전수 검색(`grep -rn "ChatChannelUpdateConfigDto\|ChatChannelPatchConfigDto" plan/ spec/ codebase/`)
  결과 **0건** — target 문서 자신 외에는 어디에도 없다.
- **상세**: draft 는 애초에 `ChatChannelPatchConfigDto`(`Patch` 접두)를 후보로 검토했다가
  저장소 명명 컨벤션(`codebase/backend/src/modules/triggers/triggers.controller.ts:35-36`의
  `CreateTriggerDto`/`UpdateTriggerDto`, 그리고 기존 `ChatChannelConfigDto`
  — `triggers.service.ts:33` 등)이 전부 `Create`/`Update` 축이고 `Patch` 접두 클래스가 0건임을
  근거로 `ChatChannelUpdateConfigDto` 로 전환하기로 이미 스스로 결정했다. 이 결정은 기존
  컨벤션과 정합하고, 신규 이름도 기존 사용처와 충돌하지 않는다.
- **제안**: 조치 불요. 구현 턴에서 그대로 `ChatChannelUpdateConfigDto` 채택 권장 (target 의
  자체 결정을 뒤집을 근거 없음).

### 3. API endpoint 충돌 — 해당 없음

target 은 새 endpoint(method+path)를 도입하지 않는다. 참조되는 `POST /api/triggers/:id/chat-channel/rotate-bot-token`
등은 모두 기존 spec(§CCH-SE-04, :89)에 이미 정의된 endpoint 다.

### 4. 이벤트/메시지명 충돌 — 해당 없음

target 은 webhook/queue/SSE 이벤트를 신설하지 않는다.

### 5. 환경변수·설정키 충돌 — 해당 없음

target 은 ENV var·config key 를 신설하지 않는다. `issuedInboundSigning`/`inboundSigningRef`/
`botTokenRef` 는 모두 이미 `spec/5-system/15-chat-channel.md §4.1`(:201-203)에 정의된 필드다.

### 6. 파일 경로 충돌 — 해당 없음

- **target 신규 식별자**: `plan/in-progress/spec-draft-telegram-signing-carveout.md`
- **기존 사용처 대조**: `ls plan/in-progress/ | grep "^spec-draft"` 결과 `spec-draft-eia-62-waiting-payload.md`·
  `spec-draft-eia-notification-payload-contract.md`·`spec-draft-nullable-notation-followups.md` 와
  동일 명명 패턴(`spec-draft-<주제>.md`)을 따른다. 기존 파일과 이름이 겹치지 않고 컨벤션도
  깨지 않는다.
- 판정: 충돌 없음.

### 부가 확인 — "carve-out" 용어 재사용

`carve-out`/`carveout` 문자열은 `spec/5-system/6-websocket-protocol.md`,
`spec/7-channel-web-chat/{4-security,5-admin-console,0-architecture}.md`,
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에도 등장하지만 전부 **정식 식별자가
아닌 서술적 영어 표현**(다른 스코프 경계를 설명하는 일반 용어)이라 충돌 범주에 들지 않는다.

## 요약

target draft 는 신규 식별자를 사실상 도입하지 않는다 — 기존 `R-CC-21`/`CCH-AD-02`/`botTokenRef`/
`inboundSigningPlaintext`/`issuedInboundSigning`/`inboundSigningRef` 를 그대로 참조하며 스코프
산문만 좁힌다. 유일한 신규 후보였던 DTO 명(`ChatChannelPatchConfigDto` → `ChatChannelUpdateConfigDto`)은
target 스스로 저장소의 `Create`/`Update` 명명 컨벤션과 대조해 이미 올바르게 정정했고 전수
검색상 기존 사용처와 충돌하지 않는다. plan 파일 경로도 `spec-draft-*` 컨벤션을 그대로 따른다.
신규 식별자 충돌 관점에서 이 draft 는 깨끗하다.

## 위험도

NONE
