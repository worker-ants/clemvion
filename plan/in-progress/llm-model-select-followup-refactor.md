---
worktree: llm-model-select-followup-refactor
started: 2026-05-26
owner: developer
parent_plan: plan/complete/llm-model-select-only.md
---

# Follow-up — Model select 컴포넌트 중복 제거

## 배경

`llm-model-select-only` PR 의 `/ai-review` SUMMARY (`review/code/2026/05/26/11_30_56`) 에서 식별된 두 가지 architectural / maintainability WARNING 을 별도 plan 으로 분리. 본 PR 의 핵심 회귀(SUMMARY#1 isSuccess stale 버그)와 보안·테스트 보강(SUMMARY#10·#12·#2-7) 은 모두 본 PR 안에서 처리됨. 본 follow-up 은 구조적 리팩토링만 다룬다.

## 항목

### §1. `useEmbeddingModelLoader` 훅 추출 (SUMMARY #8)

`codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` 의 `useMutation` + `onMutate/onSuccess/onError` + `prevResetKey` 패턴을 `useEmbeddingModelLoader` 커스텀 훅으로 추출.

- 대칭 대상: `codebase/frontend/src/components/llm-config/use-model-loader.ts`
- 옵션 A — 신규 훅 `use-embedding-model-loader.ts` 분리.
- 옵션 B — 기존 `useModelLoader` 가 configId-only 모드 + `type: "embedding"` 옵션을 받도록 확장 (한 훅으로 통합).
- 결정 기준: API 호출 형태가 본질적으로 다르면 옵션 A, 같으면 옵션 B.

### §2. 공통 JSX 패턴 추출 (SUMMARY #11)

두 컴포넌트의 `NativeSelect + Load Button + 4-way 상태 메시지` JSX 가 거의 동일한 구조. 다음 중 택일:

- `formatModelOption(m)` 유틸 (option 레이블 포맷만 공유) — 변화 작음.
- `<SelectWithLoadButton>` 공유 컴포넌트 — JSX 구조 전체 공유.

`§1` 훅 추출과 함께 처리하면 시너지. `§1` 옵션 B (단일 훅) 가 채택되면 본 항목도 `<SelectWithLoadButton>` 까지 일관 추출 가능.

### §3. (선택) API 응답 정규화 레이어 이동 (architecture INFO)

`embedding-model-combobox.tsx` 의 `configsRes` `{ data?: ... }` vs 배열 이중 분기를 `llmConfigsApi.getAll()` 반환 타입 정규화로 흡수. `LlmConfigData[]` 단일 형태 보장.

## 완료 조건

- [ ] §1. `useEmbeddingModelLoader` (또는 통합 훅) 추출, `embedding-model-combobox.tsx` 가 훅 사용.
- [ ] §2. 공통 JSX 패턴 추출. 두 컴포넌트가 같은 헬퍼/컴포넌트 사용.
- [ ] §3. (선택) API 응답 정규화 — 본 follow-up 또는 별도 ticket.
- [ ] TEST WORKFLOW 통과, `/ai-review` Critical/Warning 0.
