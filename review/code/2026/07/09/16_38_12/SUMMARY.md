# Code Review 통합 보고서

대상 커밋: `24eaf91694741e1c9dcf87d7eca199b54a0efc2d` — test(e2e): Playwright 스위트 flakiness 안정화 (retries·prod 빌드·timeout)
대상 파일: `codebase/frontend/playwright.config.ts`, `codebase/frontend/e2e/profile/profile-edit.spec.ts`

## 전체 위험도
**MEDIUM** — 순수 테스트 인프라 변경으로 보안/부작용/스코프/유지보수성 관점에서는 이슈가 없으나(NONE~LOW), 커밋이 주장한 "3개 플레이키 스펙 완화" 중 실제로 손댄 것은 1개(`profile-edit.spec.ts`)뿐이고 나머지 2개(`web-chat-console`, `members`)는 하드코딩 timeout 이 전역 상향 효과를 차단해 실질 개선이 없다는 testing 리뷰의 WARNING 이 핵심 리스크. 여기에 CI retry 로 인한 회귀 은폐 가능성(관측 수단 부재)과 `docker-compose.e2e.yml` 인접 주석 stale 화가 더해져 MEDIUM 으로 판단.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 커밋이 지목한 3개 플레이키 스펙(`profile-change-password`·`web-chat-console`·`members`) 중 실제로 수정된 것은 `profile-edit.spec.ts` 하나뿐. Playwright 는 개별 지정 `timeout` 이 global `expect.timeout` 보다 항상 우선하므로, `members.spec.ts` 의 `toBeVisible({ timeout: 5_000 })` 등 기존 하드코딩 저(低)-timeout 은 신설된 전역 `expect.timeout: 10_000` 의 수혜를 받지 못함. `web-chat/console.spec.ts` 의 `DIALOG_TIMEOUT`(10_000) 도 신규 전역값과 동일해 실질 개선 없음. 결과적으로 이 두 스펙의 안정화는 사실상 CI `retries: 2` 에만 의존 | `codebase/frontend/e2e/workspaces/members.spec.ts:180`, `codebase/frontend/e2e/web-chat/console.spec.ts` | 두 스펙 및 `login.spec.ts`/`register.spec.ts`/`password-reset.spec.ts`/`background-run-section.spec.ts` 등 하드코딩 저-timeout(5_000/3_000) 을 전수 감사(`grep -rn "timeout: [0-9_]*" e2e`)해 global 기본(10_000) 이상으로 맞추거나 제거하여 global 기본에 위임 |
| 2 | testing | CI `retries: 2` 도입이 실제 회귀(타이밍 아닌 진짜 결함)를 조용히 가릴 위험. "1차 실패 후 2차 통과"와 "1차에 클린 통과"가 CI 게이트(exit code)·현재 reporter 구성상 구분되지 않아, retry 로 통과한 테스트를 가시화/추적하는 장치가 diff 에 없음 | `codebase/frontend/playwright.config.ts:373` (`retries: process.env.CI ? 2 : 0`) | HTML reporter 의 per-test retry 카운트를 post-run 스크립트로 파싱해 retries>0 테스트를 PR 코멘트/Slack 등으로 노출하거나, known-flaky quarantine 리스트를 두어 "재시도로 통과 = 여전히 미해결" 을 가시화 |
| 3 | documentation | `docker-compose.e2e.yml` 의 `playwright-runner` 서비스 인접 주석이 이번 Tier 2(CI 프로덕션 빌드) 변경으로 stale — "dev 서버는 playwright.config 의 webServer 가 자동으로 띄운다" 라고 서술하지만, 실제로는 같은 서비스에 `CI: "true"` 가 주입되어(L258) `next build && next start` 로 production 빌드가 기동됨 | `docker-compose.e2e.yml:226-227` | 주석을 "CI(`CI=true`) 에서는 playwright.config 의 webServer 가 production 빌드(`next build && next start`)를 자동 기동한다" 로 갱신 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | `retries` 는 config 전역 설정이라 CI 의 모든 스펙에 무차별 적용됨(특정 flaky 스펙 3건 겨냥이었으나 blast radius 는 스위트 전체) — 회귀가 우연히 2차 시도에서 통과해 CI green 으로 보고될 위험이 전 스펙에 생김 | `codebase/frontend/playwright.config.ts:27,373` | 근본 원인이 파악된 특정 스펙에 한정해 `test.describe.configure({ retries })` 로 스코프하거나, 최소한 flaky test 트래킹 도입 검토 |
| 2 | side_effect | 실제 backend(docker e2e) 사용 스펙에서 retry 시 `beforeEach`/setup 이 idempotent 한지(중복 리소스 생성/409 충돌 가능성) 이번 diff 범위(2개 파일)만으로는 검증 불가 | `codebase/frontend/playwright.config.ts:27` | retry-safety(setup 재실행 안전성)를 실제 백엔드 사용 스펙군 대상으로 별도 점검 |
| 3 | side_effect / testing | 전역 `timeout: 45_000`/`expect.timeout: 10_000` 상향이 `retries: 2` 와 곱연산되어, 진짜 결함 시 실패 확정까지 최대 약 3×45s=135s 로 지연 — CI 총 wall-clock 시간 증가가 커밋 메시지에 명시적으로 언급되지 않음 | `codebase/frontend/playwright.config.ts:373,377-378,401` | CI job 레벨 타임아웃이 이 누적 최악 케이스보다 여유 있는지, 총 소요시간 증가를 문서화/모니터링할지 확인 |
| 4 | side_effect | CI 전용 webServer 전환(`next dev`→`next build && next start`)이 `.next/` 빌드 아티팩트 신규 생성 + build-time `NEXT_PUBLIC_*` env 의존성을 만듦(이 diff 밖이라 CI 워크플로의 env 주입 여부 확인 불가). 과거 "Docker 디스크 부족(build cache 누적)" 사례와 유사한 리스크 표면을 소폭 확대(단 `webServer.timeout` 180s→240s 로 이미 대응됨) | `codebase/frontend/playwright.config.ts` webServer.command | CI 워크플로에서 `next build` 시점 필요 env 주입 여부와 빌드 캐시 정리 정책 별도 확인 |
| 5 | testing | `profile-edit.spec.ts` 의 15s 상향(Tier 3)이 같은 커밋의 Tier 2(prod 빌드 근본원인 제거) 주장과 함께 적용되어, 향후 재발 시 어느 tier 가 실효였는지 구분하기 어려움 | `codebase/frontend/e2e/profile/profile-edit.spec.ts:258` | 후속 관찰 기간에 flake 재발 시 어느 tier 가 실효였는지 기록 |
| 6 | maintainability | 동일 파일 내 timeout 리터럴 파편화 — 기존 `{ timeout: 10_000 }` 3곳 대비 신규 리다이렉트 대기만 `15_000`. 코드베이스에는 이미 이름 붙인 timeout 상수 패턴(`PAGE_READY_TIMEOUT`, `DIALOG_TIMEOUT`)이 존재해 스타일이 갈림(단, 인라인 주석이 근거를 설명해 매직넘버는 아님) | `codebase/frontend/e2e/profile/profile-edit.spec.ts:221,246,271` vs `:325` | 후속 정리 시 `const REDIRECT_TIMEOUT = 15_000` 등으로 추출 고려(비필수) |
| 7 | maintainability / documentation | `profile-edit.spec.ts` 의 "Tier 3" 라벨이 파일 내부에서 정의되지 않아 `playwright.config.ts` 를 함께 봐야 의미가 드러남(크로스 파일 문서 의존) | `codebase/frontend/e2e/profile/profile-edit.spec.ts:59` (라인 324 부근) | `(playwright.config.ts 의 Tier 3 참고)` 등 파일 참조를 주석에 추가(사소, 비차단) |
| 8 | documentation | e2e 작성/운영 SoT 인 `PROJECT.md` §Frontend e2e 패턴에 이번 CI 전용 동작 변화(CI 재시도 2회·prod 빌드 기동·전역 timeout 45s/10s)가 반영되지 않음 — 현재는 `playwright.config.ts` 인라인 주석에만 설명됨 | `PROJECT.md` §Frontend e2e 패턴 (L296-301 부근) | 한두 줄 요약 추가 권장(필수는 아님) |
| 9 | scope | `webServer.timeout` 180_000→240_000 변경은 커밋 메시지의 3-tier 목록에 별도 항목으로 명시되지 않았으나 Tier 2(prod 빌드)의 필연적 파생 조정 | `playwright.config.ts` webServer 블록 | 커밋 본문에 한 줄 추가하면 추적성 향상(optional, 비차단) |
| 10 | scope | 전역 `expect.timeout: 10_000` 신설로 `profile-edit.spec.ts` 등 기존에 개별 지정된 `{ timeout: 10_000 }` assertion 들이 redundant 해짐(회귀 아님, 스코프 위반도 아님) | `playwright.config.ts` expect 옵션; `profile-edit.spec.ts:221,246,280` | 이번 범위 밖 — 후속 cleanup PR 후보로만 기록 |
| 11 | requirement | `process.env.CI ? 2 : 0` 등 기존 파일 전반의 관용구는 `CI` 가 `"false"` 같은 비어있지 않은 문자열이어도 truthy 로 취급되는 JS 진리값 특성을 가짐(이번 diff 신규 도입 아님, `docker-compose.e2e.yml` 이 `CI: "true"` 리터럴을 주입하므로 현재는 실질 위험 없음) | `playwright.config.ts:15`(신규 retries 줄) 등 | 조치 불요. 향후 CI 값이 `"false"` 문자열로 주입되는 경로가 생기면 유의(사전 존재 이슈, 본 diff 범위 밖) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | MEDIUM | 3개 지목 플레이키 스펙 중 2개(web-chat-console·members) 미개선(하드코딩 timeout 이 전역 상향 차단), retry 은폐 관측 수단 부재 |
| documentation | LOW | `docker-compose.e2e.yml` 주석 stale(dev↔prod 빌드 서술 불일치), `PROJECT.md` e2e 섹션 미갱신 |
| side_effect | LOW | retries 전역 blast radius, real-backend retry idempotency 미검증, prod 빌드 build-time env/디스크 의존성 확대 |
| requirement | LOW | 커밋 주장 3-tier 완화가 diff 에 정확히 구현됨을 확인(기능 완전성 문제 없음), 관련 spec 문서 부재는 스코프상 정상(PROJECT.md 소관) |
| maintainability | NONE | timeout 리터럴 파편화, Tier 라벨 크로스파일 의존 — 사소한 INFO |
| security | NONE | mock 픽스처·CI 전용 빌드 커맨드 등 실질 보안 결함 없음 |
| scope | NONE | 커밋 메시지가 서술한 3-tier 항목으로만 정확히 구성, 무관 변경/오버엔지니어링 없음 |

