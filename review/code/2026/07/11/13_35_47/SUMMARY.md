# AI Review SUMMARY — 가드 실효성 완성

- diff: `74b256f46..HEAD` (2커밋: a3317ef37 mock red 정리, 029abcd86 typecheck 배선+CI)
- reviewer 4: side_effect(LOW) · testing(**CRITICAL**) · scope(NONE) · maintainability(LOW)

## Critical (testing) — 실제 GitHub CI 미배선

이 PR 의 목적("가드가 실제 CI 에서 발화")이 **로컬 harness 만 달성, 실제 GitHub Actions 는 미달**. testing reviewer 가 mutation 으로 실증:
- `test-stages.sh` cmd_build 의 typecheck 배선은 로컬 AI harness 만 커버.
- 실제 `web-chat-checks.yml` 의 `widget` job(channel-web-chat)은 Lint→Vitest→Next build 뿐, **typecheck step 없음**. `next build` 는 앱 module graph 만 걸어 standalone `*.test.ts` 를 typecheck 안 함(mutation 으로 green 유지 실증) → 실제 PR gate 에서 위젯 타입 가드가 여전히 안 돈다.
- sibling `sdk` job(@workflow/web-chat)엔 이미 Typecheck 있음 → widget 만 누락 비대칭.
- 추가 발견: `web-chat-checks.yml` paths 에 `codebase/packages/sdk/**` 가 있으나 **@workflow/sdk 를 도는 job 자체가 없다**(PR #912 가 harness 만 배선). @workflow/sdk 타입 가드(client.spec.ts negative)도 실제 CI 미발화.

→ **조치**: `web-chat-checks.yml` (1) `widget` job 에 Typecheck step 추가, (2) `@workflow/sdk` job 신설, (3) "next build ... typecheck 동반" 부정확 주석 정정.

## Warning / Info (maintainability·testing)

- **[maint W] `as unknown as this` 주석 부재** — 익명 클래스 constructor 가 다른 인스턴스 반환 시 타입 변하는 TS 동작. 배경이 커밋 메시지에만 있고 코드에 없음. → 주석 추가.
- **[maint W] EventSource stub 4곳 중복** — 기존 `installControllableSse()` 팩토리 있는데 3곳 손복사. → test 코드라 비차단이나 주석으로 완화(공용 헬퍼 추출은 후속).
- **[testing/maint redundant] `items[0]!` 앞쪽 불필요** — tsconfig 에 noUncheckedIndexedAccess 없어 items[0] 이미 non-undefined. `buttons!` 만 필요. `as unknown as typeof EventSource` outer cast 도 redundant(실측). → 최소화.
- **[maint INFO] spec-link-checks.yml paths 에 pnpm-lock/workspace 누락** — sibling 과 불일치. → 추가 검토(비차단).
- **[side_effect/scope INFO] spec-link-checks.yml frontend/** 중복** — frontend-only PR 이 frontend-checks 와 가드 이중 실행. 비용 낮음, 비차단.

## 조치 계획

CRITICAL(web-chat-checks widget typecheck + @workflow/sdk job + 주석) 필수. maintainability W(주석) 반영. redundant cast 최소화. spec-link-checks paths 보강. 공용 헬퍼 추출은 후속.
