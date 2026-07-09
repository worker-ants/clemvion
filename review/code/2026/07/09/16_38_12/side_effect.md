# 부작용(Side Effect) 리뷰

대상: `codebase/frontend/e2e/profile/profile-edit.spec.ts`, `codebase/frontend/playwright.config.ts`
(commit 24eaf91694741e1c9dcf87d7eca199b54a0efc2d — e2e flakiness 안정화: retries·prod 빌드·timeout)

## 발견사항

- **[INFO]** retries 도입은 전체 e2e 스위트에 무차별 적용되어 blast radius 가 넓다
  - 위치: `codebase/frontend/playwright.config.ts:27` (`retries: process.env.CI ? 2 : 0`)
  - 상세: 이번 변경의 동기는 `profile-change-password`·`web-chat-console`·`members` 등 특정 스펙의 간헐적 timeout 이지만, `retries` 는 config 전역 설정이라 CI 의 **모든** spec 파일에 예외 없이 적용된다. 의도치 않은 부작용은 아니나(Playwright 구조상 `test.describe.configure({ retries })` 로 특정 스펙에만 좁힐 수도 있었음), "특정 flaky 스펙 완화" 목적이 "전체 스위트의 실패 허용 정책 변경"으로 확대된 점을 인지할 필요가 있다. 재시도로 인해 실제 회귀인데 우연히 2번째 시도에서 통과하는 케이스가 CI green 으로 보고될 위험(false negative)이 전 스펙에 걸쳐 생긴다.
  - 제안: 근본 원인이 파악된 특정 스펙에 한정해 `retries` 를 스코프하거나, 최소한 CI 리포트에서 "재시도로 통과" 케이스를 별도로 가시화(flaky test 트래킹)하는 후속 조치를 고려.

- **[INFO]** real backend(docker e2e) 를 쓰는 스펙에서 retry 시 setup idempotency 가 검증되지 않았다
  - 위치: `codebase/frontend/playwright.config.ts:27`
  - 상세: 커밋 메시지가 언급하는 `make e2e-test-full` 은 docker 기반 실제 백엔드를 쓰는 것으로 보인다(리뷰 대상 `profile-edit.spec.ts` 자체는 `page.route` mock 이라 이 우려에서 자유롭다). 재시도가 켜진 상태에서, 다른 스펙 중 일부가 사전 상태를 생성(회원가입·초대·리소스 생성 등)한 뒤 assertion 단계에서만 실패하는 패턴이라면, 재시도가 setup 단계를 다시 실행해 중복 리소스 생성/충돌(예: unique constraint 409)을 유발할 수 있다. 이번 diff 범위(두 파일)만으로는 다른 스펙들의 setup 이 매 재시도마다 안전하게 재실행 가능한지 확인할 수 없다.
  - 제안: retry-safety(각 스펙의 `beforeEach`/setup 이 idempotent 한지)를 별도로 점검. 최소한 실제 백엔드를 쓰는 스펙군에서 retry 후 실패 로그를 모니터링.

- **[INFO]** 전역 `timeout`/`expect.timeout` 상향이 실패 감지를 느리게 만들고 retries 와 곱연산된다
  - 위치: `codebase/frontend/playwright.config.ts:28,432` (`timeout: 45_000`, `expect: { timeout: 10_000 }`)
  - 상세: Playwright 기본값(test 30s, expect 5s) 대비 각각 1.5배·2배 상향이며, 기존엔 개별 스펙이 명시적으로 `{ timeout: 10_000 }` 등을 지정하던 것을 전역 기본으로 끌어올렸다. 순수 flakiness 완화 목적에는 맞으나, 실제로 회귀가 발생해 어떤 assertion 이 영원히 실패하는 경우 CI 가 실패를 확정하기까지 걸리는 시간이 늘어난다(retries 2회와 곱해지면 케이스당 fail 확정까지 최대 약 3×45s = 135s). 스펙 개수가 많은 스위트 전체로 보면 CI 총 wall-clock 시간 증가는 의도된 트레이드오프이나 커밋 메시지에 명시적으로 언급되어 있지 않다.
  - 제안: CI 총 소요시간 상한(현재/변경 후)을 문서화하거나 모니터링에 반영.

