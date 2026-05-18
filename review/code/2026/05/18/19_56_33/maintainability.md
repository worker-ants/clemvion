# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `makeFakeJwt` 헬퍼 함수가 두 테스트 파일에 중복 정의됨
  - 위치: `integration-oauth.service.cafe24.spec.ts` (신규 추가), `cafe24-api.client.spec.ts` (신규 추가)
  - 상세: `makeFakeJwt` 함수의 내부 `b64` 헬퍼 포함 구현이 두 spec 파일에 동일하게 존재한다. `jwt-exp.spec.ts`의 `base64url` + `makeJwt` 패턴과도 목적이 동일하나 인터페이스가 다르게 정의되어 있다. 세 파일이 독립적으로 base64url 인코딩을 구현하고 있다.
  - 제안: 테스트 유틸리티 파일 (예: `__test-helpers__/jwt-test-utils.ts` 또는 `test/helpers/cafe24-test-helpers.ts`) 로 추출하고 세 곳에서 import. 단, 테스트 파일의 자급자족(self-contained) 원칙을 선호한다면 최소한 `cafe24-api.client.spec.ts`와 `integration-oauth.service.cafe24.spec.ts` 두 곳은 같은 함수이므로 공유를 권장.

- **[WARNING]** `normalizeCafe24IsoTimezone`과 `hasTimezoneDesignator`의 정규식이 두 파일에 중복 존재
  - 위치: `cafe24-api.client.ts` (`normalizeCafe24IsoTimezone` 내부), `integration-oauth.service.ts` (`hasTimezoneDesignator` 함수)
  - 상세: 두 함수가 동일한 정규식 `/Z$|[+-]\d{2}:?\d{2}$/`을 독립적으로 보유하고 있다. 로직이 완전히 동일하나 함수명이 다르고 (`hasTimezoneDesignator` vs 인라인 ternary) 위치도 다르다.
  - 제안: 정규식 상수 또는 함수를 `jwt-exp.ts` 나 별도 `cafe24-iso-utils.ts`로 추출하고 양쪽에서 import. 혹은 두 함수 중 하나(`hasTimezoneDesignator`)를 내보내기(export)로 전환하여 재사용.

- **[WARNING]** `refreshAccessToken`의 expiresAt 계산 로직에서 `normalizeCafe24IsoTimezone(expiresAtStr)` 이중 호출
  - 위치: `cafe24-api.client.ts`, diff 내 `expiresAt` 계산 ternary
  - 상세: `Number.isFinite(Date.parse(normalizeCafe24IsoTimezone(expiresAtStr)))` 조건 검사와 `new Date(Date.parse(normalizeCafe24IsoTimezone(expiresAtStr)))` 에서 동일한 함수 호출이 반복된다. 동일 입력에 동일 순수 함수라 결과는 동일하지만 불필요한 중복 계산이며 가독성을 낮춘다.
  - 제안: 지역 변수에 캐싱:
    ```ts
    const normalizedStr = normalizeCafe24IsoTimezone(expiresAtStr);
    const parsed = Date.parse(normalizedStr);
    ... Number.isFinite(parsed) ? new Date(parsed) : ...
    ```

- **[WARNING]** `parseTokenExpiresAt` 함수의 구조 변경으로 비-Cafe24 provider 처리가 함수 말미의 `if (provider === 'cafe24') { ... }` 블록 밖에 위치하여 읽기 흐름이 직관적이지 않음
  - 위치: `integration-oauth.service.ts`, `parseTokenExpiresAt` 함수
  - 상세: 변경 전 코드는 먼저 표준 `expires_in` 을 읽고 없으면 cafe24 분기로 진입하는 순서였다. 변경 후는 `if (provider === 'cafe24') { ... return; }` 가 함수 전체를 선점하고 비-cafe24 경로가 `if` 블록 밖 2줄로 처리된다. 함수의 제어 흐름이 "cafe24이면 early return, 나머지는 뒤처리" 형태라 처음 보는 독자는 비-cafe24 분기를 쉽게 놓칠 수 있다.
  - 제안: 명시적 `else` 블록을 추가하거나 비-cafe24 분기를 `else if` 로 표현해 두 경로가 동등하게 보이도록 구조화. 또는 `if (provider !== 'cafe24') { return ...; }` 로 비-cafe24를 early return 한 뒤 cafe24 로직을 메인 흐름으로 서술.

