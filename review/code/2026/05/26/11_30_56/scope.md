# 변경 범위(Scope) 리뷰 결과

리뷰 대상: LLM 설정 / 임베딩 모델 선택 — select-only 전환  
Plan: `plan/in-progress/llm-model-select-only.md`  
검토일: 2026-05-26

---

## 발견사항

### [INFO] 파일 10–16: consistency 리뷰 산출물 7개 파일 포함
- 위치: `review/consistency/2026/05/26/10_59_37/` 하위 전체 (`_retry_state.json`, `convention_compliance.md`, `cross_spec.md`, `meta.json`, `naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md`)
- 상세: 이 파일들은 이번 작업(`llm-model-select-only`)의 구현 착수 전 `--impl-prep` 일관성 검토 산출물이다. `review/consistency/<날짜>/` 경로는 CLAUDE.md 규약 정의 저장 경로와 일치하므로 의도된 범위 내 산출물이다. 구현 코드·spec 변경과 무관한 별도 파일이므로 "무관한 수정"이 아닌, 절차상 필수 생성 파일이다.
- 제안: 범위 초과 아님. 유지.

### [INFO] 파일 9: `plan/in-progress/llm-model-select-only.md` 신규 생성
- 위치: `plan/in-progress/llm-model-select-only.md`
- 상세: plan 파일은 CLAUDE.md 규약 "진행 중 작업 → `plan/in-progress/<name>.md`"에 따른 정상 생성이다. 내용은 사용자 요청 원문·변경 항목(Spec 1종, 구현 2개 파일, i18n 4개 파일, 테스트 2개 파일)·TEST/REVIEW 계획을 담고 있어 실제 변경 범위와 정합한다.
- 제안: 범위 초과 아님. 유지.

### [INFO] 파일 4 (`model-combobox.tsx`): `datalistId` / `useId` 제거 — 범위 내 임포트 정리
- 위치: `codebase/frontend/src/components/llm-config/model-combobox.tsx`, line 2 (`import { useId, useMemo } from "react"` → `import { useMemo } from "react"`)
- 상세: `<Input list={datalistId}>` + `<datalist>` 구조를 `<NativeSelect>` 로 교체하면서 `useId` 와 `datalistId` 가 실제로 쓰이지 않게 된다. 사용하지 않는 임포트·변수를 제거한 것이므로 "불필요한 임포트 정리"처럼 보이지만, 사실상 변경의 직접 결과다. 불필요한 독립 정리 아님.
- 제안: 범위 내 정리. 유지.

