# Testing Review

## 발견사항

### 1. 테스트 존재 여부 및 커버리지

- **[INFO]** `useCafe24MallIdPrecheck` 훅에 대한 단위 테스트(`use-cafe24-mall-id-precheck.test.tsx`)가 새로 추가되었고, 6개의 핵심 시나리오(disabled/패턴 위반/정상 debounce/abort/enabled 전환/fetch 실패)를 모두 커버하고 있다.
  - 위치: `frontend/src/lib/integrations/__tests__/use-cafe24-mall-id-precheck.test.tsx`
  - 상세: 훅의 계약(contract) — conflict, loading 상태 전이, AbortController 동작 — 을 격리 검증하는 구조가 적절하다.
  - 제안: 현재 커버리지는 충분하며 별도 조치 불필요.

- **[INFO]** `IntegrationsService.create`의 audit log 실패 시나리오에 대한 회귀 테스트가 추가되었다.
  - 위치: `backend/src/modules/integrations/integrations.service.spec.ts` L50–81
  - 상세: 테스트 코멘트가 "트랜잭션 미적용 결정(W23)"의 회귀 안전망임을 명시하고, `auditLogsService.record`가 throw할 경우 user-visible 500이 되지 않아야 한다는 정책을 단언으로 표현하고 있다. 이 테스트가 없었다면 미래 `record()` 구현이 throw하도록 변경될 때 무언의 회귀가 발생할 수 있었다.
  - 제안: 현재 추가된 테스트로 충분하다.

- **[INFO]** `integration-error-codes.ts` (신규 파일)에 대한 전용 단위 테스트는 존재하지 않는다.
  - 위치: `frontend/src/lib/api/integration-error-codes.ts`
  - 상세: `getIntegrationErrorI18nKey`는 순수 함수로, 입력→출력이 결정론적이다. 현재는 `cafe24-precheck.test.tsx`의 E2E 경로(CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드 시나리오)를 통해 간접 검증된다. 함수 자체는 단순하지만, 향후 매핑 항목이 늘어나면 독립 단위 테스트가 유지보수에 유리하다.
  - 제안: 현재 간접 커버리지로 수용 가능. 매핑이 2건 이상으로 늘어나면 `integration-error-codes.test.ts`를 분리해 `(null/undefined/"unknown_code"/매핑된 코드)` 4경우를 테스트할 것을 권장.

### 2. 엣지 케이스 테스트

- **[WARNING]** `useCafe24MallIdPrecheck` 훅 테스트에서 `mallId`가 빈 문자열(`""`)인 경우를 명시적으로 테스트하지 않는다.
  - 위치: `frontend/src/lib/integrations/__tests__/use-cafe24-mall-id-precheck.test.tsx`
  - 상세: 빈 문자열은 패턴 `/^[a-z0-9-]{3,50}$/`을 통과하지 못하므로 `setLoading(false)` 분기로 진입한다. 이 경로가 묵시적으로 "패턴 위반" 테스트에 포함되긴 하지만 명시적으로 검증되지 않아, 향후 패턴 변경 시 빈 문자열 처리를 놓칠 수 있다.
  - 제안: 기존 "패턴 위반 mall_id" 테스트에 `""` (빈 문자열) 케이스를 추가하거나, 별도 `it("빈 mall_id 는 fetch skip")`을 추가.

- **[INFO]** `cafe24-precheck.test.tsx`에서 `status=expiring` 분기에 대한 테스트가 존재하지 않는다.
  - 위치: `frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx`
  - 상세: 현재 `connected / pending_install / expired / error` 4개 상태는 검증되나, `expiring` status가 `Cafe24PrecheckResult`의 `status` 유니온에 포함될 경우 배너 문구가 어느 분기로 떨어지는지 검증되지 않는다. `conflictDescKey` 계산식의 `else` 분기(`"integrations.cafe24DuplicateMallConnectedDesc"`)가 `expiring`을 처리하는지 여부는 spec에 따라 달라지므로, spec상 `expiring`이 valid precheck result라면 테스트를 추가해야 한다.
  - 제안: `Cafe24PrecheckResult.status` 유니온 정의를 확인하고, `expiring`이 포함되면 테스트 케이스 추가.

- **[INFO]** `IntegrationsService.create` audit fail 테스트에서 `auditLogsService.record`가 reject하는 단일 케이스만 검증한다.
  - 위치: `backend/src/modules/integrations/integrations.service.spec.ts` L50–81
  - 상세: `record()`가 동기 throw가 아닌 reject인 경우만 테스트한다. 현재 구현의 `try { await ... } catch { logger.warn }` 구조에서는 동기 throw도 잡히므로 동일하게 동작하지만, 테스트 코멘트에서 "향후 record 구현이 throw하도록 변경"을 언급한 만큼 이 점은 코드 구조상 정확하게 커버된다.
  - 제안: 현재 수준으로 충분.

### 3. Mock 적절성

