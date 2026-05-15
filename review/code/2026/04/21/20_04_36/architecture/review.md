## 아키텍처 리뷰: `google.client.spec.ts`

### 발견사항

- **[INFO]** 테스트 헬퍼가 인터페이스가 아닌 구체 구현에 직접 의존
  - 위치: `makeClientWithStreamResult` 함수, `// @ts-expect-error` 주석 라인
  - 상세: `client.genAI`를 `@ts-expect-error`로 직접 overwrite하는 방식은 `GoogleClient` 내부 구현 세부사항에 강하게 결합되어 있음. 필드명 변경 시 런타임 오류 없이 테스트가 통과될 위험이 있음
  - 제안: `GoogleClient`가 생성자 주입 또는 팩토리 메서드로 SDK 의존성을 주입받도록 설계하면, 테스트에서 mock을 `@ts-expect-error` 없이 주입 가능. 예: `new GoogleClient('key', 'model', fakeGenAI)`

- **[INFO]** `FakeChunk` 인터페이스가 실제 SDK 타입과 분리됨
  - 위치: `FakeChunk` 인터페이스 정의부 (lines 16–29)
  - 상세: Gemini SDK의 실제 청크 타입 대신 별도 `FakeChunk`를 정의해 테스트가 SDK 타입 변경에 무감각해짐. SDK 타입이 변경되어도 테스트는 통과하지만 구현은 깨질 수 있음
  - 제안: `import type { GenerateContentResponse } from '@google/generative-ai'` 등 실제 SDK 타입을 활용하거나, 적어도 핵심 구조가 동일함을 보장하는 `satisfies` 검증 추가

- **[INFO]** 각 오류 시나리오 테스트에서 `GoogleClient`를 중복 수동 구성
  - 위치: 오류 케이스 3개 테스트 (401, 429, AbortSignal 테스트)
  - 상세: `makeClientWithStreamResult` 헬퍼를 사용하지 않고 동일한 stub 패턴을 반복 작성. DRY 원칙 위반이며, 추후 `genAI` 구조 변경 시 여러 곳을 동시에 수정해야 함
  - 제안: `makeClientWithStreamResult`를 확장하거나 `makeClientWithError(error: Error)` 헬퍼를 별도로 추출해 중복 제거

- **[INFO]** 테스트 파일이 단일 public API(`stream`)만 검증하며 책임 범위가 명확함
  - 위치: 전체 파일
  - 상세: 긍정적 사항. 모든 테스트가 `client.stream()`이라는 단일 진입점만 테스트하며, 내부 변환 로직(finishReason 매핑, usage 집계, AbortSignal 전달)을 블랙박스 방식으로 검증함. 레이어 경계가 명확히 유지됨

### 요약

전반적으로 테스트 구조는 `GoogleClient.stream()`의 공개 계약을 중심으로 잘 조직되어 있으며, 이벤트 타입별 시나리오가 적절히 분리되어 있다. 주요 아키텍처 우려사항은 `@ts-expect-error`를 통한 내부 필드 직접 조작인데, 이는 `GoogleClient`가 의존성을 외부에서 주입받지 않는 구조적 제약에서 기인한다. SDK 의존성을 생성자나 팩토리로 주입받도록 `GoogleClient`를 리팩토링하면 테스트 코드의 취약성과 중복이 함께 해소된다. 오류 케이스 테스트의 stub 중복은 즉시 개선 가능한 낮은 위험 수준의 문제다.

### 위험도

**LOW**