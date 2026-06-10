# Maintainability Review

## 발견사항

### 파일 1: integration-expiry-scanner.service.spec.ts

- **[INFO]** `getNotifResourceIds` 헬퍼는 `createMany` 의 첫 번째 호출(`calls[0][0]`)만 검사한다. 현재 테스트 구조에서는 1회 호출이 전제이므로 문제 없으나, 향후 다회 호출 시나리오가 생기면 헬퍼가 조용히 잘못된 결과를 반환할 수 있다. 함수 내부 주석(`W-4`)에 이 제약이 언급되어 있지 않아 사용자에게 단일 호출 전제가 불명확하다.
  - 위치: spec 파일 `getNotifResourceIds` 함수 (라인 44–52)
  - 상세: 함수명만 보면 "모든 호출에서 resourceId 목록을 돌려준다"로 읽히지만 실제로는 첫 번째 호출만 반영한다. `getNotifResourceIdsFromFirstCall` 또는 JSDoc 에 `@remarks Only inspects the first call.` 추가 권장.
  - 제안: JSDoc 에 `@remarks Inspects the first `createMany` call only.` 추가 또는 함수명을 `getFirstCallNotifResourceIds`로 구체화.

- **[INFO]** W-2 테스트 두 개(`cafe24 + refresh_token from passive alert at 7d threshold`, `makeshop + refresh_token from passive alert at 3d threshold`)의 알림 검증이 `getNotifResourceIds` 헬퍼를 사용하지 않고 동일한 인라인 패턴(`notificationsService.createMany.mock.calls[0]?.[0] ?? []`)으로 작성되어 있다. 기존에 추출된 헬퍼와 불일치해 스타일이 혼재된다.
  - 위치: 라인 306–308, 342–344
  - 상세: 같은 파일 안에서 두 가지 방식이 혼재되면 새 테스트 작성자가 어떤 패턴을 따라야 하는지 알기 어렵다.
  - 제안: W-2 테스트도 `getNotifResourceIds(notificationsService)` 헬퍼를 사용해 통일.

- **[INFO]** `5 * 24 * 60 * 60 * 1000`, `2 * 24 * 60 * 60 * 1000` 등 밀리초 계산이 테스트 내부에서 인라인으로 반복된다. 서비스 파일에 `DAY_MS` 상수가 이미 정의되어 있으나 테스트에서는 import 하지 않아 동일 계산이 두 곳에 존재한다.
  - 위치: 라인 277, 316
  - 상세: 서비스 파일에서 `DAY_MS`가 이미 export 되어 있다면 테스트에서 import 해 재사용하는 것이 중복을 줄인다. export 가 없다면 테스트 파일 상단에 로컬 `const DAY_MS = 24 * 60 * 60 * 1000` 하나만 정의하고 모든 곳에서 참조.
  - 제안: `const DAY_MS = 24 * 60 * 60 * 1000` 를 테스트 파일 최상단에 선언하고 참조 일원화.

---

### 파일 2: integration-expiry-scanner.service.ts

- **[INFO]** `isRefreshCapable` 함수 내부의 `serviceType !== 'cafe24' && serviceType !== 'makeshop'` early-return 로직은 명확하다. 그러나 함수 내부에 서비스 타입이 두 군데(early-return 조건 + `credentials as Record<string, unknown>` cast) 에 산재해 있어, 새 provider 추가 시 수정 범위가 불명확할 수 있다. 현재 규모에서는 허용 범위이나, 향후 3개 이상의 provider 가 추가되면 `REFRESH_CAPABLE_PROVIDERS = new Set(['cafe24', 'makeshop'])` 패턴이 더 유지보수하기 쉽다.
  - 위치: 서비스 파일 `isRefreshCapable` 함수
  - 상세: 함수 내 JSDoc이 상세하게 작성되어 의도 파악에는 문제없다. 다만 확장 포인트가 함수 본문에 묻혀 있다.
  - 제안: 현재는 INFO 수준. provider 가 3개 이상으로 늘어날 경우 `const REFRESH_CAPABLE_SERVICE_TYPES = new Set(['cafe24', 'makeshop'] as const)` 상수 분리 고려.

- **[INFO]** `run()` 메서드 내 `isRefreshCapable(integration)` 블록 안에 있는 `continue` 직전 주석(라인 881–887)이 8줄에 달해 함수 본체의 가독성을 낮춘다. 핵심 설계 배경은 JSDoc 또는 spec 참조 단 한 줄로 줄이고 나머지는 spec 문서로 위임하는 것이 코드 밀도를 낮춘다.
  - 위치: `run()` 내 `continue` 직전 블록 (라인 881–887)
  - 상세: `// §11.2 의도적 설계: ...` 주석이 정책 변경 의도를 잘 설명하지만, 같은 내용이 spec 에도 이미 기술되어 있어 중복이다.
  - 제안: `// §11.2: refresh-capable provider — 격하·passive 알림 없음. 재활성화 방법은 spec §11.2 참조.` 수준으로 축약.

