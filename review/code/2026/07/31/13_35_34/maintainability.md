# 유지보수성(Maintainability) Review

### 발견사항

- **[CRITICAL]** 이번 PR 어디에도 설명되지 않은 ~1,304줄짜리 orphaned 파일이 `code_review_orchestrator.py` 수정 **전** 스냅샷 그대로 통째로 커밋됨 — 극단적 중복 코드 + 실행 가능한 회귀 지뢰
  - 위치: `.claude/skills/code-review-agents/scripts/_probe_main.py` (신규 파일 전체, 1~1304줄)
  - 상세: git blob 대조 결과 `_probe_main.py` 는 이 브랜치가 `code_review_orchestrator.py` 를 고치기 **직전** 상태(blob `8aedb8eb8`, `origin/main` 기준 그 파일의 pre-image)와 바이트 단위로 완전히 동일하다(`diff` 결과 0). 즉 이 파일의 내용은 100% `code_review_orchestrator.py` 의 구버전이며, 이번 PR 이 그 파일에 실제로 추가한 수정(생략 안내 `_omitted_content_note`/`_aggregate_omission_note` 신설, 예산 재계산 로직, `warn_if_committed_work_is_missing`, `_default_branch_ref` 등)은 전혀 반영돼 있지 않다. 저장소 전체를 grep 해도 이 파일을 import·실행·문서에서 언급하는 곳이 전무하다(이번 리뷰 세션 자체가 생성한 메타파일 외 0건 — `grep -rln "_probe_main"`). `.gitignore` 대상도 아니다. 그런데 `if __name__ == "__main__": main()` 을 갖춘 완결된 독립 실행 CLI 스크립트라 구문 오류 없이 그대로 실행 가능하다 — 누군가 실수로 이 파일을 돌리면 이번 PR 이 막 고친 결함(예산 초과 시 파일이 안내 없이 통째로 누락되는 문제 등)이 그대로 재현된다. 파일을 추가한 커밋(`d19e01880 fix(harness): 3R 리뷰 반영 …`)의 커밋 메시지·관련 plan 문서(`harness-consistency-summary-downgrade-rule.md`, `harness-review-gate-ci-backstop.md`) 어디에도 이 파일의 존재 이유가 적혀 있지 않다 — "고치기 전/후 동작을 비교하려던 로컬 스냅샷/스크래치 파일"이 `git add` 범위에 휩쓸려 커밋된 것으로 보인다. (동일 세션의 scope-reviewer 도 독립적으로 같은 근본 원인을 지목했다 — 교차 확인됨.)
  - 제안: `_probe_main.py` 삭제. 비교 목적으로 정말 필요했다면 저장소 밖(로컬 scratch, `/tmp` 등)에 두거나 커밋 메시지·plan 에 존재 이유를 명시할 것. 현재 상태로 남기면 (1) 유지보수자가 이 파일을 "진짜" 오케스트레이터의 대체본·참조본으로 오인할 위험, (2) 두 파일이 앞으로 독립적으로 편집되며 조용히 갈라질 위험, (3) 실수로 실행됐을 때 이미 고친 결함이 재현될 위험이 있다.

