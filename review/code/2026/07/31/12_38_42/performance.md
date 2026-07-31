# 성능(Performance) Review

## 발견사항

- **[INFO]** `prioritize_bundle_files`/`tier()`의 plan-mention 판정이 O(후보 파일 수 × plan 말뭉치 크기) 부분 문자열 탐색이다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:311` (`tier()` 내부 `plan_text and (rel in plan_text or os.path.basename(rel) in plan_text)`), 호출 경로 `:453-465` (`_rank_plan_text`/`_prioritized` 정의), `:581-582` (`other_spec_files`/`convention_files` 무조건 랭킹 — 모드 분기 밖이라 `--spec`/`--plan`에서도 실행됨)
  - 상세: `tier(path)`는 각 후보 파일마다 `rel`/`basename`이 `plan_text`(= `plan/in-progress/**/*.md` 전체를 이어붙인 문자열, `:453-455`)에 부분 문자열로 포함되는지 검사한다. `other_spec_files`(이 저장소 현재 113개)와 `convention_files`(270개) 전량이 `collect_context`에서 무조건 이 랭킹을 거치며(`:581-582`), 이는 `--spec`/`--plan`처럼 target이 이미 고정된 모드에서도 동일하게 실행된다. 실제 모듈을 이 저장소 상태로 직접 호출해 실측: `plan/in-progress` 58개 파일(675,228자) read+join 2.6ms, `prioritize_bundle_files(other_spec_files)` 16.2ms, `prioritize_bundle_files(convention_files)` 3.5ms — 합계 약 22ms/세션. 오늘 기준으로는 checker fan-out(초~분 단위 LLM 호출)에 완전히 묻히는 크기지만, 이 값은 plan 말뭉치 크기(m)와 후보 파일 수(n) 모두에 비례해 커지는 O(n×m) 패턴이고, 두 코퍼스 모두 이 프로젝트에서 계속 성장 중이다(이 티켓 자체가 "문서 개수 증가로 컨텍스트 예산이 밀린다"는 문제의 수정이라 향후 성장이 전제된 변경).
  - 제안: 현재는 조치 불요. 값이 커지면 `plan_text`에서 후보 경로/basename 전체를 하나의 정규식 alternation(`re.compile("|".join(re.escape(x) for x in candidates))`)으로 단 한 번만 스캔해 매칭 집합을 만들고, 이후 각 파일은 그 집합에 대한 O(1) 멤버십 조회로 대체하면 O(n×m) → O(m+n)으로 낮출 수 있다.

- **[INFO]** `build_files_section`에서 `_notice_cost`가 같은 인자로 두 번 계산된다
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:703-716`
  - 상세: 708행 `remaining_budget -= sum(_notice_cost(i) for i in content_indices)`가 예산 확보를 위해 모든 `content_indices`에 대해 `_notice_cost`를 한 번 계산하고, 바로 아래 루프의 713행 `refund = _notice_cost(i)`가 같은 `i`에 대해 또 계산한다 — 콘텐츠가 포함되는 파일들과 루프가 멈추는 경계 파일까지는 동일 인자로 `_omitted_content_note` 포맷팅이 이중 실행된다. 다만 이 계산은 짧은 f-string 포맷팅이고 대상 파일 수(리뷰 세션당 통상 수십 개 이하)를 감안하면 체감 비용은 마이크로초 단위라 실질적 영향은 미미하다.
  - 제안: `notice_costs = {i: _notice_cost(i) for i in content_indices}`로 한 번만 계산해 캐싱한 뒤 708행·713행 모두 그 딕셔너리를 참조하도록 하면 중복이 사라진다.

