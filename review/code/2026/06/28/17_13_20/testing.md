# 테스트(Testing) 리뷰 결과

리뷰 대상: autoRefresh attention 제외 로직 — 4개 코드 파일
diff-base: origin/main

---

## 발견사항

### [INFO] 핵심 변경에 대한 테스트 추가 — 적절
- 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` L1714-L1735 / `codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` L200-L291
- 상세: `needsAttention` 함수의 TODO 제거 및 실구현에 맞춰 프론트엔드 `needsAttention` 단일 술어 테스트 블록 5개가 신설됐다. 백엔드는 `it.each(['expiring', 'attention'])` 으로 두 status 경로를 한 테스트에서 동시 검증한다. `computeAttentionBreakdown` 기존 테스트에 `autoRefresh: false` 픽스처가 추가됐으며, 자동 갱신 행 제외·error/expired 전이 후 재포함 시나리오가 별도 케이스로 커버됐다.
- 제안: 이상 없음.

### [INFO] `needsAttention` — `tokenExpiresAt=null` + `autoRefresh=false` 케이스 테스트 없음
- 위치: `codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` `describe("needsAttention")` 블록
- 상세: 현재 5개 케이스가 추가됐으나, `status="connected"` + `tokenExpiresAt=null` + `autoRefresh=false` 조합이 테스트되지 않았다. `isExpiringSoon(null)` 이 `false` 를 반환하므로 실제 동작은 안전하지만, 이 조합은 연동 토큰이 없는 API Key 타입 통합에서 발생할 수 있는 실제 경로다. `row()` 기본값이 `tokenExpiresAt: null, autoRefresh: true` 이므로 `autoRefresh=false` 단독 케이스(만료 없음)가 의도치 않게 커버 누락됐다.
- 제안: 아래 케이스를 `needsAttention` describe 블록에 추가:
  ```ts
  it("connected + tokenExpiresAt=null + autoRefresh=false → false", () => {
    expect(
      needsAttention(row({ status: "connected", autoRefresh: false, tokenExpiresAt: null })),
    ).toBe(false);
  });
  ```

### [INFO] 백엔드 테스트 — `autoRefreshServiceTypes` 빈 배열 분기(`excludeAutoRefresh` 조건부 skip) 미커버
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` L127-L132 / `codebase/backend/src/modules/integrations/integrations.service.spec.ts`
- 상세: `excludeAutoRefresh` 헬퍼와 `attention` 분기의 `autoRefreshExclusion` 모두 `autoRefreshServiceTypes.length > 0` 가드를 통해 빈 배열일 때 절을 생략한다. 현재 registry 에 항상 cafe24/google/makeshop 이 존재하므로 이 경로는 런타임에서 실행되지 않는다. 그러나 이 경로는 테스트로 커버되지 않아, 향후 registry 정리 시 silent regression 가능성이 있다.
- 제안: `SERVICE_REGISTRY` 를 모킹해 `supportsTokenAutoRefresh=true` 항목이 0개인 상태를 시뮬레이션하는 테스트 추가를 고려한다. 단, registry 가 모듈-레벨 상수여서 Jest `jest.mock` 적용이 다소 번거롭다면, 코드 내부의 `autoRefreshServiceTypes` 도출 로직을 별도 헬퍼로 추출해 독립 단위 테스트를 작성하는 방법도 있다. 현재 운영상 위험은 없으므로 INFO 수준.

