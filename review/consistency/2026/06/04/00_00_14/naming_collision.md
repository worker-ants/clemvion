# 신규 식별자 충돌 검토 결과

검토 범위: `spec/4-nodes/3-ai/` (diff-base=origin/main)
검토 시각: 2026-06-04

---

## 발견사항

### INFO — `memoryStrategy` 새 값 `persistent` 와 기존 `persistent` 영어 단어의 혼재

- **target 신규 식별자**: `memoryStrategy` 필드의 enum 값 `'persistent'` (`spec/4-nodes/3-ai/0-common.md §10`, `spec/4-nodes/3-ai/1-ai-agent.md §1`)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/ai-context-memory-9c7e6e/spec/2-navigation/4-integration.md` line 737, `spec/4-nodes/4-integration/4-cafe24.md` line 466 — 여기서 `persistent` 는 **자연어 형용사**로 "토큰이 지속됨" 의미이며 enum 값이 아님
- **상세**: 두 사용처의 `persistent` 는 타입 시스템 바깥의 산문 텍스트이므로 enum 값 `'persistent'` 와 직접 충돌하지 않는다. 코드 리뷰어나 LLM이 문서를 읽을 때 혼동 가능성이 낮다.
- **제안**: 현행 유지. 별도 조치 불필요.

---

### INFO — `includeSystemContext` / `systemContextSections` 에 대응하는 요구사항 ID 부재

- **target 신규 식별자**: `includeSystemContext` (Boolean, default `true`), `systemContextSections` (String[], default `['time','timezone']`) — `spec/4-nodes/3-ai/0-common.md §11.1`
- **기존 사용처**: `spec/4-nodes/3-ai/_product-overview.md` 의 ND-AG 테이블(ND-AG-27~ND-AG-30 은 memory 전략 커버), `spec/4-nodes/_product-overview.md` 의 동일 테이블. System Context Prefix (`§11`) 는 두 테이블 어디에도 요구사항 ID 행이 없다.
- **상세**: Memory 전략 필드 (ND-AG-27~30) 는 product-overview 에 명시됐지만, 동일 PR 에서 도입된 `includeSystemContext` / `systemContextSections` 는 요구사항 ID 미등록 상태다. 이 두 필드는 기존 워크플로우 LLM 동작에 기본 활성화(`true`)로 영향을 주므로 추적 가능성이 확보되어야 한다. 단, 명명 충돌이 아니라 traceability 누락이다.
- **제안**: `spec/4-nodes/3-ai/_product-overview.md` 와 `spec/4-nodes/_product-overview.md` 에 `ND-AG-31 | System Context Prefix (includeSystemContext / systemContextSections) — 3 노드 systemPrompt 앞에 현재 시각·timezone prefix 자동 prepend` 행 추가를 권장.

---

### INFO — `NAV-SC-06` 참조와 `spec/2-navigation/3-schedule.md` 의 기술 불일치 (선재 이슈)

- **target 신규 식별자**: `spec/4-nodes/3-ai/0-common.md §11.3` 에서 `Workspace.settings.timezone` 을 `NAV-SC-06 필수 항목` 으로 명시
- **기존 사용처**: `spec/2-navigation/3-schedule.md` line 71 — "워크스페이스 설정 기반 기본값은 미구현/Planned (워크스페이스에 timezone 설정 자체가 아직 없음)"
- **상세**: `spec/1-data-model.md` (worktree) line 80 은 이미 `Workspace.settings.timezone` 을 정식 필드로 기술하고 `NAV-SC-06` 과 연결한다. target spec 의 참조는 data-model 과 일치하며 정확하다. 단, `3-schedule.md` 는 아직 갱신되지 않아 "아직 없음"으로 남아 있다. 이 불일치는 이번 target 이 도입한 것이 아닌 선재 이슈다.
- **제안**: `spec/2-navigation/3-schedule.md` line 71 의 "(워크스페이스에 timezone 설정 자체가 아직 없음)" 부분을 `spec/1-data-model.md §2.2` 기준으로 현행화하는 별도 수정 권장. target 에는 변경 불필요.

---

## 요약

`spec/4-nodes/3-ai/` 가 도입하는 신규 식별자(`memoryStrategy`, `memoryTokenBudget`, `memoryKey`, `memoryTopK`, `memoryThreshold`, `summary_buffer`, `persistent`, `includeSystemContext`, `systemContextSections`, `AgentMemory` 엔티티, `runningSummary` / `summarizedUpToSeq` 필드, `agent_memory` 테이블명)는 기존 spec 코퍼스 내에서 동일 이름으로 다른 의미로 쓰이는 사례가 없다. `memoryTopK` / `memoryThreshold` 는 `ragTopK` / `ragThreshold` 와 유사하나 `spec/5-system/17-agent-memory.md` line 75 에서 명시적으로 별개 필드임을 선언한다. `PresentationPayload` 타입은 `spec/4-nodes/3-ai/1-ai-agent.md §7.10` 을 단일 진실로 두고 여러 downstream spec 이 cross-ref 만 두어 drift 없이 정합된다. 유일한 구조적 개선 여지는 `includeSystemContext` / `systemContextSections` 에 대한 요구사항 ID 미등록으로, 명명 충돌이 아닌 traceability 공백이다.

## 위험도

LOW

---

STATUS: OK
