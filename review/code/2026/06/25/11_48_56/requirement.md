# Requirement Review — codebase/frontend/e2e/web-chat/console.spec.ts

## 발견사항

### [INFO] getByRole("button") 매처가 실제 DOM 구조에 정확히 대응한다
- 위치: diff +41, +52, +63
- 상세: `page.tsx` 의 사이드바 목록 항목은 `<button type="button">` 엘리먼트(line 110)이고, 상세 패널 인스턴스명은 `<h2>(line 231)`에 렌더된다. Playwright strict-mode 는 기본적으로 매처가 2개 이상의 요소를 반환할 때 오류를 던지므로 `getByRole("button", { name: /…/ })` 으로 좁히는 변경은 실제 DOM 구조와 정확히 일치한다. 수정 방향이 옳다.

### [INFO] `getByText("Plain webhook").toHaveCount(0)` — 변경 없이 유지
- 위치: line 159
- 상세: Plain webhook 비노출 검증은 `getByText` 를 계속 사용한다. PLAIN_WEBHOOK 인스턴스명이 interaction 필터에 의해 목록에 나타나지 않으므로, h2 영역에도 노출될 경로가 없다(PLAIN_WEBHOOK 은 `selected` 가 될 수 없다). strict-mode 충돌 없음 — 이 라인은 변경하지 않은 것이 옳다.

### [INFO] 생성 후 자동 선택 — `CreateWebChatDialog.onCreated(id)` 경로 검증
- 위치: line 187 (`await expect(page.getByRole("button", { name: /신규 봇/ })).toBeVisible`)
- 상세: `page.tsx` line 155 에서 `onCreated={(id) => setSelectedId(id)}` 로 자동 선택이 구현된다. mock 에서 POST 응답이 `{ data: { id: "t-new" } }` 를 반환하고, `use-web-chat.ts` 의 mutate 성공 핸들러가 해당 id 로 `setSelectedId` 를 호출한다고 가정한다. 이 경로는 e2e spec 외부 구현에 의존하므로 e2e 테스트 자체는 올바르게 결과를 검증하고 있다.

### [INFO] [SPEC-DRIFT] 2-column 레이아웃 — spec §6 에 구현 배경이 기술돼 있으나 e2e 검증 없음
- 위치: spec/7-channel-web-chat/5-admin-console.md §6 ("레이아웃(2-column)"), §R7
- 상세: spec §6 마지막 항과 §R7 은 "xl+ 에서 외형(좌)/미리보기(우, sticky) 2-column" 을 명시한다. `page.tsx` 는 `xl:grid-cols-[minmax(0,1fr)_minmax(360px,400px)]` 로 구현되어 있다. 이 변경의 부작용(인스턴스명이 h2 에도 나타남)은 spec §1 화면 구조 ASCII 다이어그램의 "고객지원 봇" h2 영역에서 이미 암묵적으로 예상되는 것이나, e2e 테스트 파일의 주석은 "2-column 레이아웃" 을 근거로 언급하지만 spec §6 본문이 그 배치를 명시적으로 기술한 것은 PR #703 이후 반영된 사항이다. 코드와 주석이 spec 과 일치하므로 spec drift 없음.

### [INFO] `viewer` 역할 테스트 — `mockAuth(page, { role: "viewer" })` 경로
- 위치: line 192–201
- 상세: spec §7 에서 viewer 는 "인스턴스 목록·상세·스니펫 복사 조회" 가 가능하고 생성 버튼은 `editor+` 전용이다. 테스트는 `getByRole("button", { name: /고객지원 봇/ })` (목록 버튼) 과 생성 버튼 미노출을 검증한다. spec §7 RBAC 규칙을 정확히 커버한다.

### [INFO] 설치 스니펫 검증 범위
- 위치: line 163–164
- 상세: spec §5 는 스니펫이 `endpointPath` + `ClemvionChat('boot'` 를 포함해야 한다고 명시한다. 테스트는 `snippet.toContainText("endpoint-uuid-abc")` 와 `snippet.toContainText("ClemvionChat('boot'")` 로 두 항목을 모두 검증하고 있다. spec §5 요구사항을 충족한다.

### [INFO] `mockConsole` 의 `POST` 응답에 `name` 이 `body.name` 을 따름
- 위치: line 125–132 (mockConsole 함수 내 triggers.push 부분)
- 상세: mock 은 POST 로 받은 `body.name` 을 그대로 새 트리거의 `name` 으로 삽입한다. 이후 GET 재조회 시 "신규 봇" 이 목록에 나타나도록 stateful 로 구현되어 있다. `react-query` 캐시 invalidate 후 GET 재조회 경로를 mock 이 올바르게 지원한다.

---

## 요약

변경의 핵심은 Playwright strict-mode 충돌 해소다. 인스턴스명이 사이드바 목록 버튼(`<button>`)과 상세 패널 제목(`<h2>`) 양쪽에 동시에 렌더되는 2-column 레이아웃에서 `getByText("인스턴스명")` 가 두 요소를 매칭해 strict-mode 오류를 유발하던 것을, `getByRole("button", { name: /…/ })` 으로 목록 버튼만 선택하도록 수정했다. 이 수정은 실제 `page.tsx` DOM 구조(사이드바 `<button>`, 상세 `<h2>`)와 정확히 일치하며, spec §6 및 §R7 이 명시하는 2-column 배치의 부작용을 올바르게 처리한다. 세 가지 테스트 케이스 모두 spec §2 (인스턴스 필터링), §3 (생성 후 자동 선택), §5 (스니펫), §7 (RBAC) 의 핵심 요구사항을 적절히 검증한다. 기능 완전성·에러 시나리오·비즈니스 로직 관점에서 결함 없음. 미완성 주석(TODO/FIXME) 없음.

## 위험도

NONE
