# 요구사항(Requirement) 리뷰 결과

## 사전 확인: diff 대상 범위 정정 (stale local main)

프롬프트 payload 에 포함된 `codebase/frontend/e2e/workflows/background-run-section.spec.ts` ·
`codebase/frontend/e2e/workspaces/members.spec.ts` · `docker-compose.e2e.yml` ·
`codebase/frontend/playwright.config.ts` 변경, 그리고 review 세션 산출물(`review/code/2026/07/09/16_38_12/**`,
`18_39_22/**`)은 `git diff origin/main...HEAD` 기준으로는 **차이가 0**이다 — 이미 `origin/main` 의 PR #872
(`test(e2e): Playwright 스위트 flakiness 안정화`)로 병합 완료된 내용이며, 로컬 `main` 브랜치가 stale 하여 diff
payload 생성 시 재포함된 것으로 확인했다 (기존 MEMORY 항목 "리뷰 diff base: stale 로컬 main 주의" 와 동일 패턴).
`origin/main...HEAD` 기준 실제 신규 변경은 4개 파일뿐이다: `PROJECT.md`(+1줄),
`codebase/backend/.../execution-engine.service.spec.ts`(+1/-1), 신규
`codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts`(130줄),
`plan/in-progress/e2e-retry-visibility-followup.md`(+6줄). 아래 평가는 이 4개 파일을 실질 대상으로 한다.

## 발견사항

