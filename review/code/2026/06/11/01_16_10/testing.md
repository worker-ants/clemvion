# Testing Review — integration-expiry-fixes

## 발견사항

### [WARNING] `getNotifResourceIds` 헬퍼가 첫 번째 `createMany` 호출만 검사
- 위치: `integration-expiry-scanner.service.spec.ts` 44-52행 (`getNotifResourceIds`)
- 상세: 헬퍼가 `mock.calls[0][0]`(첫 번째 호출의 첫 번째 인자)만 꺼낸다. 현재 `run()`은 candidates 루프 종료 후 `createMany`를 한 번만 호출하므로 실용적으로 문제없지만, 향후 `createMany`가 여러 번 호출되는 경로가 생기면 헬퍼가 조용히 첫 번째 배치만 검사해 FP·FN이 모두 발생할 수 있다. 헬퍼 주석에 "단일 호출 가정" 명시 또는 `flat().map(...)`으로 전체 호출 통합 검사하도록 보강 권장.
- 제안: `const allArgs = notificationsSvc.createMany.mock.calls.flatMap(c => c[0] as Array<{resourceId?:string}>); return allArgs.map(n => n.resourceId ?? '');`

### [WARNING] `hasSavedExpired` 헬퍼가 첫 번째 `save` 호출만 검사
- 위치: `integration-expiry-scanner.service.spec.ts` 58-66행 (`hasSavedExpired`)
- 상세: `mock.calls[0][0]`만 검사한다. `save()`가 여러 번 호출되는 시나리오(예: integrationsToUpdate 배치가 루프에서 개별 push된 경우)에서 두 번째 이후 호출의 expired 행을 놓친다. 현재 구현(`run()`)은 `integrationsToUpdate`를 모아 한 번만 `save`하므로 실질적 위험은 낮지만, 헬퍼 자체의 견고성이 부족하다.
- 제안: `mock.calls.some(call => Array.isArray(call[0]) ? call[0].some(i => i?.status === 'expired') : call[0]?.status === 'expired')` 형태로 전체 호출 체크.

### [WARNING] `cafe24 7d/3d 임계 알림 면제` 테스트 — `getNotifResourceIds` 헬퍼 대신 직접 접근
- 위치: `integration-expiry-scanner.service.spec.ts` 306-308행 (cafe24 7d 테스트), 342-344행 (makeshop 3d 테스트)
- 상세: 두 테스트만 헬퍼를 사용하지 않고 `notificationsService.createMany.mock.calls[0]?.[0]`를 직접 접근한다. 동일 검증 의도임에도 인라인 패턴을 쓰는 것은 `getNotifResourceIds` 헬퍼를 추가한 W-4 목적(반복 패턴 추출)과 불일치하며, 이 두 케이스도 동일 헬퍼로 교체하면 코드 스타일이 통일된다.
- 제안: `expect(getNotifResourceIds(notificationsService)).not.toContain('cafe24-7d-int')` 패턴으로 교체.

### [INFO] `makeshop-int-1` 테스트의 `cafe24RefreshQueue.add` 미호출 assertion이 cafe24와 명시적으로 구분되지 않음
- 위치: `integration-expiry-scanner.service.spec.ts` 224행 (`exempts makeshop + refresh_token ...`)
- 상세: `expect(cafe24RefreshQueue.add).not.toHaveBeenCalled()` assertion은 makeshop이 cafe24 큐를 사용하지 않는다는 의도로 맞지만, 코멘트가 없으면 "큐가 아예 없다 vs cafe24 큐를 타지 않는다"의 설계 의도 구분이 불명확하다. 라인 223의 주석으로 커버되나 assertion 바로 위에도 짧은 인라인 주석(`// makeshop 은 자체 큐가 없고, cafe24 큐도 사용하지 않음`)을 추가하면 가독성이 향상된다.
- 제안: 현재 수준으로도 허용 범위이나, 향후 `makeshopRefreshQueue` mock 이 추가될 때 미호출 검증도 함께 추가 필요.

