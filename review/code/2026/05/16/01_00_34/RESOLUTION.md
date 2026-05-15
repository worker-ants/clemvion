# RESOLUTION — 2026/05/16 01:00:34 코드 리뷰 조치

대상 커밋: `claude/cafe24-request-scopes-ui-b6e34d` 의 cafe24 Private request-scopes UI 안내 추가.
SUMMARY: `review/code/2026/05/16/01_00_34/SUMMARY.md`.

전체 위험도 **MEDIUM** (Critical 0, WARNING 13, INFO 24). 본 RESOLUTION 에서 WARNING 9건 조치, 4건 보류 (보류 근거 명시).

---

## 조치 완료 (WARNING 9건)

### W-1 / W-2 / W-3 — 테스트 커버리지 보강

`scope-tab.test.tsx` 를 2건 → 7건으로 확장.

신규 케이스:
1. `cafe24_private_pending` 분기에서 `onChanged()` **호출되지 않음** 단언 (pending 상태에서 refetch 무의미 — 이 점은 W-9 의 코드 주석으로도 반영)
2. `cafe24_private_pending` 분기에서 `toast.info` 호출 단언
3. `scopesAdded: []` 빈 배열 응답 경계 케이스 — 안내문은 나오지만 scope 목록 칩은 표시되지 않음
4. **재요청 시 alert 리셋** — 두 번 연속 mutate 호출 시 `onMutate` 가 `setCafe24Pending(null)` 으로 pending alert 를 비우는지 검증 (W-3)
5. `onError` 분기 — `mockRejectedValue` 로 API 실패 시 `toast.error` 호출 + alert 미표시 + `onChanged` 미호출 단언 (W-2)
6. `allOptions` 빈 배열 — 빈 상태 메시지 표시 + Request scopes 버튼 disabled 단언 (W-8 검증)
7. `authType !== 'oauth2'` fallback — non-OAuth 안내 표시 + Request scopes 버튼 부재 단언

또한 `vi.mock("sonner", ...)` 로 toast 호출을 검증할 수 있게 했고, `onChanged` 를 `vi.fn()` 으로 주입해 W-1 의 사이드이펙트 검증 가능하게 함.

### W-4 — `Cafe24PrivatePendingBase` 공유 타입 추출

`OAuthBeginResult` 와 `RequestScopesResult` 의 cafe24 variant 필드 중복·불일치 해소. `Cafe24PrivatePendingBase` 인터페이스 추출 후 두 타입이 이를 공유. `RequestScopesResult` 의 cafe24 variant 만 `& { scopesAdded: string[] }` 로 확장.

```ts
export interface Cafe24PrivatePendingBase {
  mode: "cafe24_private_pending";
  integrationId: string;
  appUrl: string;
  callbackUrl: string;
}
export type OAuthBeginResult =
  | { authUrl: string; state: string }
  | Cafe24PrivatePendingBase;
export type RequestScopesResult =
  | { authUrl: string; state: string }
  | (Cafe24PrivatePendingBase & { scopesAdded: string[] });
```

### W-5 — `requestScopes` 반환 타입 변경 영향 조사

`grep -rn "requestScopes\b" frontend/src` 결과:
- `frontend/src/lib/api/integrations.ts:243` (정의 자체)
- `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx:44` (단일 소비처)
- `frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx:24` (테스트 mock)

본 PR 외 다른 소비처 없음 — breaking change 영향 범위는 본 PR 안에서 자기완결.

### W-8 — `allOptions` 빈 배열 빈 상태

scope 카드 안에서 `allOptions.length === 0` 이면 새 i18n 키 `noScopeOptionsAvailable` 메시지를 표시. 체크박스가 없을 때 Request scopes 버튼만 비활성으로 떠 있던 어색한 UX 해소.

### W-9 — 알 수 없는 mode silent 처리

`requestMutation.onSuccess` 에 `else` 분기 추가해 알 수 없는 응답 shape 수신 시 `toast.error(t("integrations.requestScopesFailed"))` 호출. 동시에 `cafe24_private_pending` 분기에서 `onChanged()` 호출을 제거 — pending 상태에서 token 갱신은 cafe24 측 후속 작업 후이므로 지금 refetch 해도 변화 없음을 코드 주석으로 명시 (I-6 동시 해소).

### W-11 — 루프 내 `includes` 중복 호출

