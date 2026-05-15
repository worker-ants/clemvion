## 발견사항

### 보안 취약점

---

- **[WARNING]** `OAUTH_STUB_MODE` 환경 변수가 프로덕션 코드에서 OAuth 흐름을 우회함
  - 위치: `integration-oauth.service.cafe24.spec.ts:47` — `process.env.OAUTH_STUB_MODE = 'true'`
  - 상세: 테스트가 프로덕션 `IntegrationOAuthService` 에 존재하는 `OAUTH_STUB_MODE` 분기를 활성화한다. 이 환경 변수가 배포 환경(`.env`, K8s ConfigMap 등)에 실수로 포함되면 실제 Cafe24 토큰 교환을 건너뛰고 stub 자격 증명이 발급된다. 인증 우회 백도어가 프로덕션 코드 안에 있는 것이 근본 문제.
  - 제안: stub 로직을 테스트 전용 subclass 또는 DI-injectable `OAuthTokenExchanger` 인터페이스로 분리해 프로덕션 코드 경로에서 제거한다.

---

- **[WARNING]** `__resetForTesting()` / `__resetCafe24LocksForTesting` — 테스트용 백도어가 프로덕션 클래스에 노출됨
  - 위치: `cafe24-mcp-tool-provider.spec.ts:278` (`provider.__resetForTesting()`), `cafe24-api.client.spec.ts` (`__resetCafe24LocksForTesting` import)
  - 상세: 프로덕션 클래스에 공개 메서드 / 모듈 익스포트로 내부 상태를 초기화하는 진입점이 존재한다. 현재 공격 표면은 인-메모리 Map 초기화에 불과해 직접 피해는 제한적이나, 분산 환경에서 실행 세션 격리 상태가 제거될 경우 다른 사용자의 Cafe24 API 호출이 잘못된 세션 컨텍스트로 실행될 수 있다.
  - 제안: `jest.spyOn` + 모듈 내부 Map을 `protected` / `package-private`으로 관리하거나 별도 테스트 팩토리 함수를 두어 프로덕션 인터페이스에서 제거한다.

---

- **[WARNING]** Private 앱 `client_secret` 이 요청 바디에 전송되어 서버 액세스 로그에 기록될 가능성
  - 위치: `integrations.controller.ts` — `providerMeta: { client_secret: body.clientSecret }` 전달 경로; `new/page.tsx:141`
  - 상세: Private 앱의 `client_secret` 이 POST `/oauth/begin` 요청 바디에 포함된다. HTTPS 전송 자체는 안전하지만 NestJS 미들웨어 로거나 APM 도구(Datadog, New Relic 등)가 `request.body` 전체를 기록할 경우 `client_secret` 이 평문으로 로그에 남는다.
  - 제안: body 로깅 미들웨어에 `clientSecret` 필드를 마스킹 대상으로 추가한다. `@ApiProperty({ writeOnly: true })`와 함께 Swagger에서도 노출 방지. DTO 단에서 `@Exclude()` 처리를 확인.

---

- **[INFO]** `mallId` 정규식이 leading/trailing hyphen을 허용 (`-myshop`, `myshop-`)
  - 위치: `integration.dto.ts:264` — `/^[a-z0-9-]{3,50}$/`; `new/page.tsx:232`
  - 상세: RFC 1123 서브도메인 규칙상 leading/trailing hyphen은 유효하지 않다. `https://-myshop.cafe24api.com` 은 연결 실패로 끝나므로 SSRF 관점의 실질적 위험은 없으나, 사용자 입력 오류를 조기에 차단하지 못한다.
  - 제안: `/^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$/` 또는 `/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test() && length >= 3` 로 강화.

---

- **[INFO]** Scope 입력에 대한 서버 측 열거형 검증 없음
  - 위치: `integration-oauth.service.ts` (diff 생략됨) — `scopes: string[]`
  - 상세: `OAuthBeginDto.scopes` 는 임의 문자열 배열을 허용한다. Cafe24 가 자체적으로 무효 스코프를 거부하므로 실제 피해로 이어지지는 않지만, 비정상 스코프가 OAuth state row에 저장된 후 Cafe24 API 오류로 응답하는 구조다.
  - 제안: `service-registry.ts` 의 `CAFE24_SCOPES` 목록으로 서버 단 allowlist 검증 추가.

---

- **[INFO]** `privacy` 리소스 오퍼레이션(`customers_privacy_get`)의 민감 데이터 접근에 애플리케이션 레벨 경고 없음
  - 위치: `privacy.ts:9` — description에만 "requires elevated scope" 명시
  - 상세: `mall.read_privacy` 스코프는 고객 개인 식별 정보를 반환하지만, 이 오퍼레이션 선택 시 워크플로 에디터나 API 레벨에서 별도 경고가 없다. 데이터 규정 준수(GDPR·개인정보보호법) 관점에서 감사 추적이 부재할 수 있다.
  - 제안: `sensitiveData: true` 플래그를 `Cafe24OperationMetadata` 타입에 추가하고 UI에서 경고 배지를 렌더링한다.

---

## 요약

전반적으로 보안 설계가 견고하다. SSRF 방어를 위한 `mall_id` 정규식 검증, 헤더 인젝션 차단을 위한 printable-ASCII 가드, DB 레벨 AES-256-GCM 암호화, OAuth state TTL 10분 등 핵심 보안 통제가 적절히 구현되어 있다. 주요 우려 사항은 프로덕션 코드 내 `OAUTH_STUB_MODE` 백도어와 테스트용 리셋 메서드 노출로, 이는 현재 즉각적 익스플로잇 가능성은 낮지만 장기적으로 운영 환경 설정 오류 또는 내부 위협 시나리오에서 보안 통제 우회로 이어질 수 있어 리팩토링이 권장된다.

## 위험도

**LOW**