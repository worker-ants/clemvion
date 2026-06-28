# 아키텍처(Architecture) 리뷰 — 인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 fix

## 발견사항

### **[INFO]** `hooks-body-parser.ts` — bootstrap 레이어 책임 분리 적절, SRP 준수
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts`
- 상세: body-parser 정책(한도 상수·env 해석·미들웨어 팩토리)을 `bootstrap/` 하위 별도 모듈로 격리해 `main.ts` 부트스트랩 진입점과 파서 정책 로직의 책임을 분리했다. `resolveHooksMaxBodyBytes(env)` 순수 함수 추출로 env 주입 단위 테스트가 가능하며, `buildBodyParsers(maxBytes)` 공통 팩토리 추출로 json/urlencoded 미들웨어 쌍 구성 책임이 단일 위치에 집중돼 있다. `createHooksBodyParsers` / `createGlobalBodyParsers` 는 각각 다른 정책 컨텍스트(hooks vs 전역)를 표현하는 명확한 공개 인터페이스다. 전체적으로 개방-폐쇄 원칙 관점에서도 양호하다 — 새로운 라우트 스코프 정책을 추가하려면 새 팩토리 함수만 추가하면 된다.
- 제안: 현행 유지.

### **[INFO]** `GlobalExceptionFilter` — http-errors 4xx 매핑 추가, 단일 책임 유지
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts`
- 상세: NestJS `HttpException` 이 아닌 body-parser 의 `PayloadTooLargeError`(http-errors 객체)는 기존 `instanceof HttpException` 분기에 포함되지 않으므로, `exception instanceof Error` 내에서 `status`/`statusCode` duck-typing 으로 4xx 를 추출해 매핑하는 `mapHttpErrorLike` 헬퍼를 추가했다. `HttpErrorLike` 타입 alias 추출·`mapHttpErrorLike` private 메서드 분리로 `catch()` 최상위 흐름이 평탄하게 유지된다. 에러 분류·직렬화 단일 책임을 Filter 내부에서 유지하면서 4xx http-errors 를 추가 처리 경로로 흡수한 구조는 레이어 책임 관점에서 올바르다. `getCodeFromStatus` private 메서드에 `case 413` 추가는 기존 패턴과 일관적이다.
- 제안: 현행 유지.

### **[WARNING]** `GlobalExceptionFilter` — 4xx http-error 메시지 직접 노출 가능성
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` — `mapHttpErrorLike` 반환값의 `message: exception.message`
- 상세: 4xx http-error 메시지를 응답에 그대로 싣는다(`message = exception.message`). 현재 이 경로를 타는 오류는 body-parser 의 `PayloadTooLargeError`("request entity too large") 뿐이고 무해하다. 그러나 `mapHttpErrorLike` 분기는 `status >= 400 && < 500` 전체를 커버하므로, 향후 다른 http-errors 의존 미들웨어가 추가될 경우 내부 경로·정보가 포함된 메시지가 클라이언트에 노출될 가능성이 있다. 이는 아키텍처 확장점이 열려 있는 상태에서의 잠재적 보안 회귀다.
- 제안: 현행 허용 가능한 수준. 향후 http-errors 의존 미들웨어가 추가될 경우 message sanitize 레이어(허용 목록 or 메시지 교체) 도입 검토 권장.

### **[INFO]** `main.ts` — body-parser 미들웨어 등록 순서, idempotency 가드 의존 명문화
- 위치: `/codebase/backend/src/main.ts` — hooks 파서 → 전역 파서 순서 등록 블록
- 상세: hooks(1MB) 를 먼저 등록한 뒤 전역(100KB) 을 등록하는 순서는 body-parser 의 `req._body` idempotency 가드(재파싱 skip) 에 의존한다. 이는 body-parser 의 내부 구현 상세이나, 사실상 표준 동작으로 안정적이다. 주석이 이 의존성·이유(Nest 기본 파서 skip 함정 회피)·rawBody 보존 방식 모두를 명시해 아키텍처 결정 근거가 코드 위치에 문서화돼 있다. `bodyParser: false` 옵션과 두 파서 명시 등록의 조합이 레이어 책임(인프라 초기화 vs 라우트 핸들링) 분리를 잘 구현한다.
- 제안: 현행 유지. body-parser 라이브러리 버전 업그레이드 시 `req._body` 가드 동작 재검증 필요.

### **[INFO]** W14 패턴 — Guard → Controller → Service 트리거 재사용, 타입 계약 명시
- 위치: `hooks.controller.ts` + `hooks.service.ts` + `public-webhook-throttle.guard.ts`
- 상세: Guard 가 조회한 full trigger entity 를 `req.__publicWebhookTrigger`(`PublicWebhookReqExtension` 인터페이스 export) 에 첨부하고, Controller 가 이를 추출해 Service 의 `preloadedTrigger?: Trigger | null` 선택적 파라미터로 전달하며, Service 는 `preloadedTrigger !== undefined ? preloadedTrigger : await findOne(...)` 로 단락한다. 이 패턴은 req 객체를 암묵적 채널로 사용하는 트레이드오프가 있으나, `PublicWebhookReqExtension` 인터페이스 export 로 타입 계약이 명시돼 암묵성이 경감된다. Service 메서드 시그니처(`preloadedTrigger?: Trigger | null`)가 선택적(optional)이라 Guard 없이 Service 를 직접 호출하는 경로(예: 다른 컨트롤러, 테스트)에서도 폴백이 보장된다 — 인터페이스 분리 원칙 관점에서 올바르다.
- 제안: 현행 유지. 단, 이 패턴이 확장되어 여러 Guards 가 req 에 데이터를 첨부하는 형태가 된다면 공통 req 확장 타입 집계 모듈(예: `request-extensions.d.ts`) 도입을 고려.

### **[WARNING]** `PublicWebhookThrottleGuard` — SRP 관점 복합 책임, 기술 부채 명시됨
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`
- 상세: Guard 가 (1) trigger 조회 + 공개 여부 판정, (2) body 크기 제한(32KB), (3) IP 단위 rate-limit 세 책임을 가진다. 이 세 관심사는 모두 "공개 webhook 남용 방어"라는 공통 도메인에 속하므로 현재 범위에서 합리적이나, Guard 파일 내에 `extractClientIp` 유틸리티 함수가 export 돼 모듈 경계가 약간 모호하다. plan 파일에 "extractClientIp 의 `auth/utils/client-ip` 이동" 이 기술 부채로 명시 추적 중이다.
- 제안: 현행 단기 허용. `extractClientIp` 를 `auth/utils/client-ip` 로 이동하는 중기 리팩토링이 완료되면 Guard 파일의 모듈 경계가 명확해진다. 세 책임이 더 복잡해지면(예: 글로벌 rate-limit 정책 추가) 별도 Guard 로 분리 검토.

