# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: rag-search.service.spec.ts

- **[INFO]** 추가된 expect 블록에 인라인 주석이 충분히 설명적이다.
  - 위치: 추가된 diff 블록 (lines 36-45)
  - 상세: `'text-embedding-3-small'` 과 `undefined` 가 위치 인자로 하드코딩되어 있다. `undefined` 는 opts 자리임이 주석 없이는 식별 어렵다. 위치 인자 방식 자체는 기존 테스트와 일관적이나, 장황해질 경우 named fixture 활용을 고려할 만하다.
  - 제안: 현 수준에서 허용 범위. 변경 없음 권고.

- **[INFO]** `'text-embedding-3-small'` 이 makeKbRow 기본값과 일치하는 사실이 테스트 독자에게 암묵적이다.
  - 위치: expect 내 `'text-embedding-3-small'` 리터럴
  - 상세: makeKbRow 의 기본 embeddingModel 이 `'text-embedding-3-small'` 임을 알아야 expect 가 왜 그 값인지 이해된다. 상수 추출보다 주석이 더 가볍고 이미 인라인 주석이 있어 수용 범위.
  - 제안: `// makeKbRow 기본값 'text-embedding-3-small' 을 그대로 사용` 한 줄 추가하면 명확성 개선.

---

### 파일 2: local.client.spec.ts (신규 파일)

- **[INFO]** makeEmbedClient 팩토리 함수가 반복 셋업을 잘 추상화하고 있다.
  - 위치: 파일 전체 (56줄)
  - 상세: describe 블록이 단일 책임(LocalClient 상속 경로 e5 prefix), 테스트 케이스가 명확한 시나리오별 이름, 팩토리 재사용 — 양호한 구조.
  - 제안: 없음.

- **[INFO]** `@ts-expect-error` 사용 시 이유 설명이 주석으로 첨부되어 있어 유지보수 시 혼동 방지가 잘 되어 있다.
  - 위치: `client.client = { embeddings: { create: createMock } };` 라인
  - 상세: `// @ts-expect-error — 내부 SDK client 를 embeddings stub 으로 교체.` 로 의도 명확.
  - 제안: 없음.

- **[WARNING]** `'http://localhost:1234/v1'` 이 매직 문자열로 각 테스트마다 팩토리 내에서 하드코딩된다.
  - 위치: makeEmbedClient 내 `new LocalClient(defaultModel, 'http://localhost:1234/v1')`
  - 상세: 현재는 팩토리 내부에 1회만 존재하므로 중복은 없다. 그러나 상수 이름이 없어 이 URL 의 의미(더미 로컬 서버 주소)가 암묵적이다. 포트 번호 `1234` 나 경로 `/v1` 이 테스트에서 검증하는 계약과 무관한 임의 값임을 독자가 추론해야 한다.
  - 제안: `const LOCAL_ENDPOINT = 'http://localhost:1234/v1'; // 임의 더미 — 실제 연결 안 함` 상수로 추출하면 의도가 명확해진다. 단, 파일 크기가 56줄로 작고 1회 사용이므로 강제성은 낮음.

---

### 파일 3: embedding-input-type.spec.ts

- **[INFO]** 멱등성 부재를 명시적으로 문서화하는 테스트 추가는 설계 계약을 코드로 고정하는 좋은 관행이다.
  - 위치: 추가된 diff (lines 855-877)
  - 상세: 긴 인라인 주석이 "왜 이 테스트가 멱등성을 보장하지 않는지" 를 충분히 설명한다. 의도적 비멱등성을 테스트로 고정하는 패턴은 미래 유지보수자가 실수로 dedup 로직을 추가하는 것을 방지한다.
  - 제안: 없음.

- **[INFO]** `once` / `twice` 변수 네이밍이 서술적이다. 단계별 적용 결과가 명확하게 구분된다.
  - 위치: 추가된 테스트 케이스 내 변수
  - 제안: 없음.

---

### 파일 4: llm.service.spec.ts

- **[INFO]** 배치 분기(25개 → 20+5)와 timeout 경유 두 케이스를 분리한 것이 단일 책임 원칙을 잘 따른다.
  - 위치: 추가된 두 개의 it 블록
  - 상세: 각 테스트가 하나의 계약(inputType 전달 보존)을 검증하며, 분기(배치/timeout) 별로 분리되어 있다.
  - 제안: 없음.

