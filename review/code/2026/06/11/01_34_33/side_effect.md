# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `isCafe24RefreshCapable` → `isRefreshCapable` 함수명 변경 — 모듈 내부 함수이므로 호출자 영향 없음
- 위치: `integration-expiry-scanner.service.ts`, 함수 선언부
- 상세: 파일 내부 private 함수(`function isCafe24RefreshCapable`)를 `isRefreshCapable`로 rename. 모듈 외부로 export되지 않으므로 다른 파일의 호출자에게 영향이 전혀 없다. 동일 파일 내 단일 호출 지점도 함께 변경되어 단절 없음.
- 제안: 변경 적절. 추가 조치 불필요.

### [INFO] `isRefreshCapable` 로직 확장 — makeshop 분기 추가로 기존 cafe24 동작 유지 여부 확인
- 위치: `integration-expiry-scanner.service.ts`, `isRefreshCapable` 함수 본문
- 상세: 기존 `isCafe24RefreshCapable`는 `serviceType !== 'cafe24'`이면 즉시 false 반환했다. 새 함수는 `serviceType !== 'cafe24' && serviceType !== 'makeshop'`이면 false 반환한다. cafe24의 `credentials.refresh_token` 존재 체크 로직은 동일하게 유지된다. 기존 cafe24 통합은 동일한 `refresh_token` 체크를 거치므로 동작 변화 없음. makeshop 신규 분기는 의도된 확장이다.
- 제안: 변경 적절.

### [INFO] `run()` 루프 흐름 구조 변경 — refresh-capable provider에 대해 `claimThreshold` 호출이 사전에 skip됨
- 위치: `integration-expiry-scanner.service.ts`, `run()` 내부 루프
- 상세: 기존 코드는 모든 provider에 대해 `claimThreshold` (→ `integration_expiry_dispatch` INSERT)를 먼저 수행하고, claim 성공 후 0d cafe24 분기에서 큐 enqueue 또는 expired 격하를 선택했다. 변경 후에는 `isRefreshCapable`이 true이면 `claimThreshold`를 호출하지 않고 `continue`로 이탈한다. 즉 refresh-capable provider는 `integration_expiry_dispatch` 테이블에 행을 남기지 않는다. 이 변화는 spec §11.2 의도("dedup claim 생성하지 않음")와 일치하며, 기존에 cafe24에 대해 enqueue + 알림이 발사되던 동작에서 cafe24 enqueue는 유지하되 claim·알림을 제거하는 것이 목표다.

  잠재적 관찰 포인트: `integration_expiry_dispatch`에 cafe24·makeshop의 claim이 없어지므로, 해당 테이블을 읽어 "임박 알림 발사 여부"를 판단하는 별도 코드가 있다면 영향받을 수 있다. 그러나 diff 범위 내에서 해당 테이블을 consumer 측에서 읽는 경로는 확인되지 않는다. claim 자체가 dedup 목적이므로 발사하지 않는 것은 부작용이 아니라 정상 설계 변경이다.
- 제안: 변경 적절. `integration_expiry_dispatch`의 다른 consumer가 없는지 확인 권장이나 현재 diff 범위에서는 문제 없음.

### [INFO] `statusReason` 변경: `null` → `'token_expired'` — DB 컬럼값 변화
- 위치: `integration-expiry-scanner.service.ts`, `run()` 0d 격하 분기
- 상세: 기존 코드는 `integration.statusReason = null`을 명시했다(또는 변경하지 않았다). 변경 후 `integration.statusReason = 'token_expired'`로 저장된다. 이 값은 `INTEGRATION_STATUS_REASONS` union에 새로 추가된 유효 슬러그다. API 응답에서 `statusReason`을 읽는 프론트엔드 또는 외부 연동이 있을 경우, 기존에 `null` 또는 `undefined`를 기대하던 코드가 `'token_expired'` 문자열을 수신하게 된다.
  - `normalizeStatusReason` 헬퍼가 `raw`가 유효 슬러그이면 그대로 반환하므로 API 직렬화 경로의 정규화 로직은 문제 없다.
  - 프론트엔드 UI에서 `statusReason`을 switch/case로 분기하는 코드가 있다면 `'token_expired'` case를 처리하지 않고 fallthrough될 수 있다. 단, diff에 포함된 프론트엔드 변경은 문서(MDX) 파일뿐이며 UI 로직 변경은 없다.
- 제안: 프론트엔드 `statusReason` 표시 로직에 `'token_expired'`에 대한 분기 또는 fallback이 존재하는지 별도 확인 권장. 현재 diff 범위에서 직접적인 문제는 없음.

