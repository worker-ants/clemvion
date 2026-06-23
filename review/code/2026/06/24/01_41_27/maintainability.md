# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상 커밋: `e914edfd6428b8e6c6d1a4fed91510a2f0920f47`

---

## 발견사항

### 파일 1: `codebase/frontend/e2e/web-chat/console.spec.ts`

- **[INFO]** `mockAuth` 내 `route.fulfill` 호출 패턴 반복
  - 위치: 66–82번 줄
  - 상세: `route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(...) })` 패턴이 5회 반복된다. 현재 파일 크기(116줄)에서는 허용 범위이나, 향후 mock 엔드포인트가 추가될 경우 헬퍼 함수로 추출해야 가독성이 유지된다.
  - 제안: `function jsonFulfill(route, status, data)` 형태의 로컬 헬퍼를 선언해 보일러플레이트를 줄이는 것을 검토한다.

- **[INFO]** `triggersBody` 함수에 하드코딩된 pagination 기본값
  - 위치: 108번 줄 (`{ page: 1, limit: 100, totalItems: items.length, totalPages: 1 }`)
  - 상세: `limit: 100`, `page: 1` 은 현재 백엔드 응답 shape 에 맞게 고정된 값인데, 주석 없이 인라인 수리터럴로 기재되어 있다. 파일 상단의 파일 주석(`PaginatedResponseDto`)에서 shape 를 설명하고 있으나, 이 리터럴만 보면 임의 값처럼 읽힌다.
  - 제안: 상수화하거나(`const MOCK_PAGE_SIZE = 100`) 최소한 inline comment(`// PaginatedResponseDto defaults`) 를 달아 의도를 명시한다.

- **[INFO]** `test.describe` 내 두 테스트가 각각 `mockAuth` + `mockConsole` + `page.goto` 삼중 setup 을 직접 호출
  - 위치: 132–163번 줄
  - 상세: 현재 테스트가 2개뿐이라 중복이 미미하고 `test.beforeEach` 를 쓰면 테스트별로 다른 `triggers` 인자를 전달할 수 없어 현 구조가 합리적이다. 다만 테스트가 늘어날 경우 setup 반복이 누적될 수 있다.
  - 제안: 지금은 변경 불필요. 케이스가 3개 이상이 되면 `test.beforeEach` + 픽스처 파라미터화를 고려한다.

- **[INFO]** `timeout` 숫자(15_000, 10_000)가 두 테스트에 각각 하드코딩
  - 위치: 139번, 155번, 160번 줄
  - 상세: `15_000`ms 와 `10_000`ms 가 각 `expect(...).toBeVisible({ timeout: ... })` 에 직접 기재되어 있다. numeric separator(`_`) 사용으로 가독성은 좋으나, 값이 여러 곳에 산재하면 타임아웃 튜닝 시 놓치기 쉽다.
  - 제안: 파일 상단에 `const VISIBLE_TIMEOUT = 15_000;` / `const DIALOG_TIMEOUT = 10_000;` 상수를 선언해 의미를 부여하고 일괄 변경을 용이하게 한다.

- **[INFO]** `page.locator("pre")` 를 통한 설치 스니펫 어설션
  - 위치: 143번 줄
  - 상세: `page.locator("pre")` 는 태그명 기반 셀렉터로, UI 컴포넌트가 `<code>` 블록 또는 `<textarea>` 로 변경되면 테스트가 묵시적으로 깨진다. 현재로선 구현 의존이 있음.
  - 제안: `page.getByTestId("install-snippet")` 같은 semantic testid 또는 role 기반 셀렉터로 교체하면 리팩터링에 더 견고하다. 단, 현재 스니펫 컴포넌트에 testid 가 없다면 컴포넌트도 함께 수정이 필요하므로 별도 followup 으로 처리 가능.

---

### 파일 2: `plan/in-progress/web-chat-console.md`

- **[INFO]** "미해결/이월" 섹션에 완료(`[x]`) 항목이 잔류
  - 위치: 430–431번 줄
  - 상세: `## 미해결/이월` 섹션 안에 `- [x] embed-config spec 갭 해소` 가 체크 완료 상태로 남아 있다. 미해결 섹션에 완료 항목이 섞이면 "아직 남은 작업이 있는지" 를 한눈에 파악하기 어렵다.
  - 제안: 완료된 항목을 미해결 섹션에서 제거하거나, "완료된 이전 이슈" 하위 절로 분리해 섹션 시맨틱을 유지한다.

---

### 파일 3: `spec/7-channel-web-chat/3-auth-session.md`

- **[INFO]** 들여쓰기 불일치 (step 0 설명 줄)
  - 위치: 478번 줄 (코드 블록 내 `0.` 항목의 두 번째 줄)
  - 상세: `0. (boot) 위젯: ...` 으로 시작하는 첫 줄은 들여쓰기 없이 시작하고, 이어지는 `       불일치 시 ...` 줄은 7스페이스 들여쓰기로 작성되었다. 아래 `1.`~`8.` 항목들은 연속 줄이 없어 통일성이 명시적이지 않으나, 기존 코드 블록 스타일(번호 줄 이어쓰기 없음)과 비교하면 새로 추가된 step 0 만 다소 다른 포매팅이다.
  - 제안: 코드 블록 내 연속 줄 들여쓰기를 기존 항목과 같은 규칙으로 맞추거나, step 0 설명을 한 줄로 줄여 일관성을 확보한다.

---

### 파일 4: `spec/7-channel-web-chat/4-security.md`

- **[INFO]** §3-① 항목이 단일 단락에 여러 책임(API 경로, DTO, 동작, 시퀀스 위치, fail-open 조건) 혼재
  - 위치: 618–624번 줄
  - 상세: 기존 단락이 이미 길었는데, 이번 변경으로 `GET /api/hooks/:endpointPath/embed-config`, `EmbedConfigDto { allowlist, enforce }`, `EmbedConfigService`, 시퀀스 위치 참조(`3-auth-session §3 step 0`), `fail-open` 조건이 한 단락 안에 추가되었다. 각 정보 단위가 모두 필요하나 문장이 길어 빠른 스캔이 어렵다.
  - 제안: 구조적 변경은 불필요하나 가독성 개선을 위해 API 경로·DTO·동작 설명을 `코드 인라인`으로 묶어 시각적 구분을 주거나, 별도 sub-bullet 으로 분리하는 방식을 고려할 수 있다. spec 문서 내에서의 INFO 수준 제안이며 현재 형태도 수용 가능.

---

## 요약

이번 변경(e2e 테스트 신설 + 플랜 업데이트 + spec 2개 보강)은 전반적으로 유지보수성이 양호하다. e2e 파일은 116줄 규모로 함수 분리(`mockAuth`, `mockConsole`, `triggersBody`)가 적절하게 이루어져 있고, 테스트 의도가 한국어 설명과 인라인 주석으로 명확하게 기술되어 있다. 지적 사항은 모두 INFO 수준으로, `timeout` 및 pagination 기본값의 미명명 매직 넘버, 셀렉터의 태그명 의존, 플랜 파일 내 미해결 섹션의 완료 항목 잔류, spec 단락 포매팅 소폭 불일치가 있으나 즉시 차단이 필요한 사항은 없다.

---

## 위험도

LOW