- **[INFO]** `undefined /* opts */` 주석이 위치 인자의 의미를 명확히 한다.
  - 위치: `service.embed(config, texts, 'multilingual-e5-large', undefined /* opts */, 'query')`
  - 상세: 5인자 시그니처에서 4번째 인자가 opts 임을 주석으로 표시 — 가독성 개선이 잘 되어 있다.
  - 제안: 없음.

- **[WARNING]** `as any` 타입 단언이 config 객체에 사용되었으나 주석 없이 넘어간다.
  - 위치: `} as any;` (두 테스트 케이스 모두)
  - 상세: `as any` 는 타입 안전성을 포기한다. 테스트용 최소 픽스처 타입이 서비스 시그니처와 맞지 않는다면 타입 단언 이유를 한 줄이라도 기술하는 것이 유지보수성을 높인다. 파일 1의 `as never` 패턴과도 불일치(일관성 낮음).
  - 제안: `// 테스트용 최소 픽스처 — provider/apiKey 만 의미 있고 나머지는 사용 안 함` 주석 추가, 또는 기존 코드베이스의 `as never` 패턴과 일관되게 맞추기.

---

### 파일 5: embedding-model-combobox.test.tsx

- **[INFO]** 새 테스트가 기존 패턴(wrap / getLoadButton / optionValues 헬퍼)과 완전히 일치한다.
  - 위치: 추가된 it 블록 (lines 1114-1150)
  - 상세: 파일 내 헬퍼 함수를 재사용하고, 테스트 이름이 검증 내용을 구체적으로 설명한다.
  - 제안: 없음.

- **[INFO]** `optionText` 헬퍼가 테스트 내부 함수로 정의되어 있다.
  - 위치: `const optionText = (value: string): string => ...` (테스트 블록 내부)
  - 상세: 이 헬퍼가 이 테스트에서만 쓰인다면 인라인 정의가 적절하다. 향후 다른 테스트에서도 option 라벨 텍스트를 검사하는 케이스가 늘어날 경우 파일 상단 헬퍼로 승격을 고려할 수 있으나, 현재는 단일 사용이라 수용 범위.
  - 제안: 없음 (현재 범위).

---

### 파일 6: embedding-model-combobox.tsx

- **[INFO]** `renderOption` 을 인라인 람다에서 `useCallback` 으로 추출한 것은 가독성과 안정성 면에서 개선이다.
  - 위치: 추가된 useCallback 블록
  - 상세: 컴포넌트 JSX 내 인라인 로직(base 계산 + 조건 분기)이 순수함수 `formatEmbeddingOptionLabel` 로 이동하여 JSX 가 간결해졌다.
  - 제안: 없음.

- **[WARNING]** `Parameters<typeof formatEmbeddingOptionLabel>[0]` 타입 표현이 지나치게 장황하다.
  - 위치: `(m: Parameters<typeof formatEmbeddingOptionLabel>[0]) =>`
  - 상세: `Parameters<typeof formatEmbeddingOptionLabel>[0]` 는 실제로 `Pick<ModelInfo, "id" | "name">` 이다. 이 표현은 타입 추론 체인을 깊게 따라가야 이해되며, `formatEmbeddingOptionLabel` 의 시그니처가 변경되면 이 타입 추론도 함께 변한다는 점에서 간접 결합이 존재한다. 유지보수자가 타입을 확인하려면 함수 정의까지 탐색해야 한다.
  - 제안: `import type { ModelInfo } from "@/lib/api/llm-configs"` 가 이미 있으므로 `Pick<ModelInfo, "id" | "name">` 으로 명시하거나, 해당 타입을 `embedding-model-recommendation.ts` 에서 named export 하는 방법이 더 읽기 쉽다.

- **[INFO]** 주석("현재 ModelSelectField 는 memo 가 아니라 리렌더 절감 효과는 없으나")이 useCallback 사용 근거를 설명하고 있어 미래 유지보수자에게 맥락을 제공한다.
  - 위치: useCallback 바로 위 주석
  - 제안: 없음.

