# RESOLUTION — 12_10_38

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| Critical #1 | 코드 | (수정 없음) | FALSE POSITIVE — spec line 114 이미 select-only 명시 ("자유 입력 fallback 은 제공하지 않는다"), Rationale R-1 (lines 169-181) 도 이미 추가돼 있음. requirement-reviewer 가 Rationale 의 "초기 구현은…" 역사 기술을 현재 spec 으로 오인 |
| Warning #1 (testing) | 코드 | 3b8fa8fd | `sanitize-loader-error.test.ts` 신규 — 7케이스 (Axios string/array/201자/undefined/empty/non-Axios/no-response) |
| Warning #2 (testing) | 코드 | 3b8fa8fd | `use-embedding-model-loader.test.tsx` 신규 — 8케이스 (load/canLoad/retry-clears-error/keeps-models/stale-closure/reset/sanitize/fallback), `use-model-loader.test.tsx` 대칭 |
| Warning #3 (testing) | 코드 | 3b8fa8fd | `model-select-field.test.tsx` 신규 — 12케이스 (defaultOptionLabel/renderOption/isEmpty/isPending-no-flicker/loadRequiredHint/loadedHint/error/disabled/onChange/savedFallback/load/canLoad) |
| Warning #4 (maintainability) | 코드 | (보류) | `useModelLoader`/`useEmbeddingModelLoader` 구조 중복 — 이미 등록된 followup plan `plan/in-progress/llm-model-select-followup-refactor.md` 에서 처리 예정. 본 PR 추가 진행 없음 (사용자 지시) |
| Warning #5 (requirement) | 코드 | 3b8fa8fd | `renderOption` 반환 타입 `ReactNode` → `string` 으로 좁힘. JSDoc 에 `<option>` HTML 제약 및 `dangerouslySetInnerHTML` 금지 명시 |
| Warning #6 (requirement) | 코드 | 3b8fa8fd | `isEmpty` 조건에 `&& !isPending` 추가 — 재시도 중 "모델 없음" 메시지 플리커 방지 |
| Warning #7 (side_effect) | 코드 | 3b8fa8fd | `list()` 가 `apiClient.get("/llm-configs")` 직접 호출 — `getAll()` self-reference 제거, React Query cache key collision 위험 제거 |
| Warning #8 (security) | 코드 | (보류) | 서버 에러 메시지 노출 — 200자 상한 이미 적용됨. 오류 코드 기반 i18n 매핑은 API 계약 변경 필요 → 후속 plan 으로 이관 (사용자 지시) |

## INFO 항목 처리

| INFO # | 처리 결과 |
|--------|----------|
| #2 `useDefaultLlmConfigId` 훅 분리 | 후속 plan 이관 (사용자 지시) |
| #5 CustomNode 다수 구독 → prop drilling | 후속 plan 이관 (사용자 지시) |
| #7 LLM_CONFIGS_QUERY_KEY JSDoc | 3b8fa8fd — `getAll()` → `list()` 로 업데이트 |
| #8 sanitize 리뷰 경로 참조 | 3b8fa8fd — JSDoc 에 리뷰 경로 표현 간소화 |
| #9 embedding-model-combobox.test getAll 주석 잔류 | 3b8fa8fd — llm-config-selector.test.tsx mock 주석 정정 |
| #10 plan/complete 결과 섹션 | 기존 plan 에 이미 반영됨 |
| #13 list test apiClient.get assertion | 3b8fa8fd — 3개 list 케이스 모두 `expect(apiClient.get).toHaveBeenCalledWith("/llm-configs")` 추가 |
| #14 DEFAULT_CONFIG `as never` 제거 | 3b8fa8fd — `LlmConfigData` 완전 타입 픽스처로 교체 |
| #15 isSuccess 잔존 참조 grep | 확인 완료 — 주석(comment)에만 존재, 실제 코드 참조 없음 |
| #16 setDefault return value | 본 PR 영향 없음 — 보류 |
| #17 isPending 삼항 추출 | 3b8fa8fd — `loadLabel` 변수 추출, aria-label + span 재사용 |
| #18 MAX_ERROR_MESSAGE_LENGTH 상수 추출 | 3b8fa8fd — `sanitize-loader-error.ts` 에 상수 추출 + 주석 추가 |
| #20 useResetOnKeyChange 추출 | 후속 plan 이관 (사용자 지시) |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4944 passed)
- e2e   : 통과 (123/123)

## 보류·후속 항목

- WARNING #4 (훅 중복): `plan/in-progress/llm-model-select-followup-refactor.md` 에서 처리 예정 — `useBaseModelLoader` 공통 훅 추출
- WARNING #8 (서버 에러 메시지): 200자 상한 적용 완료. 오류 코드 기반 i18n 매핑은 API 계약 변경을 수반하므로 별도 후속 plan 필요
- INFO #2 (`useDefaultLlmConfigId` 분리): followup plan 대기
- INFO #5 (CustomNode 다수 구독): followup plan 대기
- INFO #16 (setDefault return value): 본 PR 영향 없음 — 별도 리뷰 시 처리
- INFO #20 (useResetOnKeyChange 추출): followup plan 대기
