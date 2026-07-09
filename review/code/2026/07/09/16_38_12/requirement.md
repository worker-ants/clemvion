# 요구사항(Requirement) 리뷰 — e2e flakiness 안정화 (retries·prod 빌드·timeout)

대상: `codebase/frontend/playwright.config.ts`, `codebase/frontend/e2e/profile/profile-edit.spec.ts`
커밋: `24eaf91694741e1c9dcf87d7eca199b54a0efc2d`

## 분석 방법

커밋 메시지가 주장하는 3-tier 완화(재시도/prod 빌드/timeout slack)가 실제 diff 에 그대로 구현됐는지,
그리고 `docker-compose.e2e.yml`(`playwright-runner`) · `package.json` scripts 와 상호 정합적으로
동작하는지(즉 `process.env.CI` 게이팅이 실제 e2e 러너에서 참이 되는지, 빌드/스타트 포트가
`PLAYWRIGHT_BASE_URL` 과 맞는지)를 교차 확인했다.

## 발견사항

- **[INFO]** 관련 spec 문서 부재 — Playwright e2e 인프라 전략(재시도 정책·CI 빌드 전략·timeout 값)을
  규정하는 `spec/` 문서를 찾지 못했다.
  - 위치: `spec/` 전역 (grep: `playwright`, `retries`, `webServer`, `flak`)
  - 상세: 이 변경 영역은 제품 스펙이 아니라 CI/테스트 인프라 운영 규칙이며, CLAUDE.md 자체가
    "실제 명령·인프라·e2e 작성 패턴은 `PROJECT.md`" 로 명시적으로 스코프를 분리해 둔 영역이다.
    `PROJECT.md` §e2e 테스트 작성 가이드를 확인했고 이번 변경(재시도/prod 빌드/timeout)과 충돌하는
    기존 서술은 없었다(해당 세부값을 규정하는 문장 자체가 없음).
  - 제안: spec 갱신 불필요. 참고 정보로만 기록.

- **[INFO]** `process.env.CI ? 2 : 0` (및 기존 `workers`/`webServer.command` 의 동일 패턴) 은 JS 진리값
  평가상 `CI` 가 임의의 비어있지 않은 문자열("false" 포함)이면 truthy 로 취급된다.
  - 위치: `codebase/frontend/playwright.config.ts:15`(신규 `retries` 줄), 기존 `workers`/`webServer.command`/
    `reuseExistingServer` 줄에도 동일 패턴 이미 존재
  - 상세: 이 diff 가 새로 도입한 관용구가 아니라 파일에 이미 있던 컨벤션을 그대로 따른 것이며,
    `docker-compose.e2e.yml` 의 `playwright-runner` 서비스가 `CI: "true"` (리터럴 문자열 "true") 를
    명시적으로 주입하므로 오늘 시점 실질적 위험은 없음을 확인했다.
  - 제안: 코드 수정 불요. 향후 CI 값이 `"false"` 문자열로 주입되는 경로가 생기면 `!!process.env.CI`
    만으로는 안 막힌다는 점만 유의(사전 존재하던 이슈, 본 diff 범위 밖).

- **[INFO]** (긍정 확인) prod 빌드/스타트 흐름의 포트·env 정합성 — `next start --port ${PORT:-3012}`
  (package.json `start` 스크립트) 가 compose 의 `PLAYWRIGHT_BASE_URL: http://localhost:3012` 및
  `playwright.config.ts` 의 fallback baseURL 3012 와 일치한다. `.env` 미존재(`.env.example` 만 존재,
  `.gitignore` 로 제외)로 인한 `source .env 2>/dev/null` no-op 은 build 단계와 start 단계에서 동일하게
  적용되어(같은 컨테이너 셸) build-time inlining 과 run-time 값의 괴리가 없다.
  - 결론: Tier 2(prod 빌드 webServer) 가 실제 `make e2e-test-full` 경로에서 의도대로 활성화되고
    포트 불일치 없이 동작함을 정적으로 검증.

- **[INFO]** (TODO 해소 확인) 제거된 주석 `"로컬 디버깅 우선. CI 도입 시 1~2 로 올림."` 은 그 자체로
  미구현 TODO 성격이었고, 본 diff 가 정확히 그 약속(`retries: process.env.CI ? 2 : 0`)을 구현해
  해소했다 — 신규 TODO/FIXME 는 diff 전체에 없음.

## 기능 완전성 / 의도-구현 일치 체크

- Tier 1(재시도): `retries: process.env.CI ? 2 : 0` — 커밋 설명과 정확히 일치.
- Tier 2(prod 빌드): `command: process.env.CI ? "npm run build && npm run start" : "npm run dev"`,
  `webServer.timeout: 240_000` — 설명과 일치. `reuseExistingServer: !process.env.CI` 는 기존 그대로라
  로직상 정합(CI 는 매번 새로 fresh 기동).
- Tier 3(timeout slack): 전역 `timeout: 45_000`, `expect: { timeout: 10_000 }` + `profile-edit.spec.ts`
  의 change-password 리다이렉트 `waitForURL` 10s→15s — 설명과 일치. 파일 내 다른 `waitForURL`/`expect`
  호출은 이미 명시 timeout(10s)을 갖고 있거나 새 전역 기본값(10s)의 수혜를 받아 회귀 없음.
- `test.setTimeout`/`test.slow()` 를 별도로 오버라이드하는 스펙이 없어 전역 `timeout: 45_000` 과
  충돌하는 기존 테스트 없음을 확인.
- 부정 단언(negative assertion, 예: `not.toBeVisible`)에 의존하는 스펙(`web-chat/console.spec.ts`)은
  자체 `DIALOG_TIMEOUT` 상수를 쓰고 있어 전역 `expect.timeout` 상향의 영향을 받지 않음.

## 엣지 케이스 / 에러 시나리오 / 데이터 유효성 / 비즈니스 로직 / 반환값

본 변경은 순수 테스트 인프라 설정(재시도 횟수·webServer 기동 명령·전역 timeout)이며 비즈니스 로직·
입력 검증·반환값 경로가 없다. 실패 시나리오는 Playwright/webServer 자체의 표준 실패 처리(빌드 실패 시
webServer startup 실패로 명확한 에러)로 충분히 커버되며 별도 커스텀 에러 핸들링이 필요한 지점은 없다.

## 요약

커밋 메시지가 주장한 3-tier 완화(retries·prod 빌드 webServer·timeout slack)가 diff 에 정확히,
누락 없이 구현되어 있고 함수명/주석과 실제 동작 간 괴리가 없다. `docker-compose.e2e.yml` 의
`CI: "true"` 주입과 `package.json` 의 `build`/`start` 스크립트 포트(3012)를 교차 확인한 결과 이
설정이 실제 `make e2e-test-full` 경로에서 의도대로 활성화됨을 정적으로 확인했다. 관련 제품 spec
문서는 존재하지 않으며(이 영역은 의도적으로 `PROJECT.md` 소관), 이는 gap 이 아니라 설계상 스코프
분리다. CRITICAL/WARNING 급 발견사항 없음 — 전부 INFO(참고) 수준.

## 위험도

LOW
