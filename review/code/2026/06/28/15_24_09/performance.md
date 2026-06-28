# 성능(Performance) 리뷰 — 인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 fix

## 발견사항

### **[WARNING]** Guard → Service 중복 DB 조회 — W14 캐시 패턴 구현 완료 확인
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:99`, `codebase/backend/src/modules/hooks/hooks.controller.ts:158`, `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`
- 상세: 이전 리뷰(15_00_36)에서 W14 캐시 미구현이 WARNING 으로 식별됐으며, 이번 변경셋에서 RESOLUTION 으로 수정됐다. `PublicWebhookThrottleGuard` 가 `req.__publicWebhookTrigger` 에 full entity 를 첨부하고, `HooksController.receiveWebhook` 이 이를 꺼내 `HooksService.handleWebhook(preloadedTrigger?)` 로 전달하며, 서비스 내부는 `preloadedTrigger !== undefined ? preloadedTrigger : await this.triggerRepository.findOne(...)` 패턴으로 단락한다. 공개 webhook 경로에서 webhook 당 DB 왕복이 2회→1회로 감소했다. 단, `preloadedTrigger` 가 `null` 인 경우(트리거 미존재) 와 `undefined` 인 경우(Guard 미통과, 즉 인증 webhook 직접 접근 등)를 `!== undefined` 로 정확히 구분하는 점은 올바르다.
- 제안: 현행 구현은 올바르다. 다만 인증 webhook 경로(`auth_config_id IS NOT NULL`)는 Guard 를 early-return 해 `req.__publicWebhookTrigger` 가 세팅되지 않으므로, 해당 경로에서는 여전히 `HooksService` 가 `findOne` 을 수행한다. 이는 인증 webhook 이 Guard 의 공개 체크 대상이 아니므로 현행 설계상 불가피하며 추가 조치 불필요.

### **[WARNING]** Full entity 로드 — 불필요 컬럼 전송 비용
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` — `findOne({ where: { endpointPath, type: 'webhook' } })`
- 상세: 보안 버그(partial projection `select: { authConfigId: true }` 가 `authConfigId` 를 non-null 로 잘못 반환) 수정을 위해 full entity 로드로 변경됐다. `Trigger` 엔티티에 JSONB `config` 컬럼, `notificationSecretV2`, `chatChannelTokenV2` 등 바이트 규모가 있는 컬럼이 포함돼 있다면 매 webhook 요청마다 DB → 애플리케이션 네트워크 전송량이 증가한다. W14 캐시로 webhook 당 1회로 제한됐으나 1회 자체의 크기는 늘었다.
- 제안: TypeORM 의 partial projection null 반환 버그 재현 조건(`select` 시 nullable 컬럼이 null 대신 빈 값/0 을 반환하는 TypeORM 특정 버전 동작)을 별도 단위 테스트로 재현 및 검증한 후, Guard 와 HooksService 가 실제로 사용하는 최소 컬럼 집합(`authConfigId`, `type`, `endpointPath`, `isActive`, 서명 검증 필드 등)만 select 하는 방향을 검토한다. 실측 성능 영향이 없는 환경이라면 현행 full load 유지도 합리적.

### **[INFO]** `captureRawBody` — 전역 파서에서도 rawBody Buffer 복사
- 위치: `codebase/backend/src/bootstrap/hooks-body-parser.ts` — `buildBodyParsers` 공통 팩토리, `createGlobalBodyParsers` 포함
- 상세: `captureRawBody` verify 콜백이 `createGlobalBodyParsers`(100KB 전역 파서)에도 동일하게 적용된다. 전역 파서는 webhook 이 아닌 모든 API 요청을 처리하므로, HMAC 서명 검증이 필요 없는 일반 REST 요청에서도 원본 바이트를 `Buffer` 로 복사해 `req.rawBody` 에 세팅하는 비용이 발생한다. 100KB 한도 내이므로 개별 요청 비용은 제한적이나, 요청 볼륨이 높을 경우 GC 압박의 잠재 원인이 될 수 있다.
- 제안: `createGlobalBodyParsers` 는 `verify: captureRawBody` 없이 호출하고, rawBody 보존이 필요한 `/api/hooks/*` 파서(`createHooksBodyParsers`)에서만 verify 를 적용하는 방식으로 분리 검토. 단, 현재 100KB 전역 한도에서는 영향이 제한적이므로 즉각 필수 조치는 아님.