### [INFO] `INTEGRATION_STATUS_REASONS` 상수 배열에 `'token_expired'` 추가 — 공개 타입 확장
- 위치: `integration-status-reason.ts`
- 상세: `as const` 배열에 새 슬러그가 추가되어 `IntegrationStatusReason` 유니온 타입이 확장된다. 기존 코드에서 이 타입을 exhaustive check(예: `never` assertion이 있는 switch)로 사용하는 곳이 있다면 TypeScript 컴파일 오류가 발생한다. 단, 이는 컴파일 타임에 탐지되며 런타임 부작용은 없다. STATUS_REASON_SET의 런타임 Set도 새 값을 포함하게 되어 `normalizeStatusReason('token_expired')`가 이제 `'token_expired'`를 그대로 반환한다(이전에는 `'unknown_error'` 반환).
- 제안: exhaustive switch가 있는 코드를 검색해 TypeScript 오류 여부 확인 권장. 빌드 PASS가 이미 확인됐으므로(plan 체크리스트) 실제 미처리 case는 없는 것으로 보인다.

### [INFO] `MONITORED_QUEUES` 배열에 makeshop 큐 항목 추가 — 런타임 모니터링 확장
- 위치: `system-status.constants.ts`
- 상세: `MONITORED_QUEUES` readonly 배열에 새 항목이 추가된다. 이 배열에서 파생된 `SYSTEM_STATUS_QUEUE_NAMES`도 자동으로 makeshop 큐 이름을 포함하게 된다. 이 배열을 기반으로 BullModule.registerQueue 및 DI factory가 설정되므로, 애플리케이션 시작 시 Redis에 `makeshop-token-refresh` 큐 연결이 추가된다. 해당 큐가 Redis에 존재하지 않더라도 BullMQ는 큐를 자동 생성하므로 런타임 오류는 없다.
- 제안: 변경 적절. `MAKESHOP_REFRESH_QUEUE` 상수가 `makeshop-token-refresh.constants.ts`에 올바르게 정의되어 있는지 확인 필요하나, import가 TypeScript 컴파일을 통과했으므로 존재 확인됨.

### [INFO] e2e 테스트의 하드코딩된 큐 개수 제거 (`13개` → 동적 계산)
- 위치: `test/system-status.e2e-spec.ts`
- 상세: it 설명의 `'인증 시 13개 큐의 집계 상태를 반환한다'`를 ``인증 시 ${EXPECTED_QUEUE_NAMES.length}개 큐의 집계 상태를 반환한다``로 변경. 이는 테스트 설명 문자열의 변경이며 실제 검증 로직(`expect(names).toEqual([...EXPECTED_QUEUE_NAMES].sort())`)은 유지된다. 부작용 없음.
- 제안: 변경 적절.

### [INFO] 테스트 파일의 헬퍼 함수 추가 — 테스트 파일 scope 전역 변수 형태이나 실제 부작용 없음
- 위치: `integration-expiry-scanner.service.spec.ts`, `getNotifResourceIds`, `hasSavedExpired`
- 상세: 두 함수가 테스트 파일 모듈 scope에 추가된다. 이들은 `jest.Mock`의 `.mock.calls`를 **읽기만** 하며, mock 상태를 변경하지 않는다. 순수 헬퍼 함수이므로 테스트 격리에 영향 없음. 기존에 인라인으로 중복 작성되던 동일 로직을 추출한 것이므로 동작 변경 없음.
- 제안: 변경 적절.

### [INFO] 문서(MDX) 파일 변경 — 런타임 부작용 없음
- 위치: `integration-management.mdx`, `integration-management.en.mdx`, `makeshop.mdx`, `makeshop.en.mdx`
- 상세: 사용자 문서에 refresh-capable provider의 알림 정책 안내 문단이 추가된다. 정적 콘텐츠 파일이므로 런타임 상태, 전역 변수, API 동작에 영향 없음.
- 제안: 변경 적절.

---

## 요약

이번 변경은 `integration-expiry-scanner.service.ts`의 refresh-capable 판별 범위를 cafe24에서 cafe24·makeshop으로 확장하고, refresh-capable provider에 대해 `claimThreshold` 호출 및 passive 알림 발사를 완전히 건너뛰는 구조로 재편한다. 주요 부작용 위험으로는 (1) 기존에 `null`이던 `statusReason`이 `'token_expired'`로 바뀌어 API 응답 소비자(특히 프론트엔드 switch 분기)가 영향받을 수 있으나, 빌드 PASS와 `normalizeStatusReason` 정규화 헬퍼가 이를 흡수하며, (2) `integration_expiry_dispatch` 테이블에 refresh-capable provider의 claim이 생성되지 않게 되어 해당 테이블의 다른 consumer가 있다면 영향받을 수 있으나 diff 범위 내에서는 consumer가 확인되지 않는다. 전역 변수 신규 도입, 의도치 않은 파일시스템 접근, 환경 변수 변경, 예상 밖 네트워크 호출은 없다. `isRefreshCapable` 함수는 모듈 내부 함수이므로 외부 API 시그니처 변경도 없다. `INTEGRATION_STATUS_REASONS` 타입 확장에 따른 exhaustive switch 누락은 빌드 통과로 이미 검증됐다.

## 위험도

LOW
