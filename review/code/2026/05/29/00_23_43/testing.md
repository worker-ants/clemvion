# 테스트(Testing) 리뷰 — triggers auth column

리뷰 대상: triggers-page.test.tsx (auth column 추가), page.tsx (auth column 렌더링), en/ko i18n 키
리뷰 일시: 2026-05-29

---

## 발견사항

### [INFO] 테스트 존재 여부 — 핵심 시나리오 커버 양호
- 위치: `codebase/frontend/src/app/(main)/triggers/__tests__/triggers-page.test.tsx` lines 52-150
- 상세: 4개의 신규 테스트가 Spec 2-trigger-list §2.1 + R-15 요구사항을 직접 대응한다. (a) 컬럼 헤더 존재, (b) webhook + AuthConfig bound → type 뱃지, (c) webhook + authConfigId null → 경고 아이콘, (d) non-webhook + null → 경고 없음. TDD 선작성 계획(P3) 의도와 일치하며 최소 커버리지 요건은 충족한다.
- 제안: 없음 (커버 충분).

### [WARNING] 커버리지 갭 — "authConfigId 있으나 목록에서 미해석" 폴백 케이스 미테스트
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` lines 551-562 (authConfigId 있으나 `authConfigById.get(trigger.authConfigId)` == undefined 분기)
- 상세: plan 설계서(`triggers-auth-column.md`)는 "webhook + `authConfigId` 있으나 목록서 미해석 → `triggers.authConfigured` 폴백 뱃지"를 명시적 케이스로 정의한다. 이 분기는 `authConfigs` 배열이 빈 배열인 상태에서 `authConfigId: "ac-1"` 트리거가 렌더될 때 실행된다. 현재 테스트에는 이 경로를 커버하는 케이스가 없다.
- 제안: 아래 테스트를 `auth column` describe 블록에 추가한다.
  ```typescript
  it("webhook with authConfigId not in authConfigs list shows 'Configured' fallback badge", async () => {
    mockTriggersResponse(
      listBody([{ id: "t1", name: "Hook A", type: "webhook",
                  isActive: true, workflowId: "w1",
                  workflow: { id: "w1", name: "WF" },
                  authConfigId: "ac-unknown" }]),
      [], // authConfigs 목록이 비어 있어 ac-unknown 을 해석 불가
    );
    await renderPage();
    await screen.findByText("Hook A");
    expect(screen.getByText("Configured")).toBeInTheDocument();
    expect(screen.queryByLabelText(WARNING_LABEL)).toBeNull();
  });
  ```

### [WARNING] 커버리지 갭 — "manual" 타입 무인증 → "-" (muted) 표시 테스트 없음
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` lines 543-550 (`type !== "webhook"` 분기)
- 상세: 기존 4번째 테스트("non-webhook (schedule) without auth shows no warning")는 `schedule` 타입만 검증한다. `manual` 타입은 plan 설계 케이스에 명시되어 있고(`schedule/manual+null → 경고 없음/-`), 테스트 이름도 `non-webhook (schedule)`으로 schedule 한정을 암시한다. `manual` 타입의 동일 동작은 현재 테스트로 보증되지 않는다.
- 제안: schedule 테스트를 `type: "manual"` 파라미터로 복제하거나, `it.each([["schedule"], ["manual"]])` 패턴으로 통합한다.

### [WARNING] 커버리지 갭 — useAuthConfigs 쿼리 실패(isError) 상태에서 auth 열 렌더 미검증
- 위치: `codebase/frontend/src/components/triggers/auth-config-select.tsx` `useAuthConfigs` 훅; `page.tsx` `const { data: authConfigs = [] } = useAuthConfigs()` 라인
- 상세: `useAuthConfigs()` 가 에러를 반환하면 `authConfigs`는 기본값 `[]`로 폴백한다. 이 경우 authConfigId 가 있는 webhook 트리거는 "Configured" 폴백 배지를 보이고, authConfigId null인 트리거는 여전히 경고 아이콘을 보여야 한다. 현재 테스트는 이 시나리오를 다루지 않는다. API 장애 시 경고 아이콘이 의도치 않게 숨겨지는 회귀를 검출할 수 없다.
- 제안: `/auth-configs` 요청이 reject를 반환하도록 mock을 구성한 테스트를 추가한다.
  ```typescript
  // mockTriggersResponse 에서 /auth-configs 를 reject 로 설정
  if (url === "/auth-configs") return Promise.reject(new Error("network error"));
  ```

