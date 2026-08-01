# 요구사항(Requirement) Review — round 9

## 검증 방법론 (측정 기반, 요청에 따라 명시)

프롬프트 번들은 전체 파일(full-file context)이라 diff 가 아니었으므로, 먼저
`git diff $(git merge-base HEAD origin/main)...HEAD -- .claude spec plan codebase`
로 **실제 이번 브랜치 diff** 를 분리했다 (18개 파일, +1890/-300). 이를 통해
`guard_review_before_push.py`의 `_GIT_PUSH` 정규식·`code_review_orchestrator.py`의
`build_files_section`/`warn_if_committed_work_is_missing`/`_default_branch_ref`·
`review_guard.py`의 `in_flight_ok` opt-in 은 이미 `origin/main` 에 병합된 **이전 라운드
산출물**(컨텍스트일 뿐 이번 diff 아님)임을 확인했고, 실제 신규 diff 는
`_shared/block_integrity.py`(신규)·`_shared/retry_state.py`(신규)·`review_guard.py` 의
notes/glob-cap 추가·`guard_review_before_push.py`/`guard_review_before_stop.py` 의
notes 전파·`code_review_orchestrator.py`/`consistency_orchestrator.py`/
`merge_coordinator_orchestrator.py` 의 state-bookkeeping 위임·신규 테스트 5개 파일임을
특정했다.

다음 세 가지 "고쳤다고 주장하는 성능 결함" 을 **역-mutation(고친 코드를 원복) 후 실측**으로
개별 검증했다(라운드 7/8 에서 "같은 클래스의 두 번째 인스턴스를 놓쳤다"는 재발 패턴을 이번
라운드에도 재확인하기 위함):

1. **`block_integrity.py` 의 `BLOCK:` verdict 정규식 — 리딩 클래스(`\s`→`[ \t...]`)와
   갭(`\s*\**\s*`→`[ \t*]*`) 두 quadratic 서브패턴.** 세 가지 상태(A=둘 다 미수정,
   B=라운드7 상태: 리딩만 수정/갭은 미수정, CURRENT=둘 다 수정)를 만들어 실제 테스트
   입력(`_LINES=20000`, `_RUN=45000`)으로 6초 타임아웃 하에 측정:
   - A: 리딩 테스트 TIMEOUT(6s+), 갭 테스트 TIMEOUT(6s+).
   - B(라운드7 상태 재현): 리딩 테스트 PASS(0.02s) — **그러나 갭 테스트는 TIMEOUT(6s+)** —
     정확히 "한 인스턴스는 고쳤지만 같은 패턴의 두 번째가 살아남는다" 시나리오를 재현했고,
     현재 테스트 스위트(`test_a_bare_block_followed_by_a_long_run_returns_fast`)가 **그
     상태를 실제로 RED 로 잡아낸다**는 것을 확인했다(비-vacuous).
   - CURRENT: 두 테스트 모두 PASS(0.02s). `_BLOCK_AT_LINE_END` 의 trailing
     `[ \t*]*$` 도 별도로 측정(`'BLOCK: YES'+' '*45000+'x'`) — 세 상태 모두 fast(단일
     quantifier+anchor 는 애초에 quadratic 이 아님, 이론과 일치). **세 번째 남은
     인스턴스는 발견되지 않았다.**
2. **`review_guard._glob_to_regex` 의 `_MAX_GLOB_WILDCARDS=6` cap** (`a*`×24 패턴, 지수
   폭발). Cap 제거 mutant 는 6초 내 미종료(TIMEOUT), 원본은 0.03s — cap 이 실제로
   작동함을 확인.
3. **`code_review_orchestrator.collect_change_infos` 의 신규 `--files IGNORED`
   경고**(scope flag 가 `--files` 를 조용히 폐기하는 문제의 가시성 조치). 경고 블록만
   제거한 mutant 로 `test_review_changeset_warning.py` 재실행 → 경고 텍스트를 검증하는
   정확히 3개 테스트만 FAIL, 나머지 13개는 그대로 PASS(비-vacuous, 정밀 타겟).

추가로 `.claude/tests/` 전체 스위트를 실행: **762 tests, OK** (신규/변경 파일 관련
`test_block_integrity.py`(38)·`test_retry_state_shared.py`(9)·
`test_consistency_orchestrator_state.py`(7)·`test_review_changeset_warning.py`(16)·
`test_stop_guard_failopen.py`(17) 개별 실행도 전부 green). `.claude` 전역에서 이번 diff 가
추가한 `re.compile` 호출 전수(`_CRITICAL_TAG`/`_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END`/
glob-cap fallback `re.compile(".*", re.DOTALL)`)를 grep 으로 나열해 위 세 검증이 신규
정규식 표면을 빠짐없이 덮는지 확인했다. `spec/` 전체에서 이 하네스 모듈들(`block_integrity`/
`review_guard`/`retry_state`/`failopen_state`/`consistency-summary`)을 참조하는 문서를
검색했으나 없음(`spec/5-system/4-execution-engine.md` 의 1건은 "impl-done 4회 BLOCK: NO"
라는 무관한 서술) — 이 변경 영역은 `spec/` 관할 밖(내부 하네스 도구)이므로 spec-fidelity
점검은 `.claude/skills/*/SKILL.md`·`.claude/agents/*.md`·`plan/in-progress/*.md` 를
대상으로 수행했다.

