# 정식 규약 준수 검토 — `spec/5-system/9-rag-search.md` (동적 점수 컷 D1/D2 구현)

검토 모드: --impl-done, scope=spec/5-system/9-rag-search.md, diff-base=origin/main

---

## 발견사항

### 1. **[WARNING]** `spec/5-system/9-rag-search.md` `code:` 에 핵심 구현 파일 누락

- **target 위치**: `spec/5-system/9-rag-search.md` frontmatter `code:` 항목
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로" 를 열거해야 하며, `spec-code-paths.test.ts` 가 ≥1 매치를 강제
- **상세**: 현재 `code:` 에는
  ```
  - codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts
  - codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts
  ```
  만 등재되어 있다. 이번 diff 에서 본 spec §3.4 의 핵심 surface 로 신설된
  `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts` 와
  `codebase/backend/src/modules/knowledge-base/search/rerank.service.ts` 가 누락되어 있다.
  - `dynamic-cut.util.ts` 는 §3.4 "동적 점수 컷" 의 단일 구현체로, spec 의 독립 섹션 전체(`applyDynamicCut`, `RAG_INJECT_TOKEN_BUDGET`, `RAG_MAX_INJECT_COUNT`, `RAG_RECALL_K`)를 구현한 주 surface 다.
  - `rerank.service.ts` 는 §3.3 리랭킹 서비스의 직접 구현체로 본 spec 이 직접 약속하는 surface 이나 어떤 spec 의 `code:` 에도 등재되지 않았다.
  - `spec-code-paths.test.ts` 는 현재 `code:` 가 ≥1 매치라 통과하지만, spec 이 약속한 핵심 surface 를 누락해 정합성 증거 목적을 약화시킨다.
- **제안**: `code:` 에 아래 두 경로 추가:
  ```yaml
  code:
    - codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts
    - codebase/backend/src/modules/knowledge-base/search/rerank.service.ts
    - codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts
    - codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts
  ```

---

### 2. **[WARNING]** `plan/in-progress/rag-dynamic-cut.md` `spec_impact: yes` — 비표준 값

- **target 위치**: `plan/in-progress/rag-dynamic-cut.md` frontmatter `spec_impact: yes`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2 Gate C` + `.claude/docs/plan-lifecycle.md §Gate C` — `spec_impact` 의 유효 값은 "spec 경로 목록" 또는 no-op sentinel(`none`/`없음`/`n/a`/`na`) 만이며, `yes` 는 정의된 값이 아님
- **상세**: Gate C 는 plan 이 `plan/complete/` 로 이동하는 시점에만 build 차단 가드가 작동하므로 현재 in-progress 상태에서는 즉각적인 빌드 실패를 유발하지 않는다. 그러나 값 `yes` 는 "spec 경로 목록 또는 no-op sentinel" 규약과 일치하지 않아, 완료 시 `spec-plan-completion.test.ts` 가 이 값을 파싱할 수 없어 Gate C 검증을 통과하지 못할 수 있다.
- **제안**: 완료 이전에 값을 규약에 맞게 수정:
  ```yaml
  spec_impact:
    - spec/5-system/9-rag-search.md
  ```
  또는 spec 변경이 완료된 경우에도 `spec_impact: none` 은 "변경 불요" 의미라 부적절하므로, 실제 변경된 spec 파일 경로 목록으로 지정한다.

---

### 3. **[INFO]** `spec/5-system/9-rag-search.md` — `spec_impact` 연관 파일 누락 여부 확인 권장

- **target 위치**: `spec/5-system/9-rag-search.md`의 `pending_plans:` 및 diff 연관 spec 파일들
- **위반 규약**: 해당 없음 (INFO 수준)
- **상세**: 이번 diff 는 `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` 와 `ai-agent.handler.ts` 도 수정한다(`ragTopK` default 제거, `undefined` 전달 로직). 이 변경은 `spec/4-nodes/3-ai/1-ai-agent.md` (AI Agent 노드 spec) 의 `ragTopK` 기본값 기술에도 영향을 줄 수 있다. `ai.mdx` / `ai.en.mdx` 사용자 가이드는 diff 에서 직접 수정되었으나, AI Agent spec 의 schema 기술(`ragTopK: default 5` 등) 이 동기화되었는지 확인이 필요하다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md` 의 `ragTopK` 관련 기술을 검토해 "optional, default 없음, 미지정 시 동적 컷 적용"이 반영되었는지 확인한다.

---

### 4. **[INFO]** `grounding: "none"` 출력 필드 — 규약 외 필드, 단 spec §2.2 에 정의됨

- **target 위치**: diff `kb-tool-provider.ts` 의 `content` JSON 구성부 + `spec/5-system/9-rag-search.md §2.2`
- **위반 규약**: `spec/conventions/node-output.md` 직접 위반 아님 (tool_result 는 node output 포맷이 아님)
- **상세**: `grounding: "none"` 와 `note:` 필드는 `spec §2.2` KB tool 결과 포맷의 `cross_encoder_llm gradingNoGrounding` 분기에 spec 에서 명시적으로 정의되어 있다. node-output.md 의 output 포맷 규약 적용 대상(노드 핸들러 반환 `output.*`)이 아닌 tool_result content(LLM에 전달되는 JSON)이므로 규약 위반이 아니다. INFO 수준으로만 기록.
- **제안**: 이 필드들이 spec §2.2 에 정의되어 있으므로 별도 조치 불필요.

---

### 5. **[INFO]** 에러 코드 명명 규약 — 준수 확인

- **target 위치**: diff 전반의 에러 코드 문자열
- **위반 규약**: 해당 없음
- **상세**: diff 에 등장하는 에러 코드 `RERANK_ENDPOINT_FAILED`, `RERANK_NO_VALID_RESULTS`, `RERANK_LLM_GRADING_FAILED`, `RERANK_CONFIG_INVALID` 는 모두 `UPPER_SNAKE_CASE` 이고 의미 기반 명명(`spec/conventions/error-codes.md §1`) 을 준수한다. `tool_call_budget_exceeded` (소문자 스네이크, spec §2.3 tool_result 용)는 KB tool_result 내부 코드로 error.code 규약(`spec/conventions/error-codes.md`) 적용 대상이 아니므로 문제없다.

---

## 요약

`spec/5-system/9-rag-search.md` 는 문서 구조(Overview / 본문 섹션들 / Rationale 3섹션), 에러 코드 UPPER_SNAKE_CASE, 출력 포맷 기술, frontmatter `id`/`status`/`pending_plans` 구성 등 주요 정식 규약을 전반적으로 준수하고 있다. 단, 이번 diff 로 신설된 핵심 구현 파일(`dynamic-cut.util.ts`, `rerank.service.ts`)이 `code:` surface 증거에 누락되어 `spec/conventions/spec-impl-evidence.md` 가 요구하는 구현 경로 열거가 불완전하다. 또한 `plan/in-progress/rag-dynamic-cut.md` 의 `spec_impact: yes` 는 Gate C 에서 허용되지 않는 비표준 값으로, 완료 이동 시점에 build 가드가 실패할 수 있다. 두 항목 모두 WARNING 수준이며 빌드 차단 임박 위험이 있다.

## 위험도

MEDIUM
