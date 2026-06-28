# Performance Review

## 발견사항

### [WARNING] W14 캐시 의도 미구현 — Guard → Service DB 재조회 미제거

- **위치**: `codebase/backend/src/modules/hooks/hooks.service.ts:99` / `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts:84`
- **상세**: Guard(`PublicWebhookThrottleGuard`)가 `req.__publicWebhookTrigger`에 full entity를 첨부하고 주석에 "HooksService가 동일 엔드포인트 DB 재조회 불필요(W14)"라고 명시하지만, `HooksService.handleWebhook`(line 99)은 `req.__publicWebhookTrigger`를 읽지 않고 `this.triggerRepository.findOne({ where: { endpointPath, type: 'webhook' } })`를 독립적으로 재수행한다. `hooks.controller.ts`도 `__publicWebhookTrigger`를 서비스에 전달하지 않는다. 결과적으로 모든 webhook 요청에서 동일 `trigger` row에 대한 DB 왕복이 2회 발생한다. 이 중복 조회는 낮은 레이턴시가 요구되는 WH-NF-01(200ms 이내 응답) 경로에서 불필요한 비용이다.
- **제안**: `HooksController.receiveWebhook`에서 `req.__publicWebhookTrigger`를 꺼내 `HooksService.handleWebhook`에 선택적 파라미터(`preloadedTrigger?: Trigger | null`)로 전달하고, 서비스 내부에서 `preloadedTrigger ?? await this.triggerRepository.findOne(...)` 패턴으로 DB 조회를 단락시킨다. 또는 인터페이스를 공유하여 컨트롤러가 `req`에서 추출한 뒤 전달하도록 한다.

---

### [WARNING] full entity 로드로 인한 불필요 컬럼 전송 증가

- **위치**: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts:72-74`
- **상세**: 버그 수정 전 `select: { authConfigId: true }` partial projection은 버그(null 대신 비-null 반환)가 있었지만 네트워크·역직렬화 비용은 최소였다. 교정 후 full entity 로드는 `notificationSecretV2`, `chatChannelTokenV2`, `config(JSONB)`, `notificationLastError(TEXT)`, `chatChannelLastError(TEXT)` 등 Guard가 실제로 필요하지 않은 컬럼까지 전송한다. Trigger 엔티티에는 JSONB 타입의 `config` 컬럼과 TEXT 타입의 large 필드들이 있어 행당 수 KB에 달할 수 있다. Guard가 판단에 필요한 필드는 `authConfigId`와 W14용 캐시를 위한 기타 필드들이다.
- **제안**: `select`에 Guard 로직과 HooksService가 실제로 사용하는 최소 컬럼 집합을 명시한다. 구체적으로 Guard 자체는 `authConfigId`만 필요하고, W14 캐시 목적이라면 HooksService가 사용하는 컬럼들을 추가로 포함한다. 단, TypeORM의 `select` partial projection에서 null-컬럼 반환 버그가 재발하지 않도록 검증이 선행되어야 한다(원래 버그의 원인이 된 패턴이기 때문). 가장 안전한 대안은 raw query나 `queryBuilder().select([...]).where(...)` 패턴이다.

---

### [INFO] `createHooksBodyParsers` 기본 인자 평가 시점 — 앱 기동 시 1회 env 읽기

- **위치**: `codebase/backend/src/bootstrap/hooks-body-parser.ts:62`
- **상세**: `createHooksBodyParsers(maxBytes: number = resolveHooksMaxBodyBytes())`의 기본값은 함수가 호출될 때마다 평가된다. `main.ts`에서 `app.use('/api/hooks', ...createHooksBodyParsers())`로 한 번만 호출되므로 런타임에 반복 계산이 발생하지는 않는다. 그러나 `resolveHooksMaxBodyBytes()`가 기본 파라미터 자리에서 매 호출마다 `process.env`를 읽는 구조이므로, 만약 테스트 등에서 `createHooksBodyParsers()`를 반복 호출할 경우 환경 변수 접근이 반복된다. 실제 운영에는 영향 없음.
- **제안**: 현재 호출 패턴(기동 시 1회)에서는 문제없다. 필요 시 `HOOKS_MAX_BODY_BYTES` 상수를 모듈 로드 시 1회만 계산하도록 `export const RESOLVED_HOOKS_MAX_BODY_BYTES = resolveHooksMaxBodyBytes()`로 상수화하면 명시적이다.

---

### [INFO] `captureRawBody` — 모든 요청에 rawBody Buffer 복사 발생 (전역 파서에도 적용)

- **위치**: `codebase/backend/src/bootstrap/hooks-body-parser.ts:42-50` (전역 파서 포함)
- **상세**: `createGlobalBodyParsers`도 `verify: captureRawBody`를 사용하므로 non-webhook API 요청 전체에서도 rawBody Buffer가 `req.rawBody`에 저장된다. webhook 외 라우트는 HMAC 서명 검증이 없으므로 이 복사는 불필요하다. 메모리 관점에서 non-webhook 요청의 body 크기(최대 100KB)만큼의 Buffer가 GC 시점까지 요청 객체에 유지된다.
- **제안**: 성능 민감 환경이라면 `createGlobalBodyParsers`에서 `verify: captureRawBody`를 제거하거나, 경로를 구분하는 별도 `verify` 함수를 사용한다. 다만 현재 100KB 기본 한도에서는 실질 영향이 제한적이므로, 요청 볼륨이 높을 경우에만 최적화를 고려한다.

---

### [INFO] `measureBodyBytes` — rawBody 없는 경우 `JSON.stringify` 직렬화 비용

- **위치**: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts:131-143`
- **상세**: `rawBody`가 없으면 `JSON.stringify(body)`로 body 크기를 추정한다. 이미 body-parser가 파싱한 객체를 다시 직렬화하므로 O(n) 작업이 추가된다. 그러나 `createHooksBodyParsers`가 `verify: captureRawBody`로 rawBody를 항상 캡처하므로, 정상 경로에서는 `rawBody` 분기(line 132)로 즉시 반환되어 JSON.stringify 경로에 진입하지 않는다.
- **제안**: 현재 설계에서는 fallback 경로이므로 추가 조치 불필요. rawBody 보존이 실패하는 예외 상황(파서 미적용 등)에만 진입하므로 허용 가능한 트레이드오프.

