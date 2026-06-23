# Testing Review

## 발견사항

### [INFO] e2e 테스트 범위: 2개 핵심 시나리오 커버, 단 viewer 역할 시나리오 누락
- 위치: `codebase/frontend/e2e/web-chat/console.spec.ts` 전체
- 상세: unit 테스트(`web-chat-page.test.tsx`)는 viewer 역할에서 '웹채팅 만들기' 버튼 미노출을 검증하나, e2e 레벨에서는 owner 역할만 테스트한다. WORKSPACE fixture 의 role 이 `"owner"` 로 고정돼 있고, viewer/editor 케이스가 없다. unit 레벨에서 이미 RoleGate 커버리지가 존재하므로 e2e 중복 불필요하다는 판단이 가능하나, role-based 렌더 차이를 end-to-end 수준에서 한 케이스라도 검증하면 regression 방어가 강화된다.
- 제안: viewer role mock(role: "viewer") 을 사용하는 세 번째 테스트를 추가하거나, 현재 owner 고정에 대해 주석으로 의도를 명시(역할 분기는 unit 레벨에서만 검증 등).

### [INFO] `mockAuth` 헬퍼 중복 정의 — 다른 e2e 스펙과 동일 패턴
- 위치: `codebase/frontend/e2e/web-chat/console.spec.ts` L64–83, `codebase/frontend/e2e/workflows/list.spec.ts` L30–
- 상세: `mockAuth` 함수가 `console.spec.ts`와 `workflows/list.spec.ts`에 동일 패턴으로 중복 정의돼 있다. 현재는 2개 스펙에서 공유될 경우 다른 spec 의 route stub 변경이 전파되지 않아 silent drift 위험이 있다.
- 제안: 이 커밋 범위 자체는 신규 파일 1개 추가이므로 즉시 리팩터링 의무는 없지만, `e2e/helpers/mock-auth.ts` 공용 헬퍼 추출을 후속 follow-up 으로 등록하면 유지보수성이 개선된다. 현재 리뷰 범위에서 블로커 아님.

### [INFO] POST `/api/triggers` mock 은 정의됐으나 e2e 에서 미검증(다이얼로그 제출 흐름 불완전)
- 위치: `codebase/frontend/e2e/web-chat/console.spec.ts` L111–128 (`mockConsole`), L148–163 (두 번째 테스트)
- 상세: `mockConsole`은 `POST /api/triggers` 를 201 응답으로 stub 하나, 두 번째 테스트("빈 상태에서 '웹채팅 만들기' 다이얼로그 진입")는 다이얼로그가 열리고 `<select>`에 워크플로우 옵션이 있는지까지만 확인한다. 실제 제출(이름 입력 → submit 버튼 클릭 → 목록 갱신)은 검증하지 않는다. 생성 흐름의 핵심(POST 후 목록 갱신, 새 인스턴스 자동 선택)이 e2e 로 커버되지 않는다.
- 제안: unit 레벨에서 이 시나리오를 커버하는 별도 테스트가 없으므로(`web-chat-page.test.tsx`에서 POST 후 목록 갱신 흐름은 있으나 e2e 수준 검증은 없음), e2e 두 번째 케이스를 확장해 이름 입력 후 제출 → 신규 인스턴스 스니펫 렌더까지 검증하는 것을 권장한다. 중요도는 INFO이나 생성 happy path 가 e2e 로 미커버되는 건 아쉬운 갭이다.

### [INFO] `page.getByText("Plain webhook").toHaveCount(0)` — 접근법 적절성
- 위치: `codebase/frontend/e2e/web-chat/console.spec.ts` L140
- 상세: `.toHaveCount(0)` 은 요소가 없을 때 유효한 검증이나, Playwright 에서는 `.not.toBeVisible()` 또는 `.not.toBeInViewport()` 보다 `.toHaveCount(0)` 이 더 엄격하다(DOM 에 아예 없음 확인). 이는 의도적으로 올바른 선택이다. 다만 locator `getByText("Plain webhook")` 가 정확히 텍스트 매칭을 하므로 i18n 변경 시 flaky 해질 수 있다. 현재 한국어/영어 혼용 텍스트인데, `PLAIN_WEBHOOK.name` 필드가 영어 고정("Plain webhook")이라 locale 영향 없음 — 문제없음.
- 제안: 추가 조치 불필요. 단지 주석으로 "DOM에 없음을 확인, hidden/display 체크가 아님" 을 명시하면 가독성이 향상된다.

