# Architecture Review

## 발견사항

- **[INFO]** DTO 분리 리팩토링 — 단일 책임 원칙(SRP) 준수 개선
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (파일 4)
  - 상세: `OAuthBeginResultDto` (모든 분기 필드를 optional 로 모아둔 단일 클래스) 를 `OAuthBeginPopupResultDto` / `OAuthBeginCafe24PendingResultDto` 두 개로 분리했다. 이전 설계는 두 분기의 필드가 같은 클래스에 혼재해 "어느 필드가 언제 존재하는지" 런타임 추론에만 의존해야 했다. 분리 후 각 DTO 는 하나의 응답 케이스만 책임지므로 SRP 향상. 필드가 모두 required(`!`) 로 변경되어 TypeScript 타입 수준의 안전성도 높아졌다.
  - 제안: 현재 구조는 양호하다. 추후 분기가 세 번째(예: cafe24_public_pending)로 늘어날 경우 discriminated union 을 타입 레벨에서 선언하는 패턴(`type OAuthBeginResult = OAuthBeginPopupResultDto | OAuthBeginCafe24PendingResultDto`)을 API 레이어에 노출하면 오용을 컴파일 타임에 방지할 수 있다.

- **[INFO]** Swagger 헬퍼 확장 — 개방-폐쇄 원칙(OCP) 준수
  - 위치: `backend/src/common/swagger/api-wrapped.ts` (파일 2), `backend/src/modules/integrations/integrations.controller.ts` (파일 8)
  - 상세: `wrapOneOfDataSchema` / `ApiOkWrappedOneOfResponse` 두 함수를 추가해 기존 `wrapDataSchema` / `ApiOkWrappedResponse` 를 변경하지 않고 oneOf 시나리오를 수용했다. 기존 계약을 수정하지 않고 확장하는 OCP 패턴의 올바른 적용. 공통 swagger 헬퍼가 `common/` 레이어에 위치해 모듈 경계도 명확하다.
  - 제안: 현재 `wrapOneOfDataSchema` 는 discriminator 필드 없이 `oneOf` 만 선언한다. 분기 DTO 각각이 `mode` 필드를 자체적으로 선언하고 있어 실용적으로 동작하지만, OpenAPI 3.0 의 `discriminator` 객체를 명시하면 자동 문서 생성 도구와의 호환성이 높아진다. 필수 수정은 아니나 향후 고려 가능한 확장점.

- **[INFO]** 컨트롤러의 Swagger 데코레이터 패턴 일관성
  - 위치: `backend/src/modules/integrations/integrations.controller.ts` (파일 8) — oauthBegin, reauthorize, requestScopes 3개 엔드포인트
  - 상세: 세 엔드포인트 모두 동일한 `ApiOkWrappedOneOfResponse([OAuthBeginPopupResultDto, OAuthBeginCafe24PendingResultDto], ...)` 패턴을 반복 적용. 패턴 자체는 정확하지만 동일 DTO 배열이 세 곳에 중복된다. 현 규모에서는 허용 가능하나 분기 DTO 가 추가될 때 세 군데를 모두 갱신해야 하는 산포(shotgun surgery) 위험이 잠재한다.
  - 제안: `const OAUTH_BEGIN_DTOS = [OAuthBeginPopupResultDto, OAuthBeginCafe24PendingResultDto] as const` 형태의 상수를 선언해 단일 지점에서 관리하면 DTO 추가 시 수정 범위를 1곳으로 제한할 수 있다.

- **[INFO]** 마이그레이션 인프라 — 트랜잭션 비활성화 설계 의도 명문화
  - 위치: `backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf` (파일 1)
  - 상세: `CREATE INDEX CONCURRENTLY` 가 Flyway 트랜잭션 블록 안에서 실행될 수 없다는 PostgreSQL 제약을 `.conf` 파일 주석으로 명확히 기록했다. 인프라 계층의 결정 근거를 코드 바로 옆에 문서화하는 바람직한 패턴. 아키텍처 레이어(마이그레이션 인프라) 와 비즈니스 로직 레이어의 분리 유지.
  - 제안: 이 수준이면 충분하다. 단, Flyway `outOfOrder` 또는 병렬 migration 실행 시나리오에서 CONCURRENTLY 가 어떻게 동작하는지도 `.conf` 또는 `README.md` 에 한 줄 추가하면 운영 팀의 혼동을 예방할 수 있다.

