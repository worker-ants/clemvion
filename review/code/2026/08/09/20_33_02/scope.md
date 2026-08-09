# 변경 범위(Scope) Review

## 발견사항

없음. 아래는 스코프 판단 근거로 확인한 사항이다.

- **[INFO]** `_changed-paths.yml` 에 `#`-접두 줄 제거 로직 추가는 신규 기능이지만, 기존 3개
  전환 워크플로(`deps-security-checks.yml` · `frontend-checks.yml` · `backend-checks.yml`)의
  `pathspecs` 목록에는 `#` 로 시작하는 줄이 전혀 없어(직접 확인) 기존 동작에 영향이 없다.
  `harness-checks.yml` 의 옛 `paths:` 목록이 항목마다 "왜 등재했는가" 주석을 달고 있었고,
  이를 block scalar 로 옮기며 그 인접성을 유지하기 위해 필요해진 기능이라 이번 전환의
  직접적 파생물이다 — 무관한 확장 아님.
  - 위치: `.github/workflows/_changed-paths.yml` (37-43, 84-111 부근 — `case "$spec" in '#'*) continue`)

- **[INFO]** `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts` /
  `.test.ts` 변경(`blockScalarAtPath` 신설)은 `codebase/` 트리에 속하지만, `packages-checks.yml`
  의 `on.pull_request.paths`/`on.push.paths` 가 `pathspecs:` 블록 스칼라로 합쳐지면서 이를 대조하던
  drift 가드가 옛 위치를 잃기 때문에 필요해진 동반 수정이다. 워크플로 변환과 분리할 수 없는
  종속 변경.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:248-285`

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 갱신은 이번 전환 작업이
  트리거한 "셋업 보일러플레이트 composite action 추출 여부" 판단을 위해 실측(8+1+5 워크플로
  셋업 형태 분류)한 결과를 별 plan 문서에 교차 기록한 것이며, **명시적으로 이번 PR 범위에서
  제외하고 후속으로 defer** 한다고 밝히고 있다(범위 확장을 하지 않겠다는 결정 자체를 기록).
  범위 절제의 증거로 봄.

## 스코프 정합성 확인

- 커밋 2건(`0f5ed9acf`, `af391ad82`)의 diff 는 총 15개 파일, `plan/in-progress/ci-required-check-skip-jobs.md`
  의 "후속 — 나머지 8개 워크플로" 체크리스트에 이미 항목별로 등재돼 있던 5개
  (`packages-checks.yml` · `web-chat-checks.yml` · `harness-checks.yml` · `spec-link-checks.yml` ·
  `migration-check.yml`)를 그대로 `[x]` 로 전환한 작업과 정확히 일치한다.
- `review-gate.yml`, `e2e.yml` 은 plan 에서 "주의 필요/비용 최대" 로 **의도적으로 미체크 상태**로
  남아 있고, 실제 diff 에도 포함되지 않음을 `git diff --stat` 로 확인했다 — 스코프를 넘겨받지 않았다.
- 각 워크플로 diff 는 동일한 4곳(등록부 `CONVERTED`/`_SKIP_JOB_WORKFLOWS`/`_PULL_REQUEST_KEYS`/
  `_JOB_CONDITIONS`, `changes` 잡 호출, 스텝별 `if:` 게이팅, no-op 안내 스텝)을 기계적으로 반복
  적용한 패턴이며, `packages-checks.yml` 의 손 목록 축소(4→3, guard 파일 동반 갱신) 를 제외하면
  기능 확장이나 관련 없는 리팩토링이 섞여 있지 않다.
- `.claude/tests/test_harness_checks_paths_coverage.py` 의 대규모 diff(180줄)는 파서를 `paths:`
  YAML 리스트 형태에서 `pathspecs: |` 블록 스칼라 형태로 옮기는 데 직접 기인한 재작성이며,
  무관한 스타일 정리는 확인되지 않았다.
- 포맷팅 전용 변경, 불필요한 주석 추가/삭제, 미사용 임포트, 의도치 않은 설정 변경은 발견되지
  않았다.

## 요약

15개 변경 파일 전부가 `plan/in-progress/ci-required-check-skip-jobs.md` 에 사전 등재돼 있던
"나머지 5개 워크플로를 required-check skip-job 패턴으로 전환" 이라는 단일 작업 단위에
직접 속하거나(워크플로 5개 + 판정 로직 확장), 그 전환이 필연적으로 요구하는 동반 수정
(harness 커버리지 가드 이동, packages 등록 가드 이동, 관련 unit 테스트, 계약 문서 갱신)이다.
`review-gate.yml`/`e2e.yml` 전환이나 composite action 추출처럼 인접하지만 더 큰 범위의 작업은
plan 문서에 사유와 함께 명시적으로 defer 되어 있어 오히려 스코프 절제가 잘 지켜졌다는 근거가
된다. 의도 이상의 변경, 무관한 리팩토링, 기능 확장, 포맷팅 혼입 등 스코프 위반 신호는
발견되지 않았다.

## 위험도

NONE
