# Architecture Review

## 발견사항

- **[WARNING]** `evaluate_review()`가 push/stop 두 게이트의 서로 다른 보증 수준(hard block vs soft nudge)을 하나의 boolean 플래그로 스위칭
  - 위치: `.claude/hooks/_lib/review_guard.py:862` (`def evaluate_review(cwd: str | None = None, *, in_flight_ok: bool = False)`)
  - 상세: 이번 diff 는 in-flight 리뷰 억제가 `evaluate_review()` 내부에서 무조건 적용돼 push 하드게이트까지 30분간(`_IN_FLIGHT_TTL_SECONDS`) 열어주던 결함을, 키워드 전용 `in_flight_ok` 옵트인 파라미터로 스코프를 좁혀 고쳤다. Stop 훅(`guard_review_before_stop.py:344`)만 `True` 를 넘기고 push 훅(`guard_review_before_push.py`의 `_evaluate_over_targets`)은 위치 인자 1개(`evaluate(target)`)만 넘겨 기본값 `False` 를 그대로 쓴다. Fail-safe 기본값(옵트아웃이 기본)과 양방향 seam 테스트(`test_push_never_opts_into_the_in_flight_concession`, `test_stop_passes_in_flight_opt_in`, `EvaluateInFlightShortCircuitTest`)가 정확히 이 회귀 클래스를 고정하므로 실질 위험은 낮다. 다만 "공유 함수 + boolean 인자로 두 가지 다른 안전-보증 수준을 스위칭"하는 형태(flag argument)는 향후 세 번째 호출부가 추가될 때 다시 기본값에 의존하게 만드는 구조적 취약점을 남긴다.
  - 제안: 현재 테스트로 충분히 방어되나, 장기적으로는 `evaluate_review_for_push()` / `evaluate_review_for_stop()` 처럼 의도가 이름에 드러나는 두 개의 얇은 wrapper(내부적으로 공용 로직 위임)를 두면 "옵트인 인자를 빠뜨리는" 실수 자체가 시그니처 레벨에서 원천 차단된다.

- **[WARNING]** 브랜치 변경 파일 목록 계산 로직이 새 함수로 복제되어, 두 곳을 수동으로 동기화해야 하는 부담이 하나 더 늘어남
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:249` (`_branch_changed_rels`) vs `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:975` (`get_git_branch_diff_files`)
  - 상세: 두 함수 모두 `git diff --no-renames --name-only <ref>...`로 브랜치 변경 파일을 구하는 사실상 동일 로직이며 실패 시 반환 타입만 다르다(set vs list). `_branch_changed_rels`의 docstring 이 "Mirrors `code_review_orchestrator.get_git_branch_diff_files` (same flags, same three-dot rationale, different failure default) — change both."라고 스스로 명시할 만큼, 유지보수자가 한쪽만 고치면 drift 가 난다는 것을 코드 자신이 인정한다. `plan/in-progress/harness-review-gate-ci-backstop.md`가 이미 추적 중인 "origin 기본 브랜치 해석 4곳 중복" 항목은 `_default_branch_ref`/`_default_branch`/`_origin_default_branch`/`diff_base` 리터럴만 나열하고 이 함수 쌍(브랜치 diff 파일 목록 자체)은 명시하지 않는다 — 즉 같은 결함 클래스의 새 인스턴스가 그 백로그의 스코프 밖에 하나 더 생겼다.
  - 제안: 기존 백로그 항목(`harness-review-gate-ci-backstop.md` "신규 후속 (defer)")의 스코프를 "git 기반 브랜치 diff 헬퍼 중복"으로 넓혀 이 함수 쌍도 명시적으로 포함시키거나, 최소한 신규 후속 항목으로 등재한다.

- **[INFO]** `build_files_section()`의 예산 배분 로직이 이번 수정으로 한 단계 더 복잡해짐 — 같은 함수 안에서 유사한 예산-회계 버그가 재발할 표면이 넓음
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:587` (`build_files_section`), 특히 693-736번째 줄의 `_notice_cost`/`refund`/`remaining_budget` 계산부
  - 상세: 한 함수가 (a) 헤더/diff/본문 조립, (b) 두 개의 독립된 overflow 분기별 바이트 예산 산술, (c) 잘림 안내문 자체의 길이를 예산에 되먹이는 회계까지 모두 담당한다. 이번 PR 이 고친 버그("생략 안내문 길이를 예산에서 빼먹어 143,620 vs cap 143,605 로 초과")와, PR 이 스스로 "고치지 않았다"고 명시한 자매 결함(`test_prompt_omission_notice.py`의 `test_diff_only_overflow_branch_also_announces`가 문서화 — diff-only 분기, 실측 1,681 vs cap 1,500, `harness-review-gate-ci-backstop.md` 신규 후속 1번으로 이미 추적)은 "누산 예산과 사후 추가되는 안내문 길이가 서로 안 맞는" 동일 근본 원인 클래스다. 이미 유닛 테스트로 두텁게 덮여 있으나(`test_prompt_omission_notice.py` 8건), 회계 자체가 이름 있는 헬퍼로 분리돼 있지 않아 세 번째 유사 버그가 재발할 표면이 여전히 넓다.
  - 제안: `_notice_cost` 기반 refund/reserve 계산을 `build_files_section` 밖의 독립 함수(예: `_reserve_notice_budget(file_parts, indices, budget)`)로 추출해 그 자체를 단위 테스트 가능하게 만들면, 이미 문서화된 "diff-only 분기" 잔여 결함도 같은 헬퍼로 통합 수정할 수 있다.

