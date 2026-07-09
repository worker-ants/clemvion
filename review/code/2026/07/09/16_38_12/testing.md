# 테스트(Testing) 리뷰 — e2e stabilization (retries·prod 빌드·timeout)

## 발견사항

- **[WARNING]** 커밋이 명시한 3개 플레이키 스펙 중 2개(web-chat-console·members)는 실제로 손대지 않음
  - 위치: `codebase/frontend/e2e/workspaces/members.spec.ts:180` (`toBeVisible({ timeout: 5_000 })`, 초대 성공 토스트), `codebase/frontend/e2e/web-chat/console.spec.ts` 의 `DIALOG_TIMEOUT`(10_000, 신규 글로벌 기본과 동일해 실질 개선 없음)
  - 상세: 커밋 메시지는 "profile-change-password·web-chat-console·members 가 간헐 timeout flake" 라고 적었지만, diff 는 `profile-edit.spec.ts` 의 비밀번호 변경 리다이렉트(`waitForURL`) 하나만 10s→15s 로 올렸다. Playwright 는 **명시적으로 지정된 개별 `timeout` 옵션이 global `expect.timeout` 보다 항상 우선**하므로, `playwright.config.ts` 의 `expect: { timeout: 10_000 }` 신설은 `members.spec.ts:180` 처럼 이미 5_000ms 로 하드코딩된 assertion 에는 전혀 영향을 주지 않는다. 즉 이번 fix 의 Tier 3(전역 timeout slack)는 정작 커밋이 지목한 스펙 중 2/3 에는 도달하지 않고, 오직 Tier 1(CI retries)의 재시도 흡수에만 의존하게 된다. retries 예산(2회)이 소진되는 부하 상황이면 동일 flake 가 재발할 수 있다.
  - 제안: `members.spec.ts` 의 초대 성공 토스트 등 named-flaky 스펙의 하드코딩 저(低)-timeout 값을 실제로 감사해 최소 global 기본(10_000) 이상으로 맞추거나, 제거하고 global 기본에 위임. `grep -rn "timeout: [0-9_]*" e2e` 로 5_000/3_000 하드코딩(`login.spec.ts`, `register.spec.ts`, `password-reset.spec.ts`, `background-run-section.spec.ts`, `members.spec.ts`)을 전수 재검토할 것.

- **[WARNING]** CI `retries: 2` 는 실제 회귀를 조용히 가릴 수 있음 — 재시도 발생 여부에 대한 관측 수단 없음
  - 위치: `codebase/frontend/playwright.config.ts:373` (`retries: process.env.CI ? 2 : 0`)
  - 상세: retries 도입 자체는 합리적인 완화책이나, `reporter: [["list"], ["html", { open: "never" }]]` 구성만으로는 "1차 실패 후 2차에 통과"와 "1차에 클린 통과"가 CI 게이트(exit code) 상 구분되지 않는다. 실제 코드 결함(타이밍이 아닌 진짜 회귀)이 간헐적으로만 재현되는 경우, retry 가 이를 그린으로 흡수해 버그가 릴리스까지 침투할 위험이 있다. 이번 diff 어디에도 "N 회 이상 retry 로 통과한 테스트를 알림/트래킹" 하는 장치가 추가되지 않았다.
  - 제안: HTML reporter 결과(각 테스트의 `retry` 카운트)를 post-run 스크립트로 파싱해 retries>0 인 테스트 목록을 PR 코멘트/Slack 등으로 노출하거나, 최소한 known-flaky 스펙을 별도로 추적하는 quarantine 리스트를 두어 "재시도로 통과 = 여전히 미해결" 임을 가시화할 것.

- **[INFO]** Tier1(retries)+Tier2(prod build 기동 ~240s)+Tier3(45s test timeout) 누적으로 CI 전체 소요시간이 최악의 경우 크게 늘어남
  - 위치: `codebase/frontend/playwright.config.ts` (`timeout: 45_000`, `webServer.timeout: 240_000`, `retries: 2`)
  - 상세: 진짜로 깨진 테스트가 있으면 (45s 대기 × 최대 3회 시도) + prod 빌드 기동 대기까지 겹쳐 실패 판정까지 걸리는 시간이 기존 대비 수배로 늘어난다. 버그 자체는 아니지만 CI 피드백 루프 예산에 대한 트레이드오프이므로, 파이프라인 전체 타임아웃(잡 레벨)도 함께 재점검했는지 diff 만으로는 확인 불가.
  - 제안: CI 잡 레벨 타임아웃을 이 누적 최악 케이스보다 여유 있게 설정했는지 별도 확인.

- **[INFO]** `profile-edit.spec.ts` 의 15s 타임아웃 상향은 근본 원인(Tier2 prod 빌드) 검증과 분리되지 않음
  - 위치: `codebase/frontend/e2e/profile/profile-edit.spec.ts:258`
  - 상세: 이번 커밋은 Tier2(prod 빌드)가 "client-side navigation flake 의 뿌리를 제거"한다고 주장하면서 동시에 Tier3(동일 지점 timeout 10s→15s)도 적용했다. 두 레이어가 같은 커밋에 함께 들어가 있어, 향후 재발 시 어느 레이어가 실제로 효과가 있었는지(혹은 없었는지) 구분하기 어렵다. 회귀 자체를 막는 항목은 아니라 INFO.
  - 제안: 후속 관찰 기간에 flake 재발 시 어느 tier 가 실효였는지 기록해 둘 것(문서화만으로 충분).

- **긍정 확인**: 기존 4개 테스트의 assertion 본문은 변경 없음(timeout 숫자만 조정) — 회귀 유효성 훼손 없음. 리포지토리 전역에 `beforeAll`/`describe.serial`/`storageState` 등 테스트 간 공유 상태가 없음을 확인(grep 결과 0건) — `retries`/`fullyParallel` 조합에서도 테스트 격리가 깨질 위험은 낮음. 각 스펙이 `page.route` 기반 per-test 클로저 상태(`patchCalls` 등)를 쓰므로 retry 시 이전 시도의 mock 상태가 누출되지 않는다.

## 요약
설정 변경은 방향성(재시도·prod 빌드·타임아웃 상향) 자체는 타당하고 기존 assertion 로직을 훼손하지 않으며 테스트 격리에도 새로운 위험을 들여오지 않는다. 다만 커밋 메시지가 명시적으로 지목한 3개 플레이키 스펙 중 실제로 손댄 것은 `profile-edit.spec.ts` 하나뿐이며, `web-chat-console`·`members` 스펙의 기존 저(低)-timeout 하드코딩(5_000ms 등)은 Playwright 의 "명시 timeout > global 기본" 우선순위 규칙 때문에 이번 global `expect.timeout: 10_000` 신설의 수혜를 받지 못한다 — 결과적으로 이 두 스펙의 안정화는 사실상 Tier1(CI retries)에만 의존한다. 재시도가 실패를 가리는지 관측할 장치도 없어, 회귀 검증 관점에서 "고쳤다"는 커밋 주장과 실제 diff 범위 사이에 갭이 있다.

## 위험도
MEDIUM