### [INFO] Mock 적절성 — mockTriggersResponse 시그니처 확장 방식 적절
- 위치: `triggers-page.test.tsx` lines 36-44 (diff 기준)
- 상세: 기존 `mockTriggersResponse(body)` 시그니처에 `authConfigs: unknown[] = []` 파라미터를 추가하는 방식은 기존 테스트(pagination, RBAC describe 블록)를 인수 없이 그대로 호출 가능하게 유지한다. 기본값 `[]`는 실제 프로덕션 동작(auth-configs 쿼리가 비어있는 경우 authConfigId가 있어도 "Configured" 폴백)과 일치하므로 기존 테스트가 의도치 않게 break될 위험이 없다.
- 제안: 없음.

### [INFO] 테스트 격리 — beforeEach 설정 일관성 양호
- 위치: `triggers-page.test.tsx` lines 56-62 (auth column describe 블록 beforeEach)
- 상세: `vi.clearAllMocks()`, `cleanup()`, `currentSearchParams 초기화`, `useLocaleStore.setState`, `setRole("editor")`를 매 테스트 전 초기화한다. pagination/RBAC describe 블록의 beforeEach와 동일한 패턴을 따르므로 describe 간 상태 누수가 없다.
- 제안: 없음.

### [INFO] 테스트 가독성 — WARNING_LABEL 상수 분리 적절
- 위치: `triggers-page.test.tsx` line 53-56 (describe 블록 상단 상수 선언)
- 상세: aria-label 문자열을 `WARNING_LABEL` 상수로 추출하여 모든 테스트가 동일 참조점을 사용한다. 경고 문구가 i18n 키(`authUnauthenticatedWarning`)에서 변경될 경우 한 곳만 수정하면 된다. 다만 상수값이 en 사전 값을 하드코딩하므로 locale을 `ko`로 전환한 테스트에서는 이 상수가 무효화된다는 점을 염두에 두어야 한다 (현재 모든 auth column 테스트는 `locale: "en"` 고정이므로 실제 문제 없음).
- 제안: 없음.

### [WARNING] 회귀 테스트 — RBAC describe 내 기존 row() fixture에 authConfigId 없음
- 위치: `triggers-page.test.tsx` lines 288-302 (RBAC describe 의 `row()` 함수)
- 상세: 기존 RBAC 테스트의 `row()` fixture는 `authConfigId` 필드를 포함하지 않는다. page.tsx 매핑 코드(`authConfigId: t.authConfigId ?? null`)는 undefined를 null로 처리하므로 실제 렌더에서는 webhook 타입의 authConfigId null이 경고 아이콘을 표시한다. RBAC 테스트들은 경고 아이콘을 Assert하지 않지만, 새 컬럼이 추가되어 테이블 구조가 바뀐 뒤에도 기존 RBAC 테스트가 통과한다는 점은 기본적으로 문제없다. 단, "Editor: ⋮ 메뉴 노출" 등의 테스트가 경고 아이콘을 발견하고 혼동될 가능성이 있는지 확인이 필요하다 — `queryByLabelText(WARNING_LABEL)` 같은 불필요한 단언이 없으므로 현 상태에서는 회귀 없음.
- 제안: 명확성을 위해 RBAC의 `row()` fixture에도 `authConfigId: null`을 명시적으로 추가하는 것을 고려한다 (필수 아님).

### [INFO] 테스트 용이성 — page.tsx의 authConfigById 계산 로직 테스트 가능성
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` lines 202-204
- 상세: `const authConfigById = new Map(authConfigs.map((c) => [c.id, c]))` 로직이 컴포넌트 내 인라인으로 작성되어 있어 독립 단위 테스트가 불가능하다. 현재 테스트는 통합 방식(mock API → render → DOM assertion)으로 이를 간접 검증하므로 실질적인 커버리지는 충족된다. 로직 자체가 단순하여 별도 추출의 실익은 낮다.
- 제안: 없음 (현 구조 적절).

---

## 요약

신규 "인증" 컬럼에 대한 테스트는 4가지 핵심 시나리오(컬럼 헤더, webhook+bound AuthConfig 뱃지, webhook+null 경고, non-webhook N/A)를 커버하며 TDD 계획과 잘 정렬되어 있다. Mock 확장 방식이 기존 테스트와 하위호환되고 격리 설정도 일관적이다. 다만 세 가지 커버리지 갭이 있다: plan 설계서에 명시된 "authConfigId 있으나 목록 미해석 → Configured 폴백" 케이스, `manual` 타입 N/A 동작, 그리고 `/auth-configs` 쿼리 실패 시 폴백 동작. 이 중 폴백 케이스와 에러 상태 케이스는 보안 경고의 오표시/미표시 회귀로 이어질 수 있으므로 추가를 권고한다.

---

## 위험도

LOW
