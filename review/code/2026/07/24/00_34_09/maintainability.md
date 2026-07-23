# Maintainability Review — push-guard-worktree-scope (round 00_34_09, post origin/main 병합)

## 검증 방법

이번 라운드는 `plan/in-progress/push-guard-worktree-scope.md` §"origin/main 재구조화 흡수
(2026-07-24)" 가 서술하는 병합(`feda5b219` — main 의 fail-open 관측 구조 #999/#1000 위에 이 branch 의
worktree 스코핑을 재이식)을 대상으로 한다. 직전 라운드(18_22_56)까지의 maintainability
WARNING/INFO(REVIEW/PLAN 루프 DRY, `base_cwd` 죽은 파라미터, 지역 import, `timeout` 매직넘버 근거)는
모두 그 시점 코드에서 해소가 확인돼 있었다. 이번 병합으로 `_run_gate()` 가 `_evaluate_over_targets()`
+ `_run_gates()` 로 대체된 것이 리뷰 대상 신규 구조이므로, 현재 파일을 직접 `Read` 하고 병합 직전
커밋(`89c3870b4`)과 대조해 실질 diff만 분석했다. `.claude/tests/test_push_guard_worktree_scope.py` /
`.claude/tests/README.md` / `plan/in-progress/push-guard-worktree-scope.md` 도 함께 대조했다.

## 발견사항

- **[WARNING]** 병합으로 `main()`(구 `_run_gate` 시절 REVIEW/PLAN 각 7줄)이 다시 `_run_gates()` 안에서
  REVIEW/PLAN 각 21줄짜리 동일 골격 두 벌로 늘어났다 — 직전 라운드에 이미 해소됐던 DRY 위반이 병합으로
  재발
  - 위치: `.claude/hooks/guard_review_before_push.py:639-685` (`_run_gates`) — REVIEW 블록
    641-661행, PLAN 블록 663-683행
  - 상세: 병합 전(`89c3870b4`) 의 `_run_gate(evaluate, bypass_env, targets, *, is_blocked, render)`
    는 `BYPASS_*` 확인과 `evaluate is None` 확인까지 헬퍼 **내부**로 캡슐화하고 있어서, `main()`
    쪽 REVIEW/PLAN 호출부는 각각 7줄에 불과했다(1차 리뷰 WARNING #4 가 정확히 이 형태를 요구해
    반영된 결과). 이번에 origin/main 구조(`_run_gates(outcome, targets)` + `#999` 의 `outcome.degraded`/
    `outcome.bypassed` 관측)를 base 로 채택하면서, `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 체크 →
    `evaluate_review is None`/`evaluate_plan is None` 체크 → `_evaluate_over_targets(...)` 호출 →
    `blocked is not None` 이면 print+return 2 라는 골격이 REVIEW/PLAN 두 곳에 다시 그대로 반복됐다.
    공통 per-target 루프 자체는 `_evaluate_over_targets` 로 잘 뽑혀 있지만, 그 바깥을 감싸는
    bypass/import-실패/print-return 스캐폴딩은 이번 병합으로 되돌아왔다. 세 번째 게이트가 추가되면
    다시 이 21줄짜리 블록을 통째로 복붙해야 하고, 이 파일이 과거 실제로 겪은 "미러링된 두 블록 중
    한쪽만 갱신되어 드리프트" 패턴(project 메모리에도 기록된 반복 사례)을 재현할 위험이 있다.
  - 제안: `_run_gates` 를 다시 `_run_one_gate(evaluate, bypass_env, gate, import_error, targets,
    outcome, is_blocked, render) -> int | None` 같은 헬퍼로 묶어 REVIEW/PLAN 호출을 각각 한 줄로
    줄이는 것을 권장. `outcome.bypassed.append`/`outcome.degraded.append` 호출까지 헬퍼 안으로
    넣으면 병합 전 `_run_gate()` 수준의 압축을 다시 회복할 수 있다.

- **[INFO]** 신규 테스트 docstring 이 병합으로 사라진 함수명 `_run_gate` 를 여전히 인용
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:247`
    (`test_per_target_fail_open_still_checks_remaining_targets` docstring: `` `_run_gate`'s
    per-target fail-open, pinned (review 17_51_28 WARNING 1). ``)
  - 상세: `grep -rn "_run_gate\b"` 로 확인한 결과, 현재 코드베이스에 `_run_gate` 라는 심볼은 이 한
    줄(테스트 docstring)에만 남아 있고, 실제 함수는 `_evaluate_over_targets`/`_run_gates` 로 이름이
    바뀌었다(위 WARNING 참고). 히스토리 각주(리뷰 라운드 번호 인용)로는 유효하지만, 백틱으로 감싼
    함수명은 코드 심볼처럼 읽혀서 이 테스트를 이해하려는 다음 사람이 grep 했을 때 대상이 사라진
    것처럼 보일 수 있다.
  - 제안: `` `_evaluate_over_targets`'s per-target fail-open (당시 `_run_gate`), pinned … `` 정도로
    현재 이름을 우선하고 옛 이름은 괄호로 남기면 혼동이 사라진다. 기능 영향 없음, 급하지 않음.

