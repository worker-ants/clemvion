# Requirement Review — harness-block-backstop (하향 금지 backstop + retry_state 공유화)

## 검토 방법

프롬프트 diff/컨텍스트 확인 + 잘림 표시된 7개 파일(`review_guard.py`, `guard_review_before_push.py`,
`guard_review_before_stop.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`,
`merge_coordinator_orchestrator.py`, `test_block_integrity.py` 본문 일부)은 Read 로 원본을 직접
확인. 신규 테스트 `test_block_integrity.py`(26 tests) + `test_retry_state_shared.py`(6 tests) 를
`pytest`로 직접 실행, 그리고 관련 기존 스위트(`test_review_guard*.py`,
`test_guard_review_before_push_main.py`, `test_stop_guard_failopen.py`,
`test_*orchestrator_state.py`, `test_push_guard_*.py`) 및 `.claude/tests/` 전체(41 파일)를 실행해
회귀 여부를 실측했다. 추가로 `guard_review_before_stop.py`의 note 스로틀링 동작을 서브프로세스로
직접 재현해 텍스트 근거로 검증했다.

**실측 결과**: `.claude/tests/` 전체 743 passed, 571 subtests passed (65.32s), 0 failed. 신규 2개
파일 32 tests 전부 PASSED. `.claude/_shared/__init__.py` 존재 확인(→ `retry_state.py`의
`from . import report_paths` 상대 import 유효). TODO/FIXME/HACK/XXX 주석 검색 결과 없음.

## 발견사항

