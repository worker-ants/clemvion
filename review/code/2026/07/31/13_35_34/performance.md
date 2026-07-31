# 성능(Performance) 리뷰 보고서

## 메타 노트 — 대형 파일 3개는 프롬프트에 안 실려 원본을 직접 Read

`_prompts/performance.md`에서 `.claude/hooks/_lib/review_guard.py`,
`.claude/skills/code-review-agents/scripts/_probe_main.py`,
`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`,
`.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`,
`.claude/tests/README.md`는 크기 제한으로 본문이 비어 있었다. 다섯 파일 모두 `Read`와
`git diff origin/main...HEAD -- <path>`로 직접 열어 검토했고, 아래 위치는 조립 프롬프트가 아니라
**원본 소스 파일의 실제 줄 번호**(Read 기준)다. 이 리뷰는 `origin/main...HEAD` 전체 diff(3라운드
누적: in-flight 스코프 축소, consistency 번들 4-tier 재정렬, changeset 누락 경고, 리뷰 프롬프트
omission notice)를 대상으로 했으며, 이전 라운드 리뷰(`review/code/2026/07/31/11_07_48/performance.md`)
에서 이미 지적·처분된 항목은 현재 diff에서 상태가 바뀌었는지만 재확인하고 중복 보고하지 않았다.

## 발견사항

- **[WARNING]** 미참조 중복 스크립트(`_probe_main.py`, 1,304줄)가 리뷰/일관성 도구의 컨텍스트
  예산을 실측 가능하게 잠식하며, 실행되면 이 PR이 방금 고친 예산-초과 버그를 그대로 재현하는
  회귀 지뢰이기도 하다
  - 위치: `.claude/skills/code-review-agents/scripts/_probe_main.py` (신규 파일 전체, git status
    `A`, 1,304줄)
  - 상세: 저장소 전체에서 이 파일을 import·실행·문서화하는 곳은 0건이다(`grep -rln "_probe_main"`
    확인 — 이번 리뷰 세션 산출물 외 히트 없음). `code_review_orchestrator.py`와 직접 diff하면
    유일한 차이가 이번 PR이 그 파일에 추가한 예산 계상 로직(`_omitted_content_note`,
    `_aggregate_omission_note`, `_render`, `warn_if_committed_work_is_missing` 등)이 **빠진
    구버전 스냅샷**이라는 것만 드러난다 — 즉 순수한 스크래치 사본이다(scope-reviewer가 같은
    대상을 CRITICAL로 별도 지적함; 근거는 "의도 범위 이탈", 이 항목의 근거는 성능/자원 비용이라
    관점이 다르다). 성능 관점에서 구체적으로 측정되는 비용 두 가지: (1) **이 리뷰 세션 자신의
    프롬프트 조립에서 실제로 발현** — `_prompts/performance.md`를 포함한 14개 reviewer 프롬프트
    전원이 이 파일에 대해 "55,309자라 전혀 실리지 않았다"는 생략 안내를 내야 했다. 즉 이 orphaned
    파일이 실제로 이번 세션의 리뷰 컨텍스트 예산 한 자리를 점유해, 다른 실제 검토 대상 콘텐츠가
    밀려날 뻔한 상황을 만들었다(이번 PR이 막 고친 "예산이 무관한 콘텐츠에 소진된다"는 결함 클래스를
    이 파일 스스로 재현) — omission-notice 메커니즘 덕에 이번엔 침묵 유실 없이 안내는 됐지만,
    애초에 없어도 됐을 부담이다. (2) `if __name__ == "__main__": main()`을 가진 완전한 실행형
    CLI라, 향후 누군가 실수로 이 파일을 `code_review_orchestrator.py` 대신 돌리면 이번 3R 수정이
    고친 "파일이 안내 없이 통째로 누락되는" CRITICAL이 그대로 재현된다.
  - 제안: 삭제(`git rm`). 수정 전/후 비교용으로 실측에 썼다면 저장소 밖 scratch에 두거나, 최소한
    실행 진입점(`if __name__ == "__main__"` 블록)을 제거해 회귀 재현 가능성을 없앨 것. scope-reviewer의
    CRITICAL과 동일 파일이므로 한 번의 삭제로 두 발견 모두 해소된다.

