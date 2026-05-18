# Cross-Spec 일관성 검토 결과

검토 대상: `spec/conventions/conversation-thread.md` (draft — §1.2·§1.4·§1.5·§1.6·§8.1·§9 신규/갱신 포함)

---

## 발견사항

### 1

- **[WARNING]** `output.messages` SoT 참조 — D6 결정(폐기)과 불일치
  - target 위치: §4 영속화 표 "실행 후" 행 — `output.messages` (AI 멀티턴 누적 — waiting/resumed 시) 를 분산 SoT 로 열거
  - 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` D6 결정 (2026-05-17, 라인 613) — "옛 top-level `output.messages` / `.message` / `.turnCount` / `.maxTurns` 는 폐기 — 다운스트림 expression 은 `$node["X"].output.result.messages` 처럼 단일 경로로 접근한다"
  - 충돌 대상 2: `spec/5-system/4-execution-engine.md` 라인 646 — 동일하게 `output.messages` 를 영구 SoT 로 참조 (이미 D6 이전 표현)
  - 상세: target §4 는 `output.messages` 를 SoT 로 유지하지만, AI Agent spec 의 D6 결정 이후 해당 경로는 폐기되고 `output.result.messages` 가 단일 경로로 통일되었다. §4 의 "실행 후" 행이 그대로 채택되면 UI 재구성 로직이 폐기된 경로를 참조하는 문서를 공식 SoT 로 따르게 된다.
  - 제안: target §4 의 `output.messages` 를 `output.result.messages` 로 수정. `spec/5-system/4-execution-engine.md` 라인 646 도 동시 갱신 필요.

### 2

- **[WARNING]** WebSocket §4.4.6 의 chip "권장" vs target §9.2 의 3중 신호 "강제" — 상위 spec 미동기화
  - target 위치: §9.2 "시각 구분 신호 (3중 강제)" 및 §8.1 Rationale "chip 표시 권장 → 필수 격상 이유"
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` §4.4.6 소비 측 권장 동작 라인 523 — "주입된 컨텍스트 임을 시각적으로 구분(예: chip) 하는 것을 **권장**"
  - 상세: target §8.1 은 "WebSocket §4.4.6 옛 '권장'을 §9.2 의 3중 신호 정규 매핑으로 강제 격상"이라고 명시하나, WebSocket 프로토콜 spec 자체는 여전히 "권장" 표현을 유지하고 있다. 두 문서를 동시에 읽는 구현자는 강제인지 권장인지 혼돈할 수 있다.
  - 제안: `spec/5-system/6-websocket-protocol.md` §4.4.6 소비 측 권장 동작 항목을 "강제" 또는 "conversation-thread.md §9.2 의 3중 신호 강제 매핑을 따른다"로 갱신.

### 3

- **[WARNING]** §9.3 D4 / §9.4 D6 레이블 — execution-history spec 의 EH-DETAIL-06 와 책임 겹침
  - target 위치: §9.3 데이터 소스 선택 표 "실행 이력" 행 — "NodeExecution 의 `output.messages` (DB 영속) + `output.interaction` … UI 복원 시 두 경로를 합쳐 `conversationThread.turns` 와 동등한 view 를 재구성한다"
  - 충돌 대상: `spec/2-navigation/14-execution-history.md` EH-DETAIL-06 — "AI Agent 노드는 대화 내역 + 메시지별 상세"만 정의. 재구성 방법(두 경로 합산 방식)에 대한 별도 spec 없음
  - 상세: target §9.3 이 실행 이력 화면의 재구성 방법을 직접 정의하고 있으나, 실행 이력 화면의 단일 진실 공급원은 `14-execution-history.md` 이다. 책임 분산이 발생했으며 두 문서가 다른 사람에 의해 별도 갱신될 경우 드리프트 가능성이 있다.
  - 제안: target §9.3 의 실행 이력 행에서 재구성 방법을 서술하되 "상세 재구성 규약은 [Spec 실행 이력 §EH-DETAIL-06](../2-navigation/14-execution-history.md) 를 따른다"로 역참조를 추가하거나, 실행 이력 spec 에 재구성 방법 단락을 신설하고 여기서 참조.

### 4

