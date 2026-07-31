# 유지보수성(Maintainability) Review

## 사전 확인 사항

이 세션(`12_38_42`)은 같은 diff 에 대한 **3번째 리뷰 라운드**다. `git log` 상 직전 커밋
`426f8bd40`(2026-07-31 12:38:34, "2R 리뷰 반영")이 이 리뷰가 시작되기 8초 전에 만들어졌고,
1라운드(`review/code/2026/07/31/11_07_48`)·2라운드(`review/code/2026/07/31/11_58_11`) 리뷰의
maintainability 발견사항 중 다수(‑ `build_files_section` 두 번째 예산 분기 무표시 누락,
`_default_branch_ref` 예외 미흡수, 모듈 최상단 docstring 의 깨진 불변식 서술, `_branch_changed_rels`
의 죽은 `subpath` 파라미터·"Mirrors X" 상호참조 누락 등)은 이미 코드에 반영돼 현재 상태에서
직접 확인 결과 해소돼 있었다. 아래는 **현재(post‑2R) 코드를 직접 Read 해 재확인한 뒤에도 남아 있는
항목만** 기재한다 — 이미 고쳐진 것을 다시 지적하지 않기 위해서다.

## 발견사항

- **[WARNING]** `build_files_section` 이 3개의 서로 다른 예산 초과 전략을 한 함수에 누적하며 계속 길어지고, 각 전략이 "안내문 길이도 예산에 포함시켜야 한다"는 같은 불변식을 각자 손으로 재계산한다
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:587`-`749` (함수 전체, 약 163줄) — 특히 `644`-`685`(header+diff 조차 초과할 때의 `global_note` 오버플로우 처리)와 `690`-`736`(콘텐츠 예산 할당 + `_notice_cost` 선반영/환급 산술)
  - 상세: 이 함수는 지금 (1) `max_total_size<=0`(예산 없음, `632`-`639`), (2) `base_size >= max_total_size`(header+diff 조차 초과, `644`-`685`), (3) 정상 케이스의 콘텐츠 예산 할당(`687`-`736`) 이라는 서로 다른 3개의 오버플로우 대응 코드 경로를 갖고 있다. 세 경로 모두 "생략/절단 안내문 자체도 문서 텍스트이므로 그 바이트 수를 예산에 포함시켜야 한다"는 동일한 불변식을 각자 별도의 누산 변수(`overflow`, `remaining_budget`+`refund`)로 재구현한다. 실제로 직전 라운드(2R, 커밋 `426f8bd40`)에서 바로 이 불변식을 빠뜨린 계상 누락(자신의 생략 안내 길이를 예산에 반영하지 않음, 실측 143,620 vs cap 143,605)이 CRITICAL 로 발견돼 고쳐졌고, 그 수정 자체가 또 하나의 유사한 분기를 새로 만들었다(`_notice_cost`/`refund`). 함수 하나가 "파일별 파트 조립 / 무예산 렌더 / diff‑only 오버런 처리 / 콘텐츠 예산 할당" 4가지 책임을 지고 있어 순환 복잡도가 이번 PR 을 거치며 계속 상승했다.
  - 제안: 세 오버플로우 경로를 이름 있는 헬퍼로 분리하고(예: `_render_unbounded`, `_render_diff_only_overflow`, `_allocate_content_budget`), "텍스트를 예산에 반영할 때는 안내문 후보 길이까지 포함해 계산한다"는 규칙을 단일 헬퍼(예: `_reserve_and_include(candidate_text, note_text, budget)`)로 뽑아 세 경로가 공유하게 하면, 이번 라운드에 나온 것과 같은 계상 누락 클래스가 구조적으로 재발하기 어려워진다.

- **[INFO]** 잘린 목록 상한이 이름 없는 매직 넘버 `10` 으로 두 곳에 반복된다 (1R·2R 리뷰에서 이미 지적, 두 라운드 모두 "비‑행동"으로 보류된 항목 — 현재도 동일하게 존재)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1221`(`for f in missing[:10]:`), `:1224`(`print(f"     … 외 {len(missing) - 10}개", ...)`)
  - 상세: `warn_if_committed_work_is_missing` 안에서 캡 값 `10` 이 리터럴로 두 번 등장한다. 동작은 `test_review_changeset_warning.py::test_long_lists_are_capped_but_counted` 로 이미 고정돼 있어 버그는 아니며, 두 라운드 연속으로 "고쳐도 되지만 급하지 않음"으로 판단된 항목이다. 다만 향후 이 상한을 조정할 때 한 곳만 고치는 실수를 유발하기 쉬운 자리라는 사실 자체는 그대로 남아 있다(참고로 같은 파일 `845`행의 비슷한 "… 외 N개" 패턴은 상한이 `20`으로 다르다 — 서로 다른 표시 목적이라 불일치라 보기는 어렵지만, 두 곳 다 이름 있는 상수는 아니다).
  - 제안: `_MAX_LISTED_MISSING_FILES = 10` 같은 모듈 상수로 추출(선택 사항).

