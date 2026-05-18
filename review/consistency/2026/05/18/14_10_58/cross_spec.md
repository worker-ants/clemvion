# Cross-Spec 일관성 검토 결과

대상: `spec/conventions/conversation-thread.md` (2026-05-18 개정 draft)

---

### 발견사항

---

- **[WARNING]** WebSocket §4.4.6 "권장" vs. target §9.2·§9.3·§9.4 "강제" — UI 소비 정책 충돌
  - target 위치: `§9.2 시각 구분 신호 (3중 강제)` / `§9.3 데이터 소스 선택` / `§9.4 emit messages 의 raw 노출 금지` / `§8.1 Rationale`
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md §4.4.6` "소비 측 권장 동작" (line 523)
  - 상세: WebSocket spec §4.4.6는 "대화 UI 표시는 `injected` 도 함께 보여주되, '주입된 컨텍스트' 임을 시각적으로 구분(예: chip) 하는 것을 **권장**"이라고 명시한다. target draft는 이를 폐기하고 ① `conversationThread.turns` snapshot을 conversation Preview의 **유일한** 1차 소스로 강제하고 ② `ai_message.messages[]`(emit)를 LLM debug 패널 전용으로 격리하며 ③ 아이콘+컨테이너+chip 3중 신호를 **강제**한다. target의 §8.1이 이 설계 변경을 설명하지만, WebSocket spec 본문은 여전히 구 "권장" 문구를 유지하고 있어 두 spec이 소비 측 UI 구현 방향을 다르게 지시하는 상태다. 구현자가 WebSocket spec만 읽으면 emit messages를 conversation UI에 노출(chip 표시 포함)하고, target만 읽으면 emit messages를 conversation Preview에서 완전히 격리한다.
  - 제안: `spec/5-system/6-websocket-protocol.md §4.4.6` 소비 측 권장 동작 단락을 target §9 결정과 정합되도록 갱신 필요. 구체적으로: "대화 UI 표시는 conversationThread.turns snapshot을 1차 소스로 사용하고 emit messages는 LLM debug 패널 전용으로 격리한다" 방향으로 교체. target 채택 시 WebSocket spec 동반 개정 필수.

---

- **[WARNING]** `spec/2-navigation/14-execution-history.md §EH-DETAIL-06`에 "ConversationThread 재구성 정책" 부재
  - target 위치: `§9.3 데이터 소스 선택` 표의 세 번째 행 ("실행 이력 복원 view")
  - 충돌 대상: `spec/2-navigation/14-execution-history.md` EH-DETAIL-06 항목 (line 65)
  - 상세: target §9.3은 "상세 복원 규약은 [Spec Execution History §EH-DETAIL-06]의 ConversationThread 재구성 정책에 위임"이라고 명시한다. 그러나 실행 이력 spec의 EH-DETAIL-06은 "Preview 탭: Presentation 노드는 시각적 프리뷰, AI Agent 노드는 대화 내역 + 메시지별 상세, 일반 노드는 상태 요약" 한 줄만 있으며, `output.result.messages` + `output.interaction`을 합쳐 `conversationThread.turns`와 동등한 view를 재구성하는 규약은 정의되어 있지 않다. 링크된 위임 대상이 비어 있어 구현자가 따를 단일 규범이 없다.
  - 제안: `spec/2-navigation/14-execution-history.md`에 EH-DETAIL-06 확장 섹션을 추가해 ConversationThread 재구성 정책(source 매핑, output.result.messages + output.interaction 합산 방식, debug 탭용 emit 재구성 방식)을 명문화하거나, target §9.3 내에 직접 해당 규약을 인라인으로 기술해야 한다.

---

- **[WARNING]** §1.6 테이블의 `output.messages[].content` — D6 단일 경로(`output.result.messages`)와 표기 불일치
  - target 위치: `§1.6 LLM-facing 보안 마커` 테이블 두 번째 행
  - 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` D6 결정 (line 613), `spec/conventions/node-output.md §8.2`
  - 상세: target §1.6 표에서 "마커가 박힌 `turn.text` / `output.messages[].content`"가 "그대로 영속·emit"이라고 기술한다. D6 결정(2026-05-17)은 `output.messages`를 폐기하고 `output.result.messages`를 단일 경로로 확정했다. `output.messages[].content`는 폐기된 경로명이다. target의 §4 영속화 표와 CHANGELOG에서는 이미 D6를 반영해 `output.result.messages`를 사용하고 있어 §1.6 테이블만 구 명칭을 그대로 남기고 있다.
  - 제안: target §1.6 테이블 두 번째 행을 "마커가 박힌 `turn.text` / `output.result.messages[].content`"로 정정한다.

