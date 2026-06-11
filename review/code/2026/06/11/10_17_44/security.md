# 보안(Security) 리뷰

## 발견사항

### **[INFO]** .env.example ENCRYPTION_KEY placeholder 교체 — 올바른 방향

- 위치: `codebase/backend/.env.example` L202
- 상세: 기존 `0123456789abcdef...` 패턴(순열 구조로 예측 가능) 을 `000...000` 으로 교체하고, `production-guards.ts` 의 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` Set 에 두 값을 모두 포함해 과거 placeholder 로 운영 중인 배포도 차단한다. "옛 값을 제거하지 말고 추가" 방침이 명시적으로 문서화되어 있어 히스토리 키 허용 누락 위험이 낮다.
- 제안: 현재 접근이 적절하다. 향후 placeholder 변경 시 동일 방침(Set 에 누적 추가)을 유지한다.

---

### **[INFO]** assertProductionConfig 단일 블록 응집 — 긍정적 리팩터

- 위치: `codebase/backend/src/common/config/production-guards.ts`
- 상세: 기존 `main.ts` 에 인라인으로 흩어져 있던 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 부팅 가드가 `assertProductionConfig` 로 통합됐다. 순수 함수 분리 덕분에 전 분기를 단위 테스트(`production-guards.spec.ts`)로 검증한다. `INSECURE_JWT_SECRETS`, `KNOWN_EXAMPLE_ENCRYPTION_KEYS` Set 을 export 해 테스트 커버리지가 동기화된다.
- 제안: 이슈 없음. 현 구현 구조가 적절하다.

---

### **[INFO]** isFlagOn 파싱 — 의도적 보수적 해석이나 사각지대 문서화 필요

- 위치: `codebase/backend/src/common/config/production-guards.ts` L695–697
- 상세: `isFlagOn` 은 정확히 `'true'` 또는 `'1'` 만 ON 으로 판단한다. `'TRUE'`, `'Yes'`, `'on'` 등은 OFF 로 처리한다. 이는 "비표준 truthy 값의 우연한 활성화 방지" 를 위한 의도적 설계이며 테스트(`it.each(['TRUE', 'yes', 'on', '0', '']` ...)에서 명시적으로 검증된다. 다만 운영자가 `MCP_ALLOW_INSECURE_URL=TRUE` 로 오설정하면 부팅은 통과하나 실제로는 해당 플래그의 동작 코드(별도 체크)가 다른 파싱 로직을 쓸 경우 동작 불일치가 생길 수 있다.
- 제안: `isFlagOn` 이 사용되는 모든 플래그(현재 `OAUTH_STUB_MODE`, `LLM_STUB_MODE`, `MCP_ALLOW_INSECURE_URL`) 의 실제 동작 코드에서도 동일한 파싱 규칙을 사용하는지 교차 확인한다. 규칙이 다르다면 파싱 함수를 공유 모듈로 추출해 단일화한다.

---

### **[WARNING]** ALLOW_PRIVATE_HOST_TARGETS=true — warn-only 정책의 SSRF 위험 명시 보완 필요

- 위치: `codebase/backend/src/main.ts` L986–993
- 상세: `ALLOW_PRIVATE_HOST_TARGETS=true` 는 HTTP Request 및 DB Query 노드의 outbound SSRF 호스트 블록리스트 전체(loopback, RFC 1918, cloud metadata 포함)를 우회한다. 본 PR 에서 throw 가 아닌 warn-only 로 정책을 분리한 이유(VPC 내부 DB/SMTP 정당 용도)는 설계 문서에 명시됐다. 그러나 warn 메시지가 `logger.warn` 으로만 남아 운영자가 모니터링 시스템에서 이 경고를 alert 로 구성하지 않으면 실질적으로 무시될 수 있다.
  - 특히 `ALLOW_PRIVATE_HOST_TARGETS=true` + 멀티테넌트(워크플로 편집자가 다수) 조합에서 워크플로 편집자가 내부망 DB/서비스를 HTTP Request 노드 대상으로 지정할 수 있어 SSRF 에 가까운 공격 표면이 생긴다.
- 제안: (1) warn 메시지에 `[SECURITY]` 태그나 로그 레벨 구분이 가능한 필드를 추가해 SIEM/alerting 연동을 용이하게 한다. (2) spec 문서(`http-request §4`)에 "이 플래그 활성화 시 외부 egress 방화벽 또는 IP allowlist 가 반드시 보완돼야 함" 을 조건으로 명시할 것을 권고한다.

---

### **[INFO]** JWT_SECRET 길이 검증 미포함

- 위치: `codebase/backend/src/common/config/production-guards.ts` L726
- 상세: `assertProductionConfig` 는 `JWT_SECRET` 이 비어있지 않고 알려진 insecure 값이 아님을 검사한다. 그러나 최소 길이(예: 32바이트 이상) 검사가 없다. 예를 들어 `JWT_SECRET=x` 처럼 극도로 짧은 값도 현재 가드를 통과한다. 짧은 HS256 키는 brute-force 취약점이 있다(NIST SP 800-107).
- 제안: `jwtSecret.length >= 32` (또는 권장 64자) 조건을 추가하고, 미달 시 throw 또는 최소 warn 을 추가한다. .env.example 의 주석에서 "32자 이상 무작위 문자열" 을 명시한다(현재 생성 명령어 없이 단순 설명만 존재).

---

### **[INFO]** ENCRYPTION_KEY 형식 검증 미포함

- 위치: `codebase/backend/src/common/config/production-guards.ts` L737
- 상세: `ENCRYPTION_KEY` 가 공개 예시 키가 아님을 검사하나, "64개의 hex 문자" 형식 검증은 없다. 주석(`.env.example` L195)에 "32-byte hex (64 hex chars) recommended (otherwise derived via SHA-256)" 라고 명시되어 있으나 임의 평문 문자열도 부팅을 통과한다. 평문 문자열은 SHA-256 파생을 통해 AES 키로 변환되므로 기능상 동작하지만, 엔트로피가 낮은 문자열을 키로 쓰는 오설정이 소리없이 허용된다.
- 제안: 선택적으로 64자 hex 패턴 정규식 검사(`/^[0-9a-fA-F]{64}$/`)와 함께 hex 형식이 아닐 경우 warn(비hex 도 동작하나 권장하지 않음) 을 추가할 수 있다. 현재 구현이 기능적으로 동작하므로 Critical 은 아님.

---

### **[INFO]** Swagger 문서 프로덕션 노출 여부 확인 권고

- 위치: `codebase/backend/src/main.ts` L1020–1087
- 상세: `SwaggerModule.setup('docs', ...)` 가 `NODE_ENV` 에 무관하게 항상 활성화된다. Swagger UI 가 프로덕션에 노출되면 API 구조, 엔드포인트, 인증 스키마 정보가 공개된다. 이 PR 의 변경 사항은 아니지만, 이번 보안 리뷰 범위 내에서 발견.
- 제안: `NODE_ENV === 'production'` 일 때 Swagger 를 비활성화하거나 별도 인증 미들웨어로 접근을 제한하는 것을 권고한다. 최소한 `assertProductionConfig` 에 Swagger 노출 여부 체크를 추가하거나 환경변수(`ENABLE_SWAGGER=false`)로 제어하는 옵션을 고려한다.

---

### **[INFO]** 테스트 파일에서 VALID_ENC 상수가 실제 운영 키처럼 보이는 패턴

- 위치: `codebase/backend/src/common/config/production-guards.spec.ts` L394
- 상세: `VALID_ENC = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'` 는 테스트용 유효 키 예시로 사용된다. 이 값이 실제로 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 에 포함되지 않음을 확인했다. 테스트 파일이므로 평문 포함에 문제는 없으나, 이 값이 실제 배포에 복사될 경우 현재 가드를 통과한다(Set 에 없으므로).
- 제안: 이 테스트 값도 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 에 추가하거나, 테스트 파일에 "이 값은 테스트 전용이며 절대 운영에 사용하지 말 것" 주석을 추가한다. 테스트 유효성을 위해 Set 에 넣지 않는 것이 의도라면 주석으로 명확히 한다.

---

### **[INFO]** plan 문서 status 동기화 — 정보 노출 없음, 이슈 없음

- 위치: `plan/complete/security-jwt-secret-fallback.md`
- 상세: 이 파일의 `status` 가 diff 에서 `backlog` 로 추가되었으나 전체 파일 컨텍스트에는 `superseded` 로 표시되어 있다. plan 문서이므로 코드 보안 이슈는 없으며 단순 문서 상태 관리 사항이다.
- 제안: plan 라이프사이클 정책에 따라 diff 와 최종 파일 상태가 `superseded` 로 일치하는지 확인한다.

---

## 요약

이번 PR 은 프로덕션 부팅 시 미설정/예시 시크릿·위험 플래그를 단일 `assertProductionConfig` 함수로 집중 차단하는 fail-closed 강화 작업이다. `JWT_SECRET`, `ENCRYPTION_KEY` 의 예시값 블록리스트, `MCP_ALLOW_INSECURE_URL` throw 정책, `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 가드 응집이 핵심이며, 전 분기를 단위 테스트로 검증한 설계는 보안 관점에서 긍정적이다. `ALLOW_PRIVATE_HOST_TARGETS` 의 warn-only 분리 정책은 self-host 용도를 고려한 설계이나, 멀티테넌트 환경에서의 SSRF 표면 확대 위험을 운영자가 명확히 인지하고 외부 egress 제어로 보완해야 한다는 점이 경고 수준의 유의 사항이다. JWT_SECRET 최소 길이 미검사, ENCRYPTION_KEY 형식 미검증, Swagger 상시 노출 등 소소한 개선 여지가 있으나 이 PR 의 보안 방향성에 반하지 않는다.

## 위험도

LOW

STATUS: SUCCESS
