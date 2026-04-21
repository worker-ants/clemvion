## 리뷰 결과: `google.client.spec.ts`

### 발견사항

- **[INFO]** `@ts-expect-error`를 통한 내부 상태 직접 변경
  - 위치: `makeClientWithStreamResult` 함수, `// @ts-expect-error — overwrite the internal SDK client` 라인
  - 상세: `client.genAI`를 직접 교체하는 방식이 반복적으로 사용된다. 이는 `GoogleClient` 내부 구현에 강하게 결합된 테스트이며, `genAI` 프로퍼티명이 변경되거나 접근 제한이 강화될 경우 모든 테스트가 한 번에 깨진다. 단, 이는 테스트 파일 내부에 국한된 조작으로 런타임 부작용은 없다.
  - 제안: 인스턴스를 직접 패치하는 대신 `GoogleClient` 생성자에서 `genAI` 인스턴스를 주입받을 수 있도록 리팩토링하면 `@ts-expect-error` 없이 타입 안전하게 목을 주입할 수 있다.

- **[INFO]** `abort` 테스트에서 `AbortController.abort()`를 스트림 내부에서 호출
  - 위치: `'yields done with finishReason="aborted"'` 테스트, `next: async ()` 내부
  - 상세: `abort.abort()`를 호출한 뒤 즉시 `throw`하는 구조인데, 실제 구현이 `signal.aborted` 여부를 확인하지 않고 예외 타입만으로 abort를 판별한다면 이 테스트는 우연히 통과할 수 있다. abort와 일반 에러 분기를 모두 커버하는지 구현 코드를 교차 확인해야 한다.
  - 제안: abort 판별 로직이 `signal.aborted` 체크 기반인지 에러 메시지 기반인지 명시적으로 문서화하고, 해당 분기를 직접 자극하는 테스트임을 주석으로 표기한다.

- **[INFO]** `makeClientWithStreamResult`에서 빈 배열 전달 시 `chunks[chunks.length - 1]`이 `undefined`
  - 위치: `makeClientWithStreamResult` 함수, `response: Promise.resolve(aggregated ?? chunks[chunks.length - 1] ?? {})` 라인
  - 상세: `chunks`가 빈 배열일 때 `chunks[-1]`은 `undefined`이므로 `{}` 폴백이 적용된다. 현재는 `??` 체인이 올바르게 처리하므로 런타임 오류는 없다. `'yields done immediately when there is no user message'` 테스트가 이 경로를 검증하지만, response가 `{}` 일 때 구현이 usage를 `{0,0,0}`으로 올바르게 처리하는지가 테스트의 핵심 검증 포인트다.
  - 제안: 현재 코드로 충분하나, 명시성을 위해 `aggregated ?? (chunks.length > 0 ? chunks[chunks.length - 1] : {})` 형태로 의도를 드러낼 수 있다.

### 요약

이 파일은 순수한 단위 테스트로, 전역 상태 변경·파일시스템·네트워크 호출·환경 변수 접근이 전혀 없다. 모든 외부 의존성은 jest mock으로 격리되어 있으며, 각 테스트는 독립적으로 자체 `GoogleClient` 인스턴스를 생성한다. `@ts-expect-error`를 통한 내부 프로퍼티 패치는 타입 안전성 측면의 유지보수 부채이지만 런타임 부작용이 아니다. 부작용 관점에서 이 파일은 안전하다.

### 위험도

**NONE**