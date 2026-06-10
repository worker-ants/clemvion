# Testing 리뷰 — integration-expiry-fixes

## 발견사항

### **[INFO]** `isRefreshCapable` 순수 함수에 대한 직접 단위 테스트 부재
- 위치: `integration-expiry-scanner.service.ts` 의 `isRefreshCapable` 함수 (모듈-프라이빗)
- 상세: `isCafe24RefreshCapable` → `isRefreshCapable` 로 일반화한 핵심 판별 함수가 파일 내 비공개 함수라 직접 테스트가 불가하나, 결과적으로 scanner 통합 테스트를 통해 cafe24+refresh_token, cafe24+empty_refresh_token, cafe24+no_refresh_token, makeshop+refresh_token, makeshop+no_refresh_token 모두 커버된다. 커버리지 자체는 충분하다.
- 제안: 현재 구조가 허용 범위이므로 추가 조치 불필요. 다만 향후 provider 추가 시 단위 테스트로 추출하는 것을 권장.

### **[INFO]** `integration-status-reason.ts` — `token_expired` 신규 슬러그 테스트 없음
- 위치: `codebase/backend/src/modules/integrations/integration-status-reason.ts`
- 상세: `INTEGRATION_STATUS_REASONS` union 에 `token_expired` 가 추가됐으나, 해당 파일에 대한 `*.spec.ts` 가 존재하지 않는다. `normalizeStatusReason` 유틸 함수(union 밖 값 → `unknown_error` fallback)도 직접 테스트되지 않는다. `token_expired` 는 scanner 에서 직접 리터럴로 사용되어 `normalizeStatusReason` 경로를 거치지 않으므로 실질적 위험은 낮으나, union 정합성 자동 검사가 없다.
- 제안: `integration-status-reason.spec.ts` 를 신설해 (1) `normalizeStatusReason('token_expired')` → `'token_expired'` (2) `normalizeStatusReason('unknown_slug')` → `'unknown_error'` (3) `normalizeStatusReason(null)` → `'unknown_error'` 세 케이스를 검증하면 회귀 방어가 강화된다. 단, 현재 기능은 scanner spec 에서 `statusReason: 'token_expired'` 일치로 간접 검증되므로 CRITICAL 은 아님.

### **[INFO]** `hasSavedExpired` 헬퍼 — 중첩 배열 구조 가정의 명시적 테스트 없음
- 위치: `integration-expiry-scanner.service.spec.ts` 의 `hasSavedExpired` 함수 (라인 56–61)
- 상세: `save(Array<{status?}>)` 가 배열을 직접 인자로 넘기는 구조를 가정하고 있다. 현재 사용 패턴에서는 정확하지만, 향후 `save` call signature 가 변경될 경우 헬퍼가 조용히 `false` 를 반환해 오탐이 생길 수 있다. 특히 `call[0]` 이 객체 단건일 때 `Array.isArray(arg)` 가 `false` 여서 탐지 불가.
- 제안: 헬퍼 내부 주석에 `save(array)` 구조 의존 명시. 필요 시 `Array.isArray(arg) || (typeof arg === 'object' && arg?.status === 'expired')` 방어 분기 추가.

### **[INFO]** makeshop 1h access_token 만료 시 dedup claim 미생성 단언 누락
- 위치: `integration-expiry-scanner.service.spec.ts` — V-01 makeshop+refresh_token 0d 테스트 (라인 370–401)
- 상세: `exempts makeshop + refresh_token` 테스트에서 `cafe24RefreshQueue.add` 미호출 + `hasSavedExpired` + `getNotifResourceIds` 를 검증하지만, `dispatchRepo.__insertBuilder.values` 미호출(dedup claim 미생성)을 단언하지 않는다. 7d 임계 테스트(라인 446)와 3d 임계 테스트(라인 485)에서는 동일 단언이 있는데 0d 케이스에서만 빠져있다.
- 제안: 0d makeshop+refresh_token 테스트에 `expect(dispatchRepo.__insertBuilder.values).not.toHaveBeenCalled()` 추가하면 §11.2 의도(dedup claim 없음)를 완결 검증할 수 있다.