### **[INFO]** `PublicWebhookThrottleGuard` full entity 로드 전환 — 보안 정확성 우선, 성능 트레이드오프 명시
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` — `findOne` 에서 `select` partial projection 제거
- 상세: `select: { authConfigId: true }` partial projection 이 TypeORM 에서 NULL 컬럼을 비-NULL 로 잘못 반환하는 버그를 수정하기 위해 full entity 로드로 전환했다. 보안 정확성(공개 webhook 보호 적용 여부 판정) 이 성능보다 우선하는 올바른 결정이다. W14 캐시(동일 요청 내 DB 재조회 제거)가 적용돼 webhook 당 1회 조회로 제한됐다.
- 제안: TypeORM 의 partial projection null 버그 재현 조건이 명확히 파악된 후, 필요한 최소 컬럼만 select 하는 방향을 실측 성능 이슈 발생 시 검토.

### **[INFO]** 두 레이어 413 경계 설계 — 스트림 레벨 vs 파싱 후 레벨 책임 분리 명확
- 위치: `hooks-body-parser.ts`(스트림 레벨 1MB) + `public-webhook-throttle.guard.ts`(파싱 후 32KB)
- 상세: 1MB body-parser 게이트(파싱 시점, 스트림 레벨)와 32KB Guard 게이트(파싱 후, body 객체 레벨) 두 레이어가 직렬로 동작한다. 각 레이어의 책임이 명확히 분리돼 있고 — body-parser 는 스트림 수준의 방어선, Guard 는 도메인 정책 수준의 방어선 — e2e J/K/L 테스트가 이 상호작용을 충분히 검증한다. `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 와 `PAYLOAD_TOO_LARGE` 두 에러 코드가 공개/인증 도메인 경계와 일치한다.
- 제안: 현행 유지.

### **[INFO]** `spec-link-integrity.test.ts` — 타임아웃 조정, 구조 변경 없음
- 위치: `/codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`
- 상세: 30s 타임아웃 추가는 CI 병렬 실행 CPU 경합으로 인한 flaky timeout 대응. 테스트 아키텍처 변경 없음.
- 제안: 현행 유지.

---

## 요약

이번 변경의 아키텍처 관점 핵심은 세 가지다. 첫째, webhook body-parser 정책을 `bootstrap/hooks-body-parser.ts` 로 격리해 레이어 책임(인프라 초기화 vs 정책)을 분리하고, factory 패턴과 순수 함수 추출로 테스트 가능성과 확장성을 확보했다. 둘째, `GlobalExceptionFilter` 에 `mapHttpErrorLike` 헬퍼를 추가해 NestJS HttpException 이 아닌 4xx http-errors 를 표준 에러 봉투로 흡수하되, 단일 책임 경계를 유지했다. 셋째, Guard → Controller → Service 간 W14 trigger 재사용 패턴이 `PublicWebhookReqExtension` 인터페이스로 타입 계약을 명시하면서 구현됐다. WARNING 으로 지목되는 두 항목 — `GlobalExceptionFilter` 의 4xx 메시지 직접 노출(향후 http-errors 추가 시 잠재적 보안 회귀)과 `PublicWebhookThrottleGuard` 의 SRP 경계(trigger 조회/body 크기/rate-limit 혼재) — 은 모두 현재 범위에서 허용 가능하며 plan 에 기술 부채로 명시 추적 중이다. 전체적으로 레이어 책임 분리, 모듈 경계, 의존성 방향이 적절하고 확장성 측면에서도 무리가 없는 구조다.

---

## 위험도

LOW

STATUS: SUCCESS