---

- **[INFO]** §1.4 `text` 변환 규칙 섹션에서 `§11` 참조 — 존재하지 않는 섹션 번호
  - target 위치: `§1.4 text 변환 규칙` 첫 번째 문단 (line 47)
  - 충돌 대상: target 문서 자체 (§9가 미리보기 UI 렌더 규칙, §11은 존재하지 않음)
  - 상세: §1.4 첫 문단이 "UI 표시는 **§11** 의 매핑표를 우선 적용하며"라고 기술하지만, target 문서에 §11은 없다. 미리보기 UI 렌더 규칙은 §9에 정의되어 있다. §9.1 표가 source별 시각 매핑(강제)을 담고 있으므로 참조 대상은 §9.1이 적합하다.
  - 제안: target §1.4 "§11" 참조를 "§9.1"로 정정한다.

---

- **[INFO]** §2.5 `nextSeq 원자성` 섹션이 §3 스코프 규칙 이후에 배치되어 있어 번호 순서 역전
  - target 위치: `§2.5 nextSeq 원자성` (문서 line 143, §3 스코프 규칙 이후)
  - 충돌 대상: 없음 (target 내부 구조 문제)
  - 상세: 목차 상 `## 3. 스코프 규칙` 이후에 `### 2.5 nextSeq 원자성`이 배치되어 있다. §3 뒤에 §2.5가 오는 것은 편집 중 위치 이탈로 보이며, 독자가 구조를 따라가는 데 혼란을 준다.
  - 제안: `§2.5 nextSeq 원자성` 블록을 `§2.4 opt-out` 직후(`## 3. 스코프 규칙` 이전)로 이동한다.

---

- **[INFO]** §7 v2 로드맵이 "현재 types/renderer가 execution-engine 폴더에 있다"고 기술 — 실제 코드와 불일치
  - target 위치: `§7 v2 로드맵` "Service 모듈 위치 정리" 항목
  - 충돌 대상: 실제 codebase 구조
  - 상세: target §7은 "현재 `codebase/backend/src/modules/execution-engine/conversation-thread/` 에 types/renderer/service 가 함께 있음"이라고 기술한다. 실제로는 `types`(`conversation-thread.types.ts`)와 `thread-renderer.ts`는 이미 `src/shared/conversation-thread/`에 분리되어 있고, `service`만 `src/modules/execution-engine/conversation-thread/`에 있다. 목표 상태(shared로 분리)가 이미 부분 달성된 상태이다. §1.6에서 thread-renderer.ts 경로를 `src/shared/conversation-thread/thread-renderer.ts`로 정확히 참조하고 있어 두 진술이 서로 모순된다.
  - 제안: §7 "Service 모듈 위치 정리" 항목을 "현재 renderer/types는 `src/shared/conversation-thread/`에 분리 완료, service는 `src/modules/execution-engine/conversation-thread/`에 위치. 향후 별도 `@workflow/conversation-thread` 패키지로 추출 검토"로 현행화한다.

---

### 요약

target draft(`spec/conventions/conversation-thread.md`)는 Conversation Thread의 UI 렌더 규칙(§9)과 LLM payload prefix 책임 경계(§1.5), 보안 마커 의무(§1.6)를 신규 명문화하는 방향에서 전반적으로 타 spec들과 정합적이다. 데이터 모델(`ConversationTurn`, `ConversationThread`), 상태 전이, RBAC, 계층 책임 분할에서 타 spec과의 직접 모순은 없다. 그러나 가장 중요한 교차 충돌은 **WebSocket spec §4.4.6와의 UI 소비 정책 불일치**로, WebSocket spec은 여전히 emit messages를 대화 UI에 chip으로 노출하는 것을 "권장"하는 반면 target은 이를 완전히 격리하고 conversationThread snapshot만을 1차 소스로 강제한다. target 채택 시 WebSocket spec 동반 개정이 필수이다. 부가적으로 EH-DETAIL-06 위임 대상의 내용 부재, §1.6의 폐기 경로명(`output.messages`) 잔존, §1.4의 존재하지 않는 §11 참조, §2.5 위치 역전, §7 코드 현황 오기술 등 소규모 정합성 이슈들이 있다.

---

### 위험도

MEDIUM