## 발견 없는 에이전트

- security — 인젝션/인증우회/입력검증미비/암호화약점/민감정보노출/취약의존성 등 실질 보안 결함 없음(위험도 NONE). mock 토큰·CI 빌드 커맨드는 모두 조치 불필요로 확인.
- scope — 임포트 변경, 기능 확장, 무관 파일 수정, 포맷팅-only 변경, 의도치 않은 설정 변경 없음. 커밋 메시지 서술 범위와 diff 가 1:1 대응(위험도 NONE).

## 권장 조치사항

1. `members.spec.ts`(`toBeVisible({ timeout: 5_000 })` 등)와 `web-chat/console.spec.ts`(`DIALOG_TIMEOUT`)를 포함해 e2e 전역에 하드코딩된 저(低)-timeout 값을 감사하고, 전역 `expect.timeout: 10_000` 이상으로 통일하거나 제거 — 커밋이 실제로 지목한 flaky 스펙 2/3 이 여전히 개선 사각지대에 있으므로 최우선.
2. CI retry 발생 여부를 가시화하는 장치(HTML reporter retry 카운트 파싱→PR 코멘트/Slack, 또는 known-flaky quarantine 리스트)를 후속 작업으로 추가해 "재시도로 통과 = 여전히 미해결" 을 은폐하지 않도록 함.
3. `docker-compose.e2e.yml` L226-227 의 `playwright-runner` 주석을 이번 Tier 2 변경(dev→prod 빌드)에 맞게 갱신.
4. (선택) `PROJECT.md` §Frontend e2e 패턴에 CI 전용 동작(재시도 2회·prod 빌드 기동·전역 timeout) 한두 줄 요약 추가.
5. (선택, 비차단) `profile-edit.spec.ts` 의 timeout 리터럴을 named 상수로 추출하고 "Tier 3" 라벨에 `playwright.config.ts` 참조를 명시해 파일 단독 가독성 개선.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 순수 테스트 인프라 설정 변경(runtime 성능 영향 없음)으로 router 가 저관련으로 판단 |
  | architecture | 아키텍처 구조 변경 없음(config 값 조정만) |
  | dependency | 의존성 추가/변경 없음 |
  | database | DB 접근 로직 변경 없음 |
  | concurrency | 동시성 로직 변경 없음 |
  | api_contract | API 계약 변경 없음 |
  | user_guide_sync | 사용자 대상 기능/UI 변경 없음(e2e 인프라 전용) |