### **[INFO]** `resolveHooksMaxBodyBytes` 기본 인자 평가 시점
- 위치: `codebase/backend/src/bootstrap/hooks-body-parser.ts:46` — `createHooksBodyParsers(maxBytes: number = resolveHooksMaxBodyBytes())`
- 상세: TypeScript 기본 파라미터 `resolveHooksMaxBodyBytes()` 는 함수 호출 시마다 평가된다. `createHooksBodyParsers()` 가 부트스트랩 시 1회만 호출되는 설계이므로 운영 영향은 없다. 그러나 테스트 환경에서 여러 번 호출될 경우 매번 `process.env.HOOKS_MAX_BODY_BYTES` 를 다시 읽는다(테스트 격리 측면에서는 오히려 유리).
- 제안: 현행 설계 문제 없음. 필요 시 모듈 로드 시 1회 상수화(`const RESOLVED_HOOKS_MAX = resolveHooksMaxBodyBytes()` 내보내기)로 명시적 의도를 표현할 수 있으나 즉각 조치 불필요.

### **[INFO]** `spec-link-integrity` 테스트 — 동기 파일시스템 스캔 타임아웃 상향
- 위치: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` — `it("has no broken in-repo links...", ..., 30_000)`
- 상세: `findBrokenLinks(root)` 가 동기 I/O 로 전체 spec 디렉토리를 재귀 스캔한다. 5초 기본 타임아웃에서 CI 병렬 실행 시 CPU 경합으로 flaky 가 발생해 30초로 상향했다. 스캔 대상 파일 수가 증가할수록 타임아웃 재연장 패턴이 반복될 위험이 있다.
- 제안: 장기적으로 `findBrokenLinks` 를 `fs.promises` / 비동기 I/O 기반으로 전환하거나, 변경된 spec 파일만 증분 스캔하는 방식을 검토. 단기적으로 30초는 적절한 헤드룸.

### **[INFO]** e2e 테스트 내 대형 인라인 문자열 생성
- 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` — 테스트 J(`512 * 1024`), K/M(`1100 * 1024`) `'x'.repeat(...)`
- 상세: 512KB, 1.1MB 문자열을 테스트 실행 중 메모리에 생성한다. 개별 테스트 케이스 규모이며 완료 후 GC 대상이 되므로 일반적인 환경에서 문제가 없다. 그러나 메모리가 제한된 CI 환경(예: 256MB 컨테이너)에서 병렬로 여러 `it` 블록이 실행될 경우 일시적 메모리 스파이크가 발생할 수 있다.
- 제안: 메모리 민감 CI 환경이라면 해당 케이스를 별도 파일로 격리하거나 `--runInBand` 직렬 실행을 고려. 일반 환경에서는 현행 유지.

### **[INFO]** `measureBodyBytes` fallback — `JSON.stringify` 비용
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` — `measureBodyBytes` 내 `rawBody` 미존재 시 JSON.stringify 폴백
- 상세: `rawBody` 가 없을 경우 `JSON.stringify(body)` 로 본문 크기를 측정한다. 정상 경로(hooks 파서가 rawBody 를 보존하는 경우)에서는 발생하지 않으나, 폴백이 트리거되면 직렬화 비용 + 임시 문자열 메모리 할당이 발생한다. 32KB 한도 대상 공개 webhook 에서 이 폴백이 빈번하게 발생하면 체감 가능한 비용이 될 수 있다.
- 제안: `captureRawBody` 수정(W3 FIXED)과 함께 rawBody 가 항상 세팅되도록 보장되므로 fallback 경로 도달 가능성이 최소화됐다. 현행 유지.

---

## 요약

이번 변경의 핵심 성능 관련 이슈는 두 가지였다. 첫째, Guard → Service 간 DB 2회 조회(W14) 는 RESOLUTION 에서 `preloadedTrigger` 파라미터 전달 패턴으로 올바르게 수정돼 webhook 당 1회로 감소했다. 둘째, partial projection 보안 버그 수정으로 인한 full entity 로드 전환은 불필요한 컬럼 전송 비용을 수반하나, W14 캐시로 1회로 제한되고 실측 성능 문제가 확인되지 않은 현 상황에서 보안 정확성 우선의 선택은 합리적이다. `captureRawBody` 가 전역 파서에도 적용되는 점은 논리적 불필요성이 있으나 100KB 한도에서 영향이 제한적이다. 전반적으로 의도된 성능 최적화(W14)는 구현됐고, 남은 성능 트레이드오프는 현재 규모에서 허용 가능한 수준이다.

---

## 위험도

LOW