- **[INFO]** `§1.2 text` 필드 정의 — 기존 배포본 대비 의미 확장
  - target 위치: §1.2 ConversationTurn `text` 필드 — "LLM-facing 1차 텍스트 … `[from <nodeLabel>]` prefix, `[user-input]…[/user-input]` 같은 인라인 마커는 박지 않는다 (§1.5·§1.6). UI 표시는 §11 의 매핑표를 따라…"
  - 충돌 대상: 현재 배포된 `spec/conventions/conversation-thread.md` 라인 31 — "`text` | String | system_text injection 과 UI 의 1차 텍스트. 빈 문자열 가능"으로 단순 정의
  - 상세: target 은 `text` 필드를 "LLM-facing 1차 텍스트"로 명확화하고 §11(target 에서는 §9)의 UI 매핑표를 정식 규약으로 정의한다. 이 의미 확장은 배포본과 단순 갱신 수준이지만, 기존에 UI 가 `text` 를 직접 raw 노출하는 구현이 있다면 §9.4 금지 규칙과 충돌할 수 있다. §9.4 는 신규 규정이므로 기존 구현의 소급 적용 여부 확인 필요.
  - 제안: 구현 영역(`codebase/frontend`)에서 `messagesToConversationItems`, `threadTurnsToConversationItems`, `parseHistoryMessages` 가 현재 raw `text`를 직접 표시하는지 확인 후, §9.5 의 strip 정규식 적용 여부 점검.

### 5

- **[INFO]** §7 v2 로드맵 "Service 모듈 위치 정리" — `codebase/` 경로 직접 참조
  - target 위치: §7 v2 로드맵 마지막 항 — "현재 `codebase/backend/src/modules/execution-engine/conversation-thread/` 에 types/renderer/service 가 함께 있음"
  - 충돌 대상: `spec/` 단일 진실 원칙(CLAUDE.md). spec 문서가 codebase 특정 경로를 박제하면 리팩토링 시 spec 과 코드가 드리프트됨
  - 상세: spec 문서가 codebase 의 구체 파일 경로를 직접 기술하는 패턴은 살아있는 문서(spec) 가 코드 트리의 일회성 상태를 박제하는 것이다. 리팩토링 후 경로가 달라지면 spec 이 오래된 정보를 제공하게 된다.
  - 제안: 경로 직접 기술 대신 "현재 execution-engine 모듈 내 conversation-thread 서브모듈에 위치" 수준의 논리적 기술로 변경하거나, 코드 참조 주석에 "현재 위치 — 리팩토링 시 갱신 필요" 명기.

### 6

- **[INFO]** §1.6 `[user-input]…[/user-input]` 마커 — node-output §4.5 의 `interaction.data` 와 책임 경계 명확화 필요
  - target 위치: §1.6 표 마지막 행 — "라벨/이벤트/메타 (예: button 라벨, URL) — `turn.data` 의 1급 필드 ([node-output §4.5]) 가 단일 진실"
  - 충돌 대상: `spec/conventions/node-output.md` §4.5 — `interaction.data` 의 shape 을 정의하지만 UI 가 `data` 에서 직접 추출해야 한다는 규칙은 없음
  - 상세: target §1.6 은 "UI 는 `data` 에서 직접 추출, marker 가 박힌 text 를 파싱하지 않음"을 강제하지만, 이 규칙이 node-output 규약에 back-reference 되어 있지 않아 node-output 단독 검토자는 UI 파싱 금지 규칙을 놓칠 수 있다.
  - 제안: `spec/conventions/node-output.md` §4.5 에 "UI 는 `interaction.data` 필드를 직접 추출하며 `turn.text` 의 마커를 파싱하지 않는다 — 상세: [Conversation Thread §1.6]"의 단문 주석 추가 권장.

---

## 요약

target 문서는 기존 Conversation Thread 컨벤션에 UI 렌더 규칙(§9), LLM payload prefix 책임 경계(§1.5), 보안 마커 정책(§1.6)을 추가하고 `§1.2 text` 의미를 명확화하는 실질적 확장이다. 데이터 모델 구조 자체의 충돌은 없으며 RBAC/상태 머신/API 계약 충돌도 없다. 그러나 두 가지 WARNING 이 존재한다. 첫째, §4 영속화 표에서 AI Agent D6 결정(2026-05-17)으로 폐기된 `output.messages` 경로를 SoT 로 참조하고 있어, `output.result.messages` 로 수정하지 않으면 UI 재구성 로직이 구버전 경로를 공식 문서 기준으로 따르는 모순이 발생한다. 둘째, WebSocket §4.4.6 의 chip "권장" 표현이 target §9.2 의 "3중 강제"와 상충하며, 두 문서를 독립적으로 읽을 경우 구현자의 혼돈이 예상된다. 두 WARNING 모두 독립 작동 불가 수준의 기능 충돌은 아니지만, 방치 시 구현 드리프트로 이어질 수 있어 채택 전 갱신을 권고한다.

---

## 위험도

MEDIUM
