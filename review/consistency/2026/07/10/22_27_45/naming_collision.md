# 신규 식별자 충돌 검토 — widget-presentation-restore

## 검토 개요

target(`plan/in-progress/widget-presentation-restore.md`)의 성격을 먼저 확인: 이 문서는 **새 기능 도입이 아니라 spec 오기술 정정 + 기존 코드 결함 수정 plan**이다.

- §4-1 (spec 트랙): `spec/7-channel-web-chat/1-widget-app.md` §2 의 "알려진 제약(Planned)" 서술 삭제/재기술. **새 파일을 만들지 않고 기존 파일을 수정**한다.
- §4-2 (구현 트랙): `asEnvelope`(`codebase/channel-web-chat/src/lib/presentation.ts`)가 이미 존재하는 `PresentationPayload.truncation` 필드를 이미 존재하는 `output.rowsTruncated`/`itemsTruncated`/`rowsTotalCount`/`itemsTotalCount` 필드로 흡수하도록 코드를 고친다.

즉 target 이 **새로 도입**하는 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로는 존재하지 않는다. 아래는 관점별로 실제 저장소를 대조해 이를 검증한 결과다.

## 관점별 대조 결과

### 1. 요구사항 ID 충돌
target 은 새 요구사항 ID를 부여하지 않는다(`NAV-*`/`ED-*`/`ND-*` 류 ID 신설 없음). 해당 없음.

### 2. 엔티티/타입명 충돌
target 이 언급하는 `PresentationPayload`, `ConversationTurn.presentations[]`, `truncation` 은 모두 **이미 spec 에 정의되어 있고 target 은 이를 그대로 인용**한다. 실제 대조:

- `spec/4-nodes/3-ai/1-ai-agent.md:958` — `PresentationPayload type 정의 (단일 진실)` 블록이 이미 존재. `truncation?` 필드가 `:966` 에 이미 정의됨.
- `spec/4-nodes/3-ai/1-ai-agent.md:1249` — 이미 `formDataTruncation (≠ truncation)` 으로 유사 명칭 간 혼동을 명시적으로 구분해 둔 상태 — target 이 신규로 헷갈릴 이름을 도입하는 게 아니라 **기존에 이미 관리되던 네임스페이스 경계**를 그대로 따른다.
- `spec/4-nodes/6-presentation/0-common.md:312` — `presentations[i].truncation` 이 이미 §10.4 에 규정되어 있음(target R3 의 근거와 일치, 코드만 spec 을 못 따라간 상태).
- `spec/7-channel-web-chat/1-widget-app.md:48` — target 이 삭제 대상으로 지목한 "알려진 제약(Planned)" 서술이 실제로 존재함을 확인(target 의 실증 근거가 실제 파일과 일치).

새 타입/엔티티 신설이 없으므로 충돌 없음.

### 3. API endpoint 충돌
target 은 신규 REST/SSE endpoint 를 정의하지 않는다. `getStatus`(EIA, 기존), SSE `execution.message`(기존) 를 그대로 인용할 뿐이다. 해당 없음.

### 4. 이벤트/메시지명 충돌
새 webhook/queue/SSE 이벤트명 도입 없음. 기존 SSE `execution.message` 참조만 있다. 해당 없음.

### 5. 환경변수·설정키 충돌
새 ENV var·config key 도입 없음. 해당 없음.

### 6. 파일 경로 충돌
- spec 변경 대상 `spec/7-channel-web-chat/1-widget-app.md` — 기존 파일 수정, 신규 경로 아님.
- 신규 plan 파일 `plan/in-progress/widget-presentation-restore.md` 자체의 경로 충돌 여부를 확인: `find plan -iname "*widget*presentation*"` 결과 본 파일 1건만 존재 — 기존 plan(`plan/in-progress/`, `plan/complete/`) 어디에도 동명·유사명 파일 없음. kebab-case 명명도 인접 plan 파일들(`ai-agent-tool-connection-rewrite.md`, `cafe24-backlog-residual.md`, `chat-channel-discord-gateway.md` 등)과 컨벤션 일치.

충돌 없음.

## 발견사항

없음 — target 이 신규 식별자를 하나도 도입하지 않으므로(정정 전용 spec 트랙 + 기존 필드를 배선하는 코드 트랙) 본 체크리스트의 6개 관점 모두에서 충돌 후보가 발견되지 않았다.

## 요약

target 문서는 신규 기능이 아니라 기존에 잘못 기술된 spec 문구를 정정하고, 이미 spec(§10.4, §7.10)에 정의돼 있던 `truncation`/`PresentationPayload` 필드를 위젯 코드가 실제로 소비하도록 배선하는 정정 plan이다. 새 요구사항 ID·엔티티/타입·API endpoint·이벤트명·ENV/설정키를 전혀 도입하지 않으며, 유일한 "신규 산출물"인 plan 파일 경로도 기존 `plan/in-progress/` 명명 컨벤션과 정확히 일치하고 동명 충돌이 없다. 신규 식별자 충돌 관점에서 문제될 지점이 없다.

## 위험도
NONE
