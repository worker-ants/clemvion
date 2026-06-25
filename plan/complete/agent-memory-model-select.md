---
spec_impact:
  - spec/5-system/17-agent-memory.md
  - spec/4-nodes/3-ai/1-ai-agent.md
  - spec/4-nodes/3-ai/3-information-extractor.md
name: agent-memory-model-select
worktree: agent-memory-model-select-83e703
started: 2026-06-19
owner: developer
status: complete
spec_area:
  - spec/5-system/17-agent-memory.md
  - spec/4-nodes/3-ai/1-ai-agent.md
  - spec/4-nodes/3-ai/3-information-extractor.md
---

# AI Agent / IE 메모리 모델 필드 → select 전환

> **⚠️ SUPERSEDED (2026-06-20)**: 본 plan 의 "노드 provider 내 **모델명** select"(`chat-model-selector`/
> `embedding-model-selector`, 모델명 문자열 저장) 설계는 PR #642 로 머지됐으나, 후속으로 **등록
> ModelConfig 선택(`config.id`, provider 디커플)** 으로 재번복됐다 — 후속 plan [[agent-memory-model-config]]
> (worktree `agent-memory-model-config-73a1a5`) 가 대체한다. 아래 미완료 체크박스(위젯/스키마/`--impl-done`
> gate)는 후속 plan 에서 새 설계로 재구현·검증 완료되어 **별도 이행 불필요**. 본 plan 은 이력으로 보존.

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
- [x] 구현 — backend(interface union·schema 3필드·주석) + frontend(UiWidget·WidgetProps.config·
      SchemaForm·registry·신규 model-selector-widgets.tsx 2위젯)
- [x] 테스트 — backend ai-agent/IE schema spec widget 단언 + frontend
      model-selector-widgets.test.tsx (wiring/provider-scope/value)
- [x] DOCUMENTATION — ai.mdx/ai.en.mdx 메모리 모델 필드 type "expression"/"string" →
      "모델 선택"/"model select" 동반 갱신 (bgIsolation 으로 user-guide-writer 대신 직접;
      라벨 불변 → backend-labels parity 무영향). 관찰: AI Agent 가이드 KO/EN 표에
      embeddingModel 행 부재(기존 갭, 본 변경 무관 — follow-up 후보).
- [x] TEST WORKFLOW (origin/main `1a6bbe73` rebase 후): lint PASS / unit PASS(plan
      frontmatter guard fix 포함) / build PASS(110s) / e2e PASS(35 suites·205 tests 전원,
      45s). build 차단했던 DangerTab 회귀는 PR #636 으로 main 에서 해소됨(rebase 로 흡수).
      e2e 는 jest open-handle teardown 으로 러너가 클린종료 못 해 wrapper 가 매달렸으나
      테스트 결과는 전원 PASS(내 변경은 async 추가 없음 — infra 아티팩트). 컨테이너 정리 완료.
- [x] /ai-review (5 reviewer, 전체 LOW, Critical 0) — review/code/2026/06/19/20_40_01/SUMMARY.md.
      FIX 적용: AI Agent 가이드 embeddingModel 행(KO/EN) + 위젯 테스트 보강(격리+엣지 3종+baseUrl,
      6→9 cases) + apiKey="" 주석. NO-FIX: config={value} 리렌더(controlled form 본질, 근거 SUMMARY).
      RESOLUTION: review/code/2026/06/19/20_40_01/RESOLUTION.md.
- [ ] /consistency-check --impl-done (spec 연결 코드 변경 → SPEC-CONSISTENCY 게이트)

## 미결정 / 리스크
- embedding 위젯 config 소스: 노드 `llmConfigId`(chat connection)에 embedding 모델이
  없을 수 있음 → `:id/models?type=embedding` 빈 목록 가능. 런타임 폴백과 일치하나
  UX 상 안내 필요. (EmbeddingModelCombobox 가 빈목록/저장값 fallback 처리.)
- WidgetProps `config` 확장은 모든 위젯에 optional 로 무해. 기존 위젯 무영향.

## Follow-up (ai-review DEFER) — 동일 브랜치 구현 완료 (2026-06-19)
방어적 UX 개선. 사용자 요청으로 동일 브랜치에서 진행:
- [x] **FU1 stale config 경고**: chat 위젯에서 `llmConfigId` 가 (로드된) 목록에 없어 default 로
      fallback 한 경우(`useResolvedChatConfig.isStale`) 경고 표시. i18n `modelSelector.staleConfigWarning`.
- [x] **FU3 expression 저장값 경고**: 두 위젯 모두 `value` 가 `{{ }}` 포함 시(`looksLikeExpression`)
      "동적 참조 — 새로 선택" 경고. i18n `modelSelector.expressionValueWarning`.
- [x] **FU4 multiselect backend union**: `node-component.interface.ts` UiHint.widget 에 `multiselect`
      추가 (spec §2.6.2 "기본 입력(10)" 와 정합 — 기존 갭 해소, spec 변경 불요).
- [~] **FU2 빈 임베딩 목록 안내**: 기존 `ModelSelectField` 가 이미 `isEmpty` → `noModelsFound`
      메시지로 처리 → 변경 불요. (메시지 특화는 공유 컴포넌트(KB 공용) 수정이라 blast radius 큼, skip.)
- i18n: KO/EN `nodeConfigs.modelSelector` 양쪽 등록(parity 확인).
- [x] follow-up TEST WORKFLOW: lint/unit/build/e2e 전원 PASS. (unit 1회 flaky — http-request abort
      timeout, 내 변경 무관, 격리 재실행 통과.)
- [x] 최신 main `9c6bd08f`(#639 jest forceExit) rebase 후 full TEST WORKFLOW 재수행: lint 44s /
      unit 45s / build 58s / **e2e 79s 205 PASS — status=PASS 깨끗이 자체 종료(hang 없음, 컨테이너
      자체 정리)**. 내 코드는 rebase 로 불변이라 직전 ai-review/impl-done 유효(content 동일).
- [x] follow-up /ai-review (3 reviewer: side-effect NONE/requirement NONE/testing LOW, Critical 0) —
      review/code/2026/06/19/21_23_25/. 테스트 보강(동시·미발화·teardown, 14→17 cases) + §12.12 문구 정정.
- [x] follow-up /consistency-check --impl-done BLOCK:NO — review/consistency/2026/06/19/21_30_59/.
</content>
</invoke>
