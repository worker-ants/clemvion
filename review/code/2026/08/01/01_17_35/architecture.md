# 아키텍처(Architecture) Review

## 발견사항

- **[WARNING]** 새 `notes` advisory 필드가 정본(canonical) `Outcome` 클래스 + 두 개의 손으로 짠 fallback shim 에 각각 따로 추가되어, 이 PR 자신이 `retry_state.py` 추출로 없애려던 "Mirrors X. Change both." 중복 패턴을 한 단계 위(hook의 fallback stand-in 계층)에서 재생산한다.
  - 위치:
    - `.claude/hooks/_lib/failopen_state.py:46-54` (정본 `Outcome.__init__`, `self.notes` 신규 필드 — line 54)
    - `.claude/hooks/guard_review_before_push.py:793-799` (`failopen_state` import 실패 시 대체용 `_Outcome` — `self.notes` line 799)
    - `.claude/hooks/guard_review_before_stop.py:99-114` (`_new_outcome()` 내부 `_Fallback` — `self.notes` line 112)
  - 상세: `retry_state.py` 자신의 모듈 docstring 은 "두 orchestrator 가 각자 사본을 유지하며 'Change both' 주석으로만 동기화하던 것을, `report_paths.py` 가 이미 그 방식으로 실패한 뒤 대체한 배치"라고 명시한다. 그런데 이번 PR 은 정확히 같은 모양의 문제를 하나 더 만든다 — `notes` 필드를 `Outcome`(정본) 에 추가하면서, 별도로 존재하는 두 개의 fallback 클래스 리터럴(`_Outcome`, `_Fallback`)에도 손으로 필드를 추가해야 했다. `guard_review_before_stop.py:108-111` 의 주석("the push side already diverged once by having it on only one of its two")이 이 취약성을 스스로 인정한다 — 즉 같은 브랜치 작업 도중 이미 한 번 두 shim 간 필드가 어긋났다가 재수정된 이력이 있다. 두 fallback 은 `failopen_state` import 자체가 실패할 때만 활성화되는 좁은 경로라 폭발 반경은 작지만, 향후 4번째 필드가 추가될 때 두 shim 중 하나만 갱신되고 넘어갈 구조적 위험은 그대로 남는다 — 이 PR 이 다른 곳(retry_state)에서 없앤 바로 그 결함 종류다.
  - 제안: `_shared/`(이미 "hooks 도 skills 도 소유하지 않는" 계층으로 문서화됨, `.claude/_shared/__init__.py`)에 최소 stand-in 클래스를 한 번만 정의해 두 hook 의 fallback 분기가 그것을 import 하도록 통합. `failopen_state` 자체가 깨졌을 때만 쓰는 shim 이므로 `_shared` 에 두면 `failopen_state` 에 대한 의존을 만들지 않고도 두 hook 이 같은 정의를 공유할 수 있다.

- **[WARNING]** 동일한 `notes` 전달 메커니즘이 push hook 에서는 게이트-불문(generic) 으로 일반화됐지만 Stop hook 에서는 REVIEW 게이트에만 하드코딩되어, 같은 PR 안에서 같은 관심사(advisory 전달)의 일반화 수준이 두 형제 hook 사이에서 어긋난다.
  - 위치:
    - `.claude/hooks/guard_review_before_push.py:847-859` (`_evaluate_over_targets` — `getattr(result, "notes", ()) or ()` 로 REVIEW/PLAN 어느 게이트 결과든 동일하게 처리)
    - `.claude/hooks/guard_review_before_stop.py:356-383` (REVIEW 게이트 `decision.notes` 만 순회하는 throttle 루프) vs `:394-423` (PLAN-COMPLETE 분기 — `plan.notes` 처리 없음)
  - 상세: 현재 `PlanDecision`(`.claude/hooks/_lib/plan_guard.py:77-84`)에는 `notes` 필드가 없어 지금 당장은 잠재적(latent) 문제일 뿐 실동작 결함은 아니다. 그러나 push hook 은 `_evaluate_over_targets` 한 함수가 REVIEW/PLAN 양쪽 게이트 결과에서 `.notes` 를 획일적으로 뽑아 올리도록 설계된 반면, Stop hook 은 REVIEW 분기 안에만 note 출력 루프를 심어뒀다. 이후 누군가 PLAN 게이트에도 advisory 를 추가하면 push 에는 (기존 일반화 덕에) 자동으로 반영되지만 Stop 에는 별도 코드를 추가하지 않는 한 조용히 사라진다 — "아무도 읽지 않는 경고" 라는, 이 PR 자신이 막으려는 실패 유형을 그 PR의 구현 내부에서 한 겹 위로 재현하는 셈이다.
  - 제안: Stop hook 도 REVIEW/PLAN 결과를 균일하게 순회하며 `.notes` 를 뽑는 형태로 일반화하거나, 두 hook 이 공유하는 `_forward_notes(result, ...)` 헬퍼를 두어 게이트별 특수 취급을 없앤다.

