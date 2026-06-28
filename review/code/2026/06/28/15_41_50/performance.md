# 성능(Performance) 리뷰 — 인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 fix

## 발견사항

### **[WARNING]** `PublicWebhookThrottleGuard` — full entity 로드로 불필요 컬럼 전송 증가
- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` — `triggerRepository.findOne(...)` 호출부 (`select: { authConfigId: true }` 제거)
- 상세: partial projection(`select: { authConfigId: true }`)을 제거하고 full entity 로드로 변경함으로써 보안 버그(TypeORM null 오판)를 수정했다. 그러나 이로 인해 매 public webhook 요청마다 `Trigger` 엔티티 전체(JSONB `config` 컬럼 포함 가능)가 DB에서 로드된다. Guard의 목적은 `authConfigId IS NULL` 판별뿐이므로 그 이상의 데이터는 Guard 단계에서 불필요하다. W14 최적화(`req.__publicWebhookTrigger`에 첨부 후 `HooksService` 재사용)로 동일 요청 내 DB 왕복 중복은 제거되었지만, DB에서 전송되는 바이트 수 자체는 이전보다 증가한다.
- 제안: TypeORM의 partial select가 null 컬럼을 비-null로 반환하는 버그 재현 조건을 검증한 후, 안전하다면 `select: { authConfigId: true, endpointPath: true, type: true }` 와 같이 Guard에 실제로 필요한 필드 + W14 재사용을 위한 최소 필드만 projection하는 방향으로 개선을 검토한다. 현재 full load는 기능 정확성·보안 면에서 안전하므로 실측 성능 이슈가 확인될 때까지 유지도 합리적이다.

### **[INFO]** `resolveHooksMaxBodyBytes` — 모듈 로드 시 1회 계산, 이후 재사용 적합
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` — `resolveHooksMaxBodyBytes` 함수 + `createHooksBodyParsers` default 파라미터
- 상세: `createHooksBodyParsers(maxBytes = resolveHooksMaxBodyBytes())` 형태로 default 파라미터에 함수 호출이 있다. JavaScript 특성상 이 값은 함수 호출 시마다 재평가된다. 실제로는 `main.ts` 부트스트랩 시 1회만 호출되므로 성능 문제는 없다. `resolveHooksMaxBodyBytes` 자체도 단순 숫자 연산·로그이므로 반복 계산 비용이 무시할 수 있는 수준이다.
- 제안: 현행 유지. 부트스트랩 1회 경로이므로 최적화 필요 없음.

### **[INFO]** `captureRawBody` — 매 요청마다 Buffer를 `req.rawBody`에 할당 (메모리)
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` — `captureRawBody` 함수
- 상세: body-parser의 `verify` 콜백으로 `buf`(파싱 원본 Buffer)를 `req.rawBody`에 할당한다. 전역 파서(`createGlobalBodyParsers`)에도 동일 콜백이 적용되므로 non-webhook 라우트(100KB 한도)를 포함한 모든 요청의 rawBody가 메모리에 보존된다. HMAC 서명 검증이 필요한 webhook 경로 외 라우트에는 rawBody가 불필요하나, 100KB 상한이 있고 Node.js가 요청 완료 후 GC하므로 누수 위험은 없다. 다만 요청 수가 많을 때 전역 파서에서의 rawBody 보존은 단기 메모리 압박을 가중시킬 수 있다.
- 제안: rawBody가 필요한 경로(`/api/hooks/*`)에만 `captureRawBody`를 적용하고, 전역 파서에는 `verify` 없이 등록하는 방안을 검토할 수 있다. 단, 기존 코드베이스 내 `req.rawBody` 소비처가 webhook 경로에 한정되는지 확인이 필요하다. 현재는 100KB 상한과 GC로 실질적 위험이 낮으므로 현행 유지도 수용 가능하다.

### **[INFO]** `HooksService.handleWebhook` — `preloadedTrigger` 폴백 조회 분기 (W14 최적화)
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` — `preloadedTrigger !== undefined ? preloadedTrigger : await this.triggerRepository.findOne(...)` 분기
- 상세: Guard(`PublicWebhookThrottleGuard`)가 조회한 trigger를 `req.__publicWebhookTrigger`로 전달해 서비스가 재사용하는 W14 패턴이 올바르게 구현되었다. 공개 webhook 경로에서는 DB 왕복이 1회로 감소한다. 인증 webhook 경로(Guard를 거치지 않는 경우)는 `preloadedTrigger`가 `undefined`이므로 기존 조회 경로로 폴백 — 동작 정확성이 보장된다.
- 제안: 현행 유지. 최적화가 올바르게 적용되었다.

### **[INFO]** e2e 테스트 — 대용량 페이로드 인메모리 생성
- 위치: `/codebase/backend/test/webhook-trigger.e2e-spec.ts` — 케이스 J(512KB), K(>1MB), M(>1MB)
- 상세: `'x'.repeat(512 * 1024)`, `'x'.repeat(1100 * 1024)` 등 대용량 문자열을 테스트 내에서 즉시 생성해 메모리에 적재한다. e2e 환경에서는 테스트당 1회이고 GC 대상이므로 실운영 영향 없음. 테스트 목적상 필수적인 패턴이다.
- 제안: 현행 유지. e2e 특성상 수용 가능하며 명시적으로 경계값을 생성하는 것이 의도적이다.

### **[INFO]** `spec-link-integrity.test.ts` — 30초 타임아웃 확대
- 위치: `/codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` — `}, 30_000)` 추가
- 상세: 전체 spec 파일셋을 동기적으로 스캔하는 테스트에 30초 타임아웃을 부여했다. 스캔 자체가 O(n) 파일 I/O이며 병렬 CI 환경에서 CPU 경합 시 flaky timeout이 발생한다는 설명이 주석에 명시되어 있다. 테스트 로직 변경 없이 타임아웃만 확대한 것이다. 스캔을 비동기화하거나 점진적으로 처리하는 구조 변경은 별도 리팩토링 범위이다.
- 제안: 현행 유지. CI 안정성을 위한 적절한 조치다.

---

## 요약

이번 변경의 핵심 성능 관련 사항은 `PublicWebhookThrottleGuard`의 partial select 제거로 인한 full entity 로드 전환이다. 이는 보안 버그 수정을 위한 불가피한 조치이며, W14 패턴(`req.__publicWebhookTrigger` 첨부 + `HooksService` 재사용)이 DB 왕복 중복을 제거해 공개 webhook 경로의 net DB 비용 증가를 상쇄한다. `captureRawBody`가 전역 파서에도 적용되어 non-hooks 요청에도 rawBody가 보존되는 점은 단기 메모리 미압상 미미하나 장기적으로 hooks 경로로 범위를 좁히는 것이 좋다. 알고리즘 복잡도, N+1 쿼리, 블로킹 I/O, 캐싱 무효화, 불필요한 연산 측면에서는 신규 도입 문제가 없으며, `buildBodyParsers` 공통 팩토리 추출로 코드 중복도 정리되었다. 전반적으로 성능 관점의 위험은 낮다.

---

## 위험도

LOW

STATUS: SUCCESS