### [INFO] 백엔드 `attention` 분기 — `autoRefreshExclusion` 인라인 경로의 단독 SQL 구조 검증 없음
- 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` L1714-L1735
- 상세: 추가된 `it.each(['expiring', 'attention'])` 테스트는 `qb.andWhere.mock.calls` 에서 `'i.service_type NOT IN (:...autoRefreshServiceTypes)'` 문자열을 포함하는 호출을 탐색한다. `expiring` 분기는 `excludeAutoRefresh(qb)` 헬퍼를 통해 최상위 `andWhere` 로 전달되므로 이 탐색이 명확히 히트한다. 반면 `attention` 분기는 동일 조건이 OR 복합 표현식 문자열(`autoRefreshExclusion`) 안에 인라인으로 포함되어 있어, `qb.andWhere` 의 첫 번째 인자가 전체 OR 덩어리 문자열이다. 현재 테스트가 `.find((c) => String(c[0]).includes(fragment))` 로 부분 문자열 검색을 하므로 `attention` 분기도 정상적으로 탐지된다. 문제는 없으나, 두 경로의 SQL 구조적 차이(최상위 AND vs 인라인 OR 서브조건)가 테스트에서 명시적으로 구분·문서화되지 않아 향후 `attention` 분기 SQL 구조 변경 시 구조적 차이가 회귀됐음을 감지하기 어렵다.
- 제안: `attention` 케이스 전용 추가 단언을 삽입해 `qb.andWhere` 호출이 복합 OR 구조 내에 `autoRefreshServiceTypes` 파라미터를 포함함을 검증하면 두 경로 구현 차이가 명시적으로 회귀 방지된다. 필수 수정은 아니며 INFO 수준.

### [INFO] `computeStatus` — `autoRefresh=true` + `expiresSoon` 경로의 `label`/`tone` 미단언
- 위치: `codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` L155-L191
- 상세: 기존 `computeStatus` 테스트 중 `autoRefresh=true` + `expiresSoon` 케이스에서 `subLabel` 이 `"Auto-renews · next in "` 으로 시작하는지만 검증한다. `autoRefresh=true` 이면서 만료 임박인 경우 `computeStatus` 가 `expiresSoon` 분기를 우회해 `label="Connected"` + `tone="ok"` 를 반환하는지가 테스트에서 명시적으로 단언되지 않아, 이 경로의 의도가 테스트 독자에게 불명확하다.
- 제안: `expect(view.label).toBe("Connected")` + `expect(view.tone).toBe("ok")` 를 동일 케이스에 추가해 `expiresSoon` 분기가 `autoRefresh=true` 에 의해 우회됨을 문서화한다. 필수 아님.

### [INFO] 기존 `computeAttentionBreakdown` 픽스처 갱신 — 회귀 방지 적절
- 위치: `codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` L299, L391, L404, L429
- 상세: `row()` 기본값이 `autoRefresh: true` 이므로 `connected` + `tokenExpiresAt` 임박 기존 케이스들에 `autoRefresh: false` 를 명시 삽입했다. 갱신이 누락됐다면 `needsAttention` 구현 변경으로 기존 테스트가 silent pass → false로 뒤바뀌는 회귀가 발생했을 것이다. 올바르게 수행됐다.
- 제안: 없음.

### [INFO] 테스트 격리 및 시간 고정 — 적절
- 위치: `codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` L16-L22
- 상세: `beforeEach/afterEach` 에서 `vi.useFakeTimers()` + `vi.setSystemTime(new Date("2026-06-28T00:00:00Z"))` 로 시스템 시간을 고정한다. 이는 `isExpiringSoon` · `humanizeUntil` · `daysUntil` 이 모두 `Date.now()` 에 의존하는 상황에서 flaky 를 방지하는 올바른 접근이다. 신규 `needsAttention` · `computeAttentionBreakdown` 테스트도 동일 타이머 고정 환경에서 실행되어 격리가 유지된다.
- 제안: 없음.

---

## 요약

이번 변경의 핵심인 `needsAttention` TODO 해소와 백엔드 `expiring`/`attention` 쿼리 `autoRefresh` 제외 로직에 대한 테스트가 적절히 추가됐다. `needsAttention` 5개 단위 케이스, `computeAttentionBreakdown` autoRefresh 제외·error 전이 재포함 시나리오, 백엔드 `it.each` registry 파라미터 바인딩 검증이 모두 신설됐으며, 기존 픽스처의 `autoRefresh: false` 갱신도 누락 없이 수행됐다. 실질적인 커버리지 갭은 (1) `tokenExpiresAt=null + autoRefresh=false` 경로 미단언, (2) `autoRefreshServiceTypes` 빈 배열 방어 분기 미커버, (3) `attention` 분기 인라인 SQL 구조 단독 검증 부재로, 모두 INFO 수준이며 운영 위험도는 없다. 테스트 격리(fakeTimers 전역 setup/teardown)와 가독성(명세 주석 포함) 모두 양호하다.

---

## 위험도

LOW
