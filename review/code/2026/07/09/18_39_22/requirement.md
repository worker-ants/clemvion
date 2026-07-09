# 요구사항(Requirement) 리뷰 — e2e ai-review 후속 (session 16_38_12 → 18_39_22)

대상 커밋: `d4a188eb00cc171b5bc9c3e024a8ff6d5fee6698`
대상: W1(sub-global timeout 10곳 제거) · W2(retry-visibility 부분 fix + plan 이관) · W3(docker-compose 주석 정합)

## 분석 방법

커밋 메시지·RESOLUTION.md가 주장하는 W1/W2/W3 조치가 실제 diff에 정확히 구현됐는지 `git show --stat` + 개별 파일 diff로 대조하고, 남은 하드코딩 timeout이 없는지 `grep`으로 전수 확인했다. 추가로 RESOLUTION.md "## TEST 결과" 절의 e2e 검증 근거(로그 경로)가 실제로 이번 변경(frontend Playwright 스펙 6개 + `playwright.config.ts` + `docker-compose.e2e.yml`)을 검증했는지 로그 내용·`playwright-report`/`test-results` mtime을 직접 대조했다.

## 발견사항

- **[CRITICAL]** RESOLUTION.md/commit 메시지의 "e2e PASS(247 tests, retry 없이 clean)" 검증 근거가 실제로는 **backend Jest e2e 스위트**이며, 이번 커밋이 실제로 변경한 **frontend Playwright 스펙(6개 파일의 하드코딩 timeout 제거)은 이 세션에서 전혀 재실행되지 않았다**
  - 위치: `review/code/2026/07/09/16_38_12/RESOLUTION.md` "## TEST 결과" e2e 줄, commit 메시지 마지막 줄("SUMMARY/RESOLUTION 기록. lint PASS, e2e PASS(247 tests, retry 없이 clean).") / 근거로 인용된 `_test_logs/e2e-20260709-183434.log`
  - 상세: 인용된 로그를 직접 열어 확인한 결과, 첫 줄부터 `docker compose ... up -d --wait --build backend-e2e`, 195번째 줄 `docker compose ... run --rm --build backend-e2e-runner`, 438번째 줄 `jest --config ./test/jest-e2e.json`, 496-497번째 줄 `Test Suites: 43 passed, 43 total` / `Tests: 247 passed, 247 total`(정확히 "247 tests" 수치 일치) — **`playwright-runner` 서비스 실행 흔적이 로그 전체에 단 한 줄도 없다**(`grep -n "playwright" _test_logs/e2e-20260709-183434.log` = 0건). 즉 `make e2e-test`(backend 전용, `Makefile:58-60`)만 실행됐고, 이번 diff가 바꾼 6개 `*.spec.ts` + `playwright.config.ts` + `docker-compose.e2e.yml`(`playwright-runner` 주석)을 검증하려면 필요한 `make e2e-test-full`(backend + playwright, `Makefile:72-75`)의 두 번째 단계(`playwright-runner`)는 실행되지 않았다.
    추가 물증: `codebase/frontend/playwright-report/index.html` 와 `codebase/frontend/test-results/.last-run.json` 의 mtime 이 모두 **`2026-07-09 16:35:43`** — 이 commit(Author date `Thu Jul 9 18:38:59 2026`)보다 **약 2시간 이전이고, 심지어 그 원인이 된 ai-review 세션(`16_38_12`, 16:38:12 시작)보다도 이전**이다. 즉 이번 diff의 코드가 만들어지기도 전의 낡은 Playwright 실행 결과이며, 이번 W1 fix(10곳의 하드코딩 저-timeout 제거)를 검증하는 새 Playwright 실행은 이 세션에서 전혀 일어나지 않았다.
    이는 `PROJECT.md` §e2e 실행 원칙의 명시적 요구("코드가 한 줄이라도 바뀌었으면 e2e 수행이 default", "review 반영 직후 fix 가 1~2 줄"도 재수행 대상, "변경이 frontend 만/backend 만"은 면제 사유 아님)와 developer SKILL의 RESOLUTION.md e2e 줄 스키마(실제 검증을 반영해야 함) 모두를 위반한다. 코드 자체(diff)는 정적으로 타당해 보이지만(아래 참고), "e2e PASS"라는 문서화된 근거는 실제로 변경된 코드 경로를 전혀 검증하지 못한 채 committed artifact(RESOLUTION.md)에 남아 향후 이 세션을 신뢰하는 사람(merge-coordinator 등)을 오도할 수 있다.
  - 제안: `make e2e-test-full`(또는 최소 `docker compose ... run --rm --build playwright-runner`)을 실제로 재실행해 247개 backend 테스트가 아니라 **frontend Playwright 스위트**가 clean 통과(retry 없이)함을 확인하고, RESOLUTION.md의 e2e 줄을 그 결과(정확한 log 경로·frontend 테스트 개수)로 정정할 것.

