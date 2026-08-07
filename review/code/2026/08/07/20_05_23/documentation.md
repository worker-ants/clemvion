# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `_fatal/<name>` sentinel 의 "영구성"을 과장하는 트리 다이어그램 주석
  - 위치: `.claude/skills/code-review-agents/README.md:118`
  - 상세: 산출물 디렉토리 구조 다이어그램에 `_fatal/security ← 있으면 그 reviewer 는 영구 실패로
    판정됨` 이라는 설명이 추가됐다. 그러나 같은 PR 의 `.claude/_shared/retry_state.py`
    `reconcile_state_with_disk` 구현은 `on_disk`(리포트 존재) 를 `missing`/`fatal_recorded` 보다
    먼저 판정하므로, sentinel 이 남아 있어도 **나중에 리포트가 생기면 success 가 이긴다** —
    이 사실은 `.claude/tests/test_retry_state_shared.py::test_a_sentinel_does_not_outrank_a_report_that_arrived_later`
    로 이 PR 자신이 직접 pin 하고 있고, `retry_state.py` 모듈 docstring 의 "잔여 3" 항목도
    "판정은 정확하다 — success 가 이긴다" 라고 명시한다. `_fatal/` 이 "terminal bucket"인 것은
    맞지만(=`/loop` 가 자동 재시도하지 않음), README 의 "영구"(permanent) 라는 단어는 수동/직접
    Agent 재실행으로 리포트가 새로 생기면 조용히 뒤집힌다는 사실을 가린다.
  - 제안: "영구 실패" 대신 "`/loop` 가 자동 재시도하지 않음(단, 새 리포트가 생기면 success 로
    되돌아감)" 처럼 정확한 표현으로 수정.