- **[INFO]** `_newest_resolved_impl_done_mtime` 이 "타임스탬프 계산"과 "가변 out-parameter 를 통한 advisory 수집"이라는 두 책임을 한 함수에 갖게 되어 경미한 단일 책임 원칙(SRP) 흐림이 있다.
  - 위치: `.claude/hooks/_lib/review_guard.py:718-760` (함수 시그니처 718-720, side-effect append 756-759)
  - 상세: 함수명·1차 docstring 은 순수 타임스탬프 조회로 서술되지만, `notes: list[str] | None` out-parameter 를 통해 채택된 세션에 대한 하향 감지 advisory 를 부수효과로 쌓는 두 번째 책임이 추가됐다. `notes is not None` 가드로 하위호환은 지켜지고 테스트(`GateSurfacesTheContradictionTest`, `NotesSurviveBlockingTest`)로 커버되어 기능적 위험은 낮지만, `(mtime, best_dir)` 를 반환해 호출부인 `evaluate_review`(이미 `_block_integrity` 를 import 하고 있음)가 직접 `contradiction_note(best_dir)` 를 호출하는 편이 더 깔끔한 계층 분리였을 것이다.
  - 제안: 우선순위 낮음 — 향후 리팩터링 시 반환값 기반으로 전환 고려.

- **[INFO]** (긍정적 관찰) `.claude/_shared/` 가 단방향 의존 계층으로 깨끗하게 유지된다.
  - 위치: `.claude/_shared/__init__.py:1-12`, `.claude/_shared/block_integrity.py` (import 는 `os`/`re` 뿐), `.claude/_shared/retry_state.py:31-38` (import 는 stdlib + 형제 모듈 `report_paths` 뿐)
  - 상세: `_shared/__init__.py` 는 "hooks/** 도 skills/** 도 이 계층을 소유하지 않는다 — 둘 다 소비자다" 라는 규칙을 명문화하고 있고, 실제로 `_shared/*.py` 어느 파일도 `hooks/`·`skills/` 를 되돌아 import 하지 않음을 확인했다(grep 결과 역참조 없음). `review_guard.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`, `merge_coordinator_orchestrator.py` 넷 모두가 `_shared` 를 단방향으로만 의존해 순환 의존이 없다. `consistency_orchestrator.ALL_CHECKERS` 도 이번에 `block_integrity.ALL_CHECKERS` 로부터 파생되도록 바뀌어(`ALL_CHECKERS = list(_block_integrity.ALL_CHECKERS)`), "체커 목록"이라는 단일 진실이 그것을 가장 필요로 하는 모듈(빠지면 안전에 직결되는 `block_integrity`)에 위치하는 좋은 의존성 역전 사례다. `BLOCK:` 판정 정규식도 repo 전체에서 `block_integrity.py` 한 곳에만 남아 있음을 grep 으로 확인했다(잔존 중복 없음).