---

### 파일 3: integration-status-reason.ts

- **[WARNING]** `token_expired` 슬러그의 인라인 주석이 한 줄에 과도하게 많은 정보를 담고 있다(spec 링크, namespace 구분, 적용 조건 등). 이 파일은 단순 union 정의 파일인데 이 한 줄이 다른 항목들보다 월등히 길어 일관성이 떨어지고 스캔 가독성이 낮다.
  - 위치: `integration-status-reason.ts` `token_expired` 항목 (라인 1008)
  - 상세: 다른 항목(`auth_failed`, `install_timeout` 등)은 한 줄 짧은 설명인 반면 `token_expired`는 같은 줄에 spec 링크, namespace 구분 설명까지 포함해 라인 길이가 표준을 크게 벗어난다. linter eslint `max-len` 또는 가독성 규약 위반 가능성.
  - 제안: 기본 설명은 짧게 유지하고, namespace 구분 설명은 별도 JSDoc 블록 또는 추가 주석 라인으로 분리. 예: `'token_expired', // connected-expiry 0d 격하 (refresh_token 없는 provider). spec §11.2. // Note: JWT TOKEN_EXPIRED 에러 코드와 별개 네임스페이스.`

---

### 파일 4–5: system-status.constants.spec.ts / system-status.constants.ts

- **[INFO]** `system-status.constants.ts` 의 `MONITORED_QUEUES` 주석에 `test/system-status.e2e-spec.ts` 파일을 직접 명시한다. 파일 경로 하드코딩은 파일 이동 시 stale 주석이 된다. 경로보다는 `// e2e 테스트의 EXPECTED_QUEUE_NAMES 목록도 갱신` 수준의 기능 설명이 유지보수에 더 견고하다.
  - 위치: `system-status.constants.ts` 라인 1188 주석
  - 상세: 현재는 사소하나 패턴으로 굳어지면 여러 파일에서 경로 하드코딩이 확산될 수 있다.
  - 제안: 경로보다 책임 중심(`e2e EXPECTED_QUEUE_NAMES`)으로 기술 변경.

- **[INFO]** `system-status.constants.spec.ts` 는 간결하고 목적이 명확하다. 세 개의 독립 `it` 블록이 각각 하나의 assertion 초점을 가지고 있어 가독성이 좋다. 특이사항 없음.

---

### 파일 6: system-status.e2e-spec.ts

- **[INFO]** 테스트 설명(`it(...)`)의 큐 개수가 템플릿 리터럴 `${EXPECTED_QUEUE_NAMES.length}` 로 동적 계산되어 하드코딩 숫자 제거가 잘 적용되었다. 향후 큐 추가 시 테스트 이름이 자동 갱신되어 유지보수 부담이 낮다.

---

### 파일 7–9: plan 문서

- **[INFO]** plan 문서의 체크리스트 항목들은 구체적이고 추적 가능하다. 유지보수성 관점에서는 코드가 아니므로 별도 지적 사항 없음.

---

### 파일 10–14: spec 문서

- **[INFO]** spec 문서 변경은 코드 변경의 반영으로 적절히 동기화되어 있다. 표·의사코드·다이어그램이 구현과 정합하며, 구 Rationale 에 "폐기" 표시를 남기는 방식은 이력 추적에 유용하다.

---

## 요약

이번 변경은 `isCafe24RefreshCapable` → `isRefreshCapable` 일반화, `token_expired` statusReason 추가, passive 알림 제외 정책 적용, 큐 레지스트리 동기화를 다루며, 전반적으로 가독성과 의도 명확성이 높다. 핵심 로직의 네이밍 개선(`isRefreshCapable`)과 중복 검증 코드를 헬퍼로 추출(`hasSavedExpired`, `getNotifResourceIds`)한 리팩토링은 긍정적이다. 다만 (1) `getNotifResourceIds` 헬퍼가 첫 번째 호출만 검사하는 제약이 함수명·JSDoc에 드러나지 않고, (2) 새 W-2 테스트가 같은 파일의 헬퍼를 사용하지 않아 패턴 불일치, (3) `token_expired` 인라인 주석이 파일 내 다른 항목들에 비해 과도하게 길어 스타일 일관성이 낮은 점이 주요 개선 여지다. Critical·High 수준의 문제는 없으며 모두 낮은 우선순위의 개선 사항이다.

## 위험도

LOW
