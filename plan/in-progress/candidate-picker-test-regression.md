# candidate-picker 회귀 테스트 실패

> 발견 시점: 2026-05-12 (feature/auth-sessions 작업 중 TEST WORKFLOW 단계)
> 영향 범위: `frontend/src/components/editor/assistant-panel/candidate-picker.test.tsx`

## 증상

`renders an amber guidance box when there are no candidates` 테스트가 안정적으로 실패한다.

```
expect(screen.getByText(/사용 가능한 Integration 이\(가\) 없어요/))
→ DOM 상에 해당 텍스트 없음. 대신 chevron-right SVG 만 렌더링됨.
```

## 원인 추정

- 컴포넌트는 main 의 `0f1dbe5f refactor(workflow-assistant): ai-review 조치` 또는 `637ac783 feat(workflow-assistant): MCP 서버 picker 추가` 에서 변경됨.
- 테스트는 "Integration 후보가 없을 때 안내 박스가 보인다" 를 검증하나, 실제 컴포넌트는 안내 박스 대신 navigation 화살표만 그리는 듯.
- 테스트와 구현 중 한 쪽이 갱신 누락된 회귀로 추정.

## 본 plan 과의 관계

`feature/auth-sessions` 브랜치(활성 세션·로그인 이력) 와 무관. main 에서 이미 깨진 상태로 분기됨을 확인 (해당 컴포넌트·테스트 우리가 건드린 적 없음).

## 후속 처리

- 우선 본 회귀를 별도 plan 으로 추적해 메인 작업 진행을 가로막지 않는다.
- workflow-assistant 책임자가 컴포넌트 또는 테스트 한 쪽을 갱신해야 한다.
- 본 plan 은 작업이 시작되면 `in-progress/` 안에서 owner 와 함께 갱신, 완료 시 `complete/` 로 이동한다.

## 조사 결과 (2026-05-13)

plan-cleanup 후속 작업에서 코드를 spot-check 한 결과 — **컴포넌트 분기와 i18n 사전은 모두 정상**, 회귀의 root cause 는 i18n 구독 타이밍으로 의심된다.

### 일치 확인

- `frontend/src/components/editor/assistant-panel/candidate-picker.tsx:170-194` — `candidates.length === 0` 분기가 amber 박스(`role="note"`) + Settings 링크(`ChevronRight`) 를 렌더한다. 분기 자체는 의도대로 동작.
- `frontend/src/lib/i18n/dict/ko.ts:2135-2136` — `assistant.candidatePickerEmpty: "사용 가능한 {{label}} 이(가) 없어요. Settings 에서 먼저 등록해 주세요."` 가 존재. 테스트가 매칭하는 정규식 `/사용 가능한 Integration 이\(가\) 없어요/` 와 일치.
- 테스트 (`candidate-picker.test.tsx:18-47`) 는 `useLocaleStore.setState({ locale: "ko" })` 를 `beforeEach` 에서 호출하고 `field.label="Integration"` 으로 렌더.

### 의심 root cause — `useT` server snapshot

`frontend/src/lib/i18n/index.ts:17-28` 의 `useT()` 가 `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` 를 사용하는데, **server snapshot 은 항상 `DEFAULT_LOCALE` (`"en"`)** 으로 fallback 한다. vitest + jsdom 환경에서 React 18 의 `useSyncExternalStore` 가 첫 렌더 시 server snapshot 을 채택할 가능성이 있고, 이 경우:

1. ko 사전에는 `assistant.candidatePickerEmpty` 가 있지만
2. en 사전에 같은 키가 정의되어 있는지 / 다른 텍스트가 들어가 있는지에 따라 결과가 달라짐

`grep "candidatePickerEmpty" frontend/src/lib/i18n/dict/en.ts` → 라인 2140-2141 에 영문판도 존재하므로 단순히 영어 텍스트가 렌더된 것뿐이라면 `getByText(/Integration/)` 정규식으로 매칭되어야 함. plan 노트가 "ChevronRight SVG 만 렌더" 라고 보고한 것을 보면 텍스트 자체가 비어있을 가능성도 있다 (translate 가 key 미스 시 빈 문자열 반환?).

### 권장 수정 방향 (owner 영역)

(a) `useT` 의 `getServerSnapshot` 도 `useLocaleStore.getState().locale` 를 읽게 하거나, (b) 테스트 setup 에서 `act(() => useLocaleStore.setState({ locale: "ko" }))` + `await waitFor(() => screen.findByText(...))` 로 hydration 보장. `executions-list-test-regression.md` 와 같은 root cause 일 가능성이 높아 통합 수정 검토 권장.

본 plan 은 owner 가 받는 시점까지 `in-progress/` 유지.