### [INFO] 라이브 미리보기 iframe 비검증 — 명시적 제외 근거 문서화됨
- 위치: `codebase/frontend/e2e/web-chat/console.spec.ts` L54–57 (파일 상단 주석)
- 상세: 라이브 미리보기 iframe 은 동봉 위젯 + EIA 풀스택 의존으로 mock e2e 범위 외임을 주석으로 명확히 기술했다. unit 레벨에서 `live-preview.test.tsx`가 iframe src, wc:boot postMessage, origin 검증, 타임아웃 fallback 을 모두 커버한다. 이 결정은 적절하다.
- 제안: 없음.

### [INFO] `mockConsole` 에서 workflows 응답이 단일 워크플로우로 고정 — 페이지네이션 엣지 케이스 미커버
- 위치: `codebase/frontend/e2e/web-chat/console.spec.ts` L126–128
- 상세: 워크플로우 목록이 빈 경우(`data: []`) 다이얼로그의 "워크플로우 없음" 안내 메시지 렌더를 e2e 로 검증하지 않는다. `CreateWebChatDialog` 내 `noWorkflows` 분기가 UI에 노출하는 "워크플로우가 없습니다" 안내는 unit 레벨에서도 미커버(현재 `create-web-chat-dialog` 에 대한 독립 unit 테스트 파일이 없음).
- 제안: `create-web-chat-dialog` 에 대한 unit 테스트 추가 또는 e2e 두 번째 케이스에서 빈 워크플로우 분기 추가를 고려한다. 현재는 INFO 수준이나 이 분기는 UX 노출 경로이므로 커버리지 갭으로 기록한다.

### [INFO] `triggersBody` 헬퍼 — `pagination` 응답의 `totalItems`/`totalPages` 계산 의존성
- 위치: `codebase/frontend/e2e/web-chat/console.spec.ts` L107–109
- 상세: `triggersBody` 가 `items.length` 를 `totalItems` 로 직접 계산하는 건 올바르다. 단 `totalPages` 가 항상 1로 고정되므로 다중 페이지 시나리오는 이 헬퍼로 표현 불가하다. 현재 콘솔은 `limit: 100` 단일 페이지 전략이라 문제없다. 주석으로 single-page assumption 을 명시하면 향후 혼동을 방지한다.
- 제안: 즉시 수정 불필요. 선택적 주석 추가.

## 요약

변경된 e2e 스펙(`console.spec.ts`)은 핵심 두 시나리오(interaction 필터 + 설치 스니펫 렌더, 빈 상태 → 다이얼로그 진입)를 적절한 mock 전략으로 검증한다. unit 테스트 계층(`web-chat-page.test.tsx`, `live-preview.test.tsx`, `snippet.test.ts`, `widget-base.test.ts`)이 이미 27개 케이스로 비즈니스 로직 대부분을 커버하고 있으며, e2e 는 그 위에 end-to-end 흐름 검증을 보완하는 역할을 잘 분리하고 있다. 주요 갭은 (1) 생성 happy path(submit → 목록 갱신)가 e2e 레벨에서 미검증인 점, (2) `CreateWebChatDialog` 컴포넌트에 독립 unit 테스트가 없는 점, (3) viewer 역할 분기가 e2e 레벨에서 미검증인 점이며, 모두 INFO 수준으로 현재 unit 커버리지가 일부 보완한다. 라이브 미리보기 iframe 비검증은 명시적 제외 근거가 문서화돼 있어 정당하다. spec 변경(3-auth-session.md, 4-security.md)은 기존 코드 행동을 소급 문서화한 것으로 테스트 추가 의무를 발생시키지 않는다.

## 위험도

LOW
