# 아키텍처(Architecture) 리뷰 — 인증 webhook 1MB body 게이트 (옵션 C) + 공개 webhook 보호 우회 fix (fresh review)

## 발견사항

### **[INFO]** `hooks-body-parser.ts` — bootstrap 레이어 책임 분리 올바름, Factory 패턴 적절
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts`
- 상세: body-parser 설정 로직을 `src/bootstrap/` 에 독립 모듈로 격리해 `main.ts` 부트스트랩 진입점의 단일 책임을 유지한다. `createHooksBodyParsers` / `createGlobalBodyParsers` 는 Factory 패턴으로 생성 로직을 캡슐화하고 `maxBytes` 주입을 통해 테스트 가능성을 확보한다. `resolveHooksMaxBodyBytes(env?)` 는 순수 함수로 환경 의존을 외부 주입(기본값 `process.env`)으로 처리해 단위 테스트가 가능하다. `HOOKS_MAX_BODY_BYTES_CEILING` 상한 클램프로 운영 실수에 대한 방어 레이어도 갖춘다. SOLID SRP/OCP 준수.
- 제안: 현행 유지.

### **[INFO]** `GlobalExceptionFilter` — 단일 책임 유지, 에러 분류 캡슐화 적절
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts`
- 상세: `HttpErrorLike` 타입과 `mapHttpErrorLike` private 헬퍼를 추출해 NestJS `HttpException` 이 아닌 http-errors 4xx 경로를 명확히 분리했다. `getCodeFromStatus` 에 413 케이스 추가는 status→code 매핑 책임이 한 곳에 집중된다는 OCP 준수 패턴이다. 이중 캐스팅 제거(`HttpErrorLike` 타입)로 코드 가독성도 개선됐다.
- 제안: 현행 유지.

### **[INFO]** `main.ts` body-parser 등록 순서 의존성 — 적절한 문서화
- 위치: `/codebase/backend/src/main.ts` (bootstrap 섹션)
- 상세: hooks(1MB) → 전역(100KB) 순서 등록은 body-parser 의 `req._body` idempotency 가드에 의존한다. 이 의존은 라이브러리 내부 구현 상세이므로 잠재적 취약점이 될 수 있으나, 주석이 이 메커니즘과 의존 근거를 명시적으로 기술하고 있어 향후 라이브러리 업그레이드 시 검증 포인트가 명확하다. `HOOKS_ROUTE_PREFIX` 상수 export 로 경로 하드코딩이 제거돼 단일 진실 원칙(SoT)도 준수된다.
- 제안: 현행 유지. 단, body-parser 메이저 버전 업그레이드 시 idempotency 가드 동작을 e2e K/L 테스트로 재검증할 것.

### **[INFO]** Guard-Service 간 `req` 객체 채널(W14 패턴) — 타입 계약으로 암묵성 경감
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`, `/codebase/backend/src/modules/hooks/hooks.controller.ts`, `/codebase/backend/src/modules/hooks/hooks.service.ts`
- 상세: Guard 가 조회한 `Trigger` 를 `req.__publicWebhookTrigger` 에 첨부하고 Controller 가 Service 로 전달하는 W14 패턴은 Guard-Service 간 암묵적 데이터 채널을 형성한다. 이는 Guard 와 Service 사이의 결합도를 높이는 트레이드오프다. 단, `PublicWebhookReqExtension` 인터페이스 export 와 Controller 의 타입 선언(`req: ... & PublicWebhookReqExtension`)으로 이 채널이 명시적 타입 계약으로 표현돼 있다. `HooksService.handleWebhook(preloadedTrigger?: Trigger | null)` 의 선택적 파라미터 설계는 Guard 가 없는 경로(예: 직접 테스트, 다른 컨트롤러)에서도 서비스가 독립적으로 동작한다는 점에서 DIP 를 약하게나마 준수한다.
- 제안: 현행 유지. 추후 Guard 와 Service 간 결합이 더 복잡해지면 request-scoped cache provider 도입을 검토할 수 있으나 현재 복잡도에서는 과도한 추상화다.

### **[WARNING]** `PublicWebhookThrottleGuard` — Guard 의 복합 책임(SRP 경계 주의)
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`
- 상세: 이 Guard 는 (1) trigger 조회 및 공개/인증 판별, (2) body 크기 검사(`measureBodyBytes`), (3) IP rate-limit 소비(`quota.consumeStart`) 세 가지 책임을 한 클래스에서 수행한다. 현재는 모두 "공개 webhook 남용 방어"라는 단일 도메인에 속하지만, 각 책임이 독립 변경 이유를 가진다(예: rate-limit 정책 변경은 body 크기 정책에 무관). `extractClientIp` 유틸 함수가 Guard 파일 내에 export 돼 있는 것도 모듈 경계 흐림의 징후다. 주석에 리팩토링 의도가 명시돼 있어 기술 부채로 추적 중이나, 파일이 더 커지면 단일 책임 위반이 유지보수 비용으로 전환될 위험이 있다.
- 제안: 단기 허용 가능. 중기 리팩토링 시 (1) `extractClientIp` 를 `auth/utils/client-ip` 로 이동, (2) body 크기 검사를 별도 Guard 나 별도 메서드로 분리 검토. 기술 부채 plan 에 추적 항목 등재 권장.