- **[INFO]** `cafe24-token-refresh.processor.ts`의 short-circuit guard 인라인 주석이 장문
  - 위치: `cafe24-token-refresh.processor.ts`, `process` 메서드 내 `if (source !== 'reactive_401')` 블록
  - 상세: 6줄 분량의 인라인 주석이 로직 블록 앞에 위치하여 코드 흐름 파악을 잠시 방해한다. 내용은 필요하고 정확하나 코드 블록 바로 위 주석으로서는 다소 장문이다.
  - 제안: 핵심 한 줄 (`// reactive_401 은 DB tokenExpiresAt 을 신뢰하지 않음 — short-circuit skip`) 만 인라인에 두고 상세 배경은 함수 수준 JSDoc 또는 spec 링크로 대체. 현재 코드도 spec 링크를 포함하고 있어 참조 경로는 충분히 제공되고 있음.

- **[INFO]** `jwt-exp.spec.ts`의 `base64url` 헬퍼 함수와 `makeJwt` 함수가 테스트 파일 내 모듈 스코프 최상단에 선언되어 테스트 케이스와 섞임
  - 위치: `jwt-exp.spec.ts`, 파일 상단 `base64url` / `makeJwt` 정의 영역
  - 상세: 관용적 Jest 패턴이며 기능상 문제없다. 다만 `describe` 블록 외부에 헬퍼가 있고 테스트 케이스가 많아져도 이 패턴은 유지되어야 하므로 명시적 `// --- test helpers ---` 구분자를 두면 파일 내 탐색이 더 용이해진다.
  - 제안: 헬퍼 선언 앞에 `// ---- Test helpers ----` 구분 주석 추가 (선택적 개선).

- **[INFO]** `Cafe24RefreshJobData.source` 유니온 타입에 신규 값 추가 시 `refreshViaQueue` 시그니처도 함께 변경한 것은 좋으나, 이전 호출 지점에서 하드코딩된 `'proactive'` 리터럴 문자열이 잔존할 경우 타입 추론이 도움이 되지 않음
  - 위치: `cafe24-api.client.ts`, `refreshViaQueue` 파라미터 타입 변경 (`source: Cafe24RefreshJobData['source']`)
  - 상세: 파라미터 타입을 `Cafe24RefreshJobData['source']` 로 변경한 것 자체는 올바르고 유지보수성을 높인다. 향후 `source` 값이 추가될 때 컴파일 오류가 조기에 노출된다.
  - 제안: 현재 변경은 적절함. 추가 권장사항 없음 — INFO 수준의 긍정 관찰.

- **[INFO]** `plan/in-progress/cafe24-jwt-exp-fix.md`의 작업 항목 체크박스가 아직 모두 `[ ]` 상태
  - 위치: `plan/in-progress/cafe24-jwt-exp-fix.md`
  - 상세: 이 파일은 리뷰 대상 코드가 구현된 이후의 상태와 일치하지 않는 것으로 보인다 (코드는 이미 구현되어 있으나 plan의 체크박스는 미체크). plan 문서와 실제 구현 상태의 동기화 불일치가 있다.
  - 제안: 완료된 항목을 `[x]`로 갱신하여 plan 문서를 구현 현실과 동기화. CLAUDE.md의 PLAN 문서 라이프사이클 규칙에 따라 모든 항목 완료 후 `plan/complete/`로 이동.

---

## 요약

이번 변경은 Cafe24 JWT `exp` claim을 만료 시각의 단일 진실 원천으로 격상하는 핵심 버그 픽스로, 전반적으로 코드 품질이 우수하다. `parseJwtExp` 함수는 단일 책임으로 명확하게 분리되었고 JSDoc 주석이 설계 의도와 반환 규약을 충실히 설명한다. `hasTimezoneDesignator` 함수 신설로 TZ 정규화 로직이 명명되어 가독성이 향상됐다. 그러나 동일한 `makeFakeJwt` base64url 인코딩 헬퍼가 두 spec 파일에 중복 정의된 점, `normalizeCafe24IsoTimezone`과 `hasTimezoneDesignator`의 정규식 로직이 두 프로덕션 파일에 독립적으로 존재하는 점, 그리고 `refreshAccessToken` 내 `normalizeCafe24IsoTimezone` 이중 호출이 개선 여지로 남아 있다. 이러한 중복은 미래에 KST 정규화 로직이 바뀔 때 한 곳만 수정되고 나머지가 누락되는 회귀 위험으로 이어질 수 있다.

## 위험도

LOW