- **[INFO]** 생략-안내 예산 계상용 `_notice_cost()`가 같은 인덱스에 대해 두 번 계산됨(캐싱 없음)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:703-716`
    (`_notice_cost` 정의 703-706, 전체 합산 708, 루프 내 재계산 713)
  - 상세: `remaining_budget -= sum(_notice_cost(i) for i in content_indices)`(708줄)에서
    `content_indices`의 모든 파일에 대해 `_notice_cost(i)`를 한 번씩 호출해 전체 예약분을 뺀 뒤,
    바로 아래 `for i in content_indices:` 루프 안에서 `refund = _notice_cost(i)`(713줄)로 **동일
    인덱스에 대해 다시 호출**한다. `_notice_cost`는 매번 `_omitted_content_note()`로 전체 안내
    문자열(파일 경로 + 콤마-포맷 크기 포함)을 새로 만들고 `len()`만 취해 버리므로, 결과를 재사용하지
    않고 매 호출마다 불필요한 문자열 객체를 새로 만든다(카테고리: 중복 계산 + 불필요한 객체 생성).
    정상 리뷰 배치 크기(`REVIEW_BATCH_SIZE=50`)에서는 체감 비용이 없지만, 이번 커밋이 직접 검증한
    대규모 시나리오(n=1,200)에서는 호출·문자열 생성 횟수가 이유 없이 2배가 된다.
  - 제안: `notice_costs = {i: _notice_cost(i) for i in content_indices}`처럼 한 번만 계산해
    `sum()`과 이후 루프 양쪽에서 재사용.

- **[INFO]** 예산 초과(생략 파일 다수) 분기에서 `_render()`가 전체 파일 목록을 두 번 조립하고 첫
  결과를 통째로 버림 — 정확히 대규모(n 큰) 시나리오에서 발동
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:738-771`
    (`_render` 정의 738-750, 첫 호출 752, 조건부 재호출 767)
  - 상세: `body = _render(per_file_notice=True)`(752줄)가 `file_parts` 전체(header+diff+notice)를
    조립한 뒤, 그 결과가 `max_total_size`를 넘고 `omitted`가 비어 있지 않을 때만
    `body = _render(per_file_notice=False)`(767줄)를 다시 호출해 완전히 새로 조립한다 — 첫 번째
    렌더 결과는 전량 폐기된다. 이 재렌더링이 발동하는 조건은 정확히 이번 수정이 겨냥한 "파일 수가
    많아 안내 자체가 예산을 넘는" 케이스(커밋 메시지 실측: n=1,200 → 192,087자)이므로, 파일 수가
    가장 많을 때 전체 조립 비용이 하필 정확히 2배가 된다. 다만 절대 비용은 작다 — 1회성 CLI 준비
    단계의 순수 in-memory 문자열 결합(`str.join`, O(n) 총 길이 비례)이라 n=1,200에서도 수십~수백ms
    이내로 추정되고, 이 뒤에 이어지는 LLM sub-agent 호출(수십 초~수 분)에 비하면 무시할 수준이라
    WARNING이 아닌 INFO로 남긴다.
  - 제안: 급하지 않음. 필요해지면 렌더링 전에 "per-file notice 총량이 남은 예산을 넘는지"를
    산술적으로 먼저 판정해 모드를 한 번만 정하고 렌더링을 1회로 줄일 수 있다(현재는 실제로
    렌더링해 크기를 재본 뒤에야 판단).

- **[INFO]** (참고, 상태 변화 없음) `consistency_orchestrator.collect_context()`의
  `plan/in-progress` 이중 순회+read, `tier()`의 번들별 반복 substring 스캔은 이번 diff로 새로
  도입되지도, 변경되지도 않았다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` —
    `_rank_plan_text = "\n".join(read_text_file(p) for p in collect_markdown_files(plan_dir))`
    (`collect_context` 내, `_prioritized` 헬퍼 직전)과 이후 별도의
    `plan_files = collect_markdown_files(plan_dir, exclude_paths=excluded)` 호출(같은 함수 하단)이
    같은 `plan_dir`을 walk+read 두 번 하는 구조, 그리고 `prioritize_bundle_files`의 `tier()`
    클로저가 `scope_files`/`other_spec_files`/`convention_files` 세 번들 각각에서 독립적으로
    `plan_text` 전체를 substring 스캔하는 구조.
  - 상세: 두 항목 모두 `review/code/2026/07/31/11_07_48/performance.md`에서 이미 INFO로 보고됐고,
    해당 RESOLUTION.md에서 "INFO 다수 — 무조치(비-행동)"로 명시적으로 처분됐다(현재 규모 spec
    9.2MB/383파일, plan/in-progress 1MB/30파일에서 체감 병목 아님, 두 코퍼스 모두 상시 성장이라
    향후 스케일 관찰 항목). 이번 3R 커밋은 이 두 지점을 건드리지 않았으므로 새 발견으로
    재기재하지 않고 상태 미변경만 확인한다. (같은 라운드에서 이전에 함께 지적됐던 "동일 git diff
    범위 이중 subprocess 조회" WARNING은 `_prioritized`/`_rank_changed` 도입으로 **수정 완료**를
    확인했다 — `_branch_changed_rels`가 이제 `collect_context`당 1회만 호출되고 scope별 결과는
    prefix 필터로 파생된다.)

## 요약

이번 라운드(3R)의 실제 코드 변경 — omission-notice 예산 계상, `--staged` 면제, 리팩터된
`_branch_changed_rels`/`_notice_cost`/`_render` — 은 모두 CLI 오케스트레이터가 리뷰/일관성 세션
준비 단계에서 **한 번** 수행하는 로직으로, 새로 도입된 N+1 호출·O(n²) 누적·블로킹 I/O 병목은
없었다. `_notice_cost` 중복 계산과 `_render` 이중 호출은 실제로 존재하는 비효율이지만 둘 다 O(n)
선형성을 유지하는 상수배 낭비이고, 발동 규모(n=1,200)에서도 절대 비용은 이후의 LLM 호출에 비해
무시할 수준이라 INFO로 남긴다. 가장 실질적인 성능 관련 발견은 코드 로직이 아니라 **이번 커밋이
통째로 끌고 들어온 미참조 스냅샷 파일(`_probe_main.py`, 1,304줄)**이다 — scope 위반(CRITICAL)과는
별개로, 이 파일 자체가 "예산이 무관한 콘텐츠에 소진된다"는, 이 PR이 고치려는 바로 그 결함 클래스를
이 리뷰 세션 안에서 스스로 재현했다는 점에서 성능 렌즈에서도 실측된 비용이 있다. 삭제만으로 즉시
해소되므로 WARNING으로 표시한다.

## 위험도

LOW — 실행 로직 자체의 알고리즘적 결함은 없음. 유일한 실질 항목(`_probe_main.py`)은 삭제 한 번으로
해소되는 자원 낭비이자 잠재적 회귀 지뢰이며, 다른 리뷰어(scope)가 같은 대상을 더 강한 근거로 이미
CRITICAL 처리했다.
