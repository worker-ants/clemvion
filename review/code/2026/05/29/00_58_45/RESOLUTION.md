# RESOLUTION — llm-model-select-followup-refactor (§4-§7)

대상 SUMMARY: `review/code/2026/05/29/00_58_45/SUMMARY.md`
전체 위험도 LOW, Critical 0. 구현 commit `9373bffd`, 리뷰 반영 commit 은 본 RESOLUTION 과 동일 commit.

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | 위치 / 비고 |
|---|---|---|---|
| WARNING #1 | Side Effect | **수정** — `onError` 에 snapshot stale 가드 추가. snapshot 캡처를 `onMutate` → context 로 일원화해 `onSuccess`/`onError` 가 동일 snapshot 으로 가드 | `use-base-model-loader.ts` |
| WARNING #2 | Requirement | **불필요 확인** — `LLM_AUTH_ERROR` 는 backend 전체에서 throw 되지 않음(grep 0건). model-list/preview 경로는 `LLM_CREDENTIALS_REQUIRED`/`LLM_CONFIG_INVALID`/`LLM_MODEL_LIST_FAILED` 만 emit(provider 에러는 `LLM_MODEL_LIST_FAILED` 로 수렴). loader 범위 밖이며 spec 변경·매핑 추가 불필요 | 검증만 |
| WARNING #3 | Requirement | **변경 없음** — render-phase 복수 setState 는 React 권장 "adjust state on prop change" 패턴이며 동일 render 내 batching. 리팩터 이전 코드에도 존재하던 패턴. 기능 결함 아님 | 유지 |
| WARNING #4 | Maintainability | **수정** — `messagesByCode` 미전달 시 항상 fallback 반환임을 JSDoc 에 명시 | `sanitize-loader-error.ts` |
| WARNING #5 | Architecture | **변경 없음** — `HasDefaultLlmConfigProvider` 들여쓰기는 기존 `TooltipProvider` 의 무들여쓰기 컨벤션과 일치. cosmetic | 유지 |
| WARNING #6 | Testing | **수정** — global `@Catch()` exception filter 가 모든 에러를 `{ error: { code, message } }` 로 래핑함을 확인. 구 flat `{ message }` body → fallback 반환 명시 테스트 추가 | `sanitize-loader-error.test.ts` |
| WARNING #7 / INFO #11 | Documentation | **수정** — `useDefaultLlmConfigId` 첫-config fallback 의도 주석 + `loader-error-messages` i18n 동반 수정 안내 주석 추가 | `use-default-llm-config-id.ts`, `loader-error-messages.ts` |
| INFO #7 | Testing | **추가** — `useBaseModelLoader` 직접 단위 테스트(reset / stale success·error 가드 / canLoad no-op) | `__tests__/use-base-model-loader.test.tsx` |
| INFO #8 | Testing | **추가** — `buildLoaderErrorMessages` 키 정확성 검증 | `sanitize-loader-error.test.ts` |
| INFO #9 | Testing | **추가** — AI 노드 `hasDefaultLlmConfig=true` context 소비 렌더 케이스 | `custom-node.test.tsx` |
| INFO #10 | Testing | **수정** — embedding combobox mock 을 `importOriginal` 패턴으로 전환(쿼리 키 drift 방지) | `embedding-model-combobox.test.tsx` |
| INFO #6 | Maintainability | **변경 없음** — `configId as string` 는 `useSavedConfig = Boolean(configId) && ...` 가드로 안전. 단언 유지 | 유지 |
| INFO #5 / #12 | Maintainability / Architecture | **변경 없음** — `useLoaderErrorMessages` 훅 추출·`CanvasProviders` 합성은 현 시점(중복 2곳·provider 2개) premature | 유지 |

## TEST 결과

리뷰 반영(코드·테스트 변경) 후 TEST WORKFLOW 1단계부터 재수행:

- lint: 통과
- unit: 통과 (5004 passed)
- build: 통과 (backend·frontend·docker image)
- e2e: 통과 (127 passed). 최초 재실행 1회는 backend `register 500 INTERNAL_ERROR` 로 전수 실패했으나, backend 파일 변경 0건(`git diff --name-only HEAD` 확인)이고 동일 코드로 `make e2e-down` 후 재실행 시 127 전수 통과 — 컨테이너/DB 초기화 transient flakiness 로 판정.

## 보류·후속 항목

없음.