- **[INFO]** `_evaluate_over_targets` 안에서 "게이트를 answered 로 표시" 하는 2줄짜리 조건문이
  early-return 분기와 loop-후 분기에 각각 한 번씩, 두 번 반복
  - 위치: `.claude/hooks/guard_review_before_push.py:630-635`
    (`if is_blocked(result): if gate not in outcome.answered: outcome.answered.append(gate) …`
    그리고 `if answered and gate not in outcome.answered: outcome.answered.append(gate)`)
  - 상세: `if gate not in outcome.answered: outcome.answered.append(gate)` 라는 동일한 두 줄이
    함수 안에 두 번 등장한다(한쪽은 block 이 확정된 즉시 반환하기 전, 다른 한쪽은 루프가 끝난 뒤).
    제어 흐름상 자연스러운 결과이고 함수 전체가 39줄로 여전히 짧아 심각하지 않지만, 작은 로컬
    헬퍼(`def _mark_answered(): if gate not in outcome.answered: outcome.answered.append(gate)`)로
    묶으면 "gate 당 한 번만 기록" 이라는 불변식(이미 docstring 이 강조하는 그 불변식)이 한 곳에만
    존재하게 된다.
  - 제안: 급하지 않음 — 선택적 정리.

- **[INFO]** (이월, 계속 미반영) `_mentions_branch` 의 문자열 경계 처리에 쓰이는 `before or " "` /
  `after or " "` 트릭에 인라인 주석 없음
  - 위치: `.claude/hooks/guard_review_before_push.py:427-429`
  - 상세: 1차 리뷰(17_28_02)·2차 리뷰(17_51_28) maintainability 문서가 동일하게 지적했던 항목이
    이번 병합에서도 코드가 그대로 옮겨져 여전히 남아 있다. 동작은 정확하지만("문자열 시작/끝 =
    구분자") 그 의도가 코드 자체에는 설명돼 있지 않다.
  - 제안: 여전히 낮은 우선순위. 손대는 김에 한 줄 주석을 추가해도 좋지만 이번 병합 diff 의 범위는
    아니다.

## 검증한 항목 (문제 없음 — 병합이 실제로 지킨 것들)

- `_worktree_branches`/`_mentions_branch`/`_accepts_cwd`/`_push_targets` 4개 헬퍼와 그 설계 근거
  주석(314-377행)은 병합 전후로 완전히 동일하게 보존됐다 — grep 대조 결과 한 글자도 달라지지 않음.
- `base_cwd` 죽은 파라미터(2차 리뷰 WARNING) 재발 없음 — 현재 `_evaluate_over_targets`/`_run_gates`
  어디에도 `base_cwd` 매개변수가 없고, `main()`(705행) 안에서 지역 변수로만 쓰인다.
  `_evaluate_over_targets` 는 unscoped 분기에서 `os.getcwd()` 를 직접 참조해(633행) 병합 전 정정된
  주석("legacy fallback 은 process cwd 를 평가한다")과 정확히 일치한다.
  `os.environ.get("BYPASS_REVIEW_GUARD") == "1"`.
- per-target fail-open 불변식(2차 리뷰 WARNING #1)은 유지 — `except Exception: … continue` 가
  개별 target 만 건너뛰고(622-626행) 나머지 target 순회는 계속된다. 새 규약(#999 관측)과 결합된
  뒤에도 `test_per_target_fail_open_still_checks_remaining_targets` 가 이를 계속 고정.
- **신규 불변식**(gate 당 1회 degraded 기록, #999 streak 오발화 방지) 도 코드(624-625행)와
  전용 회귀 테스트(`test_degradation_is_counted_once_per_gate_not_per_target`) 양쪽에 정확히
  반영돼 있음을 직접 대조 확인.
- 함수 길이·중첩 깊이: 가장 긴 함수는 `_evaluate_over_targets`(39줄)이며 중첩은 최대 3단(for →
  try/except → if)을 넘지 않는다. `main()`(688-729행)도 payload 파싱 → target 계산 → 게이트 실행 →
  리포트라는 선형 흐름을 유지해 읽기 쉽다.
- 네이밍은 snake_case + 모듈-비공개 `_` 접두어로 파일 전체·신규 코드 모두 일관됨.
- `.claude/tests/README.md`(1행)와 `plan/in-progress/push-guard-worktree-scope.md`(신규 + 병합
  섹션 추가)는 각각 카탈로그·plan 컨벤션에 부합하며, plan 문서의 "origin/main 재구조화 흡수" 절은
  병합 배경·재이식 방식·신규로 발견된 갭(M9 생존)까지 정확하게 코드와 대조되는 서술을 담고 있다.

## 요약

이번 병합(origin/main 의 fail-open 관측 구조 위에 worktree 스코핑을 재이식)은 두 갈래 브랜치가 각자
독립적으로 지켜온 불변식(per-target fail-open과 gate-당-1회 degraded 관측)을 `_evaluate_over_targets`
하나로 정확히 결합했고, 이 결합이 실제로 새 회귀 테스트로 고정돼 있다는 점에서 설계 수준은 높다.
`base_cwd` 죽은 파라미터 등 과거 라운드의 WARNING 재발도 없다. 다만 병합 과정에서 `main()` 쪽
REVIEW/PLAN 호출부가 병합 전 `_run_gate()` 수준(7줄)에서 다시 `_run_gates()` 내부의 21줄짜리 반복
블록 두 개로 되돌아간 것은, 1차 리뷰가 이미 WARNING 으로 잡아 해소시켰던 구조적 중복의 재발이라
이번 라운드의 WARNING 으로 다시 기록한다. 기능 결함은 아니며, 제안대로 얇은 헬퍼 한 겹만 다시
씌우면 해소된다. 그 외에는 테스트 docstring 의 이름 드리프트(INFO)와 이월된 소소한 주석 부재(INFO)
뿐이다.

## 위험도

LOW
