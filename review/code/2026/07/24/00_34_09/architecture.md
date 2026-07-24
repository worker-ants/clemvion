# 아키텍처(Architecture) 리뷰

대상: `.claude/hooks/guard_review_before_push.py` (교차-worktree 스코핑 + origin/main 재구조화(#999/#1000) 재이식), `.claude/tests/test_push_guard_worktree_scope.py`, `.claude/tests/README.md`, `plan/in-progress/push-guard-worktree-scope.md`.

본 세션은 5번째 리뷰 라운드다. 이전 4라운드(17_28_02 / 17_51_28 / 18_06_41 / 18_22_56)에서 이미
"REVIEW/PLAN 게이트 루프 DRY 위반"·"`_accepts_cwd` 리플렉션 계약 미검증" 등이 WARNING 으로 지적되어
반영됐고, 그 뒤 `feda5b219` 머지 커밋이 병렬 세션(#999/#1000, fail-open 관측 구조)과 재통합하며
`_run_gate` 를 `_evaluate_over_targets`(신규)로 흡수했다. 이번 라운드는 그 **병합 후** 코드를
대상으로 한다.

## 발견사항

- **[WARNING]** `_run_gates` 의 REVIEW/PLAN 블록이 여전히 구조적으로 중복 (핵심 스코핑 로직은 추출됐으나 오케스트레이션 골격은 남아 있음)
  - 위치: `.claude/hooks/guard_review_before_push.py:639-685` (`_run_gates`)
  - 상세: 이전 라운드 WARNING(REVIEW/PLAN 루프 전체 복제)은 `_evaluate_over_targets()`(598-636행)로 core(스코핑 순회 + per-target fail-open + degraded 기록) 를 추출해 실질적으로 해소됐다. 다만 `_run_gates` 안에는 여전히 `BYPASS_*` 환경변수 체크 → `evaluate_fn is None` 체크(import 실패) → `_evaluate_over_targets(...)` 호출(gate 이름, `is_blocked` lambda, `render` lambda 만 다름) → `if blocked: print(...); return 2` 골격이 REVIEW(642-661행)와 PLAN(664-683행) 두 곳에 그대로 반복된다. 세 번째 게이트가 추가되면(이 프로젝트가 push 가드에 게이트를 계속 늘려온 이력 — REVIEW→PLAN→이번 worktree 스코핑→#999 관측 — 을 볼 때 가능성이 낮지 않다) 이 골격이 세 번째로 복제될 위험이 남아 있다.
  - 제안: `_run_gates` 를 `[(gate_name, evaluate_fn, bypass_env, none_reason_args, is_blocked, render), ...]` 형태의 테이블로 만들고 단일 for 루프로 순회하도록 리팩터. 이미 `_evaluate_over_targets` 가 콜백 기반 설계이므로 자연스러운 다음 단계다. 급하지 않음 — 이전 라운드보다 중복 크기가 반으로 줄었고 게이트 2개 상태에서 실질 버그 유발 가능성은 낮다.

- **[INFO]** `_evaluate_over_targets` 가 서로 다른 두 불변식(스코핑 순회, fail-open 관측 카운팅)을 한 함수에 결합 — 의도적이고 문서화됨
  - 위치: `.claude/hooks/guard_review_before_push.py:598-636`
  - 상세: 이 함수는 (1) target 목록을 순회하며 첫 blocked 결과를 찾는 "게이트 스코핑" 책임과, (2) `outcome.degraded`/`outcome.answered` 에 게이트당 1회만 기록하는 "fail-open 관측"(#999 §E) 책임을 동시에 진다. docstring 이 "왜 분리하지 않았는가"(한쪽에서 조기 return 하면 나머지 target 이 미검사로 남거나, 관측이 target 수만큼 중복 카운트된다)를 명확히 근거로 남겼고, 머지 커밋 메시지도 같은 이유로 재구조화 시 이 결합을 의도적으로 선택했다고 기록한다(M9 mutation — gate 당 degraded dedup — 이 병합 직후 생존해 `test_degradation_is_counted_once_per_gate_not_per_target` 로 닫힌 이력도 있음). 결함이 아니라, 이 함수가 향후 세 번째 축(예: per-target 타임아웃 등)이 추가될 때 자연스러운 응집 지점이 될 가능성이 크다는 관찰.
  - 제안: 조치 불요. 향후 책임이 하나 더 늘면(예: target 별 소요시간 기록) 이 함수의 파라미터 리스트(현재 6개: `evaluate, targets, gate, outcome, is_blocked, render`)가 계속 늘어날 소지가 있으므로, 그 시점에는 `GateSpec` dataclass 로 파라미터를 묶는 것을 고려.

- **[INFO]** worktree 토폴로지 헬퍼(`_worktree_branches`/`_mentions_branch`/`_accepts_cwd`/`_push_targets`)는 여전히 훅 파일에 직접 위치 — 다만 이제는 이 프로젝트 자신의 "두 번째 소비자가 생기면 추출" 관례와 정확히 일치함이 확인됨
  - 위치: `.claude/hooks/guard_review_before_push.py:344-477` (신규 함수 4개 + 설계 주석)
  - 상세: 이전 라운드(17_28_02)에서 이 헬퍼들을 `_lib/`로 분리하지 않은 점을 "god hook 방향" INFO 로 지적했었다. 이번 병합으로 같은 파일의 fail-open 관측 로직은 실제로 `_lib/failopen_state.py`로 추출됐는데, 그 모듈 docstring 이 "moved here the moment a *second* hook needed it" — 즉 두 번째 소비자(`guard_review_before_stop.py`)가 실제로 생겼을 때만 추출한다는 원칙을 명문화하고 있다. worktree 토폴로지 로직은 `guard_review_before_stop.py`가 여전히 무인자 호출(`evaluate_review()`/`evaluate_plan()`, 335행·361행 부근)이라 두 번째 소비자가 아직 없다 — 그러므로 인라인 유지는 이 프로젝트가 스스로 세운 원칙에 부합하는 결정이며, "성급한 추상화"가 아니다. 이전 INFO 를 재확인하되 근거가 더 명확해졌다는 점을 기록.
  - 제안: 조치 불요. Stop 훅 등에 동일 스코핑이 필요해지는 순간 `_lib/worktree_scope.py` 로 뽑을 것.

## 검증한 항목 (문제 없음)

- **순환 의존성**: `_lib/review_guard.py`, `_lib/plan_guard.py`, `_lib/failopen_state.py` 어디에도 훅 파일을 import 하는 코드 없음(주석에서만 파일명 언급) — 레이어링(훅 → `_lib`, 단방향)이 병합 후에도 깨지지 않았다.
- **이전 WARNING 해소 확인**: (1) REVIEW/PLAN 루프 완전 중복 → `_evaluate_over_targets` 추출로 대부분 해소(위 WARNING 은 잔존분에 대한 것). (2) `_accepts_cwd` 가 실제 production 시그니처에 대해 테스트되지 않는다는 WARNING → `test_push_guard_worktree_scope.py:441-478` 의 `AcceptsCwdContractTest`가 `review_guard.evaluate_review`/`plan_guard.evaluate_plan` 을 실제로 import 해 `_accepts_cwd(...)` 가 `True`/`False` 인지 직접 고정한다. **해소됨**.
- **병합 무결성**: `feda5b219` 머지 커밋에 conflict marker(`<<<<<<<` 등) 잔존 없음(`.claude/hooks/guard_review_before_push.py`·테스트·plan 3파일 grep 확인). 커밋 메시지가 병합 판단 근거(어느 쪽 구조를 base 로 택했는지, 왜)를 명시적으로 남겨 감사 가능.
- **LSP/ISP**: `_evaluate_over_targets` 에 전달되는 `is_blocked`/`render` 콜백은 REVIEW(`_Decision.blocked`)와 PLAN(`_Plan.untouched`)에서 속성명이 다르지만, 콜백 시그니처(`(result, target) -> Any`)는 균일해 다형성 위반 없음. `_Outcome` 로컬 대체 클래스(584-588행)는 `failopen_state.Outcome`과 동일한 속성 계약(`answered`/`bypassed`/`degraded` 리스트)을 duck-typing 으로 재현 — `_lib` 부재 시에도 `_lib` 를 참조하지 않는 fallback 이라 형식적 공유 인터페이스(Protocol)를 둘 필요가 낮다.

## 요약

병합 후 코드는 이전 4라운드에서 WARNING 으로 지적된 두 항목(게이트 루프 완전 중복, `_accepts_cwd` 계약 미검증)이 각각 `_evaluate_over_targets` 추출과 `AcceptsCwdContractTest` 로 실질 해소된 상태를 재확인했다. `feda5b219` 재구조화 병합은 마커 편집이 아니라 두 불변식(fail-open 관측을 gate 당 1회로, per-target fail-open 은 target 별로)을 명시적으로 재설계해 통합했고, 그 근거가 커밋 메시지·docstring·신규 mutation 테스트(M9)에 일관되게 남아 있다. 순환 의존성·레이어 위반은 없다. 남은 개선 여지는 `_run_gates` 안의 얇아진 잔여 중복(WARNING, 3번째 게이트가 생기면 위험 증가)과 `_evaluate_over_targets` 가 두 책임을 의도적으로 결합하고 있다는 점(INFO, 문서화된 트레이드오프) 정도로, 둘 다 병합을 막을 사안은 아니다.

## 위험도

LOW
