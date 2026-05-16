# Testing Review

## 발견사항

### 백엔드 — integrations.service.spec.ts

- **[INFO]** `status=attention` 유닛 테스트 3개가 SQL 문자열 포함 검증(substring match)에 의존함
  - 위치: `integrations.service.spec.ts` — 신규 테스트 3개 전체 (`qb.andWhere.mock.calls.map((c) => c[0]).join(' | ')`)
  - 상세: SQL 조각 문자열 매칭(`toContain("'expired'")`, `toContain("7 days")` 등)은 실제 쿼리 결과가 아니라 구현 내부의 raw SQL 리터럴에 묶인다. `INTERVAL '7 days'` 가 `INTERVAL '7d'` 나 `INTERVAL :interval` 방식으로 리팩터되면 테스트가 실패하지만 실제 동작은 동일하다. 반대로 문자열이 포함만 되면 통과하기 때문에 잘못된 파라미터 바인딩(예: `{ s: 'connected' }` 가 다른 분기에서 남아있는 경우)은 잡지 못한다.
  - 제안: 백엔드 테스트 계층 전략을 보완 — QueryBuilder mock을 통한 SQL fragment 검증은 현행 수준에서 허용하되, e2e/integration 계층(`make e2e-test`)에서 실 DB 기반 결과 행 집합을 검증하는 테스트를 추가해 SQL 의미 정합성까지 커버할 것.

- **[WARNING]** `status=attention` 에 대한 SQL 경계값 테스트가 없음 — 7일 경계(exactly 7d, 7d+1초, 만료 직전)
  - 위치: `integrations.service.spec.ts` — 신규 테스트 블록
  - 상세: 서비스 코드의 `i.token_expires_at <= NOW() + INTERVAL '7 days'` 경계값이 유닛 레벨에서 확인되지 않는다. `token_expires_at = NOW() + exactly 7d` 이 포함(≤)이고 `NOW() + 7d + 1ms` 가 제외됨을 검증하는 케이스가 없다. Mock QBuilder 방식으로는 SQL 실행이 불가하므로 e2e 계층에서 커버가 필수다.
  - 제안: e2e 테스트에 "tokenExpiresAt이 7일 후 경계"·"6일 23시간 후"·"7일 1초 후" 3개 케이스를 추가하고 각 케이스가 attention 결과에 포함/제외됨을 DB 실행 결과로 검증할 것.

- **[INFO]** `attention` 분기 테스트에서 각 테스트마다 `makeQueryBuilder` 를 새로 생성하고 있어 격리는 양호함
  - 위치: `integrations.service.spec.ts` 680~115행
  - 상세: `makeQueryBuilder({ count: 0, many: [] })` 를 각 `it` 블록 최상단에서 독립 생성하여 공유 상태 오염 위험이 없다. 기존 테스트 패턴과 일치한다.
  - 제안: 유지.

- **[INFO]** `status=attention` 테스트가 `expiring` 필터 테스트(기존)의 통과 여부에 영향을 주지 않는지 확인 필요
  - 위치: `integrations.service.spec.ts` 652~666행 (기존 `findAll` 종합 테스트)
  - 상세: 기존 테스트 `applies q/scope/serviceType/status filters...` 는 `status: 'expiring'` 으로 호출해 `expect(sql).toContain('status')` 를 검증한다. `attention` 분기가 추가되어도 `expiring` 분기(`i.status = :s` 방식)는 변경되지 않으므로 회귀 위험은 없다. 다만 기존 테스트의 `toContain('status')` 단언은 매우 약해 `attention` 분기로 들어갔어도 통과할 수 있다. 분기별 단언을 강화하거나 별도 테스트로 분리하는 것이 장기적으로 유리하다.
  - 제안: `attention` 의 전용 테스트 3개는 이미 충분하므로 단기 우선순위는 낮음. 기존 종합 테스트는 향후 리팩터링 시 분리 고려.

