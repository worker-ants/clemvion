# Cross-Spec 일관성 검토 결과

**대상 문서**: `spec/4-nodes/3-ai/1-ai-agent.md`
**검토 일시**: 2026-07-01
**검토 범위**: spec/4-nodes/3-ai/1-ai-agent.md (draft) vs spec/** 전체

---

## 발견사항

### WARNING: §6.1 step 2.7 — `_resumeState.lastExtractionTurnSeq` (구 평면 키) 참조

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 step 2.7 ("persistent 메모리 추출" 단락)
  - 인용: `"_resumeState.lastExtractionTurnSeq` watermark 초과 turn 만 snapshot 해 enqueue 후 watermark 전진"`
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-03-residuals-bc5e64/spec/5-system/17-agent-memory.md` §3 (AGM-08 / I12 결정)
  - 인용: `"_resumeState.memoryState.lastExtractionTurnSeq` (I12 — 메모리 관련 resume-state 를 `memoryState` sub-namespace 로 그룹화. 읽기는 구 평면 키 `_resumeState.lastExtractionTurnSeq` 로 폴백해 배포 시점 in-flight 파킹 실행과 하위호환)"`
- **상세**: Agent Memory spec §3 은 I12 결정으로 watermark 키를 `_resumeState.memoryState.lastExtractionTurnSeq` (신규 canonical 경로) 로 명명하고, 구 평면 키 `_resumeState.lastExtractionTurnSeq` 는 읽기 경로의 backward-compat fallback 으로만 유지한다. AI Agent spec §6.1 step 2.7 은 아직 구 평면 키를 정식 이름으로 기술하고 있어, 구현자가 두 spec 을 동시에 읽을 때 어느 키가 canonical 인지 혼동할 수 있다. backward-compat fallback 이 있어 런타임 동작 자체는 정합하나 spec 표기의 일관성이 깨진 상태다.
- **제안**: target 문서 §6.1 step 2.7 의 `_resumeState.lastExtractionTurnSeq` 를 `_resumeState.memoryState.lastExtractionTurnSeq` 로 갱신하고, "(backward-compat: 구 평면 키 `_resumeState.lastExtractionTurnSeq` 에서도 읽기 폴백)" 주석을 보존한다. agent-memory spec §3 과 동일 표기로 수렴하면 단일 진실 원칙이 회복된다.

---

### INFO: §6.2 c.fallback — `console.warn` → `logger.warn` 변경 (draft 유일한 실제 diff)

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 c.fallback (`pendingFormToolCall` 누락 시 invariant 예외 처리 진단 로그)
  - draft: `logger.warn('[processMultiTurnMessage] form submission without pendingFormToolCall …', { executionId, nodeId, formData })`
  - main 브랜치: `console.warn(...)` (동일 위치)
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md` §10.9 dispatch 표 "그 외 (미매칭)" 행
  - 인용: `"logger.warn('[processAiResumeTurn] unknown action.type', { executionId, action })"`
- **상세**: draft 의 변경(console → logger)은 NestJS 관행 및 presentation-common §10.9 의 `logger.warn` 표기와 일치한다. 다른 spec 과의 모순 없음 — 이전 main 브랜치가 `console.warn` 을 사용하고 있었던 것이 presentation-common §10.9 표기와 불일치했고, 이번 draft 가 이를 수정한 것으로 해석된다.
- **제안**: 변경 유지. 별도 조치 불필요.

---

## 검토 범위 요약

| 검토 항목 | 참조 문서 | 결과 |
|---|---|---|
| `_resumeState.memoryState.lastExtractionTurnSeq` 키 이름 (I12) | `spec/5-system/17-agent-memory.md` §3 | WARNING — AI Agent spec 이 구 평면 키 참조 |
| `ConversationTurn.presentations[]` top-level 독립 필드 | `spec/conventions/conversation-thread.md` §1.2 | 충돌 없음 |
| `PresentationPayload` SoT (AI Agent §7.10) | `spec/conventions/conversation-thread.md` §1.2 cross-ref | 충돌 없음 |
| `pendingFormToolCall` wire format / WS 이벤트 | `spec/conventions/conversation-thread.md` §9.7 / `spec/4-nodes/6-presentation/0-common.md` §10.9 | 충돌 없음 |
| `processAiResumeTurn` dispatch 4 케이스 | `spec/4-nodes/6-presentation/0-common.md` §10.9 | 충돌 없음 |
| `logger.warn` vs `console.warn` 표기 | `spec/4-nodes/6-presentation/0-common.md` §10.9 | INFO — draft 가 일관성 있게 수정함 |
| `agent_memory` 테이블·scope_key 구조 | `spec/5-system/17-agent-memory.md` §2 | 충돌 없음 |
| `MEMORY_DEDUP_SIMILARITY`·`AGENT_MEMORY_MAX_PER_SCOPE` 상수 | `spec/5-system/17-agent-memory.md` §3 | 충돌 없음 |
| `memoryStrategy` enum (manual/summary_buffer/persistent) | `spec/5-system/17-agent-memory.md` §1 | 충돌 없음 |

---

## 요약

Cross-Spec 일관성 관점에서 target 문서(`spec/4-nodes/3-ai/1-ai-agent.md` draft)의 실질 변경은 §6.2 c.fallback 의 `console.warn` → `logger.warn` 단 1건이며, 이는 presentation-common §10.9 의 기존 `logger.warn` 표기와 오히려 더 잘 정렬된다. 한편 draft 와 직접 연관된 기존 주변 spec 영역을 검토한 결과, §6.1 step 2.7 이 I12 결정(agent-memory §3) 이후에도 구 평면 키 `_resumeState.lastExtractionTurnSeq` 를 canonical 이름으로 기술하고 있어 agent-memory spec 과의 표기 불일치가 존재한다. 이 불일치는 backward-compat fallback 덕분에 런타임 동작은 정합하나 spec 독자에게 canonical 키 경로를 혼동시킬 수 있으므로 WARNING 으로 분류했다. CRITICAL 충돌은 발견되지 않았다.

## 위험도

LOW
