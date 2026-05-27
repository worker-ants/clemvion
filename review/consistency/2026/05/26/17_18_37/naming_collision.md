# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 영역: `spec/4-nodes/3-ai/` (0-common.md · 1-ai-agent.md · 2-text-classifier.md · 3-information-extractor.md)

---

## 발견사항

### 요구사항 ID 충돌 — 이상 없음

target 문서 frontmatter 의 `id` 값은 `common` / `ai-agent` / `text-classifier` / `information-extractor` 이며, 다른 spec 파일에서 동일 id 값이 다른 의미로 사용되는 사례는 확인되지 않는다.

### 엔티티/타입명 충돌 — 이상 없음

target 이 도입하는 새 타입/인터페이스명을 검토하였다.

- `McpServerRef` — `spec/4-nodes/3-ai/0-common.md §3` 에서 정의. 기존 MCP Client spec (`spec/5-system/11-mcp-client.md`) 에서 같은 명칭이 사용되는지 확인이 필요하지만, 상호 참조 문서(`spec/5-system/11-mcp-client.md`) 내에서 동일 이름으로 별도 정의하는 구조가 아니라 ai-agent spec 이 이를 정의하고 MCP Client spec 은 tool 단위 규약을 담으므로 충돌 없음.
- `ConditionDef` — ai-agent §1 에서만 정의. 기존 spec 전체에서 동명 타입이 다른 의미로 쓰이는 사례 없음.
- `PresentationToolDef` — `spec/4-nodes/6-presentation/0-common.md §10` 과 `spec/4-nodes/3-ai/1-ai-agent.md §1` 에서 동일 명칭으로 교차 참조되며, 의미도 일치한다. 충돌 없음.
- `PresentationPayload` — `spec/4-nodes/3-ai/1-ai-agent.md §7.10` 이 단일 진실로 선언하고 있으며, `spec/conventions/data-hydration-surfaces.md` 와 `spec/5-system/15-chat-channel.md` 는 동일 타입을 참조만 한다. 의미 일관성 유지. 충돌 없음.

### API endpoint 충돌 — 이상 없음

target 문서는 신규 REST endpoint 를 정의하지 않는다. 기존 실행 엔진 흐름(WebSocket 명령 `execution.submit_message` / `execution.submit_form` / `execution.retry_last_turn` / `execution.end_conversation` 등) 을 사용하며, 이들은 `spec/5-system/6-websocket-protocol.md` 에 이미 정의되어 있다. 충돌 없음.

### 이벤트/메시지명 충돌 — 이상 없음

target 이 사용하는 이벤트/interactionType 값을 검토하였다.

- `interactionType: 'ai_conversation'` — `spec/5-system/6-websocket-protocol.md §4.4` 및 `spec/conventions/interaction-type-registry.md` 에 정의된 기존 값과 일치한다.
- `interactionType: 'ai_form_render'` — `spec/conventions/interaction-type-registry.md` 에 이미 등록되어 있으며, `spec/5-system/6-websocket-protocol.md §4.4` 에도 반영되어 있다. 충돌 없음.
- `meta.interactionType` 필드명 자체 — 기존 presentation 노드들(`carousel`, `table` 등)이 동일 필드명을 `'buttons'` 값으로 사용하고 있다. 필드명은 공유되며 값(enum 멤버)으로 구분되는 설계이므로 충돌 없음.

### 환경변수·설정키 충돌

**[INFO]** `includeSystemContext` / `systemContextSections` 의 Node config 필드명

- target 신규 식별자: `includeSystemContext` (Boolean), `systemContextSections` (String[])
- 기존 사용처: `spec/4-nodes/3-ai/0-common.md §11` 이 2026-05-18 에 신설하였고, `codebase/backend/src/nodes/ai/shared/system-context-prefix.ts` 가 이를 이미 구현하고 있다.
- 상세: 이 두 필드는 AI 노드 공통 규약(§11)에서 정의된 후 1-ai-agent.md / 2-text-classifier.md / 3-information-extractor.md 세 노드의 config 표에 각각 참조/기재되어 있다. `information-extractor.md` 의 타입 표기에서 `Boolean?` (nullable) 와 `Boolean` (non-nullable) 이 혼재하는 경우가 있는지 확인이 필요하다.
- 구체 확인: `spec/4-nodes/3-ai/3-information-extractor.md` 는 `| includeSystemContext | Boolean? | | true |` 로 Optional 마킹하고 있으나, `0-common.md §11.1` 과 `1-ai-agent.md` 는 `Boolean` (non-nullable) 로 기재한다. 의미적으로 동일(미설정 시 default `true`) 하나 타입 표기가 일치하지 않는다.
- 제안: `information-extractor.md` 의 `Boolean?` 을 `Boolean` 으로 통일하거나, `0-common.md §11.1` 의 "필수" 열 표시를 `(필수 아님)` 으로 명확화하여 세 노드의 표기를 일치시킨다. 구현 착수 전에 교정하면 이후 schema 작성 시 혼선이 없다.

### 파일 경로 충돌 — 이상 없음

`spec/4-nodes/3-ai/` 하위 파일명(`0-common.md`, `1-ai-agent.md`, `2-text-classifier.md`, `3-information-extractor.md`)은 기존 컨벤션(`N-name.md` 정렬 prefix)에 부합하며, 다른 영역 폴더에 동일 경로로 중복된 파일은 존재하지 않는다.

---

## 요약

`spec/4-nodes/3-ai/` 가 도입하는 신규 식별자(요구사항 ID, 엔티티명, API endpoint, 이벤트명, 파일 경로) 전반에서 기존 사용처와 의미 충돌하는 항목은 발견되지 않았다. 주요 추가 식별자(`includeSystemContext` / `systemContextSections` / `PresentationPayload` / `PresentationToolDef` / `ai_form_render` / `ConditionDef` 등)는 모두 동일한 의미로 기존 codebase 또는 cross-reference spec 에서 이미 사용 중이며, 충돌보다는 일관성 유지 상태다. 단 하나의 INFO 사항으로, `information-extractor.md` 에서 `includeSystemContext` / `systemContextSections` 의 타입 표기가 `Boolean?` / `String[]?` (Optional) 인 반면, `0-common.md §11.1` 과 `ai-agent.md` 는 `Boolean` / `String[]` 로 표기하여 세 노드 간 표기가 불일치한다. 구현 착수 전에 통일을 권장한다.

## 위험도

LOW
