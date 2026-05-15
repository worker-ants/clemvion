### 발견사항

- **[WARNING]** `buildConfigEcho` 필드 열거 방식의 취약성
  - 위치: `http-request.handler.ts:113–125` (`buildConfigEcho` closure)
  - 상세: `httpRequestNodeConfigSchema`에 정의된 모든 설정 필드를 수동으로 나열하고 있음. `followRedirects`, `verifySsl` 등 향후 신규 필드가 추가될 때 `buildConfigEcho`도 함께 수정해야 하며, 누락 시 raw config echo가 불완전해짐. schema와 핸들러 간 동기화를 강제하는 타입 수준 메커니즘이 없음.
  - 제안: spread + URL 재정의 방식으로 단순화하면 schema 진화에 자동으로 대응됨:
    ```ts
    const buildConfigEcho = (): Record<string, unknown> => ({
      ...rawConfig,
      url: rawUrl,
    });
    ```

- **[WARNING]** `requestBodyOutput()` closure와 transport error 경로의 비일관성
  - 위치: `http-request.handler.ts:308–323` vs. `367–389`
  - 상세: success/HTTP-error 경로는 `requestBodyOutput()` closure로 일관되게 처리하지만, transport error 경로는 동일한 필드를 spread syntax로 수동 반복. 이 비대칭성은 `responseHeaders` 부재라는 의도적 차이를 표현하기 위한 것이나, 유지보수 시 한쪽만 수정되는 편집 실수를 유발하기 쉬움.
  - 제안: `requestBodyOutput(includeResponseHeaders: boolean)` 형태로 파라미터화하거나, transport error 경로에서 `requestBodyOutput()`을 호출 후 `responseHeaders` 키를 제거하는 방식으로 단일 경로로 수렴.

- **[INFO]** `sanitizeResponseHeaders`의 null/undefined 허용 — 테스트 관심사의 프로덕션 API 노출
  - 위치: `sanitize-response-headers.util.ts:60–65`, JSDoc 코멘트
  - 상세: `null | undefined` 허용과 "mock-like inputs that lack the iteration protocol" 문구는 프로덕션 API가 테스트 편의를 위해 설계된 패턴. 프로덕션 경로에서 `res.headers`는 항상 `Headers` 객체이므로 실제 null 전달 가능성이 없음. 방어적 처리 자체는 무해하지만, 테스트 mock의 불완전함을 API 계약으로 흡수한 역전된 구조.
  - 제안: 기능 변경은 불필요하나, 테스트 mock을 `new Headers()` 등 실제 타입으로 맞추는 것이 더 올바른 방향.

- **[INFO]** `context.rawConfig ?? config` 묵시적 폴백 계약
  - 위치: `http-request.handler.ts:112`, `send-email.handler.ts:89`
  - 상세: Phase 1 엔진 업데이트 전(또는 직접 핸들러를 호출하는 통합 테스트 외 경로) `rawConfig`가 absent이면 평가된 값이 raw config echo에 노출됨 — `{{ $input.name }}`이 아닌 `Alice`가 config에 기록되는 상황. 문서화되어 있으나 조용한 시맨틱 오류. `rawConfig`가 항상 필수임이 명확해지면 fallback 제거가 가능한 기술 부채.
  - 제안: Phase 1 완료 후 `?? config` 분기 제거 + `ExecutionContext`에서 `rawConfig`를 선택이 아닌 필수로 승격.

- **[INFO]** Schema-handler 출력 필드 수동 동기화
  - 위치: `http-request.schema.ts:63–66` (output schema) ↔ `http-request.handler.ts` (실제 반환)
  - 상세: `requestBody`, `requestBodyType`, `responseHeaders`, `bodyTruncated`가 schema와 핸들러 모두에서 수동 정의됨. `.passthrough()`로 인해 schema가 핸들러 출력을 실제로 검증하지 않으므로 불일치가 런타임/컴파일 타임에 드러나지 않음. 현 규모에서는 허용 가능하나 노드 수 증가 시 누적 부채.

- **[INFO]** `serializeEvaluatedBody` — `binary` bodyType 미처리
  - 위치: `http-request.handler.ts:395–409`
  - 상세: `form-data`만 특수 처리하고 나머지는 body를 그대로 반환. `binary` bodyType은 `Buffer`를 그대로 반환하게 되며 이후 `truncateBodyForOutput`이 Buffer를 처리하는 경로로 진입. 현재 `truncateBodyForOutput`이 Buffer를 처리하므로 기능상 문제없으나, 명시적 처리 여부가 불분명해 향후 변경 시 혼란 가능.

---

### 요약

Phase 2 raw-echo 마이그레이션은 전체적으로 잘 구조화되어 있으며 관심사 분리(`sanitizeResponseHeaders`, `truncateBodyForOutput`, `serializeEvaluatedBody`)가 적절하게 이루어졌다. 주요 아키텍처 위험은 `buildConfigEcho`의 필드 수동 열거 방식으로, schema 진화 시 핸들러와의 동기화 실패 가능성이 있으며 spread 방식으로 즉시 개선 가능하다. `requestBodyOutput()` closure와 transport error 경로의 비일관성은 유지보수 시 편집 실수 위험을 내포하며, `rawConfig ?? config` 폴백 패턴은 Phase 1 완료 전까지의 계획된 기술 부채로 추적이 필요하다.

### 위험도

**LOW**