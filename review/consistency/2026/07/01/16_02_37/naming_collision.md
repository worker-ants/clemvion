# 신규 식별자 충돌 검토 결과

target: `spec/4-nodes/3-ai/1-ai-agent.md`

---

## 발견사항

### 발견사항 1
- **[WARNING]** `_resumeState.lastExtractionTurnSeq` — 구 flat 키를 target 이 canonical 처럼 기술
  - target 신규 식별자: `_resumeState.lastExtractionTurnSeq` (§2.7 "증분 추출" 단락)
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-03-residuals-bc5e64/spec/5-system/17-agent-memory.md` §3 (line 80) — canonical 명칭을 `_resumeState.memoryState.lastExtractionTurnSeq` (I12 sub-namespace)로 정의하고 구 flat 키 `_resumeState.lastExtractionTurnSeq`는 "읽기 폴백"으로 명시
    - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-03-residuals-bc5e64/spec/4-nodes/3-ai/3-information-extractor.md` line 163 — `memoryState.lastExtractionTurnSeq` (I12)로 운반하며 구 flat 키는 "in-flight 하위호환 폴백"으로만 참조
    - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-03-residuals-bc5e64/spec/5-system/_product-overview.md` AGM-08 — `lastExtractionTurnSeq`(단축형) 참조
  - 상세: `17-agent-memory.md`와 `3-information-extractor.md`는 I12 결정(메모리 관련 resume-state를 `memoryState` sub-namespace로 그룹화)에 따라 **`_resumeState.memoryState.lastExtractionTurnSeq`**를 canonical로 채택했고, 구 flat 키 `_resumeState.lastExtractionTurnSeq`는 배포 시점 in-flight 파킹 실행과의 하위호환을 위한 READ 폴백으로만 언급한다. 그러나 target `1-ai-agent.md` §2.7은 flat 키만 언급하며 sub-namespace 키와의 관계를 기술하지 않아, 독자가 flat 키가 여전히 canonical인 것으로 오해할 수 있다. 실제 충돌(다른 의미의 동일 식별자)이 아니라 canonical 형식 미갱신이므로 WARNING 등급.
  - 제안: `1-ai-agent.md` §2.7의 증분 추출 단락에서 `_resumeState.lastExtractionTurnSeq`를 `_resumeState.memoryState.lastExtractionTurnSeq` (I12)로 갱신하고, 구 flat 키는 `17-agent-memory.md`·`3-information-extractor.md`와 동일하게 "(읽기 경로는 구 평면 키 `_resumeState.lastExtractionTurnSeq` 폴백 — 배포 시점 in-flight 하위호환)"으로 병기할 것.

---

### 발견사항 2 (확인 — 충돌 없음)

아래 신규 식별자들은 검색 코퍼스 내에서 동일 의미로 일관 사용되고 있어 충돌 없음을 확인했다.

| 식별자 | 충돌 검토 결과 |
|---|---|
| `ND-AG-26` ~ `ND-AG-30` | `spec/4-nodes/3-ai/_product-overview.md` 및 `spec/4-nodes/_product-overview.md` 양쪽에 동일 의미로 정의됨. target의 참조와 일치 |
| `PresentationToolDef` | `spec/4-nodes/6-presentation/0-common.md` §10.2~§10.3에서 동일 구조로 참조. 충돌 없음 |
| `PresentationPayload` | `spec/4-nodes/6-presentation/0-common.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md` 에서 동일 의미 사용 |
| `render_table` / `render_chart` / `render_carousel` / `render_template` / `render_form` | `spec/4-nodes/6-presentation/0-common.md` §10.1 tool 카탈로그에서 동일 5종으로 정의. 네임스페이스 충돌 없음 |
| `user_ended` / `max_turns` | `spec/3-workflow-editor/1-node-common.md`, `spec/4-nodes/3-ai/3-information-extractor.md`, `spec/4-nodes/3-ai/2-text-classifier.md` 예약 포트어 목록에 일관 등재. 충돌 없음 |
| `memoryStrategy` / `memoryTokenBudget` / `memoryKey` / `memoryTopK` / `memoryThreshold` / `memoryTtlDays` / `embeddingModelConfigId` / `summaryModelConfigId` / `extractionModelConfigId` | `spec/4-nodes/3-ai/3-information-extractor.md`·`spec/5-system/17-agent-memory.md` 에서 동일 의미로 사용. 충돌 없음 |
| `ai_form_render` / `ai_conversation` | `spec/conventions/interaction-type-registry.md` §1 `WaitingInteractionType` enum에 등록됨. 동일 의미 |
| `RESUME_INCOMPATIBLE_STATE` / `RETRY_STATE_NOT_FOUND` | `spec/1-data-model.md`, `spec/5-system/4-execution-engine.md` 에서 동일 에러 코드로 사용 |
| `_resumeState` / `_resumeCheckpoint` / `_retryState` | `spec/5-system/4-execution-engine.md` §1.3 및 `spec/conventions/node-output.md` Principle 4.2에서 동일 top-level internal 필드로 정의 |
| `McpServerRef` | `spec/4-nodes/3-ai/0-common.md` §3에서 동일 구조로 정의. 충돌 없음 |
| `chat-config-selector` / `embedding-config-selector` | `spec/3-workflow-editor/1-node-common.md` 위젯 목록에 동일 명칭으로 등재 |
| `meta.memory` (메모리 전략 적용 결과 echo) | `spec/5-system/17-agent-memory.md` line 90에서 `meta.memory.recalledCount`로 동일 의미 참조 |
| `presentationTools` config 필드 | `spec/5-system/4-execution-engine.md` line 165에서 ai_agent checkpoint allow-list 항목으로 동일 의미 참조 |
| `ND-AG-06` / `ND-AG-10` / `ND-AG-21` (제거됨 표기) | `spec/4-nodes/_product-overview.md` 및 `spec/4-nodes/3-ai/_product-overview.md` 양쪽에서 동일한 "제거됨 — 재작성 예정" 상태로 일치 |

---

## 요약

target `spec/4-nodes/3-ai/1-ai-agent.md`가 도입하거나 참조하는 식별자들을 전수 검토한 결과, CRITICAL 충돌은 발견되지 않았다. 단 하나의 WARNING이 확인됐다: §2.7의 증분 추출 watermark 필드명이 구 flat 키 `_resumeState.lastExtractionTurnSeq`로 기술돼 있으나, 다른 spec 문서들(`17-agent-memory.md`, `3-information-extractor.md`)은 I12 결정에 따라 `_resumeState.memoryState.lastExtractionTurnSeq` sub-namespace를 canonical로 채택하고 flat 키는 읽기 폴백으로만 남겨두었다. 실제 충돌(다른 의미의 동일 식별자)이 아니라 target의 기술이 최신 canonical 형식을 미반영한 것이다. 요구사항 ID(ND-AG-01~30), 엔티티/타입명, API endpoint, 이벤트명, 환경변수, 파일 경로 영역 모두 기존 사용처와 의미가 일치하며 충돌이 없다.

## 위험도

LOW