---

### [INFO] e2e 테스트 — 512KB / 1.1MB 인라인 문자열 생성

- **위치**: `codebase/backend/test/webhook-trigger.e2e-spec.ts:1811` (`'x'.repeat(512 * 1024)`), `1829` (`'x'.repeat(1100 * 1024)`)
- **상세**: `'x'.repeat(512 * 1024)` → `JSON.stringify` → HTTP 전송 순서로 약 512KB/1.1MB의 문자열이 테스트 프로세스 메모리에 생성된다. e2e 컨테이너 환경에서 단발성으로 실행되므로 실운영 성능에 무관하지만, 병렬 테스트 실행 환경에서 메모리 압박 요인이 될 수 있다.
- **제안**: e2e 테스트 단일 파일에서 사용이므로 허용 가능. 메모리 민감 CI 환경이라면 별도 파일로 분리하여 격리 실행을 고려.

---

### [INFO] `spec-link-integrity` 테스트 timeout 30초 — 동기 파일시스템 스캔

- **위치**: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts:1046-1049`
- **상세**: `findBrokenLinks(root)`가 전체 spec 디렉터리를 동기적으로 스캔하고 timeout을 5초에서 30초로 확장했다. spec 파일 수가 100개 이상으로 증가함에 따라 파일 I/O 스캔 시간이 증가하는 추세다. 동기 파일 I/O는 Node.js 이벤트 루프를 블로킹하며, 스캔 대상 파일이 계속 증가할수록 timeout을 계속 늘려야 하는 패턴이 된다.
- **제안**: 30초 timeout은 현재 파일 수에서 충분한 여유를 확보한다. 장기적으로는 `findBrokenLinks`를 비동기 I/O로 전환하거나, 변경된 파일만 점검하는 incremental 스캔을 고려한다.

---

## 요약

이번 변경에서 성능 측면의 핵심 이슈는 W14 설계 의도(Guard가 조회한 trigger를 HooksService가 재사용)가 실제 코드에서 연결되지 않아 모든 webhook 요청마다 동일 `trigger` row에 대한 DB 왕복이 2회 발생한다는 점이다. Guard의 `req.__publicWebhookTrigger` 첨부 패턴은 올바르게 구현되었으나 컨트롤러/서비스 측에서 이를 소비하는 코드가 누락되어 설계 의도가 사장된 상태다. 또한 버그 수정(null 오판 해소)을 위해 full entity 로드로 전환한 것은 필요하나, Guard가 실제로 필요한 컬럼(`authConfigId`)보다 훨씬 넓은 범위를 로드하므로 향후 최소 컬럼 select로 정제가 권장된다. 나머지 발견사항(rawBody 전역 캡처, JSON.stringify fallback, 테스트용 대용량 문자열)은 운영 영향이 제한적인 INFO 수준이다.

## 위험도

MEDIUM