- **[INFO]** `merge_coordinator_orchestrator.py` 의 부분 마이그레이션은 정직하게 공개된 의도적 경계이지 결함이 아니다.
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:85-122`
  - 상세: 세 orchestrator 중 이 파일만 `_load_state`/`_save_state`/`_apply_status_update` 3개만 `_shared/retry_state.py` 로 위임했고, `_emit_summary_state`(필드가 실제로 다름)와 `reconcile_state_with_disk`(이 파일엔 애초에 없음)는 그대로 남았다. 세 orchestrator 가 "state bookkeeping" 이라는 동일 개념을 공유하면서도 이를 명시하는 공통 인터페이스(ABC/Protocol) 없이 각자 함수 집합으로만 존재하기 때문에, 완전한 대체 가능성(리스코프 치환 관점)은 아직 없다 — 다만 이 격차는 코드 주석(line 107-112)과 plan 문서(`plan/in-progress/harness-review-gate-ci-backstop.md` 항목 9)에 모두 명시적으로 등록된 후속 작업이라 은폐된 결함이 아니다.

- **[INFO]** 체커 이름 목록의 세 번째 사본(`role_instructions.CHECKER_INSTRUCTIONS`)은 파생이 아니라 테스트 동등성 검증으로만 묶여 있다.
  - 위치: `.claude/tests/test_block_integrity.py` `CheckerListIsCanonicalTest.test_role_instructions_registers_the_same_checkers` (예: 라인 88-107 부근, `sorted(mod.CHECKER_INSTRUCTIONS)` 대 `sorted(BI.ALL_CHECKERS)` 비교)
  - 상세: 테스트 docstring 은 "`_shared` 가 skill 을 import 해서는 안 되는 의존 방향을 지키기 위해 import 대신 동등성 assertion 을 쓴다"고 밝힌다. 이는 `_shared → skill` 방향을 막는다는 점에서는 옳지만, 반대 방향(`skill → _shared`, 이미 `consistency_orchestrator.py` 가 쓰는 방향)은 허용되므로, `role_instructions.py`(`code-review-agents` skill 소속, 이번 diff 범위 밖)가 `_shared.block_integrity.ALL_CHECKERS` 를 import 해 dict 키를 파생시키는 방법으로 세 번째 사본 자체를 없앨 여지가 남아 있다. 이번 diff 의 범위 밖 파일이라 결함으로 보지 않으며, 향후 참고용 관찰로만 기록한다.

## 요약

이번 변경은 (1) 세 orchestrator(`code_review_orchestrator.py`/`consistency_orchestrator.py`/`merge_coordinator_orchestrator.py`)에 중복돼 있던 `_retry_state.json` bookkeeping 5개 함수를 `.claude/_shared/retry_state.py` 로 추출한 DRY 리팩터와, (2) consistency SUMMARY 의 `BLOCK:` 판정이 checker 의 `[CRITICAL]` 태그와 모순되는지 감시하는 새 backstop(`block_integrity.py`)을 `review_guard.py`/두 hook 에 `notes` advisory 채널로 연결한 기능 추가로 구성된다. `_shared/` 는 hooks·skills 양쪽이 단방향으로만 의존하는 깨끗한 기반 계층으로 유지되고(순환 의존 없음, grep 으로 확인), `ALL_CHECKERS`·`BLOCK:` 정규식 모두 단일 진실로 수렴했으며, 불완전한 마이그레이션(merge-coordinator)이나 남은 중복(체커 목록 세 번째 사본)은 은폐되지 않고 코드 주석·plan 문서에 명시적으로 등록돼 있다 — 이 프로젝트의 관례에 부합하는 좋은 투명성이다. 다만 이번 PR 이 새로 도입한 `notes` 메커니즘 자체는 일관성이 완전하지 않다: (a) 정본 `Outcome`(`failopen_state.py`) 외에 두 개의 손으로 짠 fallback 클래스에도 같은 필드를 따로 동기화해야 하는 구조가 됐고 — 이는 이 PR 이 다른 곳에서 없앤 바로 그 "Change both" 결함 종류이며 이미 한 번 실제로 어긋난 적이 있다고 주석이 자백한다 — (b) push hook 은 REVIEW/PLAN 게이트에 획일적으로 notes 를 전달하도록 일반화한 반면 Stop hook 은 REVIEW 게이트에만 하드코딩돼 있어, 향후 PLAN 게이트에 advisory 가 추가되면 Stop 쪽에서만 조용히 유실될 잠재적 위험이 남는다. 둘 다 현재 시점에 살아있는 기능적 결함은 아니며(좁은 fallback 경로, 그리고 PlanDecision 에 아직 notes 필드가 없음), 전반적으로 레이어 책임 분리·의존성 방향·단일 진실 수렴은 이 리포지토리의 기존 관례를 잘 따르는 견고한 변경이다.

## 위험도
LOW
