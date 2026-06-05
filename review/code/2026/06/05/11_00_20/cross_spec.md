# Cross-Spec 일관성 검토 — summaryModel / extractionModel 필드 추가

**검토 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` + `spec/5-system/17-agent-memory.md`  
**worktree**: `agent-memory-summary-model-fa4efb`  
**날짜**: 2026-06-05

---

## CRITICAL

없음.

---

## WARNING

### W-01 `conversation-thread.md §7` v2 로드맵 항목이 갱신되지 않음

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §12.12` — "저비용 전용 모델 옵션은 v2 로드맵으로 유보한다 ([conversation-thread §7]… "요약/추출 전용 저비용 모델")" 라는 기존 문구가 §12.12 번복 이전(origin/main)에 작성됐다.
- **충돌 대상**: `spec/conventions/conversation-thread.md §7 v2 로드맵`
- **상세**: origin/main 의 `§12.12` 은 "저비용 전용 모델 옵션은 v2 로드맵으로 유보한다 ([conversation-thread §7](…) '요약/추출 전용 저비용 모델')" 라고 cross-link 한다. 그런데 `conversation-thread.md §7` 에는 이 항목이 **원래부터 존재하지 않는다** — 본 브랜치도 `conversation-thread.md` 의 §7을 갱신하지 않았다. 결과적으로 `1-ai-agent.md §12.12` 의 현재(번복) 문구는 "이미 도입했다"고 선언하면서, `conversation-thread.md §7`에는 "v2 유보" 항목도, "채택 완료" 취소선 표기도 없어 독자가 로드맵 상태를 추적할 수 없다.
- **제안**: `conversation-thread.md §7` 에 다음 중 하나를 추가·갱신한다.
  - `~~요약/추출 전용 저비용 모델 (summaryModel / extractionModel)~~` → **채택 완료** (AI Agent §12.12, 1-ai-agent.md §1 config 표)
  - 또는 해당 항목 자체가 origin/main 의 §7에 없었다면, `§12.12` cross-link 문구에서 "(conversation-thread §7 '요약/추출 전용 저비용 모델')" 참조를 제거하거나 수정한다.

---

### W-02 `AGM-04` 요구사항 명세 변경 — 구현 파일의 기댓값과 정합 확인 필요

- **target 위치**: `spec/5-system/17-agent-memory.md §3` AGM-04 요구사항 라인
- **충돌 대상**: 구현 코드 `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.processor.ts`
- **상세**: origin/main 의 AGM-04 는 "노드 model 재사용" 으로 명세됐고, 본 diff 는 이를 "추출 모델 = `extractionModel ?? 노드 model ?? llmConfig 기본`" 으로 변경한다. spec 요구사항 ID 가 같은 채로 내용이 번복됐다 — 요구사항 ID 충돌이 아니라 **의미 확장**이므로 CRITICAL은 아니지만, extraction.processor 가 실제로 `extractionModel` 필드를 읽어 model resolving 을 수행하는지는 spec 변경만으로 자동 검증되지 않는다. 해당 worktree diff 에 processor 파일이 포함돼 있으므로 구현 상 반영이 됐을 가능성이 높으나, cross-spec 차원에서 spec AGM-04 와 processor 구현의 정합을 명시적으로 확인해야 한다.
- **제안**: `agent-memory-extraction.processor.ts` 내 model resolve 로직이 `extractionModel ?? nodeModel ?? llmConfigDefault` fallback 체인을 구현하는지 확인. 미구현 시 구현 추가 또는 spec 에 "Planned" 표기.

---

## INFO