### **[INFO]** 두 레이어 413 경계 설계 — 레이어 책임 명확, e2e 커버리지 충분
- 위치: `hooks-body-parser.ts` (Express 미들웨어 레이어) + `public-webhook-throttle.guard.ts` (NestJS Guard 레이어)
- 상세: 1MB 제한은 스트림 파싱 단계(Express 미들웨어)에서, 32KB 제한은 파싱 완료 후 Guard 단계에서 순차 적용된다. 두 경계의 에러 코드가 `PAYLOAD_TOO_LARGE`(파서 레이어) / `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(Guard 레이어)로 명확히 구분돼 있어 클라이언트가 맥락을 파악할 수 있다. e2e J(512KB HMAC 통과), K(>1MB 파서 거부), L(64KB Guard 거부), M(인증 >1MB 파서 거부) 네 케이스가 이 순서 의존성을 충분히 가드한다.
- 제안: 현행 유지.

### **[INFO]** `http-exception.filter.ts` — 4xx http-errors 메시지 노출, 허용 가능 수준
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` `mapHttpErrorLike` 메서드
- 상세: 4xx 경로에서 `exception.message` 를 응답 body 에 그대로 포함한다. 현재 이 경로를 타는 발행처는 body-parser 뿐이며(`"request entity too large"` — 무해), `logger.warn` 으로 원본 메시지 로깅도 추가됐다(W5 해소). 향후 다른 http-errors 라이브러리가 이 경로를 타면 내부 경로 정보가 포함된 메시지가 노출될 수 있으나, 5xx 는 마스킹하고 4xx 는 클라이언트에 맥락을 제공하는 설계 선택으로 현재 수준에서 허용 가능하다.
- 제안: 현행 유지. 향후 http-errors 의존 미들웨어 추가 시 메시지 sanitize 또는 허용 목록 방식 도입 검토.

### **[INFO]** `spec-link-integrity.test.ts` — 타임아웃 변경, 구조적 문제 없음
- 위치: `/codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`
- 상세: 30s 타임아웃은 CI 병렬 실행 시 CPU 경쟁에 의한 flaky 대응이며 테스트 아키텍처 변경 없음. 구조적 영향 없다.
- 제안: 현행 유지.

---

## 요약

이번 변경은 webhook body-parser 레이어를 라우트 스코프로 분리하고(1MB hooks vs 100KB 전역), 공개 webhook 보호 우회 버그(TypeORM partial projection 오반환)를 수정하며, GlobalExceptionFilter 에 4xx http-errors 표준 매핑을 추가하는 세 축으로 구성된다. `hooks-body-parser.ts` 는 bootstrap 레이어에 올바르게 격리돼 Factory/순수함수 패턴으로 테스트 가능성을 확보하며 SRP 를 준수한다. `GlobalExceptionFilter` 의 `mapHttpErrorLike` 헬퍼와 `HttpErrorLike` 타입 추출은 에러 분류 단일 책임을 유지하며, `getCodeFromStatus` 의 413 케이스 추가는 코드 집중도를 높인다. W14 패턴(Guard→Controller→Service trigger 재사용)은 `PublicWebhookReqExtension` 타입 계약으로 암묵적 채널을 명시화해 수용 가능한 수준의 결합도를 유지한다. 유일한 구조적 주의점은 `PublicWebhookThrottleGuard` 가 trigger 조회·body 크기·IP rate-limit 세 책임을 보유하는 SRP 경계인데, 도메인 응집도가 동일하고 기술 부채 추적이 이미 돼 있어 현재 복잡도에서는 허용 가능하다. 전체적으로 레이어 책임 분리·결합도·확장성 측면에서 적절한 구조다.

---

## 위험도

LOW