- **[INFO]** 테스트에서 TypeORM 내부 구조(`_value._value`) 직접 접근
  - 위치: `backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts` (파일 5)
  - 상세: `Not(In([...]))` 연산자 내부 `_value._value` 배열을 직접 단언하는 방식은 TypeORM 버전 변경 시 조용히 깨질 수 있다. 이는 테스트 레이어가 데이터 레이어의 ORM 내부 구현에 과도하게 결합된 형태다. 발견되는 부분이 한 곳이고 주석으로 의도가 명시되어 있어 현재는 수용 가능하다.
  - 제안: TypeORM operator 내부 구조 대신 실제 DB 쿼리 결과(예: pending_install 상태의 통합이 scanner 결과에 포함되지 않는 것)를 단언하는 방향이 더 견고하다. 또는 find 호출 인자 전체를 스냅샷으로 캡처해 기대 구조와 비교하는 방식도 ORM 내부 필드명 변경에 강하다.

- **[INFO]** `cafe24-token-refresh.processor.spec.ts` — 테스트 삭제
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.spec.ts` (파일 17)
  - 상세: diff 에서 "TEST-C2" 라 표시된 `propagates refreshAccessToken failure` 테스트 케이스가 삭제되었으나, 전체 파일 컨텍스트를 보면 동일 테스트가 파일 하단에 존재한다. 즉 중복 선언이 제거된 것으로, 동일 검증이 여전히 존재한다. 아키텍처적으로 error propagation 불변식을 테스트로 고정하는 것은 올바른 접근이며, 유일한 위치로 정리된 것도 바람직하다.
  - 제안: 조치 없음.

- **[INFO]** 경고 메시지 언어 SoT 전환 — 관심사 분리 개선
  - 위치: `backend/src/nodes/ai/llm-provider-rule.ts` (파일 11), `backend/src/nodes/core/node-component.interface.ts` (파일 13), 다수 `.schema.spec.ts` 파일들 (파일 10, 12, 14–16, 18–19, 21–23)
  - 상세: 백엔드 경고 메시지를 영문 SoT 로 전환하고 프론트엔드 `backend-labels.ts` 가 한국어 번역을 담당하는 구조로 명확히 정립했다. 이는 백엔드(비즈니스/도메인 레이어)에서 프레젠테이션 관심사(언어/i18n)를 제거한 올바른 계층 분리다. 각 spec 파일의 테스트 메서드명도 "Korean warning" 에서 "warning" 으로 통일되어 언어 의존적 테스트 기술이 제거되었다.
  - 제안: 현 구조는 바람직하다. `llm-provider-rule.ts` 주석에 프론트엔드 `WARNING_KO` 와의 동기화 의무를 명시한 것도 좋은 설계 문서화. 추후 영문 메시지가 변경될 때 이 계약을 CI 로 강제하는 것(예: 메시지 키 변경 시 프론트엔드 `backend-labels.ts` 동시 갱신 여부를 검사하는 lint rule)을 고려할 수 있다.

- **[INFO]** `integration-oauth.service.ts` — 미사용 파라미터 주석 처리
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` (파일 7), line 1715
  - 상세: `urlToken` 파라미터를 구조분해에서 제거하고 주석으로 "caller-side documentation" 목적임을 설명했다. 함수 파라미터가 타입 수준에는 존재하지만 구현 내부에서는 사용되지 않는 형태다. 주석이 의도를 잘 설명하나, 사용하지 않는 파라미터가 인터페이스에 계속 남는 것은 인터페이스 분리 원칙(ISP) 관점에서 약간의 노이즈다.
  - 제안: 현재는 허용 수준. 향후 파라미터 구조가 안정화되면 `urlToken` 을 타입에서 제거하거나, 사용 의도를 서비스 메서드 주석에 명시해 인터페이스를 깔끔하게 유지하는 것을 검토할 수 있다.

---

## 요약

이번 변경 세트의 가장 중요한 아키텍처 결정은 단일 optional-필드 DTO 를 두 개의 전용 DTO 로 분리한 것이다. 이전 `OAuthBeginResultDto` 설계는 두 분기의 필드를 한 클래스에 혼재시켜 런타임 분기 추론이 필수였으나, 분리 후에는 각 DTO 가 하나의 응답 케이스만 책임진다. Swagger 헬퍼 계층이 `wrapOneOfDataSchema` / `ApiOkWrappedOneOfResponse` 로 확장되어 기존 계약을 훼손하지 않고 oneOf 시나리오를 수용한 것도 OCP 원칙에 부합한다. 백엔드 경고 메시지를 영문 SoT 로 이전하고 한국어 번역을 프론트엔드 i18n 레이어에 위임한 것은 프레젠테이션 관심사를 비즈니스 레이어에서 제거한 올바른 계층 분리다. 전반적으로 SOLID 원칙 적용, 레이어 경계, 모듈 응집도 측면에서 이전보다 향상된 구조이며, 발견된 사항들은 모두 INFO 수준으로 즉각적인 조치보다는 향후 개선을 고려할 수 있는 관찰점들이다.

---

## 위험도

LOW