`allOptions.map` body 상단에 `const isGranted = currentScopes.includes(s.value)` 변수 추출 후 `disabled={isGranted}`, `{isGranted && ...}` 로 재사용. 두 번 호출되던 동일 표현식이 한 번으로 줄어듦.

### W-12 — plan 체크리스트 갱신

`plan/in-progress/cafe24-request-scopes-ui.md` 의 체크리스트를 실제 완료 상태로 갱신. consistency I-1·I-2·I-4 spec 역반영과 W-1·W-2 (Rationale 보완) 을 project-planner 위임 follow-up 항목으로 추가.

---

## 보류 (WARNING 4건)

### W-6 — `openOAuthPopup` 을 `lib/` 레이어로 이동

**보류**. 두 번째 사용처가 아직 발생하지 않은 시점에서의 사전 분리는 YAGNI. `[id]/page.tsx` 와 `[id]/scope-tab.tsx` 모두 같은 라우트 세그먼트 안에서 호출되므로 co-location 이 자연스럽다. 세 번째 사용처가 생기는 시점에 분리 검토.

### W-7 — `cafe24_private_pending` 문자열 하드코딩 (OCP)

**보류**. 현재 spec 정의상 mode 는 `cafe24_private_pending` 하나뿐이며, 두 번째 pending-style mode 가 추가될 시점에 분기 추출 검토하는 것이 합리적. 가상의 두 번째 mode 형태(token 갱신 흐름 / 외부 redirect / 사용자 입력 추가 등)에 따라 적절한 분기 위치가 달라지므로 사전 추상화는 비용 대비 효익이 낮다.

### W-10 — `ScopeTab` 다중 책임 (193줄 → 4컴포넌트 분리)

**보류**. 현재 컴포넌트는 한 화면 안의 4개 영역(current/missing/pending/selector) 을 하나의 mutation state 와 함께 렌더링하는 응집도 높은 구성. 분리하면 prop drilling 또는 context 가 필요해 오히려 가독성이 떨어진다. 본 영역에 두 번째 페이지가 같은 UI 를 요구하면 그 시점에 추출 가능.

### W-13 — consistency-check 산출물 분리 커밋

**보류**. 이미 커밋된 상태(`6db2d5df`). 향후 절차 개선 사항으로 받아 두되 본 PR 에서 amend 하지 않음 (단일 PR 안의 history 청결도 vs 재커밋 비용 trade-off).

---

## INFO 처리

24건 INFO 중 본 RESOLUTION 에서 부수적으로 해소된 것:
- I-6 — `cafe24_private_pending` 분기에서 `onChanged()` 호출 제거 (W-9 와 함께)
- I-11 — `cafe24Pending` 익명 타입 → useState generic 으로 유지하나 위치만 명확화 (분리 type 까지는 비용 대비 효익 낮음, 보류)
- I-14 — 테스트 픽스처 날짜를 `2000-01-01T00:00:00Z` 로 변경 (의도 없는 고정값 명시)
- I-17 — `toast.success` 호출 단언 (`vi.mock("sonner")` + assertion)
- I-18 — `scopesAdded: []` 빈 배열 케이스 추가
- I-19 — non-oauth2 fallback 케이스 추가
- I-24 — `QueryClient` mutations `retry: false` 명시

나머지 INFO 항목(URL scheme 검증, 팝업 차단 UX, Zod 런타임 검증, SSR 가드, `Set` 변환, JSDoc, 상수 명명, 매직 넘버, sessionStorage 임시 저장 등)은 본 작업 범위 밖이며 별도 개선 plan 으로 권장.

---

## TEST WORKFLOW 재실행 결과

- `npm run lint` — 깨끗
- `npm run build` — 통과
- `npm test` — 119 files, **1355 tests** all passed (기존 1350 + 신규 5건 추가)
- e2e — `[skip-e2e]` (단일 컴포넌트 분기 추가, e2e 가치 없음)

---

## Follow-up (별도 plan 으로 분리 권고)

- consistency I-1·I-2·I-4 — `spec/2-navigation/4-integration.md §4.4` 역반영 (project-planner 위임)
- consistency W-1·W-2 — Rationale 보완 (project-planner 위임)
- 사전 pre-existing flake — `frontend/src/app/(main)/workflows/[id]/executions/__tests__/execution-list-page.test.tsx` 가 본 worktree 의 전체 suite 실행 시 ~20% 확률로 flake (단독 실행은 항상 성공). 현재 5회 재실행 모두 통과로 회귀 안전망에는 영향 없음. 별도 flake-fix plan 으로 분리 권고.