### [INFO] 파일 2 (`embedding-model-combobox.tsx`): `useId` 제거 + `useQuery` → `useMutation` 전환 — 아키텍처 변경이지만 plan 명시 범위 내
- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx`, 임포트 블록 전체
- 상세: 기존 `useQuery` 기반 자동 fetch 에서 `useMutation` 기반 버튼 트리거 조회로 전환됐다. Plan §2 에 "모델 불러오기 버튼 신설 (현재는 페이지 로드 시 자동 fetch 만)"이 명시되어 있어 의도된 변경이다. `axios` 임포트 추가는 Axios 에러 타입 체크(`axios.isAxiosError`) 를 위한 것으로 신규 기능이 아니다. `Loader2`, `RefreshCw` 아이콘 추가는 버튼 신설에 필요한 의존이다.
- 제안: 범위 내 변경. 유지.

### [INFO] 파일 6 (`llmConfigs.ts` en): `modelPlaceholder` 값 및 힌트 문구 변경
- 위치: `codebase/frontend/src/lib/i18n/dict/en/llmConfigs.ts`
- 상세: `modelPlaceholder: "gpt-4o"` → `"Select a model"`, `loadModelsHint` 문구 변경, `loadModelsFailed` 오류 메시지 보강이 포함됐다. Plan §3 "llmConfigs.loadModelsHint 직접 입력 표현 제거"에 직접적으로 대응하는 변경이다. 기존 힌트 문구에서 "또는 직접 입력" 표현을 제거하는 것이 이번 select-only 전환의 핵심 UX 의미 전달이므로 범위 내다.
- 제안: 범위 내 변경. 유지.

### [INFO] 파일 19 (`8-embedding-pipeline.md`): spec 주석 한 줄 수정
- 위치: `spec/5-system/8-embedding-pipeline.md`, line 320
- 상세: `EmbeddingModelCombobox` 설명 주석에서 "datalist + graceful degrade" 를 "모델 불러오기 버튼 select, 자유 입력 fallback 없음 + Rationale cross-reference" 로 교체했다. Plan §1 에 이 파일에 대한 직접 언급은 없으나, consistency 리뷰(`naming_collision.md` [INFO])에서 `8-embedding-pipeline.md` 의 "datalist" 표현을 동기화할 것을 권장했고, 변경 내용이 정확히 그 수정이다. 범위는 단 한 줄이며 다른 섹션을 건드리지 않는다.
- 제안: 범위 내 1-line 정합 수정. 유지.

### [WARNING] 파일 3 (`model-combobox.test.tsx`): 삭제된 테스트 케이스 중 일부 동작이 신규 케이스에서 미검증
- 위치: `codebase/frontend/src/components/llm-config/__tests__/model-combobox.test.tsx`
- 상세: 기존 테스트 케이스 9건 중 다음 케이스가 제거됐고 신규 케이스에서 동등한 검증이 확인되지 않는다.
  1. "trims apiKey and baseUrl before calling preview endpoint" — `apiKey.trim()` / `baseUrl.trim()` 동작 검증. 신규 케이스에는 trim 관련 assertion 없음. 해당 로직이 `useModelLoader` 내부에 있다면 이 테스트는 `use-model-loader.test.ts`(별도 파일)에서 커버해야 하지만, 해당 파일이 이번 diff 에 포함되지 않았다.
  2. "keeps previously loaded models visible when a retry fails" — 재시도 실패 시 이전 모델 목록이 select 옵션에 유지되는지 검증. 이는 select-only 전환 후에도 유효한 동작(재시도 실패 = 에러 메시지 표시 + 이전 목록 유지 or 초기화)인데 신규 케이스에서 누락됐다.
  3. "ignores a stale response when provider changes mid-flight" — in-flight 중 provider 변경 후 stale 응답 무시 검증. `useModelLoader` 가 이미 stale-guard 를 포함하고 있다면 훅 테스트에서 검증해야 하나, 이번 diff 에 `use-model-loader.test.ts` 변경이 없다.
  4. "clears the error message when a retry starts (onMutate)" — 재시도 시작 시 에러 메시지 초기화. 신규 케이스에 미포함.
- 제안: plan §4 의 테스트 케이스 교체 지침은 이들 케이스를 명시적으로 삭제 대상으로 나열하지 않았다. `useModelLoader` 단위 테스트(`use-model-loader.test.ts`)에서 위 4건이 커버되고 있는지 확인하거나, 신규 케이스에 추가 보완이 필요하다. 동작 자체가 사라진 것은 아니므로 CRITICAL 이 아니지만, 커버리지 공백으로 인한 회귀 위험이 있다.

---

## 요약

이번 변경은 `plan/in-progress/llm-model-select-only.md`에 명시된 범위와 전반적으로 정합하다. 구현 2개 파일(`model-combobox.tsx`, `embedding-model-combobox.tsx`), 테스트 2개 파일, i18n 4개 파일(en/ko 각 2개), spec 3개 파일(`5-knowledge-base.md`, `6-config.md`, `8-embedding-pipeline.md`), plan 1개 파일, consistency 리뷰 산출물 7개 파일 모두 plan 이 명시하거나 규약상 생성이 의무인 파일이다. 불필요한 리팩토링·무관한 기능 추가·설정 파일 변경은 발견되지 않았다. 단, `model-combobox.test.tsx` 에서 삭제된 케이스 중 trim 동작·재시도 실패 시 목록 유지·stale 가드·에러 초기화 동작의 검증이 신규 케이스 또는 `use-model-loader.test.ts`에 커버되는지 확인이 필요하다.

---

## 위험도

LOW
