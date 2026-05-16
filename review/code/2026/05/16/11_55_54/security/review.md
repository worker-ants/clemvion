# 보안(Security) 코드 리뷰

리뷰 대상: 35개 파일 (마이그레이션 설정, Swagger 헬퍼, DTO, 서비스, 컨트롤러, 테스트 등)

---

## 발견사항

- **[INFO]** HMAC 메시지 인코딩 함수 리팩터링 — 기능 동일성 유지
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` (파일 7, `formUrlEncode` 함수)
  - 상세: `encodeURIComponent` + 특수문자 수동 대체 체인을 괄호로 묶은 포맷 변경. 보안 로직 자체는 변경 없음. 기존에도 `!`, `'`, `(`, `)`, `~` 를 Java URLEncoder 호환으로 재인코딩하는 방어 코드가 유지된다.
  - 제안: 이 함수가 HMAC 서명 검증 전 메시지 빌드에 사용된다면, 향후 Cafe24 API 메시지에 해당 특수문자가 포함될 경우를 대비해 통합 테스트 케이스를 추가하는 것을 권장.

- **[INFO]** `urlToken` 파라미터 미사용 처리 — 의도적 설계
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` (파일 7, `findRecoveryCandidate` 메서드 영역)
  - 상세: `urlToken` 이 params 타입에는 존재하나 구현 내부에서는 `query` 만 구조분해. 주석에 "HMAC re-verification re-derives the token via the candidate row's client_secret" 라고 의도가 명시되어 있어, 실제 HMAC 재검증이 별도 경로에서 수행됨을 전제로 함. `urlToken` 을 무시하는 것이 의도임을 주석이 설명하고 있으나, 해당 caller 가 HMAC 재검증을 반드시 수행하는지 코드 경로를 명시적으로 추적해둘 필요가 있음.
  - 제안: `urlToken` 이 caller 측에서 HMAC 검증에 쓰이는지 단위 테스트 또는 주석으로 명시적으로 보장. 향후 refactoring 시 해당 파라미터가 검증 없이 삭제되지 않도록 주의.

- **[INFO]** DTO 분리로 인한 타입 안전성 강화 — 보안 측면 긍정적
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (파일 4)
  - 상세: 기존 `OAuthBeginResultDto` 가 모든 필드를 optional 로 가진 단일 DTO 였던 것을 `OAuthBeginPopupResultDto` (authUrl, state 필수) 와 `OAuthBeginCafe24PendingResultDto` (mode, integrationId, appUrl, callbackUrl 필수) 로 분리. optional 필드 남용으로 인한 분기 식별 오류 가능성을 줄임.
  - 제안: 클라이언트 사이드에서 `mode` 필드 존재 여부로 분기를 판별할 때 명시적인 타입 가드를 사용하도록 프론트엔드 코드에도 동일한 분리 패턴이 적용되었는지 확인 권장.

- **[INFO]** CSRF 방지용 state 토큰 필드 명칭 정비
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (파일 4, `OAuthBeginPopupResultDto`)
  - 상세: 기존 `authorizeUrl` (optional) 이 `authUrl` (required) 로, `state` 가 required 로 변경. CSRF 방지 필드가 nullable/optional 이었던 구조적 문제가 해소됨. OAuth state 파라미터는 CSRF 방지에 필수이므로 required 처리는 올바름.
  - 제안: 특이사항 없음. 긍정적 변경.

- **[INFO]** pending_install 상태 필터 테스트 추가 — 노출 범위 제한 검증
  - 위치: `backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts` (파일 5, REQ-C1 테스트)
  - 상세: `pending_install` 상태가 만료 스캔 대상에서 제외되는지 TypeORM `Not(In([...]))` 연산자 내부 `_value` 를 직접 검사. `_value._value` 내부 구현에 의존하는 취약한 단언 방식이나 보안 정책(pending_install 제외)을 회귀 방지한다는 목적은 명확함.
  - 제안: TypeORM 버전 업그레이드 시 `_value` 내부 구조가 바뀔 수 있음. 가능하다면 spy/mock 을 통해 where 절 의도를 검증하거나, 실제 DB 통합 테스트로 보완하는 것을 권장.

- **[INFO]** Flyway `executeInTransaction=false` — 보안 관련 없음, 주석 추가
  - 위치: `backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf` (파일 1)
  - 상세: `CREATE INDEX CONCURRENTLY` 를 위한 트랜잭션 비활성화 설정에 한국어 주석이 추가됨. 보안 측면의 변경 없음. 이 설정 자체가 인덱스 빌드 중 잠금을 최소화하기 위한 의도적 선택임을 문서화.
  - 제안: 특이사항 없음.

- **[INFO]** HTTP 헤더 인젝션 방어 테스트 (기존 코드 확인)
  - 위치: `backend/src/nodes/integration/http-request/http-request.schema.spec.ts` (파일 19, `keyValueSchema` CRLF 테스트)
  - 상세: 기존 `keyValueSchema` 에 CRLF(`\r\n`, `\n`, `\r`) 가 포함된 헤더 key/value 를 거부하는 테스트가 이미 존재하고 있음(`review W-1` 참조). 이번 변경은 테스트 설명 문자열 변경만 포함. 헤더 인젝션 방어 자체는 이미 구현되어 있음.
  - 제안: schema 레이어의 검증이 실제 HTTP 요청 실행 경로에서도 반드시 거치는지 handler 레벨 통합 테스트로 보완 권장.

- **[INFO]** Cafe24 토큰 갱신 프로세서 — re-throw 전파 테스트 위치 이동
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.spec.ts` (파일 17)
  - 상세: diff 에서 보면 테스트 블록이 삭제된 것처럼 보이나, 전체 파일 컨텍스트를 보면 해당 테스트 (`propagates refreshAccessToken failure`) 가 파일 후반부에 그대로 존재. 단순히 describe 블록 내 위치가 변경된 것. BullMQ job 실패 마킹을 위한 에러 전파 보장 테스트는 유지됨.
  - 제안: 특이사항 없음.

---

## 요약

이번 변경 세트는 주로 (1) OAuth 응답 DTO 를 단일 optional 필드 DTO 에서 두 개의 구체적 required 필드 DTO 로 분리, (2) Swagger 문서 `oneOf` 스키마 헬퍼 추가, (3) 경고 메시지 언어 표기(`Korean` → 언어 중립) 관련 주석/테스트 설명 정비, (4) 코드 포맷팅으로 구성된다. 보안 관점에서 주목할 위험은 발견되지 않았다. DTO 분리는 분기 혼용으로 인한 로직 오류 가능성을 줄이고, CSRF state 필드가 required 로 강화되었으며, 기존 HMAC 검증 로직과 HTTP 헤더 인젝션 방어는 변경 없이 유지된다. `urlToken` 파라미터를 구현에서 무시하는 패턴은 주석으로 설명되어 있으나 caller 측 HMAC 재검증 경로를 명시적으로 추적해 두는 것이 권장된다. 전반적으로 보안 측면에서 안전한 변경으로 평가된다.

---

## 위험도

LOW