- **[INFO]** `useCafe24MallIdPrecheck` 훅 테스트에서 `integrationsApi.cafe24Precheck`를 `vi.mock`으로 교체하고 있다. `vi.resetAllMocks()`를 `beforeEach`에서 실행해 구현 큐 누수를 방지한다.
  - 위치: `use-cafe24-mall-id-precheck.test.tsx` L6–12, L108–112
  - 상세: `vi.resetAllMocks()`는 `vi.clearAllMocks()`보다 강력하여 `mockResolvedValueOnce` 큐까지 초기화한다. 이 선택이 적절하며, 테스트 간 독립성을 보장한다.
  - 제안: 적절. 변경 불필요.

- **[INFO]** `cafe24-precheck.test.tsx`에서는 `beforeEach`에 `vi.clearAllMocks()`를 사용한다. 이 파일의 각 테스트는 `mockResolvedValueOnce`/`mockImplementationOnce`로 큐를 미리 설정하므로 `clearAllMocks`로 충분하다. 그러나 훅 테스트와 일관성이 없다.
  - 위치: `cafe24-precheck.test.tsx` L94
  - 상세: 현재 구조에서는 문제가 없다. 두 파일의 mock 초기화 전략이 다르지만 각 파일 내에서는 일관적이다.
  - 제안: 코드베이스 전체 일관성을 위해 `clearAllMocks` vs `resetAllMocks` 정책을 spec에 명시하는 것을 고려.

- **[WARNING]** `cafe24-precheck.test.tsx`의 audit-fail 테스트 (`IntegrationsService` spec)에서 `auditLogsService.record`를 `jest.fn().mockRejectedValueOnce`로 직접 교체하는 방식을 사용한다. 이 방식은 테스트 대상 서비스의 내부 필드를 직접 변조한다.
  - 위치: `backend/src/modules/integrations/integrations.service.spec.ts` L54–56
  - 상세: `auditLogsService.record = jest.fn().mockRejectedValueOnce(...)` — 기존 모킹 방식(`jest.spyOn` 또는 NestJS DI의 `provide`를 통한 교체)과 다른 방식이다. 만약 `auditLogsService`가 TypeScript `readonly` 또는 `private` 접근 제어자를 갖고 있다면 타입 오류가 날 수 있으나, 기존 테스트 파일이 이미 이 방식을 사용하고 있는지 확인이 필요하다. 단순 필드 재할당은 향후 속성 디스크립터(`Object.defineProperty`) 등으로 리팩토링될 경우 테스트가 조용히 깨질 수 있다.
  - 제안: 기존 테스트 파일 전체의 `auditLogsService` mock 방식을 확인해 일관성을 유지. `jest.spyOn(auditLogsService, 'record').mockRejectedValueOnce(...)` 방식이 더 명시적이고 안전하다.

### 4. 테스트 격리

- **[INFO]** `cafe24-precheck.test.tsx`의 `beforeEach`에 `vi.useFakeTimers`와 `cleanup()`이 모두 호출된다. `afterEach`에서 `vi.useRealTimers()`를 복원하므로 타이머 상태는 격리된다.
  - 위치: `cafe24-precheck.test.tsx` L93–104
  - 상세: `cleanup()`을 `beforeEach`에서 호출하는 것은 Testing Library의 `afterEach` 자동 cleanup과 중복될 수 있으나, 명시적으로 호출하는 것이 더 안전하다.
  - 제안: 현재 방식 유지. 중복 cleanup은 부작용이 없다.

- **[INFO]** `useCafe24MallIdPrecheck` 훅 테스트에서 `vi.resetAllMocks()`와 `vi.useFakeTimers()`를 `beforeEach`에서 초기화하고 `afterEach`에서 `vi.useRealTimers()`를 복원한다. 테스트 간 상태 누수 가능성이 없다.
  - 위치: `use-cafe24-mall-id-precheck.test.tsx` L106–116
  - 상세: 각 테스트가 독립적으로 실행 가능하다.
  - 제안: 적절. 변경 불필요.

### 5. 테스트 가독성

- **[INFO]** `cafe24-precheck.test.tsx`에 `DEBOUNCE_ADVANCE_MS = 360` 상수와 `advanceDebounce()` 헬퍼 함수가 추가되었다. 11회 반복되던 `vi.advanceTimersByTime(360)` 패턴이 단일 헬퍼로 수렴됐다.
  - 위치: `cafe24-precheck.test.tsx` L584–590
  - 상세: 헬퍼 상단의 JSDoc이 debounce 값(350ms)과 buffer(10ms)의 의도를 명확히 설명한다. 매직 넘버 분산을 줄이고 테스트 의도를 명확히 표현한 개선이다.
  - 제안: 적절. 이 패턴을 코드베이스 전체 debounce 테스트에 일관 적용 권장.

