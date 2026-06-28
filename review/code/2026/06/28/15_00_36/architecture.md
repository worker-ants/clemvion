# 아키텍처 리뷰 — 인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 fix

## 발견사항

### **[INFO]** `hooks-body-parser.ts` — bootstrap 레이어 책임 분리 적절
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts`
- 상세: body-parser 설정을 `bootstrap/` 에 별도 모듈로 분리해 `main.ts` 의 부트스트랩 로직과 파서 정책 로직을 명확히 구분. `createHooksBodyParsers` / `createGlobalBodyParsers` factory 패턴으로 테스트 가능성 확보. `resolveHooksMaxBodyBytes` 순수 함수 분리로 env-injection 단위 테스트 가능. SRP 준수.
- 제안: 현행 유지.

### **[INFO]** `GlobalExceptionFilter` — http-errors 4xx 매핑 추가, 단일 책임 유지
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` L68–91
- 상세: body-parser 의 `PayloadTooLargeError`(http-errors 객체)는 NestJS `HttpException` 이 아니므로 기존 `instanceof HttpException` 분기에 포함되지 않는다. 신규 코드가 `exception instanceof Error` 분기에서 `status`/`statusCode` duck-typing 으로 4xx 를 추출해 올바르게 처리. 에러 분류·직렬화 단일 책임 유지. `getCodeFromStatus` private 메서드에 `413` case 추가로 코드 집중도 높음.
- 제안: 현행 유지.

### **[WARNING]** `GlobalExceptionFilter` — http-errors 4xx 메시지 직접 노출 시 내부 정보 노출 가능성
- 위치: `/codebase/backend/src/common/filters/http-exception.filter.ts` L797–803
- 상세: 4xx `exception.message` 를 응답에 그대로 노출한다(`message = exception.message`). body-parser 의 `PayloadTooLargeError` 메시지("request entity too large")는 무해하나, 향후 다른 http-errors 라이브러리가 이 경로를 타면 내부 경로·스택 정보가 포함된 메시지가 클라이언트에 노출될 위험이 있다. 현재 범위는 4xx 에 한정돼 5xx 와 달리 마스킹하지 않는 설계이며 이는 의도적으로 보이나, 미래 확장 시 보안 회귀 가능.
- 제안: 허용가능한 수준. 단, 향후 http-errors 의존 라이브러리 추가 시 메시지 sanitize 레이어 검토 권장.

### **[INFO]** `main.ts` — body-parser 미들웨어 등록 순서 명시적 문서화
- 위치: `/codebase/backend/src/main.ts` L991–996
- 상세: hooks(1MB) 먼저 등록 후 전역(100KB) 등록하는 순서는 body-parser idempotency 가드(`req._body`)에 의존하는 암묵적 동작이다. 주석이 이 의존성을 명시적으로 설명하고 있어 가독성 확보. `bodyParser: false` 로 Nest 내장 파서를 끄는 결정과 이유도 주석에 명시돼 있음.
- 제안: 현행 유지. `req._body` 내부 필드 의존은 body-parser 내부 구현 상세이므로 라이브러리 버전 변경 시 재검증 필요하나, body-parser 는 사실상 표준 동작으로 안정적.

### **[WARNING]** `PublicWebhookThrottleGuard` — full entity 로드로 인한 성능 증가
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L71–74
- 상세: 버그 수정을 위해 `select: { authConfigId: true }` partial projection 을 제거하고 full entity 로드로 변경했다. 이는 `authConfigId` null 판별 버그를 올바르게 수정하나, `Trigger` 엔티티에 JSONB 컬럼(`config`)이나 큰 필드가 있다면 매 webhook 요청마다 불필요한 데이터를 로드하게 된다. W14 패턴(Guard 가 조회한 trigger 를 `req.__publicWebhookTrigger` 에 첨부해 HooksService 재사용)이 이 비용을 일부 상쇄하지만 DB 전송량 자체는 증가.
- 제안: Trigger 엔티티에서 `authConfigId` null/non-null 판별에 필요한 최소 필드만 select 하는 방향으로 개선 검토. 단, partial projection 이 TypeORM 에서 null 컬럼을 비-null 로 반환하는 버그의 재현 조건을 명확히 파악한 후에 적용해야 한다. 현재 full load 는 안전하고 정확한 해법이므로 성능이 실측으로 문제가 되지 않는 한 현행 유지도 합리적.