- **[INFO]** (긍정 확인) W1 조치 자체는 커밋이 주장한 범위·개수와 정확히 일치
  - 위치: `login.spec.ts`(3)·`register.spec.ts`(2)·`password-reset.spec.ts`(2)·`register-invitation.spec.ts`(1)·`members.spec.ts:180`·`background-run-section.spec.ts:224` = 정확히 10곳
  - 상세: `grep -rn "timeout:\s*[0-9_]*" codebase/frontend/e2e --include="*.spec.ts"`로 전수 확인한 결과, 남아있는 값은 모두 `10_000`(전역과 동일 — 커밋이 "전역동일 은 미대상"이라 명시한 대로 존치) 또는 `15_000`(전역보다 큰 의도적 override, `profile-edit.spec.ts`·`slug-routing.spec.ts` — 이번 diff 범위 밖)뿐이다. `web-chat/console.spec.ts`의 `DIALOG_TIMEOUT`(10_000, named const)과 `.not.toBeVisible`(negative)도 커밋이 명시한 대로 미대상으로 남아있어 "positive toBeVisible만, negative·전역동일 제외" 설명과 line-level로 일치한다. 제거 후에도 각 파일의 어서션 본문(matcher 정규식)은 변경되지 않아 회귀 위험은 없어 보인다(단, 위 CRITICAL대로 실행 검증은 없었음).

- **[INFO]** (긍정 확인) W3 docker-compose 주석 정합화도 사실관계와 일치
  - 위치: `docker-compose.e2e.yml` `playwright-runner` 인접 주석, `environment: { CI: "true" }`(L260-261)
  - 상세: 새 주석 "CI="true"(아래 environment)로 실행되므로 ... production 빌드를 자동 기동한다"는 실제로 같은 서비스 정의에 `CI: "true"`가 존재함을 확인해 정확하다. `playwright.config.ts`의 `webServer.command: process.env.CI ? "npm run build && npm run start" : "npm run dev"`와도 논리적으로 부합.

- **[INFO]** (긍정 확인) W2 partial-fix 문서화 및 후속 plan 파일 형식 적절
  - 위치: `codebase/frontend/playwright.config.ts:18-22`(신규 주석), `plan/in-progress/e2e-retry-visibility-followup.md`
  - 상세: 신규 주석은 Playwright list/html reporter가 retry로 통과한 테스트를 flaky로 별도 집계한다는 실제 동작을 정확히 설명한다(CI 게이트는 exit code 기준이라 flaky를 green 취급한다는 한계도 명시). 신규 plan 파일의 frontmatter(`worktree: (unstarted)`, `started: 2026-07-09`, `owner: ...`)는 `.claude/docs/plan-lifecycle.md §4` 스키마(3필드 필수 + 미착수 sentinel `(unstarted)`)를 정확히 따른다. 본문에 미체크 "## 할 일" 항목이 남아 있어 `plan/in-progress/`에 위치한 것도 §2 분류 기준과 일치.

