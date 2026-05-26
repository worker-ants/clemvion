---
worktree: llm-model-select-followup-refactor
started: 2026-05-26
owner: developer
parent_plan: plan/complete/llm-model-select-only.md
---

# Follow-up — Model select 컴포넌트 후속 정리

## 배경

`llm-model-select-only` PR 의 `/ai-review` SUMMARY (`review/code/2026/05/26/11_30_56`) 에서 식별된 architectural / maintainability WARNING 처리를 위한 후속 plan. 본 plan 의 §1-§3 (1차 후속) 은 본 PR 의 follow-up 묶음 commit (`7a0f2cc9`) 으로 이미 완료됐으며, 2차 follow-up SUMMARY (`review/code/2026/05/26/12_10_38`) 에서 추가로 등록된 §4-§7 가 미해결 상태로 남아 있다.

## 완료 항목 (본 PR 안에서 처리)

### §1. `useEmbeddingModelLoader` 훅 추출 — DONE (commit `7a0f2cc9`)
- `codebase/frontend/src/components/llm-config/use-embedding-model-loader.ts` 신규.
- `useModelLoader` 와 대칭 API. embedding-model-combobox 가 이 훅 사용.
- 옵션 A (신규 훅 분리) 채택 — chat 경로의 preview/saved 분기와 embedding 경로의 listModels-only 가 구조가 달라 통합보다 분리가 명확.

### §2. 공통 JSX 패턴 추출 — DONE (commit `7a0f2cc9`)
- `codebase/frontend/src/components/llm-config/model-select-field.tsx` 신규.
- `<ModelSelectField>` 공유 컴포넌트: NativeSelect + Load Button + 4-way 상태 메시지 UI 캡슐화.
- 두 콤보박스 모두 이 컴포넌트 사용. JSX 중복 0.

### §3. API 응답 정규화 레이어 이동 — DONE (commit `7a0f2cc9` + `3b8fa8fd`)
- `llmConfigsApi.list()` 신설 — `{ data: ... }` envelope 흡수해 `LlmConfigData[]` 단일 형태 반환.
- 6개 컴포넌트 (llm-config-selector / custom-node / workflow-canvas / create-kb-form-dialog / knowledge-bases/[id] page / embedding-model-combobox) 의 인라인 분기 제거.
- `list()` 가 `apiClient.get` 직접 호출 (commit `3b8fa8fd`) — React Query cache key collision 위험 방지.

## 잔여 항목 (별도 처리 필요)

### §4. `useBaseModelLoader` 공통 훅 추출

`useModelLoader` 와 `useEmbeddingModelLoader` 의 상태 기계 (render-phase reset, `hasAttemptedLoad`, stale-closure 가드, `sanitizeLoaderError` 위임) 가 거의 동일하게 중복됨. 한 쪽에서 버그 수정 시 다른 쪽도 동기화 필요.

- 옵션: `useBaseModelLoader<TSnapshot>(args)` 형태로 공통 mutation/state 추출. 두 훅은 mutationFn 과 canLoad 만 주입.
- 또는 `useResetOnKeyChange(resetKey, ...setters)` 만 분리 (INFO #20 와 동일 항목).

### §5. `useDefaultLlmConfigId` 훅 분리

`EmbeddingModelCombobox` 가 knowledge-base 도메인 컴포넌트임에도 LLM Config 목록 조회 및 `defaultConfigId` 도출까지 인라인으로 수행. 단일 책임 약한 위반.

- `codebase/frontend/src/components/llm-config/use-default-llm-config-id.ts` 신설 권장.
- 캐시 키 공유 + default 폴백 로직 캡슐화.

### §6. `CustomNode` 의 다수 쿼리 구독 → prop drilling

캔버스에 AI 노드가 N개 있을 때 각 `CustomNode` 인스턴스가 같은 `["llm-configs"]` queryKey 로 `useQuery` 구독. 캐시 공유로 네트워크 비용 1회이지만 쿼리 상태 변경 시 N개 컴포넌트 일제히 리렌더.

- 옵션: `WorkflowCanvas` 에서 한 번 조회하고 `CustomNode` 에 `hasDefaultLlmConfig: boolean` prop 으로 전달.
- AI 노드가 수십 개 이상인 워크플로우에서 측정 가능한 개선.

### §7. 서버 에러 메시지 — 오류 코드 기반 i18n 매핑

`sanitizeLoaderError` 가 서버의 `err.response?.data.message` 를 200자 이내에서 UI 에 그대로 노출 (SUMMARY #10). 200자 내에도 내부 API endpoint 구조, 서비스 이름 등 민감 정보가 담길 수 있음.

- 옵션 A: 사전 정의된 오류 코드 (`LLM_AUTH_FAILED`, `LLM_RATE_LIMIT`, `LLM_PROVIDER_DOWN` 등) 기반으로 클라이언트 i18n 매핑.
- 옵션 B: 서버 측에서 `message` 필드가 user-safe 임을 API 계약으로 보장.
- 옵션 A 가 사용자 가시 메시지의 i18n 일관성에도 도움.

## 완료 조건

- [x] §1. `useEmbeddingModelLoader` 추출, `embedding-model-combobox.tsx` 가 훅 사용.
- [x] §2. 공통 JSX 패턴 추출. 두 컴포넌트가 같은 컴포넌트 사용.
- [x] §3. API 응답 정규화 — `list()` 메서드 + getAll envelope 흡수.
- [ ] §4. `useBaseModelLoader` 또는 `useResetOnKeyChange` 공통 추출.
- [ ] §5. `useDefaultLlmConfigId` 훅 분리.
- [ ] §6. `CustomNode` 다수 구독 → prop drilling.
- [ ] §7. 서버 에러 메시지 코드 기반 i18n 매핑.
- [ ] TEST WORKFLOW 통과, `/ai-review` Critical 0.