---

### 백엔드 — integration.dto.ts

- **[INFO]** DTO 계층의 `@IsIn(INTEGRATION_STATUSES)` 검증이 `attention` 을 포함하도록 배열 갱신됨 — 테스트 없음
  - 위치: `integration.dto.ts` 41~47행, `ListIntegrationsQueryDto`
  - 상세: `@IsIn` 데코레이터는 유효성 검사 파이프가 활성화된 환경에서만 동작한다. `ListIntegrationsQueryDto` 의 유효성 검사를 직접 단위 테스트하는 코드는 diff 에 보이지 않는다. 무효한 값(`'attention'` 이 배열에 없을 때 거부, 유효값일 때 통과)에 대한 유효성 검사 테스트가 없다.
  - 제안: e2e 계층에서 `GET /api/integrations?status=attention` 이 200을 반환하고 `?status=invalid_value` 가 400을 반환하는 케이스를 커버할 것.

---

### 프론트엔드 — status-badge.test.tsx

- **[WARNING]** `computeAttentionBreakdown` 에서 `mostUrgentId` 가 다중 행일 때 우선순위 결정 로직(error > expired > expiring)의 테스트가 누락됨
  - 위치: `status-badge.test.tsx` 151~211행
  - 상세: `mostUrgentId` 는 `total > 1` 일 때에도 "가장 긴급한 항목"의 id를 반환한다고 코드 주석과 JSDoc에 명시되어 있다. 그러나 테스트는 `total === 1` 케이스(`mostUrgentId` = `"only-one"`)만 검증하며, `total > 1` 이고 error + expired + expiring 이 혼재할 때 error 항목의 id가 반환되는지는 검증하지 않는다. 이 로직은 현재 `total === 1` UX에서만 사용되지만 향후 오용 방지를 위해 다중 행 우선순위 동작을 명시적으로 검증해야 한다.
  - 제안: 다음 케이스를 추가할 것:
    ```ts
    it("mostUrgentId resolves to the error row when error and expired both present", () => {
      const items = [
        row({ id: "expiring-one", status: "connected", tokenExpiresAt: inDays(1) }),
        row({ id: "expired-one", status: "expired" }),
        row({ id: "error-one", status: "error" }),
      ];
      expect(computeAttentionBreakdown(items).mostUrgentId).toBe("error-one");
    });
    ```

- **[INFO]** `computeAttentionBreakdown` 빈 배열 입력 케이스 미검증
  - 위치: `status-badge.test.tsx` 151~211행
  - 상세: `integrations = []` (빈 배열) 를 넘겼을 때 `{ expired: 0, expiring: 0, error: 0, total: 0, mostUrgentId: null }` 이 반환되는지 테스트가 없다. 구현상 정상 동작하지만 계약을 명시하는 테스트가 없다.
  - 제안: 간단한 케이스이므로 추가 권장:
    ```ts
    it("returns zeroed breakdown for empty list", () => {
      const br = computeAttentionBreakdown([]);
      expect(br.total).toBe(0);
      expect(br.mostUrgentId).toBeNull();
    });
    ```

- **[INFO]** `inDays(0)` (오늘 자정, 즉 만료 0일) 의 `needsAttention` / `isExpiringSoon` 경계값 케이스 없음
  - 위치: `status-badge.test.tsx` — `computeAttentionBreakdown` describe 블록
  - 상세: `inDays(2)` 와 `inDays(30)` 을 사용해 "7일 이내"와 "7일 초과"를 각각 테스트하고 있다. 정확히 7일인 경우(`inDays(7)`)의 경계 포함 여부와, 이미 만료(`inDays(-1)`)가 `status='expired'` 가 아닌 `status='connected'` 상태에서 어떻게 처리되는지는 검증되지 않는다. `isExpiringSoon` 은 `ms > 0` 조건으로 이미 지난 날짜를 false로 처리하지만, 이 경계값이 `computeAttentionBreakdown` 레벨에서 명시되지 않았다.
  - 제안: `inDays(7)` 이 expiring 으로 계산되고 `inDays(7) + 1ms` 는 포함되지 않는지를 확인하는 케이스를 추가.