- **[INFO]** "Critical 하향 금지"/"planner 인계" 정책의 유일한 집행 지점이 코드가 아니라 LLM 에이전트의 프롬프트 준수 여부
  - 위치: `.claude/agents/consistency-summary.md:46-57` (§요약 지침 3·4, 신설) / `.claude/hooks/_lib/review_guard.py:140` (`_BLOCK_LINE = re.compile(r"BLOCK:\s*(YES|NO)", re.IGNORECASE)`, 변경 없음)
  - 상세: `plan/in-progress/harness-review-gate-ci-backstop.md`의 "신규 후속 3건 (defer)" 항목 2("하향 금지 정책에 기계적 backstop 이 없다")로 이미 스스로 추적 중이고, 사용자가 정책 방향(하향 금지 + planner 인계) 자체는 확정했다. 아키텍처 관점에서 재확인하면: 이번 변경이 없앤 것은 "요약 에이전트가 재량으로 하향할 수 있는 정당성의 여지"이지, "요약 에이전트가 규약을 어기고도 게이트를 통과시킬 수 있는 구조적 가능성" 자체는 아니다. `[CRITICAL]` 개수와 최종 `BLOCK:` 값의 불변식을 기계적으로 대조하는 코드가 없는 한, 이 가드는 여전히 100% prompt 준수에 의존한다. 신규 발견은 아니며 재확인 차원.
  - 제안: 이미 계획된 대로, orchestrator 가 checker 리포트의 `[CRITICAL]` 개수를 세어 최종 `BLOCK:` 과 모순되면 stderr 경고/반환 플래그를 내는 backstop 을 후속 우선순위로 진행.

- **[INFO]** 두 orchestrator에 걸쳐 "예산 초과로 생략된 파일을 이름으로 알린다"는 동일 설계 원칙이 서로 다른 자료구조 위에서 독립적으로 재구현됨
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:561` (`_omitted_content_note`) / `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:628-647` (`OMITTED_FILES_HEADING`/`_omitted_notice`)
  - 상세: 전자는 `change_info` 딕셔너리 리스트(헤더/diff/full_content 섹션)를, 후자는 마크다운 파일 번들 텍스트(`#### \`path\`` 마커)를 다루므로 도메인이 실제로 다르다 — 강한 결합은 부적절하지만 "생략을 알린다"는 공통 정책 문구/휴리스틱은 공유 유틸리티로 뽑아낼 여지가 있다. 현재는 이미 알려진 `_lib` 네임스페이스 충돌(hooks 쪽 `_lib` vs 각 skill 의 독립 `_lib`)로 두 스크립트 사이 직접 코드 공유가 막혀 있고, 이는 `harness-review-gate-ci-backstop.md`의 "fresh-interpreter 테스트 보일러플레이트가 4개 파일에 복제" 항목과 같은 원인이다.
  - 제안: 별도 조치 불필요 — `_lib` 네임스페이스 통합이 선행되면 자연히 해소될 항목으로 기존 백로그에 편입 가능.

- **[INFO]** 사소한 주석 표현 드리프트 — 같은 파일 안에서 이번 수정이 "억제 대상은 nudge 뿐, gate 아님"이라는 불변식을 명확히 했는데, 인접한 옛 주석 한 줄이 예전 표현을 그대로 남김
  - 위치: `.claude/hooks/_lib/review_guard.py:758-760`
  - 상세: `_code_review_in_flight()`의 758-760번째 줄 주석("a stray/empty file in the tree must not silently suppress **the gate**")은 이번 diff 로 갱신되지 않았다. 바로 위 docstring(741-745번째 줄)은 "The push guard remains the hard backstop — but that is NOT this function's doing... Read as an unconditional guarantee this docstring was false"라고 정확히 정정했다. 기능 결함은 아니고 순수 코멘트 드리프트.
  - 제안: "suppress the gate" → "suppress the nudge" 로 통일(1단어 수정, 후속 커밋에서 처리 가능).

## 요약

이 변경의 핵심은 `evaluate_review()`가 in-flight 리뷰 억제를 무조건 적용해 push 하드게이트까지 30분간 열어주던 구조적 결함을, 키워드 전용 `in_flight_ok` 옵트인 파라미터로 스코프를 좁혀 고친 것이다 — fail-safe 기본값(옵트아웃)과 양방향 seam 테스트로 회귀를 코드 레벨에서 봉쇄한 좋은 설계다. consistency/code-review 두 orchestrator 의 컨텍스트 번들링에는 tier 기반 우선순위 재정렬(`prioritize_bundle_files`)과 예산-초과 안내 메커니즘이 추가돼, "게이트가 실제로는 대상 문서를 본 적이 없는데 BLOCK:NO 를 낸다"는 8회 재발 결함군을 구조적으로 줄였다. 레이어 경계(hooks=정책 위임, orchestrator=세션 준비 전용·모델 미호출)와 순환 의존성 부재는 유지되고 있고, `consistency-summary.md`에 신설된 "planner 인계" 경로는 권한 경계를 넘는 문제를 적절한 역할로 넘기는 합리적인 에스컬레이션 패턴이다. 남은 아키텍처 부채(4곳+로 분산된 브랜치-해석/diff 로직, `_lib` 네임스페이스 충돌, 하향-금지 정책의 프롬프트 전용 집행)는 대부분 `plan/in-progress/*.md` 두 문서에 원인·근거와 함께 투명하게 추적돼 있어 은폐된 부채가 아니며, 이번 리뷰가 추가로 짚은 것은 그중 일부(브랜치 diff 헬퍼 복제 1건)가 기존 백로그 스코프 밖에 있다는 점과 `build_files_section()`의 예산 회계가 같은 함수 안에서 두 번째로 유사한 버그를 낸 지점이라는 점 정도다.

## 위험도
LOW