### **[INFO]** `PublicWebhookThrottleGuard` — 책임 범위 명확, W14 재사용 패턴 적절
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`
- 상세: Guard 가 trigger 조회 + body 크기 제한 + IP rate-limit 세 책임을 가지는 것이 SRP 관점에서 약간 복합적이나, 이 세 검사가 모두 "공개 webhook 남용 방어"라는 단일 도메인 개념에 속한다. `req.__publicWebhookTrigger` 첨부(W14)로 다운스트림 HooksService DB 재조회를 제거한 것은 올바른 최적화이나 Guard-Service 간 암묵적 채널(req 객체 변이) 형성이라는 트레이드오프를 수반.
- 제안: 현행 유지. W14 패턴은 `PublicWebhookReqExtension` 인터페이스 export 로 타입 계약이 명시돼 있어 암묵성이 경감됨.

### **[INFO]** `extractClientIp` 래퍼 함수 — 모듈 경계 약간 모호
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L1436–1444
- 상세: `extractClientIp` 가 `public-webhook-throttle.guard.ts` 파일 내에 export 돼 있는데, 이는 Guard 파일에 유틸리티 함수가 혼재하는 구조다. 주석에 "04 후속: `auth/utils/client-ip` 단일 구현으로 통합" 이 기술돼 있어 리팩토링 의도가 명시적으로 기재된 기술 부채.
- 제안: 기술 부채로 명시 추적 중이므로 현재 변경 범위에서 큰 문제 없음. 향후 통합 시 Guards 모듈이 auth 유틸에 의존하는 방향성이 올바름.

### **[INFO]** 두 레이어 413 경계 — 설계 의도 명확, 테스트 커버리지 충분
- 위치: `hooks-body-parser.ts` + `public-webhook-throttle.guard.ts` 상호작용
- 상세: 1MB body-parser 게이트(파싱 시점, 스트림 레벨)와 32KB Guard 게이트(파싱 후, body 객체 레벨) 두 레이어가 직렬로 동작. 순서 의존성이 있으나 e2e 테스트 J/K/L 세 케이스가 이를 충분히 검증. `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 와 `PAYLOAD_TOO_LARGE` 두 에러코드 분리도 공개/인증 webhook 도메인 경계와 일치.
- 제안: 현행 유지.

### **[INFO]** `spec-link-integrity.test.ts` — 타임아웃 설정 변경, 구조적 문제 없음
- 위치: `/codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` L1976–1980
- 상세: 30s 타임아웃 추가는 CI 병렬 실행 시 발생하는 flaky timeout 대응. 테스트 자체의 아키텍처나 구조에 변화 없음.
- 제안: 현행 유지.

---

## 요약

이번 변경은 webhook body-parser 레이어 분리(1MB hooks 스코프 vs 100KB 전역)와 공개 webhook 보호 우회 버그 수정이 핵심이다. `hooks-body-parser.ts` 는 bootstrap 레이어에 올바르게 격리돼 있고, factory 패턴과 순수 함수 분리로 테스트 가능성이 확보됐다. `GlobalExceptionFilter` 의 http-errors 4xx 매핑 추가는 기존 예외 분류 단일 책임을 유지하면서 표준화 갭을 메운다. `PublicWebhookThrottleGuard` 의 full entity 로드 전환은 partial projection TypeORM 버그를 안전하게 수정하며, W14 req 첨부 패턴으로 DB 왕복 중복을 제거했다. 두 레이어 413 경계(파서 레벨 + Guard 레벨)는 e2e J/K/L 테스트로 충분히 가드된다. 전체적으로 레이어 책임 분리, 결합도, 확장성 측면에서 적절한 구조이며, `GlobalExceptionFilter` 의 4xx 메시지 직접 노출과 `Trigger` full entity 로드라는 두 WARNING 은 모두 현재 범위에서 허용 가능한 수준이다.

---

## 위험도

LOW