- **[INFO]** `needsAttention` 함수 자체에 대한 전용 테스트가 없음 (간접 검증만 존재)
  - 위치: `status-badge.test.tsx`
  - 상세: `needsAttention` 은 `computeAttentionBreakdown` 을 통해 간접 검증되고 있으나, `needsAttention` 단독 단언이 없다. `needsAttention(row({ status: 'pending_install' })) === false` 처럼 명시적 테스트가 있으면 회귀 추적이 쉽다.
  - 제안: 기존 `isReauthorizeDisabled` describe 패턴에 맞춰 `needsAttention` describe 블록 추가 고려.

---

### 프론트엔드 — integrations-page.test.tsx

- **[WARNING]** `hides the banner when there are no attention rows` 테스트에서 `status='connected'` 이고 `tokenExpiresAt=null` 인 행만 사용해 "주의 없음" 케이스를 검증함 — connected + tokenExpiresAt 7일 초과 케이스 누락
  - 위치: `integrations-page.test.tsx` 300~310행
  - 상세: `attentionRow({ id: "ok", status: "connected" })` 는 `tokenExpiresAt: null` 이므로 `needsAttention` 이 false를 반환해 배너가 숨겨진다. 그러나 `status: 'connected', tokenExpiresAt: inDays(30)` 처럼 만료가 있지만 7일을 초과한 케이스에서도 배너가 숨겨지는지 검증하면 `isExpiringSoon` 의 임계값 로직이 page 레벨까지 올바르게 연결됨을 보장할 수 있다.
  - 제안: 추가 케이스(선택 사항이지만 경계값 커버로 권장):
    ```ts
    it("hides the banner for connected integration with tokenExpiresAt 30 days away", async () => { ... });
    ```

- **[WARNING]** `AttentionBanner` 컴포넌트 자체의 독립 단위 테스트 없음 — 페이지 통합 테스트를 통해서만 간접 검증
  - 위치: `frontend/src/app/(main)/integrations/page.tsx` — `AttentionBanner` 함수 컴포넌트 (338~636행)
  - 상세: `AttentionBanner` 는 breakdown props를 받아 title·색상·breakdown 문구를 렌더링하는 독립 컴포넌트이나 별도 단위 테스트 파일이 없다. 현재는 `integrations-page.test.tsx` 에서 페이지 전체를 렌더링하고 배너 존재/클릭/색상을 확인한다. 이는 필요한 커버리지를 제공하지만 `AttentionBanner` 단독의 props 조합(예: `breakdown.expired=0, expiring=2, error=0` 일 때 Expired 레이블 미노출) 을 직접 검증하지 않는다.
  - 제안: `AttentionBanner` 를 별도 파일(`__tests__/attention-banner.test.tsx`)로 분리하거나 현재 파일에 describe 블록 추가. 특히 breakdown 카테고리 중 0인 항목이 렌더링에서 생략되는지를 검증하는 케이스 권장.

- **[INFO]** 배너 클릭 시 단일 행 → detail 점프 테스트에서 `mockPush` vs `mockReplace` 양쪽을 모두 검사하는 방어 로직이 있음 — 의도 명확하지 않을 수 있음
  - 위치: `integrations-page.test.tsx` 265~270행
  - 상세:
    ```ts
    const jumpedTo = lastPush ?? lastReplace ?? "";
    ```
    `lastPush` 가 없으면 `lastReplace` 로 폴백하는 방식은 구현이 `replace` 를 쓰든 `push` 를 쓰든 테스트를 통과시킨다. 테스트 주석에 "detail jump uses push, not replace"라고 명시되어 있으나 실제로는 `push` 를 강제하지 않는다. 코드 리뷰 주석의 의도대로 `push` 를 강제하려면 `expect(mockPush).toHaveBeenCalled()` 단언을 추가해야 한다.
  - 제안:
    ```ts
    expect(mockPush).toHaveBeenCalled();
    const url = mockPush.mock.calls.at(-1)?.[0] as string;
    expect(url).toContain("/integrations/lonely");
    ```