### I-01 `1-ai-agent.md §1` config 표 — `summaryModel` visibleWhen 과 §2 UI 기술의 일치 확인

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §1` config 표 (신규 행) + §2 UI visibleWhen 기술
- **충돌 대상**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` (summaryModel visibleWhen)
- **상세**: spec §2 visibleWhen 문구 — "`Token Budget` 과 `Summary Model` 은 `memoryStrategy ∈ {summary_buffer, persistent}` 일 때, … `Extraction Model` 은 `memoryStrategy == persistent` 일 때만 노출" — 은 schema.ts 의 `summaryModel.visibleWhen: { field: 'memoryStrategy', oneOf: ['summary_buffer', 'persistent'] }` 및 `extractionModel.visibleWhen: { field: 'memoryStrategy', equals: 'persistent' }` 와 일치한다. spec ↔ schema 간 정합 이상 없음. 단, spec §1 config 표의 `summaryModel` 행은 `visibleWhen` 열을 기술하지 않는 기존 표 형식을 따라서 visibleWhen 이 §2 에만 있다 — 일관성 목적으로 config 표에도 간략 `visibleWhen` 비고를 추가하면 좋다.
- **제안**: 필수 아님. 기존 다른 필드(memoryTokenBudget 등)도 config 표에 visibleWhen 을 기재하지 않으므로 현행 표 관례와 일치한다 — 무시해도 됨.

### I-02 `§12.12` 번복 결정 — 번복 문서화 완결성 (Rationale)

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §12.12`
- **충돌 대상**: 없음 (동일 섹션 내 번복)
- **상세**: §12.12 는 v1 기각 결정(origin/main)을 "과거 결정"으로 보존하고 현 결정(번복)을 이어 서술하는 형식이다. 이는 spec 변경 추적 관점에서 좋은 패턴이다. 다만 번복 근거 (a)(b)(c) 중 (b) "provider/credential 선택 UI 추가 우려 불발생" 의 근거가 "모델 ID expression 문자열 1개씩" 이라고만 서술된다 — `llmConfigId` 를 그대로 재사용하는 제약이 schema 에 구현됐음을 확인할 수 있다(`summaryModel` / `extractionModel` 은 `z.string().optional()` 로 별도 llmConfigId 필드 없음). 정합 이상 없음.
- **제안**: 현행 그대로 유지 가능.

### I-03 `summary_buffer` 전략의 `summaryModel` 사용 — `17-agent-memory.md` 미언급

- **target 위치**: `spec/5-system/17-agent-memory.md §3` (추출 파이프라인)
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §6.1 단계 1.5` (요약 압축)
- **상세**: `17-agent-memory.md` 의 범위는 `persistent` 전략의 세션 간 추출 메모리다. `summaryModel` 이 쓰이는 롤링 요약 압축(단계 1.5)은 `summary_buffer`/`persistent` 공통이며 이 문서 범위 밖이다 — 따라서 `17-agent-memory.md` 가 `summaryModel` 을 언급하지 않는 것은 의도적 분리이고 충돌이 아니다. `extractionModel` 만 §3에 명시된 것도 정합하다.
- **제안**: 현행 그대로 유지 가능. 혼동을 줄이려면 `17-agent-memory.md §3` 의 첫 문장에 "본 절은 `extractionModel` (persistent 추출 전용) 을 다룬다. 롤링 요약 압축(`summaryModel`)은 AI Agent §6.1 단계 1.5 참조" 와 같은 scope 명기를 추가할 수 있다.

---

## 요약

`summaryModel` / `extractionModel` 두 필드의 spec 추가는 `1-ai-agent.md` §1 config 표, §2 UI visibleWhen, §6.1 실행 단계(1.5·2.7), §12.12 Rationale, 그리고 `17-agent-memory.md §3` AGM-04 요구사항 모두 서로 일관된 fallback 체인(`[전용] → [model] → [llmConfig 기본]`)과 visibleWhen(`summaryModel`: summary_buffer/persistent, `extractionModel`: persistent 한정) 을 반복 기술하고 있어 직접 충돌은 없다. schema 코드(`ai-agent.schema.ts`)의 `visibleWhen`·`z.string().optional()` 선언도 spec 과 일치한다. 유일한 주의 항목은 origin/main `§12.12` 가 "v2 로드맵으로 유보" 를 `conversation-thread.md §7` 에 cross-link 했으나 해당 v2 항목이 `conversation-thread.md §7` 에 실제로 없어서, 이번 번복 후에도 `conversation-thread.md §7` 가 갱신되지 않은 점(W-01)이다. CRITICAL 항목은 없으며 차단 사유 없음.

---

## 위험도

LOW

---

BLOCK: NO