### **[INFO]** `system-status.constants.spec.ts` — `INTEGRATION_EXPIRY_QUEUE` 포함 여부 미검증
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.spec.ts`
- 상세: 신설 spec 파일이 cafe24·makeshop 두 큐에 집중하며 `INTEGRATION_EXPIRY_QUEUE`, `SCHEDULE_QUEUE` 등 다른 큐의 포함 여부는 검증하지 않는다. V-15 회귀 시나리오(새 큐 누락)가 동일하게 다른 큐에서도 발생할 수 있다.
- 제안: '큐 이름 중복이 없다' 테스트 옆에 최소 MONITORED_QUEUES 길이가 예상 수와 일치한다는 단언 또는 전체 큐 이름 목록 스냅샷 테스트를 추가하면 누락 회귀를 조기에 잡을 수 있다. 단, e2e `EXPECTED_QUEUE_NAMES` 와 이중 관리가 될 수 있어 trade-off 고려 필요.

### **[INFO]** e2e `EXPECTED_QUEUE_NAMES` 하드코딩 문자열과 constants 상수 간 정합 자동화 없음
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` (라인 884–886 주석)
- 상세: 주석에 "블랙박스 e2e 는 앱 소스를 import 하지 않는다" 고 설명되어 있어 의도적 설계임이 명확하다. 그러나 큐 추가 시 세 곳(constants.ts, constants.spec.ts, e2e spec)을 동시에 갱신해야 하는 3-point sync 부담이 남는다. 현재 `system-status.constants.spec.ts` 신설로 constants ↔ spec 카탈로그 동기는 보강됐으나, e2e 목록은 여전히 수동 관리 의존이다.
- 제안: 이미 인지된 설계 제약이며 현재 PR 범위에서 해결이 어렵다. constants.ts 주석에 e2e 목록 갱신 의무를 추가한 것(라인 682)은 적절한 완화 조치이다.

### **[INFO]** `notificationsService.createMany` 호출 횟수 단언이 부분적으로만 사용됨
- 위치: `integration-expiry-scanner.service.spec.ts` — `demotes makeshop missing refresh_token` 테스트 (라인 436)
- 상세: 이 테스트만 `toHaveBeenCalledTimes(1)` 로 정확한 호출 횟수를 검증한다. 다른 테스트는 `toContain`/`not.toContain` 으로 resourceId 존재 여부만 확인한다. 단일 통합 픽스처 테스트에서 `createMany` 가 예상치 않게 복수 호출되어도 잡히지 않을 수 있다.
- 제안: 선택적 강화 사항. 단순 단일 통합 케이스에 `toHaveBeenCalledTimes` 추가를 고려할 수 있으나 현재 `getNotifResourceIds` 패턴이 다중 호출도 flatMap 으로 집계하므로 실용적 커버리지는 충분하다.

---

## 요약

이번 변경의 테스트 품질은 전반적으로 양호하다. 핵심 버그 수정(V-01: makeshop 오격하)과 정책 변경(V-07: §11.2 채택)에 대해 직접 커버하는 신규 테스트 케이스가 정확히 추가됐고, `getNotifResourceIds`·`hasSavedExpired` 헬퍼 추출로 기존의 중복·취약한 검증 로직이 개선됐다. V-15(큐 레지스트리 누락) 회귀 방지를 위한 `system-status.constants.spec.ts` 신설도 적절하다. 식별된 갭은 `integration-status-reason.ts` 의 직접 단위 테스트 부재, 0d makeshop+refresh_token 케이스의 dedup claim 미단언, 그리고 `hasSavedExpired` 헬퍼의 save() 구조 가정 명시화이며, 모두 기능 정확성에 영향을 주는 수준은 아니어서 개선 권장 수준이다.

## 위험도

LOW