- **[INFO]** `uses the red error tone` 테스트에서 `banner.className` 에 `"red"` 가 포함되는지를 substring 매칭으로 검증
  - 위치: `integrations-page.test.tsx` 273~284행
  - 상세: `expect(banner.className).toMatch(/red/)` 는 클래스명에 `"red"` 가 포함된 Tailwind 클래스가 있으면 통과한다. `dark:border-red-900` 같은 다크 모드 클래스만 남더라도 통과할 수 있다. 현재 구현에선 `border-red-300 bg-red-50 text-red-900` 조합이 한꺼번에 적용되므로 실질적 문제는 없으나, 특정 클래스(예: `bg-red-50` 포함 여부)를 정확히 검증하면 더 견고하다.
  - 제안: 현 수준에서 허용하되, 장기적으로 `hasClass('bg-red-50')` 또는 `data-testid` + aria 속성 기반 검증 전환 고려.

- **[INFO]** `beforeEach` 에서 `cleanup()` 호출이 각 테스트 전에 이루어지며 격리가 보장됨
  - 위치: `integrations-page.test.tsx` 175~181행
  - 상세: `vi.clearAllMocks()` + `cleanup()` 의 조합이 describe 블록 최상단에 있어 상태 오염이 없다. 기존 `describe` 블록들과 격리도 유지된다.
  - 제안: 유지.

---

### 전체 커버리지 갭 요약

| 계층 | 누락된 케이스 | 우선순위 |
|------|-------------|---------|
| 백엔드 e2e | `?status=attention` 실 DB 결과 행 검증, 7일 경계값 | HIGH |
| 백엔드 e2e | `?status=invalid` → 400, `?status=attention` → 200 DTO 검증 | MEDIUM |
| 프론트 unit | `mostUrgentId` 다중 행 우선순위(error > expired > expiring) | MEDIUM |
| 프론트 unit | `computeAttentionBreakdown([])` 빈 배열 | LOW |
| 프론트 unit | `AttentionBanner` 독립 컴포넌트 테스트 (breakdown 카테고리 0 시 미노출) | MEDIUM |
| 프론트 unit | 단일 행 클릭 → `push` 강제 단언 | LOW |

---

## 요약

이번 변경은 "Attention 가상 필터" 신기능의 테스트 커버리지를 충실하게 추가한 편이다. 백엔드에서는 `status=attention` 에 대한 SQL 구조(union WHERE, pending_install 제외, 단일 값 고정 방지) 3가지를 테스트하고, 프론트엔드에서는 breakdown 계산 로직의 핵심 케이스와 배너의 주요 UX 분기(단수/복수 표시, 클릭 시 필터/점프, 색상 토글, 배너 숨김)를 모두 커버하고 있다. 다만 SQL 기반 mock 테스트가 실제 DB 실행 결과를 대체하지 못한다는 구조적 한계가 남아 있으며, e2e 계층에서 `attention` 필터의 경계값(7일 기준)과 유효성 검사(400 응답)를 반드시 추가해야 한다. 프론트엔드에서는 `mostUrgentId` 우선순위 다중 행 동작, `AttentionBanner` 독립 렌더링, 단일 행 클릭 시 `router.push` 강제 단언이 소규모 개선 항목으로 남아있다. 테스트 격리와 가독성은 전체적으로 양호하며, spec 참조 주석이 테스트 의도를 명확히 표현하고 있다.

## 위험도

MEDIUM