- **[WARNING]** Stop 훅의 note 스로틀링 마커가 "note 텍스트" 가 아니라 **리스트 인덱스**로만
  키잉되어, 바로 위 코드 주석의 명시적 주장과 실제 동작이 어긋난다.
  - 위치: `.claude/hooks/guard_review_before_stop.py:369` (주석 "The marker keys on the note
    text, so a DIFFERENT contradiction still gets through.") ~ `:373`
    (`marker = _marker_path(session_id, token, f"note{idx}")`) — 함수 `_run()`.
  - 상세: `notes` 튜플을 `enumerate` 하며 `f"note{idx}"` 를 마커 파일명의 discriminator 로 쓴다.
    이는 **위치(0, 1, …)** 기준이지 **텍스트** 기준이 아니다. `evaluate_review()` 의 Gate 2 는
    호출마다 최대 1개의 note 만 채우므로(`_newest_resolved_impl_done_mtime` 이 "gate 가 실제
    채택한 세션" 하나에 대해서만 `notes.append(...)` 함), 실사용에서 `notes` 길이는 거의 항상
    0 또는 1 — 즉 거의 항상 `idx == 0` 에 떨어진다. 따라서: (a) 세션 A 의 하향 감지 note 가 한 번
    발화해 `note0` 마커가 생성된 뒤, (b) 같은 (session_id, branch) 조합에서 **완전히 다른** 세션
    B 의 하향 감지 note 가 생겨도 — session_dir 도, 위반 checker 도, 카운트도 모두 다른 텍스트임에도
    — 같은 `note0` 마커가 이미 존재한다는 이유만으로 **조용히 억제**된다. 서브프로세스로 직접
    재현: 1차 호출 note "SESSION-A 하향 감지" → stderr 에 출력됨(마커 생성) / 2차 호출(다른
    session_id 재사용, 완전히 다른 텍스트 "SESSION-B …") → stderr 완전히 비어 있음(억제 확인).
    또한 이 마커에는 소멸 로직이 전혀 없다(파일 상단 docstring 이 말하는 "AT MOST ONCE per
    (session_id, branch)" 설계 자체는 review-nudge 의 기존 의도와 일치하지만, note 는 그 설계를
    그대로 재사용하면서 "텍스트가 다르면 통과시킨다" 는 별도의 새 약속을 코드 주석으로 추가
    했고 구현이 그 약속을 지키지 않는다).
  - 영향 범위: **push 하드 게이트는 무관** — `guard_review_before_push.py._report_notes()` 는
    스로틀링 없이 `outcome.notes` 전체를 매번 재출력하므로, 실제 차단 판단에 쓰이는 표면은
    항상 최신 상태를 보여준다. 영향은 Stop 훅의 소프트 nudge 로 국한되며, "같은 branch 에서
    서로 다른 --impl-done 세션이 연속으로 하향을 냈을 때 두 번째가 안 보일 수 있다" 는 좁은
    시나리오다. 그럼에도 이 backstop 의 존재 이유("Making it visible is the fix" —
    `block_integrity.py` 모듈 docstring) 를 이 특정 표면에서 부분적으로 무력화한다.
  - 제안: 마커 discriminator 를 인덱스 대신 note 텍스트의 짧은 해시로 바꾼다(예:
    `hashlib.sha1(note.encode()).hexdigest()[:10]`). 파일명 안전성 문제(원문을 그대로
    `_sanitize_component` 하면 매우 길고 밑줄투성이 파일명이 됨) 없이 주석이 말하는 "키는
    텍스트" 를 실제로 충족한다. 대안으로 주석을 실제 동작("인덱스 기준이라 같은 위치에 다른
    문구가 와도 스로틀된다")에 맞게 정정하는 방법도 있으나, 이는 이 backstop 의 설계 목적과
    반대 방향이라 해시 키잉 쪽을 권장.

- **[INFO]** `evaluate_review()` 함수 docstring 이 신규 `notes` 필드/동작을 전혀 언급하지 않는다
  (설명은 `ReviewDecision.notes` 필드 자체의 docstring 에만 있음).
  - 위치: `.claude/hooks/_lib/review_guard.py` — `evaluate_review` 함수 docstring
    (`def evaluate_review(cwd: str | None = None, *, in_flight_ok: bool = False) -> ReviewDecision:`
    바로 아래 docstring 블록).
  - 상세: 기능상 문제는 없음(호출자는 `ReviewDecision.notes` 필드 docstring 을 통해 계약을 알 수
    있음) — 문서 완결성 차원의 사소한 누락.

- **[INFO]** `downgraded_criticals()` docstring 이 "nothing to report" 3가지 경우(합의/SUMMARY
  없음/BLOCK 상태)만 나열하고, 코드가 실제로 동일하게 처리하는 4번째 경우("BLOCK: 줄이
  파싱 불가능")는 명시하지 않는다.
  - 위치: `.claude/_shared/block_integrity.py:110`-`116` (`downgraded_criticals` docstring)
    ~ 구현은 `summary_block_verdict(summary) != "NO"` 한 줄로 "파싱 불가(None)"·"YES" 를 함께
    처리한다.
  - 상세: 기능은 정확(파싱 불가 시에도 안전하게 `{}` 반환) — 문서가 케이스를 하나 덜 나열했을
    뿐인 사소한 사항.

- **[INFO]** `merge_coordinator_orchestrator.py` 는 `_shared/retry_state.py` 로 `_load_state`/
  `_save_state`/`_apply_status_update` 는 위임했지만 `reconcile_state_with_disk` self-heal 은
  없다 — 다른 두 orchestrator 와 달리 Agent tool 직접 fan-out 세션이 prepare 시점 스냅샷에 멈춘
  채 SUMMARY 는 실제 성공을 보고하는 모순을 그대로 가진다.
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:100`-`112`
    (코드 주석이 이 갭을 명시).
  - 상세: 이 PR 이 만든 결함이 아니라 diff 자체가 "다른 skill 의 동작 변경이라 별도 PR 로
    분리한다" 고 코드 주석과 plan 문서(`plan/in-progress/harness-review-gate-ci-backstop.md`
    §신규 후속 9번) 양쪽에 정확히 등재해 둔 의도적 범위 제외다. 새로운 회귀 아님, 후속 추적 확인.

- **[INFO]** spec fidelity — 이 변경은 전부 `.claude/**`(하네스 도구)와 `plan/**` 범위이며
  `codebase/**` 를 건드리지 않는다. `spec/` 전체를 grep 했을 때 `block_integrity`/`retry_state`/
  `review_guard`/"하향 금지"/`BLOCK: NO` 를 언급하는 문서가 없고, 어떤 `spec/**/*.md` frontmatter
  `code:` glob 도 `.claude/` 경로를 가리키지 않는다 — CLAUDE.md 의 폴더 구조 규약상 하네스 워크플로
  규약은 애초에 `spec/` 관할이 아니라 `.claude/docs/*.md`·에이전트/스킬 문서·plan 문서가 그
  역할을 한다. 이 PR 은 그 실질적 "spec" 문서 3곳(`.claude/agents/consistency-summary.md`,
  `.claude/skills/consistency-checker/SKILL.md`, `plan/in-progress/harness-review-gate-ci-backstop.md`)
  을 구현과 같은 diff 로 갱신했고, 세 문서의 새 문구(경고이지 차단 아님 / `--impl-done` 세션이
  게이트에 채택될 때만 발화 / 그 외 모드는 하향 금지 조항이 유일한 방어)가 서로 그리고
  `evaluate_review`/`_newest_resolved_impl_done_mtime` 의 실제 스코프(스펙 연결 변경이 있을 때만
  Gate 2 진입, `best_dir` 단일 세션만 검사)와 line-level 로 정확히 일치함을 확인했다. Drift 없음.

## 기능 검증 상세 (요약)

- **핵심 backstop 로직** (`block_integrity.count_critical_tags`/`summary_block_verdict`/
  `downgraded_criticals`/`contradiction_note`): 4개 실제 재현 케이스(과거 세션 서술 오독,
  중간 문장 오독, override 배너 우선순위, 중복/부재 요약)를 포함한 `VerdictIsAnchoredTest` 전부
  통과. `[CRITICAL]` 태그 카운팅이 "CRITICAL 없음"/위험도 스케일 문구/미기입 템플릿
  placeholder(`[CRITICAL/WARNING/INFO]`)를 오탐하지 않음을 정규식 구조로 확인(대괄호 직후
  문자가 다르므로 매치 불가) + 테스트로 pin.
- **게이트 통합**: `_newest_resolved_impl_done_mtime` 이 gate 가 **실제로 채택하는 단 하나의
  세션**에 대해서만 `contradiction_note` 를 호출하도록 스코프가 좁혀져 있고(전체 이력 스캔은
  +0.39s 라 의도적으로 배제), `ReviewDecision.notes` 를 통해 Gate 2 의 세 반환 경로(즉시 차단 ·
  staleness 차단 · 최종 허용) 모두에 전파된다 — `NotesSurviveBlockingTest.test_blocking_returns_carry_notes`
  가 AST 파싱으로 세 `return ReviewDecision(...)` 전부 3번째 위치 인자를 갖는지 확정적으로 검증
  (정규식 기반 1차 시도가 중첩 return 을 놓쳐 2/3 만 검사하던 결함을 스스로 문서화해 둠).
- **스트림 라우팅**: push 훅은 exit code 에 따라 stderr/stdout 을 선택(차단 시 stderr, 허용 시
  stdout)하고 실제 서브프로세스 실행으로 확인됨; stop 훅은 항상 stderr(JSON 프로토콜 보호) —
  둘 다 실측 통과.
- **retry_state 추출**: AST 비교로 4/5 함수가 동일함을 사전 실측했다는 주장은 실제 델리게이션
  코드(공유 함수 호출로 완전 대체)와 일치하며, `code_review`/`consistency` 양쪽의
  `_emit_summary_state` 출력 라인이 리팩터 전후 바이트 단위로 동일함을
  `SummaryStateCliTest`(서브프로세스 실행)로 확인. `save_state` 의 temp+`os.replace` 원자적 쓰기와
  실패 시 원본 보존도 실측 테스트로 확인.
- **회귀**: 관련 기존 스위트(`test_review_guard.py`, `test_review_guard_hardening.py`,
  `test_guard_review_before_push_main.py`, `test_stop_guard_failopen.py`,
  `test_orchestrator_state.py`, `test_consistency_orchestrator_state.py`,
  `test_push_guard_allowlist.py`, `test_push_guard_worktree_scope.py`) 및 `.claude/tests/` 전체
  743 tests / 571 subtests 전부 PASS — 리팩터가 behaviour-preserving 이라는 주장이 실측으로
  뒷받침됨.
- **엣지 케이스**: SUMMARY 없음 / 파싱 불가 / checker 리포트가 파일이 아니라 디렉토리(읽기 실패)
  / 모두 동의 / BLOCK: YES(하향 아님) 케이스 전부 `downgraded_criticals`/`contradiction_note`
  에서 크래시 없이 빈 결과를 반환함을 테스트로 확인.

## 요약

이번 diff 는 "consistency SUMMARY 의 `BLOCK: NO` 가 checker 의 `[CRITICAL]` 과 모순되는데도
기계적 backstop 이 없다" 는 문서화된 갭(732개 세션 실측, 24건/3.3% 실증)을 신규 모듈
`_shared/block_integrity.py` 로 정확히 메우고, `review_guard.py`/두 훅/두 orchestrator 문서에
일관되게 배선했다. 동시에 `_shared/retry_state.py` 로의 상태 관리 공용화도 AST 비교와 실측
테스트로 뒷받침되는 behaviour-preserving 리팩터다. 743개 테스트 전수 통과, 신규 테스트 32건
전부 실제 동작을 정확히 pin(회귀 시 GREEN 이 되는 지점까지 문서화), spec 대응 문서 3곳
(consistency-summary.md/SKILL.md/plan) 이 구현 스코프와 line-level 로 일치한다. 유일한 실질
결함은 Stop 훅의 note 스로틀링이 "텍스트 키잉" 이라는 자신의 코드 주석과 달리 인덱스로만
키잉되어 동일 인덱스에서 텍스트가 바뀌는 경우(서로 다른 세션의 하향)를 억제한다는 점으로,
서브프로세스 재현으로 확정했다 — 다만 push 하드 게이트는 스로틀링이 없어 영향을 받지 않으므로
이 backstop 의 핵심 목적(가시화)은 1차 방어선에서 유지된다.

## 위험도

LOW
