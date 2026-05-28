# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] 테스트에서 Zustand 전역 store 직접 변조 — afterEach 복구 없음
- 위치: `trigger-detail-drawer.test.tsx` lines 136-153 (`setRole`, `beforeEach`)
- 상세: `useWorkspaceStore.setState(...)` 와 `useLocaleStore.setState(...)` 로 전역 Zustand store 를 직접 변조한다. `beforeEach` 에서 `useWorkspaceStore.getState().reset()` 을 호출하므로 대부분의 케이스에서 격리된다. 그러나 `useLocaleStore` 는 `setState({ locale: "en" })` 만 수행하고 초기 값으로 돌아가는 명시적 teardown 이 없다. 테스트가 병렬로 실행되거나 이 파일 이후에 다른 테스트 파일이 locale store 초기 상태를 기대한다면 오염이 발생할 수 있다.
- 제안: `afterEach(() => useLocaleStore.setState({ locale: <original_default> }))` 를 추가하거나, beforeEach 에서 locale 원복을 명시적으로 수행. `useWorkspaceStore.getState().reset()` 패턴처럼 locale store 도 동일하게 `reset()` 이 있다면 활용.

### [INFO] `navigator.clipboard` 전역 객체 직접 패치 — 복구 없음
- 위치: `use-copy-to-clipboard.test.tsx` lines 131-135 (`beforeEach`)
- 상세: `Object.assign(navigator, { clipboard: { writeText } })` 로 전역 `navigator.clipboard` 를 테스트마다 교체한다. `vi.clearAllMocks()` 가 mock 함수의 호출 기록은 지우지만, 원래 `navigator.clipboard` 객체 자체를 복구하지는 않는다. vitest 는 기본적으로 파일 단위로 환경을 격리하므로 실질 위험은 낮다.
- 제안: 방어적으로 `beforeAll` 에서 `navigator.clipboard` 원본을 저장하고 `afterAll` 에서 복원하는 패턴을 추가하면 더 명확하다.

### [INFO] `ExternalInteractionCard` Cancel 버튼에 `saveMutation.reset()` 미호출
- 위치: `trigger-detail-drawer.tsx` — `ExternalInteractionCard` CardHeader 내 Cancel 버튼 onClick (line ~1455)
- 상세: Cancel 버튼이 `setEditing(false)` 만 호출하고 `saveMutation.reset()` 을 호출하지 않는다. 저장 실패 후 취소하고 다시 편집 모드로 진입하면 같은 컴포넌트 인스턴스에서 `isError` 상태가 stale 하게 유지된다. 기능적 버그로 이어지지는 않지만 예기치 않은 mutation 상태가 남는다.
- 제안: `onClick={() => { saveMutation.reset(); setEditing(false); }}` 로 수정.

### [INFO] `useCopyToClipboard` — `navigator.clipboard` 미지원 환경 처리 불명확
- 위치: `codebase/frontend/src/lib/hooks/use-copy-to-clipboard.ts` lines 297-300
- 상세: `navigator.clipboard` 가 `undefined` 인 환경(HTTP 컨텍스트, 특정 WebView)에서 `.writeText(text)` 접근 시 동기 TypeError 가 발생한다. `try/await` 구조에서 정상적으로 catch 되므로 실질 버그는 아니나, 의도성이 불명확하다.
- 제안: `if (!navigator.clipboard)` guard 를 명시적으로 추가하면 의도가 더 명확해진다.

## 요약

변경의 핵심은 (1) `navigator.clipboard + toast` 중복 로직을 `useCopyToClipboard` 훅으로 추출, (2) `ExternalInteractionCard.handleSave` 를 수동 `saving` 상태에서 `useMutation` 으로 교체, (3) 단위 테스트 신설이다. 의도치 않은 전역 상태 오염 위험은 테스트 파일 내 Zustand store 직접 변조 및 `navigator.clipboard` 패치에서 발생하나, `beforeEach` 복구 패턴과 vitest 파일 단위 환경 격리 덕분에 실질 피해는 낮다. 프로덕션 코드에서 `ExternalInteractionCard` Cancel 버튼의 `saveMutation.reset()` 미호출은 stale mutation 상태를 남기지만 기능적 버그는 아니다. 전반적으로 부작용 위험도는 낮다.

## 위험도

LOW