- **[INFO]** CI 전용 webServer 커맨드 전환(`next dev` → `next build && next start`)은 파일시스템에 프로덕션 빌드 아티팩트를 새로 생성하고 build-time env 의존성을 새로 만든다
  - 위치: `codebase/frontend/playwright.config.ts:446-448`
  - 상세: 순수 파일시스템 관점에서 `next build` 는 `.next/` 디렉터리에 프로덕션 빌드 산출물을 쓴다(이전에는 dev 서버라 라우트 온디맨드 컴파일만 발생). 의도된 변경이고 리뷰 대상 코드 자체에 위험한 삭제/덮어쓰기는 없지만, CI 컨테이너의 빌드 시간·디스크 사용량이 늘어나는 부수효과가 있다 — 과거 세션에서 문서화된 "e2e Docker 디스크 부족(build cache 수십GB 누적)" 사례와 유사한 리스크 표면을 약간 넓힌다(webServer `timeout` 도 180s→240s 로 이미 대응되어 정합적으로 처리됨). 아울러 `next build` 는 `NEXT_PUBLIC_*` 등 build-time 환경변수를 산출물에 인라인으로 굽는 방식이라, dev 서버와 달리 **CI 빌드 시점에 해당 env 가 정확히 설정되어 있어야** 런타임에 올바른 값이 나온다 — 이 diff 범위 밖이라 CI 워크플로 파일의 env 설정 여부는 확인 불가.
  - 제안: CI 워크플로(`.github/workflows/*` 등, 이번 diff 밖)에서 `next build` 시점에 필요한 `NEXT_PUBLIC_*` env 가 실제로 주입되는지, 그리고 빌드 캐시 정리 정책이 있는지 별도 확인 권장 — 프로덕션 빌드 전환은 이 부분이 빠지면 새로운 종류의 실패(값 불일치·디스크 포화)를 유발할 수 있음.

- **[NONE]** `profile-edit.spec.ts` 변경은 timeout 값 1건(10s→15s) 조정뿐 — 부작용 표면 없음
  - 위치: `codebase/frontend/e2e/profile/profile-edit.spec.ts:60` (`waitForURL(/\/profile$/, { timeout: 15_000 })`)
  - 상세: 함수 시그니처·전역 상태·네트워크 호출·mock 설정(`page.route`)·assertion 로직 모두 그대로. 단일 `waitForURL` timeout 값만 증가했으며, 이는 테스트가 실패를 확정하기까지 5초 더 기다린다는 것 외의 부작용이 없다.

## 요약

두 파일 모두 테스트 인프라(config·e2e 스펙) 범위 내의 변경이며, 프로덕션 코드의 전역 상태·함수 시그니처·공개 API·환경변수 쓰기·네트워크 호출에는 영향이 없다. 다만 `playwright.config.ts` 의 변경(retries 도입, timeout 전역 상향, CI 전용 webServer 를 프로덕션 빌드로 전환)은 특정 flaky 스펙 3건을 겨냥한 의도이지만 실제로는 전체 e2e 스위트에 무차별 적용되는 정책 변경이라, "실패를 감추는 방향"(retry 로 인한 false negative, timeout 상향으로 인한 실패 확정 지연)과 "새로운 실패 축을 여는 방향"(prod 빌드가 build-time env 의존성·디스크 사용을 새로 만듦)의 트레이드오프를 동반한다. 이번 diff 자체에 CRITICAL/WARNING 급 부작용은 없으나, retry 로 인한 실제 백엔드 대상 스펙의 idempotency 및 CI 워크플로의 build-time env·디스크 정책은 이 diff 범위 밖이라 별도 확인이 필요하다.

## 위험도

LOW