- **[INFO] (이번 diff가 도입/악화한 결함 아님 — 인접 관찰)** Stop 경로에서 `evaluate_review(in_flight_ok=True)` 한 번의 호출 안에 `review/code/**` 전체 순회가 두 번 일어난다
  - 위치: `.claude/hooks/_lib/review_guard.py:730-767` (`_code_review_in_flight`), `:382-390` (`_iter_summaries`, `:517-547` `_newest_resolved_review_mtime`을 통해 호출), 호출 지점 `:901`·`:912`
  - 상세: Stop 훅(`guard_review_before_stop.py`)은 항상 `in_flight_ok=True`로 호출하므로, 진행 중인 리뷰가 없는 통상적인 경우 `_code_review_in_flight`가 `review/code/**`를 `os.walk`로 완전 순회한 뒤(빈손으로 반환) 곧바로 `_newest_resolved_review_mtime`이 `_iter_summaries`로 **같은 트리를 다시** 완전 순회한다. 이 저장소로 실측: `review/code` 아래 세션 디렉터리 829개, 두 순회 합산 약 37ms(`_iter_summaries` 19ms + `_code_review_in_flight` 18ms). 이번 diff는 이 이중 순회를 새로 만들지 않았다 — 오히려 push 경로(`in_flight_ok=False`, 901행)는 단락평가로 `_code_review_in_flight` 호출 자체를 건너뛰게 되어 순회 1회로 줄었다(diff 자체의 개선 효과). Stop 경로만 기존 이중 순회가 그대로 남는다. `review/**` 산출물은 gitignore 대상이 아니라 세션마다 커밋되어 누적되므로(현재 829개, 최근 며칠 사이에도 계속 증가) Stop 훅이 **매 턴 종료마다** 이 비용을 지불하며, 저장소 나이와 함께 선형으로 늘어난다.
  - 제안: 이번 PR 범위는 아니지만, 후속 작업으로 두 순회를 하나의 `os.walk` 패스로 합쳐(디렉터리마다 `meta.json`/`SUMMARY.md` 존재 여부를 동시 판정) 실질 비용을 절반으로 줄일 수 있다.

- **[INFO] (참고, 재발견 아님)** 신규 테스트 3개(`test_consistency_bundle_priority.py`/`test_prompt_omission_notice.py`/`test_review_changeset_warning.py`)가 각각 `run_in_orchestrator` 헬퍼로 테스트마다 fresh Python 서브프로세스를 스폰한다. 순수 테스트 스위트 실행 시간에만 영향(프로덕션 경로 아님)이고, 동일 보일러플레이트의 4-파일 중복은 `plan/in-progress/harness-review-gate-ci-backstop.md`의 "신규 후속 3건 (defer)" 항목 3에 이미 추적돼 있어 별도 신규 발견으로 다시 올리지 않는다.

## 요약

이번 변경은 리뷰/일관성 게이트 harness 의 프롬프트 예산·랭킹·in-flight 판정 로직을 다듬는 PR로, 성능에 실질적 위험을 더하는 지점은 없었다. 오히려 긍정적으로 볼 지점이 있다 — `consistency_orchestrator.py`의 `_branch_changed_rels`는 브랜치 diff 를 세 번들(scope/related_specs/conventions) 각각이 아니라 `collect_context` 전체에서 **단 한 번**만 서브프로세스로 호출해 재사용하도록 명시적으로 설계됐고(주석에 "a subpath parameter would only re-spawn git per bundle"이라고 왜 안 했는지까지 남겨둠), `code_review_orchestrator.py`의 새 `warn_if_committed_work_is_missing`/`_default_branch_ref`도 루프 없이 단발 호출이며, 모든 신규 git 서브프로세스 호출에 timeout 이 걸려 있어 훅이 걸리는(hang) 경로를 만들지 않는다. 실측 가능한 두 개의 새 알고리즘 패턴(`tier()`의 부분 문자열 탐색, `_notice_cost` 중복 계산)은 모두 이 저장소의 현재 데이터 규모에서 초 단위는커녕 수십 ms 이하로, LLM 서브에이전트 fan-out(초~분 단위)에 완전히 묻히는 크기임을 실측으로 확인했다. 다만 두 패턴 모두 코퍼스/파일 수가 늘어날수록 비례해 나빠지는 O(n×m) 성격이라 "지금은 괜찮지만 공짜로 스케일하지는 않는" 항목으로 INFO 처리했고, `review_guard.py`의 Stop 경로 이중 `os.walk`는 이번 diff 의 결함이 아니라 인접 관찰로만 기록했다(오히려 push 경로는 이번 diff 로 순회 1회 감소).

## 위험도
LOW