- **[WARNING]** `build_files_section` 한 함수가 예산 전략 3가지(무예산 / 헤더+diff 초과 / 콘텐츠 배분+2단계 렌더)를 병렬로 재구현 — 순환 복잡도 과다 (이미 plan 에 defer 로 등재된 구조적 문제, 이번 라운드에도 구조 자체는 해소되지 않음)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:587-771` (약 185줄)
  - 상세: 이 함수 안에서 (1) `max_total_size<=0`, (2) 헤더+diff 만으로 예산 초과, (3) 콘텐츠 예산 배분(→ `per_file_notice=True` 렌더가 상한을 넘으면 `per_file_notice=False` 로 재렌더 + 집계 안내) 세 경로가 "생략 안내 문구 길이도 예산에 포함해야 한다"는 같은 불변식을 각자 손으로 재구현한다. `plan/in-progress/harness-review-gate-ci-backstop.md` (신규 후속 3번) 가 스스로 "3R CRITICAL 이 정확히 이 구조에서 재발했다"고 기록하고 `_render_unbounded`/`_render_diff_only_overflow`/`_allocate_content_budget` 분리를 후속으로 이미 등재해 뒀다 — 이번 라운드는 그 증상(개수 누락)만 고쳤을 뿐 세 경로가 하나로 안 묶인 구조는 그대로다.
  - 제안: plan 에 이미 정식 후속으로 기록돼 있어 이번 PR 을 막을 사유는 아니나, 같은 클래스의 결함이 이미 두 라운드 연속 재발했으므로 다음 라운드에서 우선순위를 올릴 것을 권장.

- **[WARNING]** git "기본 브랜치" 해석 로직이 이번 PR 로 4번째 독립 구현이 됨
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1190-1211` (`_default_branch_ref`, 신규)
  - 상세: 이미 `branch_guard._origin_default_branch()`(정본) · `review_guard._default_branch()` 가 존재하는데, 이번 PR 이 `code_review_orchestrator._default_branch_ref()` 를 추가로 신설했고 `consistency_orchestrator.py` 는 `args.diff_base or "origin/main"` 리터럴로 4번째 변형을 갖는다(반환 계약도 서로 다르다 — 로컬 `main` vs `origin/main`). 정책이 바뀌면 4곳을 모두 고쳐야 하는 drift 위험이 이번 PR 로 한 곳 더 늘었다. `harness-review-gate-ci-backstop.md` 에 이미 "hooks/skills 의 `_lib` 네임스페이스 충돌 해소가 선행" 조건으로 통합이 defer 돼 있다. 참고로 같은 파일에 신설된 `_branch_changed_rels`(`consistency_orchestrator.py:249-267`, 특히 259줄)는 기존 `get_git_branch_diff_files` 와의 중복을 주석으로 명시했지만, `_default_branch_ref` 는 기존 3개 구현을 언급하지 않는다.
  - 제안: 즉시 통합은 defer 결정을 존중하되, 최소한 `_default_branch_ref` 에도 기존 구현들을 가리키는 "change together" 주석을 남길 것.

- **[WARNING]** 신규 테스트 3개 파일이 동일한 "fresh-interpreter" 보일러플레이트(`_PREAMBLE` + `run_in_orchestrator`, 약 30줄)를 각각 복제
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:39-68`, `.claude/tests/test_prompt_omission_notice.py:41-81`, `.claude/tests/test_review_changeset_warning.py:44-72` (기존 `test_consistency_context_budget.py` 까지 포함하면 4곳)
  - 상세: 세 파일 모두 `importlib.util.spec_from_file_location` 으로 오케스트레이터를 별도 인터프리터에서 로드하고 `<<<json>>>` 마커로 결과를 되받는 동일한 패턴을 거의 그대로 복제한다(모듈 경로·부가 import 몇 줄만 다름). `harness-review-gate-ci-backstop.md` 의 "신규 후속 (defer)" 7번이 이미 이 중복을 `_harness.py` 추출 대상으로 기록했고, "이번에 timeout 을 3곳에 각각 넣어야 했던 것이 그 비용의 실례" 라고 스스로 지적한다 — 즉 이번 PR 에서 그 복제 비용이 실제로 다시 발생했는데도 추출은 하지 않았다.
  - 제안: 다음 테스트 추가 전에 `_harness.py`(또는 신규 헬퍼 모듈)로 `_PREAMBLE`/`run_in_orchestrator` 를 추출할 것. 이미 plan 에 defer 로 기록돼 있어 이번 PR 을 막을 사유는 아님.

- **[WARNING]** `collect_context` 가 이미 길었던 함수(기존 ~155줄)에 랭킹 준비 로직까지 인라인으로 얹혀 더 길어짐 — 책임 과다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:428-598` (약 170줄)
  - 상세: 이 함수는 config 로드, `--spec`/`--plan`/`--impl-prep`/`--impl-done` 4-way 모드 분기, 경로 검증(`_require_target`), 이번에 추가된 랭킹 입력 계산(`_rank_changed`/`_rank_plan_text`, 452-455줄)과 클로저(`_prioritized`, 457-465줄), 최종 번들 조립까지 한 함수 안에서 전부 처리한다. 새로 추가된 랭킹 준비 블록은 그 자체로 독립적인 책임(우선순위 계산 준비)이라 분리하기 좋은 지점인데 기존 함수에 바로 인라인됐다.
  - 제안: 랭킹 입력 계산 + `_prioritized` 클로저 생성을 `_make_bundle_prioritizer(root, diff_base, plan_dir)` 같은 별도 팩토리 함수로 추출하면 `collect_context` 자체는 순수 모드 분기만 남길 수 있다. 블로킹 사유는 아님.

