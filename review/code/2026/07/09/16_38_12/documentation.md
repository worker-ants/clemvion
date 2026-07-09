# 문서화(Documentation) 리뷰 — e2e stabilization (retries·prod 빌드·timeout)

## 발견사항

- **[WARNING]** `docker-compose.e2e.yml` 의 `playwright-runner` 주석이 이번 변경(Tier 2: CI 프로덕션 빌드)으로 stale 해졌다
  - 위치: `docker-compose.e2e.yml` L226-227 (`playwright-runner` 서비스 바로 위 주석)
  - 상세: 주석은 "dev 서버는 playwright.config 의 webServer 가 자동으로 띄운다" 라고 서술한다. 그러나 이번 diff 로 `playwright.config.ts` 의 `webServer.command` 가 `process.env.CI ? "npm run build && npm run start" : "npm run dev"` 로 바뀌었고, 바로 이 서비스 정의에 `environment: { CI: "true" }` (L258) 가 명시되어 있다 — 즉 이 컨테이너는 실제로 **dev 서버가 아니라 production 빌드(`next build && next start`)** 를 띄운다. 코드 변경(Tier 2)이 정확히 이 서비스가 실행하는 경로를 바꿨는데, 인접한 인프라 주석은 갱신되지 않아 이제 사실과 다르다. 향후 이 컨테이너를 디버깅하는 사람이 "dev 서버가 뜬다"고 오해하면 빌드 실패/240s 타임아웃/prod 전용 이슈(hydration mismatch 없음 등)의 원인 파악이 늦어질 수 있다.
  - 제안: 주석을 "CI(`CI=true`) 에서는 playwright.config 의 webServer 가 production 빌드(`next build && next start`)를 자동 기동한다" 로 갱신.

- **[INFO]** `PROJECT.md` "Frontend e2e 패턴 (playwright, mock-based)" 섹션에 이번 CI 동작 변경이 반영되지 않음
  - 위치: `PROJECT.md` §Frontend e2e 패턴 (L296-301 부근)
  - 상세: 이 섹션은 이 프로젝트에서 e2e 명령·인프라·작성 패턴의 단일 진실(SoT)로 명시된 문서(`CLAUDE.md` "실제 명령·인프라·면제 화이트리스트·e2e 작성 패턴: PROJECT.md")이지만, 이번 변경으로 도입된 CI 전용 동작 — (a) CI 재시도 2회(로컬 0), (b) CI 에서 `next build && next start` 로 프로덕션 빌드 기동(로컬은 dev 서버 재사용), (c) 전역 `timeout: 45s`/`expect.timeout: 10s` — 이 언급되지 않는다. 현재는 `playwright.config.ts` 인라인 주석에만 설명되어 있어, 로컬-CI 동작 차이(예: "로컬에서는 재현 안 되는데 CI 에서만 flake" 디버깅 시 CI 가 실제로는 dev 서버가 아니라 prod 빌드를 쓴다는 사실)를 알려면 config 파일을 직접 열어야 한다.
  - 제안: PROJECT.md 해당 섹션에 한두 줄 요약 추가(예: "CI 는 `next build && next start` 로 기동 + 2회 retry — 로컬 재현 시 `CI=1` 로 실행하면 동일 경로 확인 가능"). 필수는 아니나, 이 문서가 e2e 작성/디버깅 SoT 임을 고려하면 권장.

- **[INFO]** `profile-edit.spec.ts` 의 "Tier 3" 라벨이 파일 내부에서 정의되지 않음
  - 위치: `codebase/frontend/e2e/profile/profile-edit.spec.ts` L324 (`// /profile 으로 리다이렉트 (client-side navigation — 부하 시 여유 필요, Tier 3)`)
  - 상세: "Tier 1/2/3" 개념은 `playwright.config.ts` 의 주석에서만 정의된다. `profile-edit.spec.ts` 단독으로 읽으면 "Tier 3" 가 무엇을 가리키는지 알 수 없어 크로스 파일 문서 의존이 발생한다. 커밋 메시지·PR 설명에는 맥락이 있지만, 코드 주석만 보는 이후 유지보수자에게는 약한 신호다.
  - 제안: 사소하므로 강제하진 않되, 여유가 있다면 `(playwright.config.ts 의 Tier 3 참고)` 정도로 파일 경로를 명시하면 더 명확해진다.

- **[NONE — 확인 사항, 조치 불필요]** CHANGELOG.md 미갱신은 이번 변경 범위상 적절
  - 상세: `CHANGELOG.md` 는 spec-sync 를 동반한 제품 기능 변경만 기록하는 컨벤션(각 항목이 `spec/...` SoT 를 명시)이다. 이번 변경은 순수 e2e 테스트 인프라 안정화(spec 영향 없음)이므로 CHANGELOG 항목 부재는 기존 컨벤션과 일치한다.

- **[NONE — 확인 사항]** 인라인 주석 자체의 품질은 양호
  - 상세: `playwright.config.ts`/`profile-edit.spec.ts` 에 추가된 Tier 1/2/3 주석은 "무엇을 바꿨는지" 뿐 아니라 "왜"(순간 flake 흡수, dev-server 온디맨드 컴파일이 flake 근본원인, 부하 시 slack 필요)를 설명해 근거가 명확하다. 제거된 구 주석("CI 도입 시 1~2 로 올림")이 실제로 이번에 이행됐다는 점도 커밋 메시지에서 잘 추적된다. `waitForURL` 10s→15s 변경에 붙은 새 주석도 왜 변경했는지(Tier 3, 부하 시 여유) 를 정확히 반영한다.

## 요약

코드 자체의 인라인 문서화(주석)는 이번 변경의 "왜"를 잘 설명하고 있어 품질이 높다. 다만 이번 diff 가 정확히 손대는 CI 실행 경로(`playwright-runner` 가 이제 dev 서버가 아닌 production 빌드를 띄움)에 대해 `docker-compose.e2e.yml` 의 인접 주석이 갱신되지 않아 stale 상태가 됐고, e2e 작성/운영 SoT 인 `PROJECT.md` 에도 이 CI 전용 동작 변화가 요약되지 않아 향후 디버깅 시 발견 지연 가능성이 있다. CHANGELOG 미갱신은 컨벤션상 적절하며 별도 조치 불필요.

## 위험도

LOW
