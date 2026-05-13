# execution-list-page 회귀 테스트 실패

> 발견 시점: 2026-05-13 (profile-safer-edit 작업 중 TEST WORKFLOW 단계)
> 영향 범위: `frontend/src/app/(main)/workflows/[id]/executions/__tests__/execution-list-page.test.tsx`

## 증상

`renders execution rows with status and duration` (line 106) 테스트가 안정적으로 실패한다.

```
expect(await screen.findByText("Completed"))
→ DOM 상에 "Completed" 텍스트 없음. 필터 버튼은 "Cancelled", "Waiting" 등만 렌더링됨.
```

`renders filter buttons` (line 115) 도 같은 원인으로 실패 (`findByText("Completed")` 사용).

## 원인 추정

- 필터 버튼 라벨 또는 status 표시 컴포넌트의 i18n 키가 "Completed" → 다른 텍스트로 변경되었을 가능성.
- 또는 mock 응답의 status 값과 컴포넌트가 기대하는 값이 어긋남.
- `git log -- "frontend/src/app/(main)/workflows"` 의 최근 커밋 `fcb5b6c3 refactor(workflows): ai-review 3차 조치` 이후 회귀로 추정.

## 본 plan 과의 관계

`profile-safer-edit` 브랜치(/profile 안전성 개선)와 무관. 본 작업 시작 전(`a9ad7cdf` 직후 `git stash` 상태) 에서도 동일하게 실패함을 확인 — main 에서 분기된 시점부터 깨진 상태.

## 후속 처리

- 별도 plan 으로 추적해 메인 작업(`profile-safer-edit`) 진행을 가로막지 않는다.
- workflows 영역 책임자가 컴포넌트 또는 테스트 한 쪽을 갱신해야 한다.
- 본 plan 은 작업이 시작되면 owner 와 함께 갱신, 완료 시 `complete/` 로 이동한다.

## 조사 결과 (2026-05-13)

plan-cleanup 후속 작업의 spot-check 결과:

- 테스트 (`frontend/src/app/(main)/workflows/[id]/executions/__tests__/execution-list-page.test.tsx:94-148`) 는 `beforeEach` 에서 `useLocaleStore.setState({ locale: "en" })` 를 호출하고 `findByText("Completed")`, `getByRole("button", {name: "Cancelled"})` 등을 검증.
- i18n 사전 (`frontend/src/lib/i18n/dict/en.ts:60-64, 857-858, 1995-1996`) 에 `Completed` / `Failed` / `Running` / `Cancelled` 모두 존재 → 키 누락은 아님.
- 컴포넌트 자체는 spot-check 하지 않음 (root cause 가 i18n 구독 타이밍이라면 컴포넌트 분기와 무관).

### 같은 root cause 의심

`candidate-picker-test-regression.md` 의 §"조사 결과 (2026-05-13)" 와 같은 가설 — `useT` (`frontend/src/lib/i18n/index.ts:17-28`) 의 `useSyncExternalStore` 가 테스트 환경 첫 렌더에서 server snapshot 을 채택하는 바람에 `useLocaleStore.setState` 호출이 첫 렌더에 반영되지 못할 가능성. 두 회귀가 동일 패턴 (useLocaleStore.setState in beforeEach + 텍스트 매칭 실패) 이므로 같은 root cause 일 개연성 큼.

### 권장 수정 방향 (owner 영역)

`candidate-picker-test-regression.md` 와 통합 수정 검토:
- (a) `useT` 의 `getServerSnapshot` 가 `useLocaleStore.getState().locale` 를 읽도록 수정 — 모든 회귀 테스트가 동시에 해소될 가능성
- (b) 테스트 setup 헬퍼 (`tests/setup-locale.ts` 신설) 로 `act` + `waitFor` 패턴 표준화 — i18n 구독 타이밍을 매번 보장

본 plan 은 owner 가 받는 시점까지 `in-progress/` 유지.

## 해결 (2026-05-13)

가설 (a) 가 정확했음. `frontend/src/lib/i18n/index.ts:21, :37` 의 `useT` · `useLocale` 가 `useSyncExternalStore` 의 3번째 인자(`getServerSnapshot`) 로 `() => DEFAULT_LOCALE` (`"ko"` 하드코딩) 을 넘기고 있었고, Suspense throw 후 재마운트 경로에서 이 server snapshot 이 활성화되며 `useLocaleStore.setState({ locale: "en" })` 가 첫 렌더에 무시되는 동작이 재현됐다. 두 인자 모두 `() => useLocaleStore.getState().locale` 로 통일.

- fix: `frontend/src/lib/i18n/index.ts`
- regression guard: `frontend/src/lib/i18n/__tests__/useT.test.tsx` (en/ko 첫 렌더 + locale flip 3 케이스)
- 검증: `vitest run src/app/(main)/workflows/[id]/executions/__tests__/execution-list-page.test.tsx src/components/editor/assistant-panel/candidate-picker.test.tsx` → 18/18 pass; 전체 vitest 1280/1280 pass.
- 같은 fix 로 `candidate-picker-test-regression.md` 도 동시 해소.
