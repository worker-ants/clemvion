# 문서화(Documentation) 리뷰

## 발견사항

- **[CRITICAL]** 신규 `typecheck-ratchet` 게이트가 의존하는 파일들이 그 게이트를 실제로 트리거하는 워크플로 자신의 `changes` pathspec 레지스트리에 미등재 — 스크립트/baseline 만 바뀌면 실제 검사가 조용히 no-op 통과한다.
  - 위치: `.github/workflows/frontend-checks.yml` `changes` 잡의 `pathspecs:` 블록(직접 `Read` 확인 — 라인 38–64, 이 PR의 diff 밖). 같은 파일의 신설 `typecheck-ratchet` 잡은 파일 5 diff 게이트 99–128 참조. `.github/workflows/backend-checks.yml` `changes` 잡의 `pathspecs:` 블록(직접 `Read` 확인 — 라인 56–68, 이 PR의 diff 밖)도 부분적으로 동일 결함.
  - 상세: `_changed-paths.yml` 의 skip-job 패턴에서 `changes.outputs.relevant` 는 `pathspecs` 목록에 없는 파일만 바뀐 PR 에 대해 `'false'` 를 내고, 각 잡은 `if: needs.changes.outputs.relevant != 'false'` 로 스텝을 건너뛴 채 "무관한 변경 — 검사 생략 (체크는 통과로 보고)" 로 통과한다(`.github/workflows/_changed-paths.yml` 자체 주석: "빈 값일 때 검사를 돌리는 쪽이 fail-safe"라고 명시할 만큼 이 메커니즘의 위험을 이 저장소는 이미 안다). 이번 PR 이 신설한 `frontend-checks.yml` 의 `typecheck-ratchet` 잡은 `scripts/check-frontend-typecheck-ratchet.py`(신규) / `scripts/_typecheck_ratchet.py`(신규 공유 코어) / `scripts/frontend-typecheck-baseline.json`(신규 baseline) 를 실행 대상으로 삼는데, 이 셋 중 **어느 하나도** `frontend-checks.yml` 자신의 `changes.pathspecs` (라인 41–64, `codebase/frontend/**` · `codebase/channel-web-chat/**` · `codebase/packages/**` · lockfile · `ci-paths-changed.sh` 등)에 없다. 즉 (a) ratchet 스크립트 자체를 고치는 PR, (b) `--update` 로 baseline 만 갱신해 커밋하는 PR(README·`_typecheck_ratchet.py` 헤더가 명시하는 정상 운용 경로), (c) 공유 코어 `_typecheck_ratchet.py` 만 바뀌는 PR — 이 세 경우 전부 `codebase/frontend/**` 를 건드리지 않는 한 `typecheck-ratchet` 잡이 **실제 tsc 를 한 번도 돌리지 않고** 통과 보고한다. baseline 을 잘못(또는 부정확하게) 낮춰 커밋해도 그 커밋 자체는 검증되지 않는다.
    이 저장소는 정확히 이 실패 클래스(`harness-checks.yml` 의 pathspec 미등재)를 "여섯 번" 겪었고 그 교훈으로 `test_harness_checks_paths_coverage.py` 를 만들었으며, 이번 PR 도 `harness-checks.yml` 에는 `scripts/_typecheck_ratchet.py` 를 정확히 등재했다(diff 파일 6, 게이트 109–115: "판정 규칙은 `_typecheck_ratchet.py` 하나에 있고 두 엔트리포인트가 설정만 담는다. 그 코어가 바뀌면 두 패키지의 게이트가 함께 움직이므로 반드시 등재한다"). 그런데 그 등재 원칙이 **정작 그 스크립트가 게이트하는 워크플로 자신**(`frontend-checks.yml`/`backend-checks.yml`)에는 적용되지 않았다. `backend-checks.yml` 은 기존 `check-backend-typecheck-ratchet.py`/`backend-typecheck-baseline.json` 은 이미 등재돼 있었지만(전 PR), 이번에 새로 추출된 공유 코어 `scripts/_typecheck_ratchet.py` 는 여기에도 빠졌다 — 즉 backend 쪽도 공유 코어만 바뀌는 변경에는 무방비다.
    `test_harness_checks_paths_coverage.py` 는 `.claude/**`/`scripts/**` 가 harness **unit test** 를 트리거하는지만 검사하며, `backend-checks.yml`/`frontend-checks.yml` 이 **자기 자신의 실제 게이트**를 트리거하는지는 검사 범위 밖이라(`.claude/tests/` 안에 그런 이름의 가드가 없음, 직접 확인) 이 갭은 어떤 자동 가드에도 걸리지 않는다.
  - 제안: `frontend-checks.yml` 의 `changes.pathspecs` 에 `scripts/_typecheck_ratchet.py` · `scripts/check-frontend-typecheck-ratchet.py` · `scripts/frontend-typecheck-baseline.json` 을(등재 근거 주석 포함, 이 저장소의 기존 관례대로) 추가하고, `backend-checks.yml` 의 `changes.pathspecs` 에도 `scripts/_typecheck_ratchet.py` 를 추가할 것. 가능하면 `test_harness_checks_paths_coverage.py` 류의 커버리지 가드를 `backend-checks.yml`/`frontend-checks.yml` 자신에도 일반화해 이 클래스가 일곱 번째로 새는 것을 막을 것.

