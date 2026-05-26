# 변경 범위(Scope) 리뷰

## 변경 의도 요약

`plan/in-progress/llm-model-select-followup-refactor.md` 의 3개 항목 이행:
- §1. `useEmbeddingModelLoader` 훅 추출 (SUMMARY #8)
- §2. 공통 JSX 패턴 추출 → `ModelSelectField` 컴포넌트 (SUMMARY #11)
- §3. API 응답 정규화 → `llmConfigsApi.list()` 메서드 추가 (architecture INFO)

---

## 발견사항

### [INFO] `use-model-loader.ts`: `isSuccess` → `hasAttemptedLoad` 인터페이스 변경
- 위치: `codebase/frontend/src/components/llm-config/use-model-loader.ts` L40-55
- 상세: 공개 인터페이스 `UseModelLoaderResult.isSuccess` 를 삭제하고 `hasAttemptedLoad` 로 교체. 이는 follow-up plan §1(훅 구조 대칭) 와 연계된 변경으로 볼 수 있으나, plan 문서에 명시되지 않은 인터페이스 rename 이다. 다만 SUMMARY #1(isSuccess stale 버그) 대응 항목이 이전 커밋에서 부분 처리된 흔적이 있고, 본 리팩토링에서 훅 추출과 함께 최종 정리된 것으로 추론된다. 소비자(`model-combobox.tsx`, 테스트)가 동시에 갱신되었으므로 미완성 상태는 아니다.
- 제안: plan §1 항목 완료 조건에 `isSuccess → hasAttemptedLoad` 인터페이스 변경이 명시되지 않으므로, plan 문서에 해당 변경 이력을 후기(결과) 섹션에 기록하는 것을 권장.

### [INFO] `use-model-loader.ts`: `axios` 직접 의존성 제거 → `sanitizeLoaderError` 위임
- 위치: `codebase/frontend/src/components/llm-config/use-model-loader.ts` import 변경
- 상세: 오류 sanitize 로직을 `sanitize-loader-error.ts` 로 추출한 것은 §1 훅 추출의 자연스러운 부산물(양쪽 훅이 같은 로직을 공유). 범위 내 변경으로 판단.
- 제안: 없음.

### [INFO] `model-combobox.tsx` 에 JSDoc 주석 추가 (`placeholder` prop)
- 위치: `codebase/frontend/src/components/llm-config/model-combobox.tsx` L23-25
- 상세: 기존 `placeholder?: string` 필드에 JSDoc 설명이 새로 추가됨. §2 공통 JSX 패턴 추출 작업 중 `ModelSelectField` 인터페이스와 맞추는 과정에서 추가된 것으로 보이며, 불필요하지 않다. 그러나 follow-up plan 에는 주석 추가가 명시되지 않은 스코프 외 소규모 편집이다. 기능·동작에 영향 없음.
- 제안: 없음 (허용 범위 내).

### [INFO] `plan/complete/llm-model-select-only.md` 에 follow-up 보류 항목 텍스트가 구현 완료로 갱신되지 않음
- 위치: `plan/complete/llm-model-select-only.md` L70-73 (보류 항목 주석)
- 상세: plan 문서의 "보류 항목" 섹션에는 "SUMMARY #8 — useEmbeddingModelLoader 훅 추출, SUMMARY #11 — 공통 JSX 패턴 추출" 이 여전히 보류로 표시되어 있다. 본 변경에서 두 항목이 실질적으로 이행되었으나, 완료된 plan 문서가 갱신되지 않았다. 미갱신 상태로 두면 followup plan 과 complete plan 간 정보가 일치하지 않는다. 단, `plan/in-progress/llm-model-select-followup-refactor.md` 의 완료 처리(→ `plan/complete/` 이동)가 별도 작업으로 남아 있을 수 있으므로 CRITICAL 은 아님.
- 제안: 본 PR 병합 시 또는 worktree 완료 시 `llm-model-select-followup-refactor.md` 를 `plan/complete/` 로 이동하고 `llm-model-select-only.md` 의 보류 항목 주석에 완료 기록 추가.

### [INFO] `llm-config-selector.test.tsx` 주석이 구현과 불일치
- 위치: `codebase/frontend/src/components/llm-config/__tests__/llm-config-selector.test.tsx` L6-9 (mock 블록 내 주석)
- 상세: 추가된 주석 "내부적으로 `getAll()` 을 한 번 더 호출하는 정규화 헬퍼이므로" 는 실제 구현(`llmConfigsApi.list()` 가 내부에서 `getAll()` 를 호출)을 정확히 설명하지만, 테스트 mock 에서는 `getAll` 을 mock 하지 않고 `list` 만 mock 한다. 이는 테스트가 `list` 를 직접 stub 하여 `getAll` 호출 체인을 우회하는 구조이므로, 주석 "한 번 더 호출하는 정규화 헬퍼이므로 둘 다 mock 해도 되나 단순성 위해 분리" 는 다소 혼란스럽다. 동작 상 문제는 없으나 주석이 독자에게 잘못된 기대를 줄 수 있다.
- 제안: 주석을 "list() 가 내부에서 getAll() 을 호출하지만, 테스트는 list() 를 직접 stub 하므로 getAll() mock 불필요" 로 명확화.

---

## 요약

17개 파일 변경 전체가 follow-up plan (`llm-model-select-followup-refactor.md`) 의 3개 항목(§1 훅 추출, §2 공통 JSX 추출, §3 API 정규화)에 직접 대응한다. `useModelLoader` 의 `isSuccess → hasAttemptedLoad` 인터페이스 rename 은 plan 에 명시되지 않았지만 이전 커밋의 SUMMARY#1 수정과 연속성 있는 마무리로 판단되며, 모든 소비자가 함께 갱신되어 불완전 상태를 남기지 않는다. 의도와 관계없는 파일 수정, 불필요한 리팩토링, 기능 확장, 포맷팅 혼입은 발견되지 않았다. plan 완료 문서 갱신 미비와 테스트 mock 주석 부정확이 INFO 수준으로 남는다.

## 위험도

LOW