### [INFO] `makeshop missing refresh_token` 테스트 — `toHaveBeenCalledTimes(1)` 과 `getNotifResourceIds` 검증이 중복
- 위치: `integration-expiry-scanner.service.spec.ts` 265-268행 (`demotes makeshop missing refresh_token ...`)
- 상세: `notificationsService.createMany`를 `toHaveBeenCalledTimes(1)`과 `getNotifResourceIds(...).toContain(...)` 두 방식으로 검증한다. 이중 검증 자체는 허용되나, 다른 테스트는 호출 횟수를 따로 검증하지 않아 스타일이 혼재된다. 테스트 의도(알림이 발사됐는지)를 명확히 하려면 둘 중 하나만으로 충분하거나, 호출 횟수 검증을 전 테스트에 일관적용하는 방향을 선택해야 한다.

### [INFO] `isRefreshCapable`에 대한 단위 테스트 없음
- 위치: `integration-expiry-scanner.service.ts` 471행 이하 (`isRefreshCapable` 함수)
- 상세: `isRefreshCapable`은 module-private 함수로 스캐너 통합 테스트에서 간접 검증되지만, 함수 자체에 대한 직접 단위 테스트(서비스 외부로 export하거나 `__test__` 경로 등으로)는 없다. 현재 spec 케이스는 잘 커버되지만, `credentials`가 null인 경우·serviceType이 신규 추가될 경우 등의 경계값이 직접 검증되지 않는다. `integration-status-reason.ts`의 `normalizeStatusReason`도 마찬가지로 직접 단위 테스트 파일이 보이지 않는다.
- 제안: 수용 가능한 수준이지만, 향후 provider 추가 시 `isRefreshCapable`에 대한 경계값 테스트(credentials=null, serviceType='shopify' 등)를 추가하면 회귀 방지에 도움.

### [INFO] e2e 테스트의 `EXPECTED_QUEUE_NAMES` 하드코딩
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` 30-35행
- 상세: 주석에 "SoT import 불가 — e2e jest 모듈 해석 실패"라는 근거가 설명되어 있어 현재 패턴이 의도적 선택임을 알 수 있다. 큐 이름 문자열이 `MONITORED_QUEUES` 상수와 중복 유지되는 구조는 동기화 누락 위험이 있으나, 이번 변경에서 `system-status.constants.spec.ts`(단위)가 해당 동기화 회귀를 탐지하도록 추가됐으므로 이중 방어가 성립된다.

### [INFO] `system-status.constants.spec.ts` — `INTEGRATION_EXPIRY_QUEUE` 포함 여부 미검증
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.spec.ts`
- 상세: 새로 추가된 단위 테스트는 `CAFE24_REFRESH_QUEUE`·`MAKESHOP_REFRESH_QUEUE` 존재 여부와 makeshop 항목의 group/concurrency를 검증한다. 그러나 이전에 누락됐다가 추가된 `MAKESHOP_REFRESH_QUEUE`처럼 다른 큐(예: `INTEGRATION_EXPIRY_QUEUE`)의 group/concurrency 속성 정합도 검증하면 spec §1 표와의 전반적인 동기화 보증이 강화된다. 현재 중복 없음 assertion(`new Set(names).size === names.length`)은 있어서 기본 가드는 동작.

---

## 요약

이번 변경의 테스트 커버리지는 전반적으로 양호하다. V-01(makeshop 오격하) 수정에 대해 `makeshop + refresh_token`/`makeshop 미보유`의 두 케이스가 신규 추가되었고, §11.2 변경(refresh-capable passive 알림 제외)에 대해 cafe24 7d·makeshop 3d 임계 테스트도 추가됐다. 기존 테스트는 `statusReason` 검증 보강과 알림 기댓값 수정으로 회귀 유효성이 유지된다. 주요 약점은 `getNotifResourceIds`·`hasSavedExpired` 두 헬퍼가 첫 번째 mock 호출만 검사한다는 점으로, 현재 구현에서는 문제가 없지만 단일 호출 가정이 명시되지 않아 향후 리팩토링 시 silent FN 위험이 있다. 또한 두 신규 7d/3d 임계 테스트가 헬퍼를 사용하지 않고 직접 mock 접근을 하는 스타일 불일치도 개선 여지가 있다. 전체적으로 크리티컬한 커버리지 갭은 없으며 테스트 격리와 독립 실행성도 유지된다.

## 위험도

LOW
