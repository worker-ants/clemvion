---
worktree: e2e-flaky-surfacing-0eed0c
started: 2026-07-09
owner: developer
spec_impact: none
---

# e2e CI retry 가시성 (flaky surfacing) 후속 — ✅ 완료

> 파생: `test(e2e): Playwright 스위트 flakiness 안정화`(#872) 의 ai-review WARNING #2
> (session `review/code/2026/07/09/16_38_12/`). 참조: `playwright.config.ts` `retries` 주석.

## 배경

CI 에서 `retries: 2` 를 도입해 순간 timing flake 를 흡수한다(#872). 부작용으로 **진짜
회귀(타이밍 아닌 결함)가 2차 시도에서 우연히 통과하면 CI green 으로 보고**될 수 있다.
`list`/`html` reporter 가 flaky 를 별도 집계하나 run 로그를 안 보면 방치된다 —
**능동적 surfacing 수단**이 없던 것이 갭이었다.

## 해소 (branch `claude/e2e-flaky-surfacing-0eed0c`)

**retry-passed(flaky) 능동 surfacing** 구현:
- `codebase/frontend/playwright.config.ts` — `json` reporter 추가
  (`playwright-report/results.json`, host-mount 라 CI step 이 읽음).
- `scripts/report_playwright_flaky.py` — JSON 리포트에서 `test.status == "flaky"` 를 추출해
  **GitHub step summary(`$GITHUB_STEP_SUMMARY`) + `::warning::` 어노테이션**으로 노출.
  flaky 는 관측 대상(retries 취지=순간 flake 흡수)이라 **항상 exit 0**(빌드 비차단), 리포트
  부재·파싱 실패에도 CI 를 안 깬다. stdlib 전용.
- `.github/workflows/e2e.yml` — `e2e-frontend` job 에 `if: always()` step 배선(성공/실패 무관 노출).
- `.claude/tests/test_report_playwright_flaky.py` — 파서 로직 harness-checks 게이트(8 case).

## 곁가지 — sub-global timeout override 재발 방지 가드 — ✅ 완료 (#873)

> 파생: 안정화 fix 커밋 fresh 리뷰(`review/code/2026/07/09/18_39_22/`) INFO 2.
> unit 가드 `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` — `e2e/**` 의
> bare-numeric `timeout: N`(N < `playwright.config.ts` 의 `expect.timeout`) 를 CI(unit)로 차단.
> 전역값은 config 에서 파싱(SoT 동기). `PROJECT.md §Frontend e2e 패턴` 에 컨벤션 명문화.

## 향후 (선택) 확장 — 데이터 나오면

- **PR 코멘트 surfacing**: step summary/annotation 을 넘어 PR 대화에 직접 코멘트(요구:
  `pull-requests: write` + `actions/github-script`). fork PR 권한 제약이 있어 현재는 권한-경량
  step summary/annotation 으로 시작.
- **known-flaky quarantine**: surfacing 으로 상습 flaky 가 드러나면 별도 리스트/프로젝트로
  격리해 "재시도로 통과 = 여전히 미해결"을 명시 추적. 근본 원인(prod 빌드 hydration·query
  해소 타이밍) 해소 시 제거. **현재는 chronic-flake 데이터가 없어 착수 근거 부족** — 관측
  누적 후 판단.

## 비고

- #872 자체는 flaky **발생 빈도**를 줄이고(prod 빌드 Tier 2·전역 timeout Tier 3), 본 후속은
  **남은 flaky 를 숨기지 않고 관측**하는 별개 관심사.
- CI 워크플로(`.github/**`)는 GitHub Actions 에서만 실제 실행되므로 로컬 검증은 (a) 파서 unit,
  (b) json reporter 산출(probe spec 로 실 구조 확인), (c) `make e2e-test-full` 스위트 무회귀로 대체.
