# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `getNotifResourceIds` / `hasSavedExpired` 헬퍼 함수 추출 — 긍정적 변경
- 위치: `integration-expiry-scanner.service.spec.ts` L41–61
- 상세: 인라인으로 반복되던 `save.mock.calls.flat() + arr.some(...)` 17줄짜리 중복 패턴을 두 개의 명명된 헬퍼로 추출하여 가독성과 재사용성이 향상됐다. JSDoc 도 작성돼 함수 의도가 명확하다.
- 제안: 없음 (이미 적절함).

### [WARNING] `isRefreshCapable` 내부의 serviceType 비교 — 확장 취약성
- 위치: `integration-expiry-scanner.service.ts` — `isRefreshCapable` 함수 (diff +469~+477)
- 상세: `serviceType !== 'cafe24' && serviceType !== 'makeshop'` 형태의 부정형 OR 조건은 새 provider 추가 시 빠뜨릴 가능성이 높다. 함수 JSDoc 의 "향후 여기에 추가" 문구가 있지만, 부정 조건 특성상 새 항목 누락이 묵시적으로 `false`(비-refresh-capable)로 처리되어 버그가 발생한다.
  ```ts
  // 현재: 부정형 guard
  if (serviceType !== 'cafe24' && serviceType !== 'makeshop') return false;

  // 제안: 허용 목록(allowlist) 방식
  const REFRESH_CAPABLE_SERVICE_TYPES = new Set(['cafe24', 'makeshop'] as const);
  if (!REFRESH_CAPABLE_SERVICE_TYPES.has(integration.serviceType)) return false;
  ```
  혹은 `switch` 문으로 명시적 열거. Set 방식은 O(1) 조회를 유지하면서 확장 시 한 곳만 수정한다.
- 제안: `REFRESH_CAPABLE_SERVICE_TYPES` 상수 Set 또는 타입 가드 배열로 교체.

### [WARNING] `§11.2 의도적 설계` 블록 주석 — 과도한 인라인 설명이 함수 가독성을 저해
- 위치: `integration-expiry-scanner.service.ts` diff +419~+425 (continue 앞 8줄 블록 주석)
- 상세: spec 참조·배경 설명이 8줄에 걸쳐 함수 흐름에 삽입돼 있다. 주석 자체는 정확하지만, 독자가 핵심 제어 흐름(`continue`)을 파악하려면 주석을 전부 읽어야 한다. 이 정도의 설계 배경은 함수 상단 또는 `isRefreshCapable` JSDoc 으로 이동하는 것이 중첩 흐름 가독성에 유리하다.
- 제안: `continue` 직전 한 줄 요약 주석만 남기고("§11.2: refresh-capable → skip claim/격하/알림"), 나머지는 `isRefreshCapable` JSDoc 의 기존 설명과 통합.

### [INFO] `5 * 24 * 60 * 60 * 1000` 반복 리터럴 — 매직 넘버
- 위치: `integration-expiry-scanner.service.spec.ts` diff +272, +311
- 상세: `5 * 24 * 60 * 60 * 1000`, `2 * 24 * 60 * 60 * 1000` 형태로 밀리초 변환 표현이 두 테스트에 각각 등장한다. 상수화하거나 헬퍼 `daysMs(n)` 을 추출하면 의도가 명확해진다.
  ```ts
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const expires = new Date(now.getTime() + 5 * MS_PER_DAY);
  ```
- 제안: 스펙 파일 상단에 `MS_PER_DAY` 상수 선언.

### [INFO] 테스트 픽스처 중복 — `userRepo.find` 설정 패턴 반복
- 위치: `integration-expiry-scanner.service.spec.ts` 신규 테스트 케이스 4개 (V-01·V-07 관련)
- 상세: `userRepo.find.mockResolvedValue([{ id: 'user-1', notificationPreferences: {} }])` 가 매 테스트에 반복된다. 기존 테스트에서도 동일 패턴이지만 신규 4개가 추가되며 반복이 심화됐다. 기존 `beforeEach` 에 default mock 으로 등록하거나 `userFixture()` 헬퍼를 추출하면 중복이 줄어든다.
- 제안: 기존 패턴 일관성을 따르는 것을 우선하되, 리팩토링 기회 시 `beforeEach` default 로 이동 고려.

### [INFO] `system-status.constants.spec.ts` `names` 변수 — 테스트 파일 상단 `describe` 밖 공유 상태
- 위치: `system-status.constants.spec.ts` L8 (`const names = MONITORED_QUEUES.map(...)`)
- 상세: `describe` 블록 안의 첫 줄에 `names` 를 선언했으나, 각 `it` 이 동일 `names` 를 사용하는 구조다. 현재는 mutation 이 없어 문제없지만, 추후 `it` 에서 `names` 를 수정하는 경우 테스트 간 오염 가능성이 있다. `beforeEach`/`beforeAll` 내 선언 패턴이 더 명확하다.
- 제안: 문제가 될 상황은 아니나, `const` 고정값이므로 INFO 수준 기록.

### [INFO] e2e 테스트 설명 문자열 자동화 — 긍정적 변경
- 위치: `system-status.e2e-spec.ts` diff +854
- 상세: 하드코딩된 `'13개 큐'` 문자열을 `` `${EXPECTED_QUEUE_NAMES.length}개 큐` `` 로 교체하여, 목록이 바뀔 때 테스트 설명이 자동으로 반영된다. 유지보수성 향상.
- 제안: 없음.

### [INFO] `integration-status-reason.ts` — NOTE 주석의 네임스페이스 경고
- 위치: `integration-status-reason.ts` L498–500
- 상세: `token_expired` 슬러그가 JWT 에러 코드·WS 이벤트와 표기가 유사하다는 NOTE 주석은 적절하다. 혼동을 예방하는 명시적 네임스페이스 경고로 유지보수에 기여한다.
- 제안: 없음.

---

## 요약

이번 변경은 전반적으로 유지보수성이 향상된 방향이다. 테스트 헬퍼 추출(`getNotifResourceIds`, `hasSavedExpired`)은 중복 제거와 가독성 면에서 명확한 개선이며, e2e 테스트의 큐 수 자동화도 긍정적이다. 주요 주의점은 `isRefreshCapable` 의 부정형 OR 조건으로, 새 refresh-capable provider 추가 시 묵시적으로 `false` 처리되는 확장 취약성이 있다 (WARNING). `§11.2 의도적 설계` 블록 주석은 설계 배경을 인라인에 과도하게 담아 제어 흐름 가독성을 낮추며, JSDoc 으로 이동하는 편이 낫다 (WARNING). 매직 넘버(`5 * 24 * 60 * 60 * 1000`)와 픽스처 반복은 INFO 수준이며 즉각 수정 필수는 아니다.

## 위험도

LOW