- **[INFO]** 파일 2(`execution-engine.service.spec.ts`)의 `service`→`svcMetrics` 변경은 이번 태스크(e2e timeout guard)와 무관한 별도 pre-existing 결함 수정
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:17005` (describe `NF-OB-07 BusinessMetrics 동작` 내부 `reentryWorkflowInput`)
  - 상세: `NF-OB-07 BusinessMetrics 동작` describe(파일 최상위 sibling, `describe('ExecutionEngineService', ...)` 밖)는 자체 `svcMetrics` 인스턴스를 갖는데, 내부 `reentryWorkflowInput` 테스트가 스코프 밖의 `service`(다른 최상위 describe 변수)를 참조해 `ReferenceError: service is not defined` 로 결정적 실패하던 것을 바로잡았다. 커밋 메시지(`7887bfb93`)에 "본 브랜치의 e2e 가드 작업과 무관한 pre-existing 결함이나 TEST WORKFLOW(unit)를 막아 함께 조치"라고 명시돼 있어 스코프 이탈이 아니라 의도적 동반 수정이다. `npx jest ... -t "reentryWorkflowInput"` 로 직접 재현 검증 — 2/2 통과 확인.
  - 제안: 조치 불필요 (이미 올바름). 참고로만 기록.

- **[INFO]** 핵심 가드 테스트(`e2e-no-sub-global-timeout.test.ts`) 기능 완전성 검증 — 통과
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts`
  - 상세: `playwright.config.ts` 의 `expect.timeout`(10_000)을 SoT 로 파싱, `e2e/**/*.ts` 를 재귀 스캔해 bare-numeric `timeout: N`(N < global) 을 검출한다. `npx vitest run` 실행 결과 11/11 통과, 실제 `e2e/**` 전수 검사 결과 위반 0건(기존 PR #872 정규화 이후 상태와 정합). regex 참/오탐 self-test(언더스코어 표기·경계값 9_999·명명 상수·`waitForTimeout`·무관 숫자)와 "fail-open 방지" sanity check(디렉토리/파일 수/global 값 하한)까지 포함해 가드 자체의 무력화를 별도로 방어한다. vitest `include: ["src/**/*.{test,spec}.{ts,tsx}"]` 이므로 `src/__tests__/` 배치 + 상대경로로 형제 `e2e/` 스캔하는 설계도 코드 주석과 실제 config 가 일치.

- **[WARNING]** TIMEOUT_LITERAL 정규식이 "timeout:" 앞 word-boundary 가 없어 오탐 가능성 존재 (현재는 미발현)
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts:31` `const TIMEOUT_LITERAL = /timeout:\s*(\d[\d_]*)\b/g;`
  - 상세: 대소문자 구분이라 `retryTimeout:` 류(대문자 T)는 걸리지 않지만, 소문자로 끝나는 임의 키(`poll_timeout: 500`, `pollTimeout` 아닌 `polltimeout: 500` 등 Playwright 옵션과 무관한 필드)가 향후 `e2e/**/*.ts` 에 추가되면 값이 10000 미만일 때 오탐으로 CI 를 막을 수 있다. 또한 주석(`// 과거에는 timeout: 3000 이었으나 ...` 같은 서술)도 라인 단위로 그대로 매칭 대상이라 코드가 아닌 텍스트에도 반응한다. 현재 `e2e/**` 전수 grep 으로 확인한 결과 이런 케이스는 0건 — 지금 당장 false-positive 를 유발하지는 않는다.
  - 제안: 당장 fix 불필요(현재 위반 없음, CI 차단 목적상 과탐이 누락보다 안전한 방향). 다만 향후 오탐 사례가 나오면 `{`/`}` 옵션 객체 컨텍스트로 좁히거나 주석 라인 스킵을 추가하는 정도로 개선 가능 — non-blocking 참고사항.

- **[INFO]** `readGlobalExpectTimeout` 의 `[^}]*` 는 `expect` 블록 내부에 중첩 객체(예: `toHaveScreenshot: {...}`)가 먼저 오면 안쪽 `}` 에서 매칭이 끊겨 파싱 실패 → 명시적 throw 로 fail-closed
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts:41` `const m = src.match(/expect:\s*\{[^}]*\btimeout:\s*(\d[\d_]*)/);`
  - 상세: 현재 `playwright.config.ts` 의 `expect: { timeout: 10_000 }` 는 단일 키라 문제없이 매칭됨을 실행으로 확인했다. 향후 `expect` 블록에 `timeout` 보다 앞서는 중첩 객체 키가 추가되면 정규식이 매칭 실패해 명시 에러(`"...파싱하지 못했습니다..."`)를 던진다 — silent fail-open 이 아니라 loud fail 이므로 설계 의도(가드 무력화 방지)에 부합하는 안전한 방향이다.
  - 제안: 조치 불필요. 참고로만 기록.

- **[INFO]** 규칙이 positive/negative assertion 을 구분하지 않음 — PROJECT.md 문구와 코드가 정확히 일치(스펙 이탈 아님)
  - 위치: `PROJECT.md:302`(가드 서술) / 가드 코드 전체
  - 상세: PROJECT.md 문구는 "positive wait(`toBeVisible`·`waitForURL` 등)"를 예시로 들지만 실제 룰과 가드 코드는 `.not.toBeVisible({ timeout: N })` 같은 negative assertion 도 예외 없이 동일하게 차단한다(negative assertion 의 짧은 timeout 은 Playwright 커뮤니티에서 빠른 부재-확인용으로 흔히 쓰이는 패턴). 그러나 이는 코드가 스펙(PROJECT.md)과 어긋난 게 아니라, **PROJECT.md 자체가 애초에 이 구분을 언급하지 않고** 코드도 문서 그대로 무차별 차단하는 것이므로 code-vs-spec fidelity 문제는 아니다.
  - 제안: 현재는 스펙-코드 불일치가 아니라 설계상 트레이드오프. 향후 negative-assertion 용 짧은 timeout 필요성이 실제로 발생하면 `project-planner` 경유로 PROJECT.md 규칙에 예외 문구(및 가드에 `.not.` 스킵 로직)를 추가하는 편이 안전 — 지금 당장 조치는 불필요.

- **[INFO]** 관련 spec 본문 부재는 의도된 배치 (spec fidelity 항목 9)
  - 위치: `PROJECT.md` §Frontend e2e 패턴
  - 상세: 이 컨벤션은 제품 요구사항이 아닌 개발 프로세스/테스트 인프라 규약이라 `spec/` 이 아닌 `PROJECT.md` 에 귀속되는 것이 CLAUDE.md 정보 저장 원칙과 기존 선례(같은 절의 AuthProvider mock·i18n 매칭·날짜 표기 규칙 모두 `spec/` 이 아닌 `PROJECT.md`)에 부합한다. `spec/` 에 대응 문서가 없는 것은 누락이 아니라 정상.

- **[INFO]** plan 문서 갱신 내용의 정합성
  - 위치: `plan/in-progress/e2e-retry-visibility-followup.md`
  - 상세: "곁가지 — sub-global timeout override 재발 방지 가드" 항목만 `✅ 완료`로 표시하고 본 plan 의 주 항목(할 일 1·2, PR 코멘트 surfacing / known-flaky quarantine)은 그대로 열어둔 채 plan 은 `in-progress` 유지 — 서술과 실제 상태(가드는 구현·검증됨, 나머지는 미착수)가 정확히 일치한다. 완료 주석이 가리키는 파일 경로(`codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts`)도 실존 확인.

## 요약

핵심 신규 코드(`e2e-no-sub-global-timeout.test.ts`)는 의도한 기능(전역 `expect.timeout` 미만 하드코딩 timeout 리터럴을 `e2e/**` 전수 검사해 CI 로 차단)을 완전하고 정확하게 구현했으며, 실행으로 통과(11/11)를 확인했고 회귀 방지용 참/오탐 self-test 와 fail-open 방지 sanity check 까지 갖춰 견고하다. PROJECT.md 문서화와 plan 완료 주석도 실제 구현과 line-level 로 일치한다. 동반된 `execution-engine.service.spec.ts` 1줄 수정은 이번 태스크와 무관하지만 정당한 근거(pre-existing ReferenceError 로 backend unit 이 막혀 있었음)를 가진 필수 동반 수정이며 직접 재현·검증했다. 다만 payload 에 포함된 다수 파일(`background-run-section.spec.ts`·`members.spec.ts`·`docker-compose.e2e.yml`·`playwright.config.ts`·과거 review 세션 산출물)은 실제로는 `origin/main` 에 이미 병합된 내용으로, stale 로컬 `main` 기준 diff 생성으로 인한 오포함이니 후속 리뷰(dependency/side-effect/scope 등)에서도 `origin/main` 기준으로 범위를 재확인할 것을 권고한다. 정규식 기반 가드의 미세한 오탐 가능성(word-boundary 부재, 주석 포함 스캔, 중첩 객체 파싱 한계)은 현재 코드베이스에서 실제로 발현되지 않으며 non-blocking 참고사항이다.

## 위험도

LOW
