# 신규 식별자 충돌 검토 — ai-agent-formdata-size-limit

검토 모드: `--impl-prep`  
검토 범위: `spec/4-nodes/3-ai` (target 문서 + 관련 spec)  
검토 일시: 2026-05-24

---

## 발견사항

### 요구사항 ID 충돌

충돌 없음. target 변경(§12.7 신설)은 `_product-overview.md` 에 새 ND-AG-* ID 를 부여하지 않는다. 기존 ND-AG-26 (`render_*` Presentation Tool Family) 범위 내의 동작 강화로, 별도 요구사항 ID 없이 §12.7 Rationale 절로만 처리됐다.

### 엔티티/타입명 충돌

#### **[INFO]** `formDataTruncation` — 기존 `truncation` 과 동일 계층에 공존

- target 신규 식별자: `formDataTruncation` (tool_result content JSON 의 옵셔널 필드)
- 기존 사용처:
  - `spec/4-nodes/3-ai/1-ai-agent.md §7.10` — `PresentationPayload.truncation?: { itemsTruncated?, rowsTruncated?, itemsTotalCount?, rowsTotalCount? }` (carousel/table tail-truncate 메타)
  - `codebase/frontend/src/lib/conversation/conversation-utils.ts:89-101` — `PresentationPayloadTruncation` 인터페이스 및 `PresentationPayload.truncation` 필드
  - `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts:302,331` — `truncation: PresentationPayload['truncation']` 반환 타입
- 상세: `formDataTruncation` 은 tool_result content JSON (LLM-facing) 에만 존재하고, `PresentationPayload.truncation` 은 ConversationTurn 의 top-level `presentations[]` 에 실리는 별개 객체다. 두 필드는 서로 다른 레이어에 위치하여 직접 키 충돌이 없다. 이미 spec §12.7 Rationale 에서 "`formDataTruncation` (≠ `truncation`) — consistency-check naming-collision 권고"로 명시적 이름 분리 근거가 기술되어 있어 이전 consistency-check 단계에서 이미 처리됨.
- 제안: 변경 불필요. 이름이 이미 의도적으로 분리되어 있으며 레이어도 다르다. 구현 시 TypeScript 타입 정의에서도 `PresentationPayload.truncation` 의 형식과 섞이지 않도록 `formDataTruncation` 을 별도 inline 타입으로 선언할 것을 권장.

### API endpoint 충돌

신규 endpoint 없음. 변경은 handler 내부 로직(tool_result content 빌드) 에 국한되며 REST/WebSocket API 경로 추가 없음.

### 이벤트/메시지명 충돌

신규 이벤트명 없음. `execution.submit_form` / `execution.submit_message` WebSocket 명령, `presentation_user` ConversationTurn source 모두 기존 식별자를 그대로 사용한다. 신규 `formDataTruncation` 은 tool_result content JSON 내부 필드이며 이벤트 레이어가 아님.

### 환경변수·설정키 충돌

#### **[INFO]** `FORM_SUBMITTED_MAX_BYTES` 상수명 — 기존 `PRESENTATION_MAX_BYTES` 패밀리와 공존

- target 신규 식별자: `FORM_SUBMITTED_MAX_BYTES = 10 * 1024` (ai-agent.handler.ts 에 신설 예정)
- 기존 사용처:
  - `codebase/backend/src/nodes/core/truncate-output.util.ts:13` — `export const PRESENTATION_MAX_BYTES = 1024 * 1024`
  - `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts:77` — `const PRESENTATION_MAX_BYTES = 1024 * 1024` (로컬 재정의)
  - `DEFAULT_MAX_BYTES = 256 * 1024` (truncate-output.util.ts:10 — 미export)
- 상세: `FORM_SUBMITTED_MAX_BYTES` 는 기존 `PRESENTATION_MAX_BYTES` 와 이름·값·목적이 모두 다르다. 충돌 없음. 단, `render-tool-provider.ts` 가 `PRESENTATION_MAX_BYTES` 를 로컬 재정의하는 패턴처럼, `FORM_SUBMITTED_MAX_BYTES` 도 `ai-agent.handler.ts` 안에 로컬 상수로 두도록 plan 에 명시되어 있다. plan 의 "별 chore 검토" 대상인 `truncate-output.util.ts` co-locate 이전이 진행되기 전까지는 파일 간 분리 상태가 유지되므로 현재는 문제 없음.
- 제안: 변경 불필요. 이름 구분이 명확하고 scope 도 분리되어 있다.

### 파일 경로 충돌

신규 파일 없음. 변경은 아래 두 기존 파일의 기존 절 번호 체계 내 신설이다.

- `spec/4-nodes/3-ai/1-ai-agent.md` — §12.6 다음에 §12.7 신설 (Rationale 섹션)
- `spec/4-nodes/6-presentation/0-common.md` — §10.9 기존 표의 (4) layer 행 보강

두 파일 모두 기존 명명 컨벤션(숫자 prefix, spec 폴더 위치)과 정합. 다른 파일과 경로 중복 없음.

---

## 요약

target(`spec/4-nodes/3-ai`) 이 도입하는 신규 식별자는 `formDataTruncation` (tool_result JSON 필드), `FORM_SUBMITTED_MAX_BYTES` (핸들러 상수), `capFormDataBytes` (헬퍼 함수명), `bytesAfterCap` / `originalBytes` / `truncatedFields` (메타 필드명), `§12.7` (spec 절 번호) 로 정리된다. 이 중 `formDataTruncation` 은 기존 `PresentationPayload.truncation` 과 이름이 유사하지만 레이어(ConversationTurn presentations vs LLM tool_result content)가 달라 직접 충돌하지 않으며, 이미 이전 consistency-check 세션에서 명시적으로 구분된 이름으로 확정된 상태다. `FORM_SUBMITTED_MAX_BYTES` 도 기존 `PRESENTATION_MAX_BYTES` 와 의미·값·scope 모두 달라 충돌 없다. 나머지 신규 식별자들은 기존 코드베이스와 spec 어디에서도 사용된 흔적이 없다. 전체 식별자 충돌 위험은 낮음(LOW).

---

## 위험도

LOW
