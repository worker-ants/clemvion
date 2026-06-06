# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `resolveEmbeddingInputStrategy` 가 `applyEmbeddingInputPrefix` 내부에서 매 호출마다 정규식 매칭 실행
  - 위치: `codebase/backend/src/modules/llm/embedding-input-type.ts` — `applyEmbeddingInputPrefix` 함수
  - 상세: `applyEmbeddingInputPrefix(texts, model, inputType)` 는 배치 전체에 한 번 호출되고, 내부에서 `resolveEmbeddingInputStrategy(model)` 를 1회 실행한다. 정규식 패턴 자체(`E5_PREFIX_PATTERN`)는 모듈 상수로 컴파일 시 고정되어 있어 재컴파일 비용은 없다. 배치당 1회 매칭이므로 실질적 비용은 무시할 수 있다. 단, 동일 모델로 반복 배치를 처리하는 high-throughput 경로에서 모델 ID 패턴 결과를 호출부에서 캐싱하면 함수 호출 오버헤드를 줄일 수 있으나, 현재 규모에서는 불필요하다.
  - 제안: 현재 구조 유지. 향후 같은 모델로 수천 배치를 연속 처리하는 경로가 생기면 `resolveEmbeddingInputStrategy` 결과를 상위 계층(예: `EmbeddingService` 초기화 시)에서 메모이즈하는 것을 고려.

- **[INFO]** `applyEmbeddingInputPrefix` 에서 `texts.map(t => prefix + t)` 로 새 배열 생성
  - 위치: `codebase/backend/src/modules/llm/embedding-input-type.ts` — `applyEmbeddingInputPrefix` 함수 (774행)
  - 상세: `strategy === 'none'` 이면 원본 배열 참조를 그대로 반환한다(메모리 복사 없음). `e5-prefix` 전략일 때만 새 배열을 생성하며, 이는 prefix 접합에 필요한 최소 할당이다. 배치 크기가 최대 20개(`LlmService` 청크 크기)이므로 메모리 압력은 무시할 수 있다. `prefix + t` 는 단순 문자열 연결(O(1))이며 누적 O(n²) 패턴이 아니다.
  - 제안: 현재 구조 이상의 최적화 불필요.

- **[INFO]** `KOREAN_RECOMMENDED_PATTERNS` 가 모듈 스코프 상수로 올바르게 정의됨
  - 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-recommendation.ts` — `KOREAN_RECOMMENDED_PATTERNS` 상수
  - 상세: `const KOREAN_RECOMMENDED_PATTERNS: RegExp[]` 는 모듈 최상위 상수이므로 모듈 로드 시 1회만 생성된다. `isKoreanRecommendedEmbeddingModel` 호출마다 RegExp 리터럴이 재생성되지 않는다. 올바른 패턴이다.
  - 제안: 현재 구조 유지.

- **[INFO]** `EmbeddingModelCombobox` 의 `renderOption` 인라인 람다가 리렌더링마다 재생성
  - 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` — `renderOption` prop
  - 상세: `renderOption={(m) => { ... }}` 는 컴포넌트 리렌더링마다 새 함수 레퍼런스를 생성한다. `ModelSelectField` 가 `React.memo` 로 감싸져 있다면 `renderOption` 레퍼런스가 매번 바뀌어 불필요한 자식 리렌더링이 발생할 수 있다. `t` (i18n 함수)와 `isKoreanRecommendedEmbeddingModel` 에 대한 의존성이 있으므로 `useCallback` 을 적용하려면 `[t]` 를 dep으로 주어야 한다. 임베딩 모델 선택 UI 는 렌더링 빈도가 낮아 실질적 문제가 되지 않는다.
  - 제안: `ModelSelectField` 가 `memo` 로 최적화된 컴포넌트라면 `useCallback` 적용을 권장하나, 현재 규모에서 필수는 아니다.

- **[INFO]** `LlmService.embed` 의 배치 루프가 순차(직렬) 처리 — 이번 변경 외 기존 구조 관찰
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` — `embed` 메서드
  - 상세: 이번 변경(inputType 패스스루)에서 배치 처리 방식 자체는 건드리지 않았으나, 기존 구현이 `for` 루프 내 `await` 순차 실행이라면 N개 배치를 직렬로 처리한다. `Promise.all` 병렬화 시 처리 시간을 단축할 수 있다. 단 이는 이번 변경 범위 밖이고, rate-limit 제어(`disableInnerRetry` / `withRetry`) 와 맞물려 있어 병렬화 시 추가 고려가 필요하다.
  - 제안: 이번 변경과 무관한 기존 구조의 관찰 사항. 별도 이슈로 추적 권장.

## 요약

이번 변경은 기존 `embed` 호출 체인에 `inputType: EmbedInputType` 파라미터를 추가하고, 순수함수 모듈(`embedding-input-type.ts`)에서 모델 패턴 기반 prefix/taskType 전략을 결정하는 구조다. 신규 연산은 배치당 정규식 매칭 1회(모듈 상수 패턴 재사용)와 prefix 접합 문자열 생성(최대 20개)에 그치며, `strategy === 'none'` 인 대칭 모델(OpenAI 등)은 원본 배열을 그대로 반환해 추가 할당이 없다. 성능 관점에서 신규 도입된 연산 비용은 임베딩 API 네트워크 RTT 대비 수십만 배 이하이며, N+1 쿼리·메모리 누수·블로킹 I/O 등 실질적 성능 위험은 발견되지 않는다.

## 위험도

NONE
