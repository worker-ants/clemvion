### 발견사항

- **[WARNING]** `bodyType === 'form'` → `bodyType === 'x-www-form-urlencoded'` 암묵적 Breaking Change
  - 위치: `http-request.handler.ts`, `execute()` 메서드 내 body 처리 분기
  - 상세: 기존 `'form'` bodyType을 `'x-www-form-urlencoded'`로 이름 변경했습니다. 이미 저장된 워크플로우 데이터에 `bodyType: 'form'`이 존재하면 이제 `else` 분기로 떨어져 `JSON.stringify(body)`가 실행됩니다. 마이그레이션 처리나 하위 호환성 분기가 없습니다.
  - 제안: `else if (bodyType === 'x-www-form-urlencoded' || bodyType === 'form')` 형태로 레거시 값을 함께 처리하거나, DB 마이그레이션으로 기존 값을 전환하는 계획을 명시하세요.

- **[WARNING]** JSON body 처리 묵시적 변경
  - 위치: `http-request.handler.ts`, `bodyType === 'json'` 분기
  - 상세: `JSON.stringify(body)`에서 `typeof body === 'string' ? body : JSON.stringify(body)`로 변경되었습니다. 이는 이 PR의 명시적 목표(배열형 key-value 지원)와 직접적 관련이 없는 암묵적 동작 변경입니다. 문자열이 이미 JSON인지 검증하지 않아 잘못된 JSON 문자열도 그대로 body로 전송됩니다.
  - 제안: 이 변경이 의도적이라면 별도 커밋과 테스트 케이스로 분리하세요.

- **[INFO]** `stringifyScalar`의 객체 JSON 직렬화 처리
  - 위치: `http-request.handler.ts`, `stringifyScalar()` 함수
  - 상세: header나 queryParam의 value가 객체인 경우 `JSON.stringify`로 처리합니다. headers/queryParams는 스칼라 값만 받아야 하므로 이 경로는 실질적으로 도달하지 않아야 합니다. 방어적 코드이긴 하나 예상치 못한 동작을 조용히 처리할 수 있습니다.
  - 제안: 객체가 들어왔을 경우 빈 문자열 대신 경고 로그를 남기거나 무시하도록 명시하면 의도가 더 명확합니다.

- **[INFO]** 프론트엔드 `authentication` 변수 추출 (경미한 범위 이탈)
  - 위치: `integration-configs.tsx`, `HttpRequestConfig` 컴포넌트 상단
  - 상세: `IntegrationSelector` 조건부 렌더링 추가를 위해 `authentication` 변수를 추출한 것은 자연스러운 리팩토링이며 범위를 크게 벗어나지 않습니다.
  - 제안: 문제 없음.

---

### 요약

변경의 핵심 의도—headers/queryParams를 객체 형태에서 `{ key, value }[]` 배열 형태로 전환하고, `x-www-form-urlencoded`/`form-data` body type을 명시적으로 지원하며, UI에 Integration Selector를 연결하는 것—는 상호 연관된 일관된 범위 내에 있습니다. 테스트 코드도 구현 변경을 충실히 반영하고 있습니다. 다만, 기존 `'form'` bodyType에 대한 하위 호환성 미처리와 JSON body의 묵시적 동작 변경이 실운영 데이터에 영향을 줄 수 있는 실질적 위험 요소입니다.

### 위험도
**MEDIUM**