---

### 파일 7: embedding-model-recommendation.test.ts

- **[INFO]** `const BADGE = "한국어 추천"` 상수가 테스트 describe 스코프에서 재사용되어 매직 문자열이 최소화되어 있다.
  - 위치: `describe("formatEmbeddingOptionLabel")` 블록 상단
  - 제안: 없음.

- **[INFO]** 각 테스트 이름이 검증하는 조건(추천/비추천, name=id, name≠id, name 빈값, i18n 비의존)을 명확히 기술하고 있다.
  - 위치: 추가된 formatEmbeddingOptionLabel describe 블록 전체
  - 제안: 없음.

- **[INFO]** `isKoreanRecommendedEmbeddingModel` 의 기존 it.each 에서 `text-embedding-3-small` / `text-embedding-3-large` 이동 위치(추천 → 비추천)에 주석이 추가되어 의도 변경이 명확히 문서화되어 있다.
  - 위치: diff의 삭제/추가 라인
  - 제안: 없음.

---

### 파일 8: embedding-model-recommendation.ts

- **[INFO]** `formatEmbeddingOptionLabel` 함수가 명확한 JSDoc 과 함께 순수함수로 추출되었다.
  - 위치: 추가된 함수 (lines 2009-2020)
  - 상세: JSDoc 에 파라미터·반환값·설계 근거(i18n 비의존, 테스트 용이성)가 기술되어 있다. 함수 자체가 17줄 이내로 짧고 단일 책임을 가진다.
  - 제안: 없음.

- **[INFO]** `KOREAN_RECOMMENDED_PATTERNS` 상수에서 `text-embedding-3` 패턴 제거 이유가 파일 헤더 주석에 충분히 설명되어 있다.
  - 위치: 헤더 주석 추가 및 패턴 삭제
  - 제안: 없음.

- **[INFO]** 각 정규표현식 옆 인라인 주석이 어떤 모델을 매칭하는지 예시를 들어 설명한다.
  - 위치: `KOREAN_RECOMMENDED_PATTERNS` 배열 리터럴
  - 제안: 없음.

---

### 파일 9: spec/2-navigation/5-knowledge-base.md

- **[INFO]** spec 문서의 추천 모델 목록 순서 변경(우선순위 명시)과 text-embedding-3 제외 근거 추가가 구현과 동기화되어 있다.
  - 위치: 변경된 임베딩 모델 행
  - 상세: 코드 변경(KOREAN_RECOMMENDED_PATTERNS에서 text-embedding-3 제거)과 spec 변경이 함께 이루어져 spec-impl 정합성이 유지된다.
  - 제안: 없음.

- **[INFO]** 임베딩 모델 필드 셀이 단일 테이블 셀에 매우 긴 문장을 담고 있다(330자 이상). 가독성이 낮다.
  - 위치: 임베딩 모델 행 (2169번째 줄)
  - 상세: 현 spec 스타일이 이미 이 패턴을 사용하고 있으므로 기존 컨벤션과 일관적이다. 그러나 유지보수 시 편집이 불편할 수 있다.
  - 제안: 기존 컨벤션을 따르므로 강제 변경은 권고하지 않음. spec 스타일 가이드 개선 시 참고.

---

## 요약

이번 변경 세트는 전반적으로 유지보수성이 양호하다. 핵심 개선 사항은 인라인 람다를 순수함수(`formatEmbeddingOptionLabel`)로 추출한 것으로, 테스트 가능성과 코드 분리가 명확히 개선되었다. 테스트 파일들은 기존 헬퍼 함수와 패턴을 일관되게 재사용하며, 설계 계약(멱등성 부재, inputType 전달 보존)을 테스트로 문서화하는 방식이 유지보수자에게 중요한 맥락을 제공한다. 단, `embedding-model-combobox.tsx` 의 `Parameters<typeof formatEmbeddingOptionLabel>[0]` 타입 표현이 장황하고 간접 결합을 형성하며, `llm.service.spec.ts` 의 `as any` 단언이 기존 `as never` 패턴과 불일치한다는 두 가지 경미한 개선 여지가 있다.

## 위험도

LOW
