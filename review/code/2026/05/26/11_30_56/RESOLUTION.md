# RESOLUTION — 11_30_56

PR 범위: LLM 설정 / 임베딩 모델 선택 — select-only 전환 (llm-model-select-4857c3)

## 조치 항목

| SUMMARY # | 출처 | 분류 | 조치 commit | 비고 |
|-----------|------|------|-------------|------|
| #1 (side_effect/requirement WARNING) | `loadMutation.isSuccess` stale 버그 | 코드 | `3122d752` | `hasAttemptedLoad` state 도입으로 `isEmpty` 오판 방지 |
| #2 (testing WARNING) | retry 시 onMutate 에러 클리어 미검증 | 테스트 | `574447a0` | `use-model-loader.test.tsx` 에 케이스 추가 |
| #3 (testing WARNING) | 재시도 실패 후 기존 모델 목록 유지 미검증 | 테스트 | `574447a0` | `use-model-loader.test.tsx` 에 케이스 추가 |
| #4 (testing WARNING) | stale closure 가드 미검증 | 테스트 | `574447a0` | provider 변경 시 즉각 초기화 동작 검증 |
| #5 (testing WARNING) | `missing-config-id` / `canLoad=false` 미검증 | 테스트 | `574447a0` | `embedding-model-combobox.test.tsx` 에 getAll 빈 배열 케이스 추가 |
| #6 (testing WARNING) | `getAll` API 실패 시 UI 상태 미검증 | 테스트 | `574447a0` | `getAll` rejected 케이스 추가 |
| #7 (testing WARNING) | `isEmpty` 상태(빈 목록) 메시지 미검증 | 테스트 | `574447a0` | `noModelsFound` 메시지 케이스 추가 |
| #8 (maintainability/architecture WARNING) | `useEmbeddingModelLoader` 훅 추출 미이행 | 코드 | — | 보류 (하단 참조) |
| #9 (testing WARNING) | `prevResetKey` 초기화 타이밍 의존성 | 테스트 | `574447a0` | SUMMARY#1 회귀 가드 케이스로 커버 (isEmpty 미표시 확인) |
| #10 (security WARNING) | 서버 에러 메시지 무제한 노출 | 코드 | `3122d752` | 200자 상한(`.slice(0, 200)`) 적용 (embedding + use-model-loader 양쪽) |
| #11 (maintainability WARNING) | 공통 JSX 패턴 중복 | 코드 | — | 보류 — #8 과 함께 후속 리팩토링 (하단 참조) |
| #12 (maintainability WARNING) | `aria-label` pending 불일치 | 코드 | `3122d752` | `isPending` 시 `loadingModels` 키로 동적 변경 |
| INFO: plan worktree frontmatter | `worktree: llm-model-select` → 실제 디렉토리명 | 문서 | `3122d752` | `llm-model-select-4857c3` 으로 수정 |
| INFO: use-model-loader 주석 datalist 언어 | `datalist`/`autocomplete` → `select` 표현 | 문서 | `3122d752` | 주석 현행화 |
| INFO(filter): embedding type 필터 이중 | 방어 필터 의도 주석 추가 | 문서 | `3122d752` | 코드 변경 없음, 주석으로 의도 명시 |
| INFO(trim): apiKey/baseUrl trim 검증 | `use-model-loader.test.tsx` 추가 | 테스트 | `574447a0` | trim 동작 직접 검증 |
| INFO(filter): chat 모델 필터 검증 | `embedding-model-combobox.test.tsx` 추가 | 테스트 | `574447a0` | type:chat 모델 옵션 제외 확인 |

## TEST 결과

- lint  : 통과 (32s)
- unit  : 통과 (4944 passed, 37s)
- build : 통과 (61s)
- e2e   : 통과 (123/123, 50s)

## 보류·후속 항목

### #8 useEmbeddingModelLoader 훅 추출 (architecture/maintainability WARNING)

`EmbeddingModelCombobox` 의 `useMutation` + `onMutate/onSuccess/onError` + `prevResetKey` 패턴을 `useEmbeddingModelLoader` 커스텀 훅으로 추출하여 `useModelLoader` 와 대칭 구조를 만드는 리팩토링. 현재 동작 정확성에는 문제 없음. 규모가 있는 리팩토링이므로 별도 plan 으로 처리 권장.

### #11 공통 JSX 패턴 추출 (maintainability WARNING)

`NativeSelect + Load Button + 상태 메시지 4-way` JSX 패턴이 두 컴포넌트에 중복됨. `formatModelOption` 유틸 또는 `SelectWithLoadButton` 내부 컴포넌트로 추출. #8 훅 추출과 함께 처리하면 시너지가 있으므로 동일 후속 plan 에서 처리 권장.

### architecture INFO: `EmbeddingModelCombobox` API 응답 정규화 레이어 혼재

`configsRes` 의 `{ data?: LlmConfigData[] }` 래퍼 처리가 컴포넌트에 있음. `llmConfigsApi.getAll()` 반환 타입 정규화로 해결 가능. 현재 런타임 오동작 없음.
