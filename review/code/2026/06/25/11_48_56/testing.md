# Testing Review — codebase/frontend/e2e/web-chat/console.spec.ts

## 발견사항

- **[INFO]** 변경 목적이 명확하고 올바른 방향: strict-mode 충돌 수정
  - 위치: 3곳 (`getByText(...)` → `getByRole("button", { name: /.../ })`)
  - 상세: 2-column 레이아웃에서 인스턴스명이 사이드바 버튼 + `WebChatDetail` `h2` 양쪽에 렌더되어 `getByText` strict-mode 가 "multiple elements" 오류를 내던 것을, `button` role 로 좁혀 정확히 목록 항목만 타겟하도록 수정했다. 수정 이유가 인라인 주석으로 명시돼 있어 가독성이 높다.
  - 제안: 현행 유지 적절.

- **[INFO]** `getByText("Plain webhook")` 은 단일 렌더 요소이므로 role 좁히기 불필요 — 올바르게 그대로 유지됨
  - 위치: line 41 (`await expect(page.getByText("Plain webhook")).toHaveCount(0)`)
  - 상세: `Plain webhook` 은 필터링돼 DOM에 존재하지 않아야 하는 요소라 strict-mode 충돌 위험 없음. `toHaveCount(0)` 사용도 적합.
  - 제안: 현행 유지.

- **[INFO]** 단위 테스트(`web-chat-page.test.tsx`)에도 동일한 "2중 렌더" 문제에 대한 대응이 이미 반영됨
  - 위치: `/codebase/frontend/src/app/(main)/web-chat/__tests__/web-chat-page.test.tsx`, 다수 케이스에서 `findAllByText` 사용
  - 상세: 단위 테스트는 `findAllByText("Support bot").length >= 1` 패턴으로 이미 2중 렌더를 허용하고 있어 e2e 수정과 대칭적으로 일관됨.
  - 제안: 현행 유지.

- **[WARNING]** 생성 플로우 테스트에서 dialog dismiss 후 상태 검증 누락
  - 위치: `console.spec.ts` line 186–187 (빈 상태에서 만들기 → 목록·스니펫 갱신 테스트)
  - 상세: dialog 가 닫혔는지(`expect(dialog).not.toBeVisible()` 또는 `toHaveCount(0)`)를 검증하지 않는다. 만들기 버튼 클릭 후 dialog 가 열린 채로 목록 버튼이 노출될 수 있는 엣지 케이스(서버 응답은 왔지만 UI 상태 닫힘 처리가 누락된 버그)를 놓칠 수 있다.
  - 제안: `await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: DIALOG_TIMEOUT });` 을 `신규 봇` 버튼 assertion 앞에 추가.

- **[INFO]** `mockConsole` POST 핸들러가 stateful(배열 push)이고 테스트 격리를 위해 `mockConsole` 호출마다 새 배열을 복사(`[...initial]`)함
  - 위치: `console.spec.ts` line 115–116
  - 상세: `[...initial]` shallow copy 로 테스트 간 공유 상태 오염을 막고 있어 격리 측면에서 올바름. `WEBCHAT_INSTANCE`, `PLAIN_WEBHOOK` 상수는 `const` 객체지만 route 핸들러가 원본을 변경하지 않으므로 추가 문제 없음.
  - 제안: 현행 유지.

- **[INFO]** 라이브 미리보기 iframe 은 의도적으로 e2e 범위 밖으로 제외 (파일 상단 주석에 명시)
  - 위치: `console.spec.ts` lines 80–81
  - 상세: 위젯 + EIA 풀스택 의존이라는 이유가 주석에 명확히 기술됨. 이 결정은 합리적이며 별도 커버리지 갭이 아님.
  - 제안: 현행 유지.

- **[INFO]** `toBeVisible` 에 `PAGE_READY_TIMEOUT` 이 일관되게 적용됨
  - 위치: 수정된 세 assertion 모두
  - 상세: 첫 번째 assertion 에만 timeout 이 필요하고, 이후 단계는 이미 렌더된 상태에서 검증하므로 명시적 timeout 이 없어도 되지만 e2e 안정성 측면에서 과도한 timeout 이 아닌 한 해가 없음.
  - 제안: 현행 유지.

## 요약

이번 변경은 `getByText` → `getByRole("button", ...)` 로 3곳의 selector 를 좁혀 2-column 레이아웃 도입 후 발생한 Playwright strict-mode 충돌을 수정한 것이다. 수정 자체는 정확하고 주석도 충분히 설명적이다. 단위 테스트(`web-chat-page.test.tsx`)에도 같은 문제에 대한 대응(`findAllByText`)이 이미 반영돼 있어 e2e-unit 간 일관성이 유지된다. 유일한 개선 포인트는 생성 플로우 테스트에서 dialog dismiss 검증이 빠져 있는 부분으로, 버그 탐지력 측면에서 미약한 갭이 존재하나 기능 동작의 핵심 경로(목록 노출 + 스니펫 렌더)는 이미 검증되고 있어 차단 사유는 아니다.

## 위험도

LOW
