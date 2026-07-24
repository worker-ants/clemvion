# Maintainability Review — push-guard-worktree-scope (round 17_51_28)

이 라운드는 직전 리뷰(17_28_02)의 WARNING 7건이 반영된 이후 커밋을 대상으로 한다. 직전
maintainability/architecture WARNING(REVIEW/PLAN 루프 DRY 위반)은 `_run_gate()` 추출로
실제로 해소됐고, INFO 였던 지역 import(`subprocess`/`inspect`)도 모듈 top-level 로 이동해
반영을 확인했다(`.claude/hooks/guard_review_before_push.py:28,32`). 아래는 그 위에서 신규로
발견한 항목이다.

## 발견사항

- **[WARNING]** `_run_gate()` 의 `base_cwd` 매개변수가 함수 본문에서 전혀 사용되지 않음 (죽은 파라미터)
  - 위치: `.claude/hooks/guard_review_before_push.py:494`(정의부 시그니처), `:506-520`(본문 전체), 호출부 `:546`·`:557`
  - 상세: `def _run_gate(evaluate, bypass_env, targets, base_cwd, is_blocked, render) -> bool:` 로 `base_cwd` 를 5번째 위치 인자로 받지만, 함수 본문(506~520행) 어디에서도 `base_cwd` 를 참조하지 않는다(`grep -n "base_cwd"` 로 직접 확인 — 정의부·두 호출부 세 곳에만 등장). unscoped fallback 은 `os.getcwd()` 를 쓰고(518행), scoped 경로는 `targets` 원소를 쓴다(511·513행) — 둘 다 `base_cwd` 를 거치지 않는다. 이 WARNING 은 직전 라운드가 지적한 DRY 위반(WARNING #4)을 고치려고 `_run_gate` 를 추출하는 과정에서 새로 생긴 것으로 보인다: `main()` 쪽에서 REVIEW/PLAN 양쪽 호출에 `base_cwd` 를 그대로 전달하도록 시그니처를 맞추다가, 실제로는 안 쓰는 인자가 남았다. 파이썬은 사용되지 않는 *함수 인자*를 기본적으로 경고하지 않으므로(사용되지 않는 지역 변수와 달리) 이런 종류의 드리프트는 린터로도 잘 안 걸린다. 향후 세 번째 게이트를 추가하며 "`base_cwd` 를 넘기면 뭔가 영향이 있겠지" 라고 오해하고 의존하는 코드를 짤 위험이 있다 — 시그니처가 실제 동작을 거짓 서술하는 상태다.
  - 제안: `base_cwd` 파라미터를 제거하고 두 호출부(`:546`, `:557`)에서도 인자를 뺄 것. 만약 향후 계획(예: unscoped fallback 도 `base_cwd` 를 우선 사용하도록 바꾸는 것)이 있다면 그 의도를 docstring 에 남기고 실제로 사용하도록 배선할 것.

- **[INFO]** e2e 테스트에서 BYPASS 검증이 `_run()` 헬퍼를 우회해 subprocess 호출 골격을 그대로 복제
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:178-197`(`test_bypass_still_applies_to_scoped_targets`) vs 공용 헬퍼 `:121-133`(`_run`)
  - 상세: `_run()` 은 이미 `STUB_BLOCKED_PATHS`/`STUB_PLAN_BLOCKED_PATHS` 설정과 `BYPASS_*` 제거까지 캡슐화하고 있는데, `BYPASS_REVIEW_GUARD=1` 을 **설정**해야 하는 이 테스트 하나만 `_run()` 을 쓰지 못해 `subprocess.run([...], env={**os.environ, ...})` 20줄을 그대로 다시 쓴다. 다른 12개 테스트가 전부 `_run()` 을 통해 일관된 경로로 훅을 실행하는 것과 대비되어, 이 파일 하나에 훅 실행 방식이 두 가지 존재하게 된다.
  - 제안: `_run(..., extra_env: dict | None = None)` 처럼 오버라이드용 파라미터를 하나 추가해 `env.update(extra_env or {})` 로 병합하면 이 테스트도 헬퍼를 재사용할 수 있다. 급한 사안은 아님(기능 결함 없음, 테스트는 통과).

- **[INFO]** `_run_gate` 호출부가 6개 위치 인자를 콜백(lambda) 두 개와 함께 나열해 각 인자의 역할을 이름만으로 파악하기 어려움
  - 위치: `.claude/hooks/guard_review_before_push.py:542-550`(REVIEW), `:553-561`(PLAN)
  - 상세: `_run_gate(evaluate_review, "BYPASS_REVIEW_GUARD", targets, base_cwd, lambda d: ..., lambda d, wt: ...)` 형태로, 인자 6개가 모두 위치 인자다. 함수 정의(494행)를 함께 열어보지 않으면 4번째 인자가 `base_cwd`(위 WARNING 대로 실제로는 미사용)인지 5번째가 `is_blocked` 인지 호출부만으로는 바로 알기 어렵다.
  - 제안: 위 WARNING 대로 `base_cwd` 를 제거하면 인자가 5개로 줄어 가독성이 개선된다. 남는 인자에 대해서도 `is_blocked=`, `render=` 처럼 키워드 인자로 호출하면 각 콜백의 역할이 호출부만 보고도 드러난다.

- **[INFO]** `_mentions_branch` 의 경계 문자 판정에서 `before or " "` / `after or " "` 트릭이 별도 설명 없이 사용됨
  - 위치: `.claude/hooks/guard_review_before_push.py:396-401`
  - 상세: `command` 의 시작/끝에서 `before`/`after` 가 빈 문자열(`""`)이 되는 경계 케이스를, `_BRANCH_CHAR.match("")` 가 아니라 공백 `" "`(비-branch 문자) 으로 치환해 "문자열 경계 = 구분자" 로 취급하는 재치 있는 처리다. 동작은 정확하지만(문자열 시작/끝에서 매치가 성립해야 함을 암묵적으로 이용) `or " "` 자체만 보면 왜 공백을 쓰는지 즉시 와닿지 않는다. 함수 docstring(387-390행)은 "경계 매칭" 의 목적만 설명하고 이 구현 트릭은 언급하지 않는다.
  - 제안: `# empty string at start/end of command counts as a delimiter too` 정도의 한 줄 인라인 주석을 `before`/`after` 계산부 옆에 추가하면 다음 유지보수자가 이 fallback 의 의도를 재추론할 필요가 없어진다. 급하지 않음.

## 검증한 항목 (문제 없음)

- 직전 라운드 WARNING #4(REVIEW/PLAN 루프 DRY 위반)는 `_run_gate()` 추출로 실제 해소됨 — 두 게이트 호출부가 각각 5줄 이내로 축소됐고, "게이트 격리"·"target 단위 fail-open" 두 불변식이 docstring 에 명시되어 있다(`:501-505`).
- 직전 INFO(지역 import 관례 이탈)도 해소 — `import subprocess`/`import inspect` 모두 모듈 top-level 로 이동(`:28`, `:32`).
- 신규 함수 4개(`_worktree_branches`/`_mentions_branch`/`_accepts_cwd`/`_push_targets`) 모두 타입 힌트(가능한 범위 내)·근거 주석을 갖추고 있어 이 파일의 기존 "모든 설계 결정에 근거 주석" 컨벤션과 일치한다.
- 함수 길이·중첩 깊이 모두 낮음 — 가장 긴 함수도 `main()`(약 40줄)이며 중첩은 최대 2단계(for → try/except)를 넘지 않는다.
- 네이밍은 snake_case + 모듈-비공개 `_` 접두어로 파일 전체와 일관됨.
- `.claude/tests/README.md`(1행 추가)와 `plan/in-progress/push-guard-worktree-scope.md`(신규)는 각각 카탈로그·plan 컨벤션에 부합하며 유지보수성 관점에서 지적할 사항 없음.
- `review/code/2026/07/23/17_28_02/**`(RESOLUTION.md·SUMMARY.md·meta.json·개별 reviewer report 등)는 생성된 리뷰 산출물이며 애플리케이션/하네스 코드가 아니므로 가독성·복잡도·중복 등 코드 품질 기준을 적용할 대상이 아니다 — 지적 없음.

## 요약

핵심 실행 코드(`guard_review_before_push.py`)는 직전 라운드의 WARNING(REVIEW/PLAN 루프 중복)과 INFO(지역 import)가 실제로 반영되어 있고, 이 파일이 오랫동안 지켜온 "모든 설계 결정에 근거 주석" 컨벤션도 신규 코드 전체에 일관되게 적용되어 있다. 다만 그 DRY 리팩터(`_run_gate` 추출) 과정에서 `base_cwd` 매개변수가 실제로는 아무 곳에서도 쓰이지 않는 채로 남아, 시그니처가 실제 동작과 어긋나는 작은 드리프트가 새로 생겼다 — 기능 결함은 없지만 향후 세 번째 게이트 추가 시 오해를 부를 수 있는 죽은 파라미터라 WARNING 으로 기록한다. 그 외에는 테스트 헬퍼 재사용성·콜백 인자 가독성·인라인 주석 부재 수준의 INFO 뿐이며, 전체적으로 유지보수성 리스크는 낮다.

## 위험도

LOW