- **[INFO]** `collect_context` 의 신규 지역 변수 `_rank_changed`/`_rank_plan_text` 만 이 파일의 언더스코어 프리픽스 컨벤션에서 벗어난다 (2R 리뷰에서 이미 지적, 미반영 상태로 유지)
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:452`-`453`
  - 상세: 이 파일에서 언더스코어 프리픽스는 지금까지 모듈 레벨 바인딩(예: import 실패 시 대체값)이나 프라이빗 함수/상수에만 쓰였고 함수 지역 변수에 붙은 전례가 없다. 바로 아래 중첩 함수 `_prioritized`(`457`행)·`_require_target`(`467`행)은 "중첩 함수명에 언더스코어" 라는 기존 관례를 따르는 반면, 이번에 추가된 지역 변수 두 개만 새 패턴(지역 변수에 언더스코어)을 도입했다. 동작에는 영향 없는 순수 스타일 편차다.
  - 제안: `rank_changed`/`rank_plan_text` 로 이름을 맞추거나(권장), 새 컨벤션으로 의도한 것이면 유지해도 무방 — 낮은 우선순위의 팀 판단 사항.

- **[INFO]** fresh-interpreter 테스트 보일러플레이트가 4개 파일에 복제된 채로 남아 있다 (repo 스스로 `plan/in-progress/harness-review-gate-ci-backstop.md` 의 defer 후속 3번으로 이미 추적 중)
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:39`-`68`(`_PREAMBLE`/`run_in_orchestrator`), `.claude/tests/test_prompt_omission_notice.py:41`-`81`, `.claude/tests/test_review_changeset_warning.py:44`-`72` (+ 기존 `test_consistency_context_budget.py`)
  - 상세: 서브프로세스 격리(`_lib` 네임스페이스 충돌 회피) 패턴이 4개 파일에 문자 그대로(~35줄씩) 반복된다. 각 파일 docstring 이 그 이유(fresh interpreter 필요성)를 반복 설명하는 것으로 보아 의도된 회피책이고, 이번 PR 이 새로 만든 부채가 아니라 기존 패턴(`test_consistency_context_budget.py`)을 답습한 것이며, plan 문서에 이미 후속 작업으로 등재돼 있다.
  - 제안: `.claude/tests/_harness.py` 에 `run_in_fresh_interpreter(module_path, snippet, arg=None)` 류의 공용 헬퍼를 만들면 ~140줄의 반복을 제거할 수 있다(이미 계획된 후속 작업이므로 이번 PR 범위 밖으로 처리해도 무방).

- **[INFO]** "origin 기본 브랜치 해석" 로직의 4번째 독립 구현 (plan 문서에 defer 로 이미 등재된 항목의 재확인)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1168`-`1189`(신규 `_default_branch_ref`) — 비교 대상: `.claude/hooks/_lib/branch_guard.py:73`-`114`(`_origin_default_branch`, 정본), `.claude/hooks/_lib/review_guard.py:201`-`214`(`_default_branch`, 이를 재사용), `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:443`(`diff_base = args.diff_base or "origin/main"` 리터럴)
  - 상세: 네 곳 모두 "origin 의 기본 브랜치를 구하라"는 동일 개념을 처리하지만 반환 형태(`origin/main` 접두 유무)까지 서로 다르다. `_lib` 네임스페이스 충돌(hooks 쪽 `_lib` vs skills 쪽 `_lib`) 해소가 선행돼야 실제 코드 공유가 가능하다는 이유로 `harness-review-gate-ci-backstop.md` 에 이미 defer 로 명시 등재돼 있다. 이번 diff 로 새로 발견된 사실은 아니며, 향후 기본 브랜치 정책이 바뀌면 네 곳을 모두 찾아 고쳐야 하는 drift 위험이 계속 존재한다는 점만 재확인한다.
  - 제안: 추가 조치 불필요(이미 추적·defer 확정됨). 이 리스트에 다섯 번째 구현이 늘지 않도록, 향후 유사 헬퍼를 새로 짤 때는 최소한 다른 3곳을 가리키는 "Mirrors X" 주석을 남기는 것을 권장(이번 diff 의 `_branch_changed_rels`가 그 패턴을 따른 좋은 선례).

## 요약

핵심 로직 변경(`evaluate_review(in_flight_ok=...)` opt-in 전환, `prioritize_bundle_files` 4계층 재배열, 생략/절단 안내 메커니즘)은 작고 목적이 분명하며, 왜 이렇게 짰는지·과거 어떤 결함을 재발시키지 않으려는지를 설명하는 docstring/주석이 매우 촘촘하다. 두 차례의 선행 리뷰 라운드에서 나온 CRITICAL 1건과 WARNING 다수(`_default_branch_ref` 예외 미흡수, 모듈 docstring 불변식 오류, `build_files_section` 두 번째 분기 무표시 누락, `_branch_changed_rels` 죽은 파라미터·상호참조 누락 등)가 실제로 코드에 반영돼 현재 상태에서 재확인되지 않는다 — 즉 반복 라운드가 유지보수성을 실질적으로 개선하는 방향으로 수렴했다. 남은 항목은 (1) `build_files_section` 이 세 가지 예산 전략을 한 함수에 누적하며 계속 길어지고 있다는 구조적 WARNING 1건과, (2) 매직 넘버·지역변수 네이밍·테스트 보일러플레이트 중복·기본 브랜치 해석 중복이라는 이미 두 차례 지적되었거나 plan 문서에 명시적으로 defer 된 INFO 4건뿐이다. 모두 동작에 영향 없는 저위험 항목이다.

## 위험도
LOW