- **[INFO]** 관련 spec 문서 부재는 기존과 동일하게 스코프상 정상
  - 위치: `spec/` 전역(재확인: `playwright`/`retries`/`webServer`/`flak` grep — 신규 매치 없음)
  - 상세: 이 영역은 CLAUDE.md가 명시적으로 `PROJECT.md` 소관으로 분리한 CI/테스트 인프라 운영 규칙이며, 직전 세션(`16_38_12/requirement.md`)의 동일 결론과 일치한다. 이번 후속 커밋도 이 경계를 넘지 않는다.

- **[INFO]** TODO/FIXME 신규 없음 — diff 전체에 미완료를 시사하는 주석은 없다. 유일하게 "후속"으로 명시된 항목(W2의 CI-level surfacing)은 committed plan(`plan/in-progress/e2e-retry-visibility-followup.md`)으로 정식 등록돼 dangling TODO가 아니다.

## 기능 완전성 / 의도-구현 일치 체크

- W1(sub-global timeout override 제거): 주장한 10곳과 실제 diff가 1:1 일치, 함수 시그니처/matcher 변경 없음(옵션 인자만 제거) — 의도-구현 괴리 없음.
- W2(partial fix + 이관): 주석 추가 내용이 Playwright 실제 reporter 동작과 일치, 이관처(followup plan)가 정식 등록됨 — 의도-구현 괴리 없음.
- W3(docker-compose 주석 정합): 주석 내용이 실제 `environment.CI`/`playwright.config.ts` 로직과 일치 — 의도-구현 괴리 없음.
- 다만 커밋이 스스로 근거로 제시한 검증(e2e PASS)이 실제로 변경 대상을 검증하지 못했다는 점에서, "구현이 의도한 대로 동작함을 확인했다"는 **주장** 자체와 **실제로 확인된 사실** 사이에 괴리가 있다(위 CRITICAL).

## 엣지 케이스 / 에러 시나리오 / 데이터 유효성 / 비즈니스 로직 / 반환값

본 변경은 e2e 테스트 인프라(assertion timeout 옵션·설정 주석·plan 문서)로 비즈니스 로직·입력 검증·반환값 경로가 없다. 실패 시나리오는 Playwright 표준 timeout 처리로 충분하며 별도 커스텀 에러 핸들링 지점 없음.

## 요약

W1/W2/W3 세 조치는 모두 커밋 메시지·RESOLUTION.md가 주장한 내용과 실제 diff가 line-level로 정확히 일치하며(하드코딩 timeout 10곳 제거, docker-compose 주석 정합, playwright.config 주석 추가 + followup plan 정식 등록), 관련 spec 문서 부재도 기존 결론대로 정상 스코프 분리다. 그러나 이 후속 커밋 자체가 "ai-review WARNING을 해소했다"는 근거로 제시한 e2e 테스트 결과는 실제로는 **이번 변경과 무관한 backend Jest e2e 스위트**(247 tests, `backend-e2e-runner`)이며, 정작 검증이 필요한 frontend Playwright 스위트는 `playwright-report`/`test-results` 타임스탬프(16:35:43, 이 commit·심지어 그 계기가 된 리뷰 세션보다도 이전)로 볼 때 이 세션에서 전혀 재실행되지 않았다. 코드 diff 자체는 정적으로 타당해 보이지만, committed 검증 근거(RESOLUTION.md)가 실제로 변경 코드를 검증하지 못한 채 "PASS"로 기록된 것은 프로젝트의 e2e 필수 검증 정책을 위반하는 CRITICAL 사안이다.

## 위험도

**HIGH** — 코드 변경 자체(diff)는 요구사항과 정확히 일치하지만, 그 변경을 검증했다고 주장하는 테스트 근거가 실제로는 다른 스위트를 가리키고 있어(frontend Playwright 미실행) 실제 회귀 여부가 이 세션 내에서 확인되지 않았다. 즉시 `make e2e-test-full`(또는 playwright-runner 단독) 재실행 및 RESOLUTION.md 정정 권고.
