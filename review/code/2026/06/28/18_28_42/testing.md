# 테스트(Testing) 리뷰 결과

리뷰 대상: autoRefresh attention 술어 구현
- `codebase/backend/src/modules/integrations/integrations.service.spec.ts`
- `codebase/backend/src/modules/integrations/integrations.service.ts`
- `codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx`
- `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx`
- `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.en.mdx`
- `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx`
diff-base: origin/main

---

## 발견사항

### [INFO] backend `it.each` 테스트: expiring vs attention 경로의 SQL fragment 검증 방식 차이
- 위치: `integrations.service.spec.ts` L1711–L1733 (`it.each` 블록)
- 상세: `expiring` 분기는 `excludeAutoRefresh(qb)` 헬퍼를 통해 최상위 `andWhere` 를 추가하는 반면, `attention` 분기는 인라인 문자열 템플릿(`autoRefreshExclusion`)을 단일 OR-복합 절 안에 포함시킨다. 테스트는 두 경로 모두 `qb.andWhere.mock.calls.find(c => String(c[0]).includes('i.service_type NOT IN (:...autoRefreshServiceTypes)'))` 로 검사하는데, `attention` 의 경우 해당 fragment 가 단일 큰 문자열의 일부로 전달되므로 `String(c[0]).includes(...)` 가 여전히 통과한다. 그러나 `expiring` 에서는 독립 `andWhere` 호출이 발생하고, `attention` 에서는 같은 문자열에 embedd 된다 — 두 경로의 구조적 차이를 현재 테스트가 추상화해버리므로, 향후 `attention` 분기가 `excludeAutoRefresh` 헬퍼로 리팩터됐을 때 테스트를 변경하지 않아도 통과해버리는 상황이 된다(false-pass). 실질적 동작 검증은 올바르다.
- 제안: 필요하다면 `attention` 케이스에 한해 `qb.andWhere.mock.calls` 의 마지막 인자(파라미터 객체)에서 `autoRefreshServiceTypes` 가 올바른 위치(복합 절 안)에 들어갔는지 별도로 단언하거나, 인라인 vs 헬퍼 구조 차이를 주석으로 명시해 리팩터 시 테스트 갱신이 필요함을 안내한다. 현재로서는 기능 정확성 검증 자체는 충분하다.

### [INFO] `needsAttention` 테스트: `connected + tokenExpiresAt=undefined` 케이스 미포함
- 위치: `status-badge.test.tsx` L203–L247 (신규 `needsAttention` describe 블록)
- 상세: 6개 케이스 중 `null` 처리(`tokenExpiresAt: null`)는 커버되어 있으나, `tokenExpiresAt: undefined` 는 테스트하지 않는다. `isExpiringSoon` 내부에서 `if (!at) return false` 가 `undefined` 도 처리하므로 실제 동작은 안전하다. `IntegrationDto.tokenExpiresAt` 타입이 `string | null` (undefined 불허)이면 TS 수준에서 방어된다.
- 제안: DTO 타입이 `null` 만 허용하고 `undefined` 를 배제한다면 현재 테스트 범위가 적절하다. 타입을 확인하고 `string | null | undefined` 이면 `undefined` 케이스를 추가한다.

### [INFO] `computeStatus` 테스트: `autoRefresh=true + expiresSoon=false` 경로 커버리지
- 위치: `status-badge.test.tsx` `computeStatus` describe 블록
- 상세: 이번 변경으로 `computeStatus` 에 `!integration.autoRefresh` 조건이 추가됐다. 기존 테스트 중 `"falls back to 'Expires in Nd' when autoRefresh=false and expiresSoon"` 케이스는 존재하나, `autoRefresh=false + expiresSoon=true` (→ 노란 배지) 경로의 subLabel 부재와 `autoRefresh=true + expiresSoon=false` (→ Connected + subLabel 있음) 경로가 명시적으로 분리되어 있지 않다. 기존 테스트가 `autoRefresh=true` 인 `row()` 기본값을 쓰는데, `tokenExpiresAt=null` 이라 `subLabel` 이 없는 케이스다. `autoRefresh=true + tokenExpiresAt` 존재하는 케이스의 subLabel 검증은 "Auto-renews subLabel" 테스트에서 커버된다.
- 제안: 사실상 커버되어 있으나 명칭·배치가 다소 산재되어 있다. 이슈 없음.