- **[INFO]** `useCafe24MallIdPrecheck` 훅 테스트의 abort 검증 케이스에서 `firstSignal` 변수를 `let firstSignal: AbortSignal | undefined`로 선언하고 mock closure에서 캡처하는 방식이 사용된다. 이 패턴은 `cafe24-precheck.test.tsx`의 동일 시나리오와 일관성이 있다.
  - 위치: `use-cafe24-mall-id-precheck.test.tsx` L163–185
  - 상세: 코드 의도가 명확하며 가독성이 높다.
  - 제안: 적절.

### 6. 회귀 테스트

- **[INFO]** audit fail 회귀 테스트의 주석이 "향후 `auditLogsService.record`가 throw하도록 변경되면 본 테스트가 회귀를 감지"라고 명시한다.
  - 위치: `backend/src/modules/integrations/integrations.service.spec.ts` L44–49
  - 상세: 이 테스트가 현재 best-effort 정책을 코드화한 유일한 단언이다. `service.create(...).catch((e: Error) => e)`로 결과를 받아 `expect(result).not.toBeInstanceOf(Error)`를 검증하는 패턴이 의도를 명확히 표현한다.
  - 제안: 적절.

- **[INFO]** `cafe24-precheck.test.tsx`의 기존 테스트들이 `advanceDebounce()` 헬퍼로 리팩토링됐으나, 각 테스트의 검증 로직 자체는 변경되지 않았다. 기존 회귀 보호가 유지된다.
  - 위치: `cafe24-precheck.test.tsx` 전체
  - 상세: 순수 리팩토링이며 테스트 시맨틱 변경 없음.
  - 제안: 적절.

### 7. 테스트 용이성

- **[INFO]** `useCafe24MallIdPrecheck`를 `page.tsx`에서 분리해 독립 훅으로 추출한 것은 테스트 용이성 측면에서 명확한 개선이다.
  - 위치: `frontend/src/lib/integrations/use-cafe24-mall-id-precheck.ts`
  - 상세: 분리 전에는 page 컴포넌트 전체를 렌더링해야만 debounce/abort 동작을 검증할 수 있었다. 분리 후 `renderHook`으로 훅만 격리 테스트 가능하다.
  - 제안: 이 분리 패턴을 다른 복잡 훅에도 적용 권장.

- **[INFO]** `IntegrationsService.create`의 리팩토링(save/audit 분리 try/catch)은 audit 실패 시나리오를 단위 테스트에서 직접 mock할 수 있게 한다. 기존 단일 try/catch 구조에서는 `save()` 성공 + `auditLogsService.record()` 실패 경로가 뒤섞여 있어 테스트하기 어려웠다.
  - 위치: `backend/src/modules/integrations/integrations.service.ts` L538–144
  - 상세: 구현 구조 개선이 테스트 가능성을 직접 향상시킨 사례다.
  - 제안: 적절.

### 8. 커버리지 갭 (잠재)

- **[WARNING]** `integration-error-codes.ts`의 `getIntegrationErrorI18nKey` 함수에 대해 `null`, `undefined`, `""`, `"알_수_없는_코드"`, `"CAFE24_PRIVATE_APP_ALREADY_CONNECTED"` 5가지 케이스 중 마지막 케이스만 `cafe24-precheck.test.tsx`를 통해 간접 검증된다.
  - 위치: `frontend/src/lib/api/integration-error-codes.ts` L48–50
  - 상세: `null`/`undefined` 입력은 함수 첫 줄 `if (!errorCode) return null`에서 처리되나 직접 테스트 없음. 향후 `hasOwnProperty` 체크 대신 Map이나 다른 자료구조로 내부 구현이 변경될 때 경계 케이스가 조용히 깨질 수 있다.
  - 제안: `integration-error-codes.test.ts` 신설하여 최소 4가지 케이스(`null`, `undefined`, 알 수 없는 코드, 매핑된 코드) 검증 추가.

---

## 요약

이번 변경에서 테스트 품질은 전반적으로 높다. `useCafe24MallIdPrecheck` 훅 추출과 동시에 단위 테스트 6건이 함께 추가되었고, `IntegrationsService.create`의 audit best-effort 정책을 코드화한 회귀 테스트도 적절히 추가됐다. `cafe24-precheck.test.tsx`의 debounce 패턴 통일(`DEBOUNCE_ADVANCE_MS` + `advanceDebounce()`)은 매직 넘버 분산을 제거했다. 주요 갭은 두 가지다: (1) `integration-error-codes.ts`의 순수 함수에 대한 독립 단위 테스트 부재, (2) `useCafe24MallIdPrecheck` 훅 테스트에서 빈 문자열 엣지 케이스 미검증. 두 항목 모두 현재 간접 커버리지가 존재하나 향후 구현 변경 시 회귀를 조기에 감지하기 위해 보완이 권장된다. 또한 `auditLogsService.record` mock 방식이 직접 필드 재할당 방식인 점은 기존 테스트 파일과의 일관성 확인이 필요하다.

## 위험도

LOW