- **[INFO]** 지역 변수에 언더스코어 프리픽스(`_rank_changed`, `_rank_plan_text`) — 이 파일의 기존 지역 변수 관례와 불일치
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:452-453`
  - 상세: 이 코드베이스에서 언더스코어 프리픽스는 보통 모듈 전역의 "private 함수/헬퍼"(`_lib`, `_default_branch`, `_save_state`, `_require_target` 등)에 쓰이고, 함수 내부 지역 변수에는 쓰이지 않는다(같은 함수의 `plan_files`/`convention_files`/`scope_files` 등은 프리픽스 없음). `_rank_changed`/`_rank_plan_text` 만 예외적으로 지역 변수인데 프리픽스가 붙어 있어 "모듈 레벨 상태냐" 는 순간적 오독을 유발할 수 있다.
  - 제안: `rank_changed`/`rank_plan_text` 로 프리픽스 제거.

- **[INFO]** 매직 넘버 `10` 이 한 함수 안에서 3번 반복
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1243, 1245, 1246`
  - 상세: `missing[:10]` / `len(missing) > 10` / `len(missing) - 10` 이 "누락 파일을 최대 몇 개까지 나열할지" 를 나타내는 동일한 상수인데 리터럴로 3번 등장한다. 테스트(`test_review_changeset_warning.py::test_long_lists_are_capped_but_counted`)가 이 값을 10 으로 고정하고 있어 동작 자체는 안전하지만, 이름 있는 상수로 추출하면 의도가 더 명확해지고 세 곳을 동시에 유지보수하지 않아도 된다.
  - 제안: `_MAX_LISTED_MISSING_FILES = 10` 같은 모듈 상수로 추출.

- **[INFO]** `evaluate_review(in_flight_ok: bool=False)` — 서로 다른 두 보증 수준(push=hard gate / stop=soft nudge)을 boolean 플래그 하나로 스위칭
  - 위치: `.claude/hooks/_lib/review_guard.py:862-864`
  - 상세: 현재는 push 가드가 옵트인하지 않고(기본값 `False`) stop 가드만 `True` 를 넘기도록 양방향 테스트(`EvaluateInFlightShortCircuitTest`, `test_stop_passes_in_flight_opt_in`, `test_push_never_opts_into_the_in_flight_concession`)로 봉쇄돼 있어 현재는 안전하다. 다만 `plan/in-progress/harness-review-gate-ci-backstop.md` (신규 후속 5번)가 스스로 지적하듯, 세 번째 호출부가 생기면 다시 "기본값이 안전한 쪽"이라는 암묵적 가정에만 의존하게 된다 — 시그니처 레벨에서 잘못된 옵트인을 막는 장치는 없다.
  - 제안: (plan 에 이미 후속으로 등재됨) `evaluate_review_for_push()`/`evaluate_review_for_stop()` 얇은 wrapper 로 감싸 호출부가 boolean 을 직접 다루지 않게 하는 안을 검토.

### 요약

이번 PR 자체가 작성한 로직 — `review_guard.py` 의 in-flight 스코프 축소(`in_flight_ok` opt-in), `consistency_orchestrator.py` 의 4-tier 번들 우선순위, `code_review_orchestrator.py` 의 생략 안내 예산 계상, changeset 누락 경고 — 는 하나같이 근거(실측 수치)·의도·회귀 방지 테스트를 코드 옆에 촘촘히 남겨 가독성과 향후 유지보수성이 우수하다. 다만 이번 라운드에서 새로 추가된 `_probe_main.py` 는 수정 전 코드의 완전한 바이트 단위 사본 1,304줄이 아무 설명 없이 커밋에 섞여 들어간 것으로, 저장소 어디에서도 참조되지 않는 죽은 코드이자 그대로 실행하면 이미 고친 결함을 재현하는 회귀 지뢰다 — 이번 PR 순증가분의 절반 가까이를 차지하는 규모라 반드시 삭제가 필요하다. 그 외에는 이미 plan 문서에 근거와 함께 명시적으로 defer 된 구조적 부채(`build_files_section` 의 3중 예산 전략, git 브랜치 해석 로직 4중복, 테스트 보일러플레이트 복제, boolean-flag 시그니처)가 이번 변경으로 소폭 더 쌓였을 뿐 새로운 미기록 부채는 아니다.

### 위험도
HIGH