### [INFO] backend 테스트: `hasAutoRefreshTypes=false` (빈 목록) 분기 미커버
- 위치: `integrations.service.ts` L119 (`const hasAutoRefreshTypes = autoRefreshServiceTypes.length > 0`)
- 상세: `SERVICE_REGISTRY` 에서 `supportsTokenAutoRefresh=true` 인 항목이 없는 경우(`hasAutoRefreshTypes=false`) `excludeAutoRefresh` 헬퍼는 아무것도 추가하지 않고, `attention` 분기에서도 `autoRefreshExclusion = ''` 이 된다. 현재 spec 에는 cafe24/google/makeshop 이 있어 실제로 빈 목록이 될 수 없으나, `SERVICE_REGISTRY.filter(...)` 결과가 항상 비어있지 않다는 가정 하에만 안전하다. 이 분기를 테스트하려면 `SERVICE_REGISTRY` 를 mock 해야 하는데, 현재 테스트는 실제 registry 를 import 해 직접 참조하므로 mock 이 없다.
- 제안: 이 분기는 현재 production 에서 발생할 수 없고 테스트 코드가 `expect(expected.length).toBeGreaterThan(0)` 로 실제 registry 비어있음을 guard 한다. 실용적으로 문제 없음. 향후 service_type 대규모 정리 시 이 분기를 테스트하려면 registry mock 이 필요하다는 점을 주석으로 남겨두면 좋다.

### [INFO] frontend `needsAttention` 테스트: `connected + autoRefresh=true + tokenExpiresAt=null` (autoRefresh 있으나 토큰 없음) 케이스 미포함
- 위치: `status-badge.test.tsx` L203–L247
- 상세: `autoRefresh=true` 이고 `tokenExpiresAt=null` 인 케이스는 `isExpiringSoon(null) → false` + `!autoRefresh=false` 이므로 전체 결과 `false`. 명시적 테스트는 없으나 `"connected + tokenExpiresAt=null + autoRefresh=false → false"` 케이스와 단순 조합이다. 로직이 단순하므로 심각한 갭은 아니지만, `needsAttention` describe 블록을 완전성 측면에서 보면 `autoRefresh=true + no-expiry` 케이스는 문서화 가치가 있다.
- 제안: `"connected + tokenExpiresAt=null + autoRefresh=true → false (만료 기준 없음)"` 케이스 하나 추가 권장 — 약한 선호.

---

## 요약

이번 변경은 테스트 추가가 구현과 함께 충실히 이루어졌다. backend `integrations.service.spec.ts` 에 `it.each(['expiring', 'attention'])` 으로 registry 동적 조회 결과·SQL fragment·파라미터 바인딩을 동시에 검증하며, frontend `status-badge.test.tsx` 에는 독립적인 `needsAttention` describe 블록(6케이스)과 `computeAttentionBreakdown` 보완 테스트(2케이스)가 추가됐다. 테스트 격리는 `beforeEach/afterEach` 의 `vi.useFakeTimers()` 로 시간 경계 flaky 를 제거해 견고하다. 기존 회귀 테스트(`autoRefresh=false` 기본값 변경 없이 `autoRefresh` 명시 오버라이드 추가)도 적절히 갱신됐다. 발견된 갭은 모두 INFO 수준으로, `hasAutoRefreshTypes=false` 방어 분기와 `needsAttention` 의 일부 조합 케이스가 커버되지 않으나 이는 실제 production 에서 도달 불가능한 경로이거나 단순 조합이다. Critical·Warning 수준의 테스트 결함은 없다.

## 위험도

LOW
