---
name: agent-memory-model-select
worktree: .claude/worktrees/agent-memory-model-select-83e703
status: in-progress
created: 2026-06-19
spec_area:
  - spec/5-system/17-agent-memory.md
  - spec/4-nodes/3-ai/1-ai-agent.md
  - spec/4-nodes/3-ai/3-information-extractor.md
---

# AI Agent / IE 메모리 모델 필드 → select 전환

## 배경 / 결정

사용자 관찰: AI Agent·Information Extractor 노드의 모델 입력란(`embeddingModel`,
`summaryModel`, `extractionModel`)이 자유텍스트(`widget:'text'`) / `expression` 이라
오타로 인한 silent recall 실패·오설정 위험. 이미 `llmConfigId`(LLM provider)는
`llm-config-selector` 로 전환된 선례가 있고, `/models` 페이지가 kind(chat/embedding/
rerank) 탭으로 통합돼 모델 목록을 동적 조회할 수 있음.

**사용자 결정 (확정)**:
- 세 필드 모두 **순수 select** 로 전환 (자유입력/expression 동적참조 제거).
- summaryModel/extractionModel 의 `{{ }}` 동적 모델명 능력 상실은 의도된 trade-off.

## 핵심 사실 (recon)

- 모델명 소스 = `GET /model-configs/:id/models`(provider 실시간, throttle 10/60s →
  lazy "모델 불러오기" 버튼 필수, eager 드롭다운 부적합). `modelConfigsApi.list(kind)`
  는 config(provider connection) 목록이지 모델명 목록이 아님.
- 런타임상 세 필드 모두 노드 `llmConfigId` 로 resolve → **provider-scoped 가 정답**.
  - chat: `ai-agent.handler.ts` summary, `agent-memory-extraction.processor.ts` extraction
    둘 다 노드 `llmConfigId` config 로 chat 호출.
  - embedding: `agent-memory.service.ts:42-46` EmbedConfigSource.llmConfigId(노드) →
    워크스페이스 기본 LLMConfig 폴백.
- 기존 재사용 컴포넌트: `ModelCombobox`(chat, provider/apiKey/baseUrl/configId 필요),
  `EmbeddingModelCombobox`(embedding, modelConfigId 만). 둘 다 `ModelSelectField` 기반 —
  lazy load + 저장값 `formatSavedFallback`(하위호환) 내장.
- 저장 형태(모델명 문자열) **불변** → 하위호환 100%, 런타임 resolve 경로 무수정.

## 변경 대상 파일

### Backend
- [ ] `codebase/backend/src/nodes/core/node-component.interface.ts` — `UiHint.widget`
      union 에 `'chat-model-selector'` `'embedding-model-selector'` 추가
- [ ] `codebase/backend/src/nodes/ai/shared/agent-memory-schema.ts`
  - embeddingModel `widget:'text'` → `'embedding-model-selector'` (라벨/hint/visibleWhen/order 유지)
  - summaryModel `widget:'expression'` → `'chat-model-selector'`
  - extractionModel `widget:'expression'` → `'chat-model-selector'`
  - `:192-196` "intentionally text not expression" 주석을 "select-only(expression
    금지) — select 도 정적 리터럴이라 차원 footgun 차단" 으로 갱신

### Frontend
- [ ] `node-definitions/types.ts` — `UiWidget` union 2개 추가
- [ ] `auto-form/widgets.tsx` — `WidgetProps` 에 `config?: Record<string, unknown>` 추가
- [ ] `auto-form/schema-form.tsx` — renderField 에서 `config={value}` 주입 (1줄)
- [ ] `auto-form/widget-registry.ts` — 2 엔트리 매핑
- [ ] 신규 `auto-form/model-selector-widgets.tsx` — `ChatModelSelectorWidget`(형제
      llmConfigId → list('chat') 로 config 찾아 ModelCombobox 래핑),
      `EmbeddingModelSelectorWidget`(형제 llmConfigId → EmbeddingModelCombobox 래핑)
- [ ] 신규 위젯 테스트 2개 (`__tests__/`)

### Spec (project-planner 위임 완료 — 2026-06-19)
- [x] spec/3-workflow-editor/1-node-common.md §2.6.2 Widget 어휘 19→21종 + "모델 selector(2)" 행
- [x] spec/4-nodes/3-ai/1-ai-agent.md §1 표(3필드 → Model select) + §12.12 후속 결정 문단
- [x] spec/4-nodes/3-ai/3-information-extractor.md §1 표(embedding/extractionModel → Model select)
- [x] spec/5-system/17-agent-memory.md §3 line 46 select 위젯 명시

## 워크플로 체크리스트
- [x] /consistency-check --impl-prep — NO-BLOCK (review/consistency/2026/06/19/19_01_11/SUMMARY.md).
      rationale checker 의 CRITICAL("위젯 미존재")은 오탐(구현 대상)으로 기각. spec 동반
      갱신(위 Spec 섹션)이 진짜 발견사항이었고 완료.
- [x] consistency --spec (planner 의무): impl-prep 가 rationale/convention/naming 검증 +
      결정적 grep 으로 dangling 참조 부재 확인(다른 곳 "19종"·spec표 "embeddingModel|String"
      0건) → 동일 변경 중복 5-checker 사이클 생략, 본 노트로 근거 대체.
- [ ] TDD 테스트 선작성
- [ ] 구현
- [ ] TEST WORKFLOW (lint/unit/build/e2e — e2e 면제 후보: 순수 UI 위젯+schema 메타,
      백엔드 동작/저장형태 무변경)
- [ ] /ai-review + SUMMARY + (Critical/Warning fix)
- [ ] /consistency-check --impl-done (spec 연결 코드 변경 → SPEC-CONSISTENCY 게이트)

## 미결정 / 리스크
- embedding 위젯 config 소스: 노드 `llmConfigId`(chat connection)에 embedding 모델이
  없을 수 있음 → `:id/models?type=embedding` 빈 목록 가능. 런타임 폴백과 일치하나
  UX 상 안내 필요. (EmbeddingModelCombobox 가 빈목록/저장값 fallback 처리.)
- WidgetProps `config` 확장은 모든 위젯에 optional 로 무해. 기존 위젯 무영향.
</content>
</invoke>