## 발견사항

- **[WARNING]** `_CRITICAL_TAG` 정규식이 대소문자에 민감해, checker 가 자신의 finding 을
  표준과 다른 케이스(`[Critical]`, `[critical]`)로 emit 하면 하향 백스톱이 그 Critical 을
  놓친다 — 이 파일이 막으려는 바로 그 실패 모드("하향이 조용히 통과")가 case-mismatch
  경로로 재현될 수 있다.
  - 위치: `.claude/_shared/block_integrity.py:40` — `_CRITICAL_TAG = re.compile(r"\[CRITICAL\]")`
    (`re.IGNORECASE` 없음). 대조: 같은 파일의 `_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END`
    (97~102행)는 둘 다 `re.IGNORECASE` 를 명시한다 — verdict 파서는 케이스를 가리지 않는데
    critical-tag 카운터만 가리는 비대칭.
  - 상세: 5개 checker 에이전트 프롬프트(`.claude/agents/{cross-spec,rationale-continuity,
    convention-compliance,plan-coherence,naming-collision}-checker.md`)는 전부
    `- **[CRITICAL/WARNING/INFO]** 간단한 제목` 형식만 지시하므로 정상 상황에서는 대문자로
    나오지만, 실측(`grep -rhoE '\[[Cc][Rr][Ii][Tt][Ii][Cc][Aa][Ll]\]' review/consistency/`)
    결과 현재 저장소에는 `[CRITICAL]` 287건 외에 **`[Critical]`(혼합 케이스) 6건**이 이미
    존재한다(`review/consistency/2026/07/11/00_03_30/cross-spec.md:8`,
    `2026/06/27/11_20_31/plan_coherence.md:13`,
    `2026/06/11/22_50_38/plan_coherence.md:13`,
    `2026/06/10/19_06_27/rationale_continuity.md:16,22`,
    `2026/06/26/07_47_54/plan_coherence.md:22`). 개별 확인 결과 이 6건은 모두 *다른
    문서(plan 항목·타 리포트)의 라벨을 인용*하는 프로즈이지 이 checker 자신의 신규
    finding 이 아니어서 현재는 우연히 안전하지만, 이는 LLM 출력이 이 저장소 실이력에서
    실제로 케이스 변형을 만들어낸다는 증거이며, `count_critical_tags`/`downgraded_criticals`
    가 이런 케이스 변형을 검증하는 테스트는 `test_block_integrity.py` 어디에도 없다
    (`test_ignores_prose_and_the_risk_scale` 은 브래킷 없는 bare "Critical" 만 다룬다).
    단, 단순히 `re.IGNORECASE` 를 추가하면 정반대 방향의 새 결함(이 6건 프로즈 인용을
    "이 checker 의 신규 Critical" 로 오탐)이 생길 수 있음도 같은 실측으로 확인했다 — 즉
    단순 플래그 추가가 아니라 "자기 finding 위치(불릿/헤딩 시작)" 를 앵커링하는 등 별도
    설계가 필요하다.
  - 제안: (a) 최소한 이 케이스-공백을 알려진 리스크로 코드 주석에 명시하고 측정을 남길
    것 — 이 파일의 다른 모든 정규식 결정은 실측 근거를 남기는데 이 상수만 없다. (b) 가능하면
    finding 태그를 "불릿/헤딩 시작" 위치로 앵커링해 케이스-무관 매칭을 안전하게 만드는 후속
    작업을 `plan/in-progress/harness-review-gate-ci-backstop.md` 후속 목록에 등재.

