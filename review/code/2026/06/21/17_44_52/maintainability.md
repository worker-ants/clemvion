# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 1: integration-oauth.service.ts

- **[INFO]** 추가된 주석이 명확하고 의도를 잘 전달함
  - 위치: 라인 1078-1080
  - 상세: `envCredentials` 가 cafe24-private/makeshop 에서 무시됨을 명시한 주석은 WARNING 7 에 대한 정확한 해결책이다. 이미 존재하는 상위 블록 주석(1072-1076)과 자연스럽게 연결되며 코드 의도를 중복 없이 보완한다.
  - 제안: 없음 — 현행 유지.

---

### 파일 2: oauth-provider-strategy.spec.ts (신설)

- **[INFO]** `thrownCode` 헬퍼 — 단일 책임, 적절한 범위
  - 위치: 라인 27-35
  - 상세: NestJS `BadRequestException`/`InternalServerErrorException` 에서 `code` 를 추출하는 패턴을 인라인으로 반복하지 않고 헬퍼로 분리한 것은 좋다. 다만 함수 이름 `thrownCode` 가 "반환 값이 없으면 `DID_NOT_THROW` 를 반환한다"는 이중 역할을 충분히 드러내지 못한다.
  - 제안: `extractThrownCode` 나 `captureErrorCode` 정도로 네이밍하면 의미가 더 명확해지나, 테스트 파일 내부 헬퍼이므로 비차단 INFO.

- **[INFO]** 예외 경로 테스트에서 `thrownCode` 와 직접 `try/catch` 를 혼용
  - 위치: 라인 107-127 (`buildTokenRequest — missing env creds...`) vs 나머지 예외 테스트
  - 상세: `OAUTH_CONFIG_MISSING` + provider key 까지 검증하는 케이스(라인 107-127)는 code 뿐만 아니라 message 도 확인해야 하므로 `thrownCode` 헬퍼를 쓸 수 없어 직접 `try/catch` 를 사용했다. 이 혼용은 불가피하며 이해하기 어렵지 않지만, 주석 한 줄(`// also asserts message content — cannot use thrownCode`)을 추가하면 다음 독자가 헬퍼를 쓰지 않은 이유를 즉시 알 수 있다.
  - 제안: 설명 주석 추가 (선택적). 비차단 INFO.

- **[INFO]** 매직 넘버 — TTL 경계값
  - 위치: 라인 162, 267-268, 306-309, 334-336, 441-442, 479-480, 499-500, 585-586, 604-606
  - 상세: `29 * 24 * 60 * 60 * 1000`, `2 * 60 * 60 * 1000`, `60 * 60 * 1000` 등 TTL 표현이 인라인에 반복 사용된다. 단위 연산(ms) 형태라서 의미는 읽히지만 각 TTL 의 출처(strategy 별 스펙 값)가 테스트 파일에서 중복 기술된다. 전략 구현(각 `.strategy.ts`)이 TTL 상수를 export 한다면 테스트가 그 상수를 가져와 검증하는 구조가 더 유지보수에 유리하다. 현재 strategy 파일들은 TTL 을 인라인 리터럴로만 사용하므로 export 상수 부재는 strategy 코드의 결정이며 테스트만의 문제가 아니다.
  - 제안: `STUB_GOOGLE_TTL_MS` 등 상수를 strategy 파일에 export 하고 테스트에서 import 하는 방식 고려 (현재 테스트 수준에서는 허용 가능한 트레이드오프 — 비차단 INFO).

- **[INFO]** 단일 `it` 블록에 여러 분기 검증 — `parseTokenExpiresAt` 4분기
  - 위치: 라인 451-481 (MakeShop parseTokenExpiresAt), 393-417 (Cafe24 parseTokenExpiresAt)
  - 상세: 4개 분기를 하나의 `it` 블록에 넣었다. 실패 시 어느 분기가 깨졌는지 즉시 알 수 없어 디버깅 비용이 늘어난다. 기존 코드베이스의 다른 spec 파일 패턴과 비교 시 단일 케이스가 하나의 `it` 에 대응하는 경향이 있다.
  - 제안: 분기별로 `it` 을 분리하면 테스트 이름만으로 실패 원인을 좁힐 수 있다. 비차단 INFO — 현재 구조도 기능적으로 완전하므로 강제하지 않음.

- **[INFO]** 하드코딩된 날짜 문자열 `'2026-06-21T18:00:00'`
  - 위치: 라인 296-299, 461-467
  - 상세: 특정 날짜를 하드코딩하면 테스트가 "오늘" 기준 경계를 직접 검증하는 것처럼 오해할 수 있다. 실제로는 `Date.parse` 값 비교라 날짜 자체보다 timezone offset 처리(KST +09:00) 가 핵심이다. 변수 이름이나 주석으로 "이 날짜는 임의의 예시 — TZ offset 정규화 검증용" 임을 명시하면 의도가 더 명확해진다.
  - 제안: 주석 보강 또는 `const ARBITRARY_TZ_LESS_DATE = '2026-06-21T18:00:00'` 식으로 이름 부여. 비차단 INFO.

- **[INFO]** `describe` 블록 이름 케이싱 비일관성
  - 위치: 라인 64 `'Standard OAuth strategies (google / github)'`, 172 `'Cafe24 OAuth strategies (public / private)'`, 379 `'MakeShop OAuth strategy'`
  - 상세: Provider 이름 케이싱이 `google/github`(소문자), `Cafe24`(타이틀 케이스), `MakeShop`(제품 표기)로 제각각이다. 본 파일 내부에서만의 문제이며 실행에 영향 없지만, 향후 spec 추가 시 일관성을 유지하기 어려울 수 있다.
  - 제안: 코드베이스 내 다른 spec 파일 규칙에 맞추어 `describe` 레이블을 통일. 비차단 INFO.

---

## 요약

이번 변경은 주석 4줄(`integration-oauth.service.ts`) + 단위 테스트 신설(`oauth-provider-strategy.spec.ts`, 502줄)로 구성된다. 소스 코드 변경이 없어 유지보수성 측면의 회귀 위험은 없다. 신설 테스트 파일은 전반적으로 읽기 쉽고 각 describe 블록이 명확히 구분되어 있다. `thrownCode` 헬퍼는 중복 제거에 효과적이나 예외 케이스 하나에서 직접 `try/catch` 와 혼용된 점이 미세한 불일치를 만든다. `parseTokenExpiresAt` 다분기 테스트를 단일 `it` 에 담은 구조는 실패 격리성을 저하시킬 수 있다. TTL 리터럴(`29 * 24 * 60 * 60 * 1000` 등)이 전략 파일과 테스트 파일에 별개로 존재하는 점은 향후 TTL 변경 시 양쪽을 동시에 수정해야 하는 유지보수 부채가 될 수 있으나 현 규모에서는 허용 가능하다. Critical/Warning 급 유지보수성 문제는 발견되지 않았다.

## 위험도

LOW
