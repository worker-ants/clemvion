# 부작용(Side Effect) 리뷰

## 발견사항

### 파일 1: `codebase/frontend/e2e/web-chat/console.spec.ts` (신규)

- **[INFO]** 모듈-레벨 상수(전역 변수 형태) 사용
  - 위치: 파일 최상단 `ACCESS`, `USER`, `WORKSPACE`, `WEBCHAT_INSTANCE`, `PLAIN_WEBHOOK` 선언
  - 상세: 이들은 `const` 이며 읽기 전용이다. 테스트 파일 내 공유 상태로 사용되나 Playwright 는 각 `test` 블록을 독립 컨텍스트에서 실행하므로 실제 공유 상태 오염은 없다. 변경·재할당 없음.
  - 제안: 현재 구조로 무방. 단, 픽스처 값이 다른 테스트 파일과 충돌할 가능성은 없다(모듈 스코프 격리).

- **[INFO]** `page.context().addCookies()` — 테스트 컨텍스트 쿠키 변경
  - 위치: `mockAuth` 함수, `has_session` 쿠키 주입
  - 상세: Playwright BrowserContext 에 쿠키를 추가한다. 각 `test` 는 새 `page`(새 context)를 받으므로 다른 테스트로 누출되지 않는다. 인텐셔널한 mock 설정이며 테스트 외부 상태(실제 브라우저·OS·파일시스템)에는 영향 없음.
  - 제안: 이상 없음.

- **[INFO]** `page.route()` 네트워크 인터셉트 — 의도된 mock
  - 위치: `mockAuth`, `mockConsole` 함수 내 `page.route(...)` 호출들
  - 상세: 모든 `page.route` 호출은 테스트용 mock이며 외부 서비스로 실제 네트워크 요청을 보내지 않는다. `route.continue()` 는 `PUT`, `DELETE` 등 명시적으로 처리하지 않는 메서드에만 사용되므로 의도치 않은 실제 API 호출이 발생할 수 있는 잠재적 경로가 있다.
  - 위치: `mockConsole` 의 `else { await route.continue() }` 브랜치
  - 상세: `/api/triggers` 에 대해 GET/POST 가 아닌 경우(PUT, PATCH, DELETE 등) 실제 백엔드로 요청이 전달된다. 이 테스트에서는 해당 메서드를 발생시키는 동작이 없으므로 실질적 위험은 없지만, 테스트가 확장될 때 주의가 필요하다.
  - 제안: 테스트 범위 한정으로 현재는 무해. 테스트 확장 시 unhandled method 를 `route.fulfill({ status: 405 })` 로 명시적 거부하는 것을 고려할 수 있다.

- **[INFO]** 파일시스템 부작용 없음
  - 상세: 테스트 파일은 파일을 생성·수정·삭제하지 않는다. Playwright 는 테스트 결과를 설정된 reporter 경로에만 기록하며, 이는 기존 playwright.config 에 의해 제어된다. 신규 파일 생성이 없다.

- **[INFO]** 환경 변수 읽기/쓰기 없음
  - 상세: 테스트 코드는 `process.env` 를 직접 읽거나 쓰지 않는다.

---

### 파일 2: `plan/in-progress/web-chat-console.md` (수정)

- **[INFO]** 문서 파일 수정 — 상태 추적 갱신
  - 상세: 기존 미해결 항목을 `[x]`(완료)로 표시하고 새 섹션("추가 e2e")을 추가한 문서 변경. plan 파일의 상태 마커 업데이트는 의도된 수명주기 관리이며, 코드 동작에 영향을 주는 부작용이 없다.
  - 제안: 이상 없음.

---

### 파일 3: `spec/7-channel-web-chat/3-auth-session.md` (수정)

- **[INFO]** Spec 문서에 새 step 0 추가 — 기존 step 번호는 유지됨
  - 위치: `## 3. 세션 시퀀스 (per_execution)` 코드 블록 최상단
  - 상세: step 0 신설이 기존 step 1~8 번호를 변경하지 않는다. 기존 참조(`§3 step 1` 등)는 깨지지 않는다. 새로 삽입한 step 0 은 기존 구현에 이미 존재하는 동작(`use-widget.ts` → `GET /api/hooks/:path/embed-config`)을 문서화한 것이며 신규 동작 도입이 아니다.
  - 제안: 이상 없음.

---

### 파일 4: `spec/7-channel-web-chat/4-security.md` (수정)

- **[INFO]** 기존 §3-① 항목 내용 보강 — 엔드포인트명·DTO명 명시 추가
  - 위치: `## 3. 임베드 allowlist` §3-① 항목
  - 상세: 기존 서술("부팅 시 실제 host origin … 을 읽어 캐시 가능한 워크스페이스 allowlist 와 대조")에 `GET /api/hooks/:endpointPath/embed-config`, `EmbedConfigDto`, `EmbedConfigService`, `enforce=false` fail-open 조건을 추가했다. 기존 §3-② / ③ 항목 텍스트·번호는 변경 없음. 인터페이스 변경이 없는 문서 보강이다.
  - 제안: 이상 없음.

---

## 요약

이번 변경은 신규 Playwright e2e 테스트 파일 추가(`console.spec.ts`), plan 파일 상태 마커 갱신, spec 문서 2건의 기존 동작 명문화로 구성된다. 테스트 코드의 모든 네트워크 인터셉트는 의도된 mock이며 실제 외부 서비스 호출이 없고, 공유 상태 누출 경로가 없다. spec 변경은 기존 코드·참조에 영향을 주지 않는 순수한 문서 보강이다. 부작용 관점에서 주목할 위험이 없다.

## 위험도

NONE