- **[WARNING]** `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 11의 "최소
  조치" 서술이 실제 구현과 어긋난 채 "미해결 backlog" 로 남아 있다(plan 서술 vs 실제 상태
  불일치 — spec-fidelity 점검을 이 저장소 관례상 plan 문서에 적용한 결과).
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:119` —
    `> - 최소 조치: 두 옵션이 같이 오면 `--files` 우선 + 무시되는 쪽을 stderr 로
    경고(현재 침묵).` / 대조 구현: `.claude/skills/code-review-agents/scripts/
    code_review_orchestrator.py:1241,1250` (`collect_change_infos` docstring "Precedence
    is left as it is (a scope flag wins) ..." 및 `scope_flag = next(...)` 경고 블록).
  - 상세: 이 bullet 은 "`--files` 우선(우선순위를 뒤집는다)" 을 제안하지만, 실제 병합된
    수정은 **정반대 방향** — 기존 우선순위(scope flag 가 이긴다)를 그대로 유지하고 대신
    무시되는 `--files` 목록을 stderr 로 **경고만** 추가했다(`docstring`: "other callers
    depend on it"). 즉 "경고도 없다"(119행 상단 서술)는 문제 자체는 이미
    닫혔고 — `test_review_changeset_warning.py::ScopeFlagDiscardingFilesIsAnnouncedTest`
    4개 테스트로 커버되며 위 mutation 검증으로 비-vacuous 임도 확인했다 — 그런데 plan
    문서는 여전히 "현재 침묵"(고쳐지지 않음)으로 서술하고 있고, 채택된 실제 해법(우선순위
    유지+경고)도 반영돼 있지 않다. 같은 파일의 항목 2 는 유사 상황에서
    `~~취소선~~ → 구현 완료 (커밋 해시)` 로 정확히 갱신된 선례가 있어, 항목 11 만 이
    관례를 놓쳤다. 한편 같은 bullet 아래 "동반" 2건(`get_directory_files()` 의
    `.gitignore` 미인식 raw `os.walk` — 120행, `elif args.files:` 분기에
    `warn_if_committed_work_is_missing` 대칭 안전장치 부재 — 121~122행, `review/**`
    전용 changeset 오구성 advisory — 123행)은 실제로 **아직 구현되지 않았음**을 코드에서
    직접 확인했다 — 그 부분은 그대로 유효한 backlog 다.
  - 제안: 코드가 맞다(다른 호출부 의존성 근거가 타당함) — plan 문서만 갱신. 119행의 "최소
    조치" bullet 에 취소선 + "구현 완료 — 단, 우선순위는 유지하고 경고만 추가하는 방향으로
    결정(다른 호출부 의존성)" 주석을 달고, 120~123행 "동반" 3건은 그대로 열린 채 유지.

## 요약

이번 라운드의 실제 신규 diff(merge-base 대비 18개 파일, +1890/-300)를 프롬프트 번들이 아닌
`git diff` 로 직접 분리해 파악한 뒤, 특히 과제에서 지목한 "고쳤다는 성능 결함이 같은 클래스의
두 번째 인스턴스를 놓쳤을 수 있다" 는 우려를 세 가지 독립 fix(BLOCK: verdict 정규식의 리딩
클래스+갭 2개소, glob wildcard 지수폭발 cap, `--files IGNORED` 가시성 경고)에 대해 실제
mutation(고친 코드를 원복)+타이밍 측정으로 개별 검증했다. 세 fix 모두 (1) 주장하는 결함
클래스를 실제로 완전히 막고 있고 (2) 딸린 회귀 테스트가 fix 를 되돌리면 정확히 RED 로
전환되는 비-vacuous 테스트임을 확인했다 — 특히 `test_a_bare_block_followed_by_a_long_run_
returns_fast` 하나만으로 "라운드7 상태"(리딩 클래스만 수정)를 실측 재현해 TIMEOUT 시켰다는
점에서, 이번 라운드는 과거 라운드가 겪은 "같은 패턴의 두 번째 인스턴스 누락" 재발이 없다.
`.claude/tests/` 전체 762개 테스트가 green 이며 신규 TODO/FIXME/HACK/XXX 도 없다.
`_shared/retry_state.py` 로의 상태관리 통합은 세 orchestrator(`code_review`,
`consistency`, `merge_coordinator`) 전부에 올바르게 배선됐고, `merge_coordinator` 에만
`reconcile_state_with_disk` 자가치유가 없는 비대칭은 코드 주석과 plan 문서 양쪽에 정직하게
후속 과제로 기록돼 있어 은닉된 결함이 아니다. 다만 두 가지 WARNING 을 남긴다: (1)
`_CRITICAL_TAG` 카운터의 대소문자 민감성은 이 백스톱이 막으려는 바로 그 실패 모드(하향
누락)를 케이스-변형 경로로 재현할 수 있는 실측 가능한 latent gap 이고, (2) plan 문서 항목
11 은 이미 다른 방향(우선순위 유지+경고)으로 구현 완료된 사안을 여전히 미해결로 서술하고
있어 plan-hygiene 정정이 필요하다. 이 영역을 규율하는 `spec/` 문서는 없음을 확인했다(내부
하네스 도구 영역, `spec/` 관할 밖 — INFO).

## 위험도
LOW