- **[WARNING]** shared `retry_state.py` 변경(fatal sentinel)이 세 소비자 중 한 곳의 문서에만 반영됨 — merge-coordinator
  - 위치: `.claude/skills/merge-coordinator/README.md:61-83` (산출물 디렉토리 구조), `:85-91`
    (`_retry_state.json` 추가 필드 — "기본 필드는 `../code-review-agents/README.md` 참고"로
    위임)
  - 상세: 이번 diff 의 `merge_coordinator_orchestrator.py` 변경으로 `_apply_status_update` /
    `_reconcile_state_with_disk` 모두 조건 없이 `_shared/retry_state.py` 로 위임하게 됐다(그
    전엔 `--update` 자체가 이 파일에 없었다 — `grep` 실측: `_retry_state_lib.apply_status_update`
    호출 1건). 즉 `retry_state.apply_status_update` 안의 `_record_fatal` 이 merge-coordinator
    세션에도 그대로 적용되어, `review/merge/<...>/_fatal/<analyzer>` sentinel 파일이 새로 생길 수
    있다. 그런데 merge-coordinator/README.md 의 세션 디렉토리 트리(예시)는 여전히 `_fatal/` 을
    보여주지 않고, "기본 필드는 code-review-agents/README.md 참고"라는 위임 문구만으로는 이
    구조 변화가 merge-coordinator 에도 적용된다는 사실이 드러나지 않는다(code-review-agents
    README 는 이번에 갱신됐지만 merge-coordinator README 는 diff 에 없다).
  - 제안: merge-coordinator/README.md 의 트리 예시에도 `_fatal/` 항목 한 줄 추가(또는 "기본
    필드/구조는 code-review-agents/README.md 와 동일, `_fatal/` 포함" 명시).

- **[WARNING]** 같은 이유로 consistency-checker 쪽 운영 함정 안내 누락
  - 위치: `.claude/skills/consistency-checker/SKILL.md:92-104` (fallback 수동 Agent 경로 절)
  - 상세: `code-review-agents/README.md` 에는 이번에 "**운영 함정 — fatal 을 손으로 해제할
    때**" 절이 추가되어, `_retry_state.json` 에서 이름만 지우면 다음 재조정이 `_fatal/<name>`
    sentinel 을 보고 조용히 되살린다는 것과 올바른 해제 절차(`--update ... --status
    rate_limit` 또는 JSON+sentinel 동시 삭제)를 안내한다. `consistency_orchestrator.py` 는
    같은 `_shared/retry_state.py` 를 그대로 쓰므로 동일한 함정이 그대로 존재하는데,
    `consistency-checker/SKILL.md` 의 대응 절(커밋된 세션을 손으로 고치는 방법을 설명하는
    바로 그 절)에는 이 sentinel 얘기가 전혀 없다. 세 소비자 중 하나(code-review-agents)에만
    안내가 실려 있어, consistency-check 세션을 손으로 정리하는 운영자는 같은 함정에
    무방비로 걸릴 수 있다.
  - 제안: 해당 절에 "code-review-agents/README.md §운영 함정 참고 — 동일하게 적용됨" 한
    줄 링크만 추가해도 충분.

- **[WARNING]** 테스트 카탈로그 설명이 이번 PR 이 잡은 회귀(가장 중요한 클래스)를 언급하지 않음
  - 위치: `.claude/tests/README.md:80`
  - 상세: `test_branch_diff_shared.py` 신규 카탈로그 행은 leading-space 버그·C-quote 버그·
    trailing-space 버그·three-dot 계약만 언급하고, 실제 테스트 파일에 있는
    `UndecodableGitOutputTest` 클래스(`_run_git_raw` 의 `except` 를 좁혔다가
    `UnicodeDecodeError`(=`ValueError`, `OSError` 아님)가 새어나가 orchestrator 를
    **크래시**시키던 결함과 그 수정(`errors="surrogateescape"` + `except Exception` 복원)을
    pin)는 언급이 없다. 정작 `plan/in-progress/harness-review-gate-followups.md` §6 처분
    기록은 이걸 "**리뷰가 진짜 회귀를 하나 잡았다 (requirement, MEDIUM)**" 이라고 부를 만큼
    비중 있게 다룬다. 이 카탈로그의 존재 이유(`test_tests_readme_catalog.py` 설명: "테스트
    목적을 아무도 기록하지 않은 파일" 을 막는 것)에 비추면, 이 PR 이 발견한 가장 심각한
    결함의 회귀 테스트가 카탈로그에서 안 보이는 것은 그 목적에 어긋난다.
  - 제안: 해당 행에 `UndecodableGitOutputTest`(surrogateescape 디코딩 + 실패 계약 복원)
    한 문장 추가.

- **[INFO]** plan 문서 내 반증된 전제가 한 곳에서만 정정됨
  - 위치: `plan/in-progress/harness-review-gate-followups.md:152-154` (item "6." 의 보존된
    "원문")
  - 상세: 같은 파일 상단(라인 111-150)에서 §6 은 "선행 조건 전제가 반증됐다"며
    `_lib` 네임스페이스 충돌 해소가 선행 조건이 아니었음을 상세히 정정한다. 그런데 바로 아래
    (152-154행)에 보존된 "원문"은 여전히 "위 '기본 브랜치 해석 4곳' 과 같은 뿌리(=
    `_lib` 충돌 해소 선행)" 이라는, 방금 반증된 바로 그 문장을 정정 표시 없이 그대로 담고
    있다. 이 파일의 다른 곳(365-377행, "origin 기본 브랜치 해석 4곳" 절)에서는 같은 반증
    내용에 대해 `> **정정 (2026-08-07, §6 처분 중).**` 인라인 노트를 명시적으로 붙였다 —
    즉 저자는 이 습관을 이미 알고 실천하고 있는데, item 6 의 "원문" 문단에는 같은 처리를
    빠뜨렸다. 파일 자신이 선언한 컨벤션("원문은 그대로 옮긴다", 20-21행)에는 부합하지만,
    같은 PR 안에서 동일 전제에 대한 정정 처리가 두 곳에서 다르게 이뤄진 것은 사소한
    비일관성이다.
  - 제안: item 6 의 "원문" 문단 앞에도 "(반증됨 — 위 처분 요약 참고)" 한 줄만 추가하면 두
    처리 방식이 일치한다. 급하지 않음.

## 요약

이번 변경은 코드 자체의 문서화 수준이 매우 높다 — `git_probe.py`/`retry_state.py` 의 신규
함수(`_run_git_raw`, `branch_diff_files`, `fatal_sentinel_path`, `fatal_on_disk`,
`_record_fatal`)는 설계 근거·측정치·거부된 대안까지 담은 상세한 docstring 을 갖추고 있고,
`code-review-agents/README.md`·`.claude/tests/README.md` 도 새 동작(`_fatal/` 디렉토리,
디스크 심판 원칙, 손으로 해제할 때의 함정)을 성실히 반영했다. 다만 이 리뷰에서 실제로 값이
있었던 지점은 "공유 모듈의 동작 변경이 세 소비자(code-review-agents / consistency-checker /
merge-coordinator) 모두에 적용되는데 문서 갱신은 한 곳에만 이뤄졌다"는 패턴이다 — README
트리 다이어그램의 `_fatal/` 누락(merge-coordinator), 운영 함정 안내 누락(consistency-checker),
그리고 README 자체의 "영구 실패" 라는 표현이 같은 PR 의 테스트가 반증하는 내용이라는 점이다.
모두 코드 정확성과는 무관한 순수 문서 갭이며 차단 사유는 아니다.

## 위험도

LOW