- **[WARNING]** 같은 `jest-axe.d.ts` shadowing 결함을 서술하는 두 문서가 서로 다른 진단 건수(1,128 vs 1,256)를 인용하는데 둘의 관계가 어디에도 명시돼 있지 않다.
  - 위치: `codebase/frontend/src/test/vitest-matchers.d.ts` 게이트 13 ("2026-09-02 실측: 이 파일을 프로그램에 넣으면 TS2305 가 **1,128건** 쏟아졌다.") vs `scripts/check-frontend-typecheck-ratchet.py` 게이트 21 ("전체 프로그램 체크의 첫 수치는 **1,414건**이었는데 그중 **1,256건**이 진짜 오류가 아니라 ... 연쇄였다") — 동일한 수치가 `.claude/tests/README.md` 게이트 44 와 `plan/in-progress/harness-review-gate-followups.md` 게이트 211–212 에도 "1,256건"으로 반복 인용된다.
  - 상세: 문맥상 1,128 은 "TS2305 코드만" 센 값(`vitest-matchers.d.ts` 문장이 명시적으로 "TS2305 가"라고 코드를 한정)이고 1,256 은 그 파일 하나로 인한 "phantom 진단 전체"(TS2305 외에 연쇄로 발생한 다른 에러 코드 포함 가능)로 읽히므로 반드시 모순은 아니다. 그러나 어느 문서도 두 수치가 부분집합 관계라고 명시하지 않는다. 이 저장소는 정량 서술의 정확성에 특히 민감한 곳이라(같은 이슈를 다루는 문서 4곳 — `.claude/tests/README.md`·`_typecheck_ratchet.py`류·plan 파일이 서로 다른 숫자를 반복해 인용하는 것 자체가, 이전 PR(2026-08-09)에서 baseline 수치 "199/38 vs 199/39 vs 209/40" 불일치가 WARNING 으로 지적됐던 사례와 같은 모양이다), 향후 이 shadowing 버그를 다시 조사할 사람이 "1,128 과 1,256 중 뭐가 맞나"로 혼동할 위험이 있다.
  - 제안: `vitest-matchers.d.ts` 의 문장에 "(1,256건 phantom 중 TS2305 만)" 같은 한 구절을 덧붙여 두 수치의 관계를 명시할 것.

- **[INFO]** `check-frontend-typecheck-ratchet.py` 모듈 docstring의 한 문단이 저장소 관례(약 80~90자 줄바꿈)를 벗어나 한 줄에 몰려 있다.
  - 위치: `scripts/check-frontend-typecheck-ratchet.py` 게이트 32 ("전면 승격하려면 그 51건을 먼저 처분해야 하고 그 사이에도 새 오류는 계속 들어온다. backend 와 같은 순서를 택한다 — 바닥을 먼저 막고, 정리는 각자 자기")
  - 상세: 같은 문단의 나머지 줄, 그리고 `check-backend-typecheck-ratchet.py` 의 대응 문단(게이트 27–31, "왜 전면 승격이 아니라 ratchet 인가")은 모두 짧게 줄바꿈되어 있는데 이 한 줄만 유독 길어 가독성이 떨어진다. 기능에는 영향 없는 순수 포맷 이슈.
  - 제안: 다른 문단과 같은 폭으로 재줄바꿈.

- **[INFO]** `.claude/tests/README.md` 의 병합된 행에서 "the PR fixed 10 genuinely stale ones and committed 199/38" 의 "the PR" 이 어느 PR 을 가리키는지 문맥상 모호해졌다.
  - 위치: `.claude/tests/README.md` 게이트 44 (해당 문장은 "Measured backend 2026-08-09: ... ; the PR fixed 10 genuinely stale ones and committed 199/38. Measured frontend 2026-09-02: ..." 구간)
  - 상세: 원래 이 문장은 `test_backend_typecheck_ratchet.py` 행 하나가 backend PR(2026-08-09) 하나만 서술할 때 쓰여 "the PR" 이 자명했다. 이번 PR 이 그 행을 `test_typecheck_ratchet.py` 로 합치며 같은 문단에 frontend PR(2026-09-02) 서술까지 이어 붙였는데, "the PR" 표현은 그대로 남아 이제 두 PR 중 어느 쪽인지 대명사만으로는 특정할 수 없다(문맥상 backend 2026-08-09 PR이 맞지만, 바로 뒤에 다른 날짜의 다른 PR 이야기가 이어져 오독 여지가 있다).
  - 제안: "the PR" 을 "that 2026-08-09 PR" 등으로 명시.

## 요약

핵심 변경(공유 ratchet 코어 추출, frontend 타입체크 ratchet 신설, `jest-axe.d.ts` 의 vitest 타입 shadowing 버그 수정)은 문서화 밀도가 전반적으로 매우 높다 — 모든 신규 파일에 "왜 필요한가"·판정 규칙·fail-closed 근거·실측 수치가 일관되게 서술되고, `PROJECT.md`·`.claude/tests/README.md`·plan 파일까지 동기화됐다. 다만 이 저장소가 그 "등재" 관례를 `harness-checks.yml` 에는 정확히 적용했으면서 정작 새 게이트가 스스로 실행되는 조건을 결정하는 `frontend-checks.yml`/`backend-checks.yml` 자신의 `changes.pathspecs` 에는 빠뜨려, 스크립트·baseline·공유 코어만 바뀌는 PR 에서 이 PR 이 막으려던 바로 그 사각지대(테스트 코드 타입 오류가 아무 게이트에도 안 걸림)가 게이트 자체의 무력화라는 형태로 재발할 수 있는 여지를 남겼다. 이 한 건을 제외하면 나머지는 사소한 정량 서술 모호성·포맷 정도의 INFO/WARNING 급이다.

## 위험도

HIGH
