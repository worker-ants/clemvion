# API 계약(API Contract) Review

본 변경은 공개 REST/HTTP API 가 아니라 **내부 하네스 도구(훅·orchestrator·공유 모듈·sub-agent 프롬프트)** 다. 따라서 "URL/경로 설계"·"페이지네이션"·"버전 관리"·"인증/인가"(HTTP 의미의) 항목은 원칙적으로 해당 없음이며, 실질적인 "계약 표면"은 다음 세 가지로 재정의해 검토했다.

1. 공유 모듈(`_shared/block_integrity.py`, `_shared/retry_state.py`) 의 함수 시그니처 — 3개 orchestrator + 2개 훅이 소비.
2. CLI 응답 계약 — `--summary-state`/`--update` 의 stdout/stderr 형식(`/loop` 및 사람이 파싱).
3. 신규 도입된 훅 간 advisory 채널 — `ReviewDecision.notes` / `Outcome.notes` 가 게이트 → 훅 → 모델로 흘러가는 경로.

아래 두 건은 `Read`/`Bash` 로 실제 소스를 직접 열람하고 **재현 스크립트로 검증**한 결과다.

## 발견사항

- **[WARNING]** Stop 훅의 advisory 중복 억제 마커가 "노트 내용"이 아니라 "리스트 인덱스"로 키가 잡혀, 내용이 바뀐 새 경고가 조용히 삼켜진다.
  - 위치: `.claude/hooks/guard_review_before_stop.py` 함수 `_run()` 내부, 366~377행 (`for idx, note in enumerate(...): marker = _marker_path(session_id, token, f"note{idx}")`).
  - 상세: 바로 위 주석(369~370행)은 "마커가 노트 텍스트를 키로 삼으므로, 다른 내용의 모순은 여전히 통과한다"고 명시하지만, 실제 코드는 `enumerate()`의 위치 인덱스(`idx`)만으로 `_marker_path(..., f"note{idx}")` 를 만든다 — 노트 문자열 자체는 `print(note, ...)` 에만 쓰이고 마커 키 계산에는 전혀 관여하지 않는다. 즉 (session_id, branch/token, 인덱스) 조합이 한 번 발화되면, 같은 위치의 그 다음 턴 "다른" 경고 텍스트는 영구히 억제된다.
    실제로 재현했다: 동일 `session_id`/branch 로 스텁 훅을 두 번 실행 — 1차 `notes=("세션X: 하향 감지 A",)` → stderr 에 정상 출력, 2차(같은 session_id/branch, 텍스트만 `"세션Y: 하향 감지 B (다른 내용)"` 로 변경) → **stderr 완전히 비어 있음**(재현 스크립트 실행 결과 `run2 stderr contains NEW note B: False`). `decision.notes` 는 현재 `_newest_resolved_impl_done_mtime` 이 세션당 최대 1건만 append 하므로 인덱스는 항상 0 — 즉 이 결함은 "가끔"이 아니라 **인덱스 0 위치에서 항상 재현**된다. 이 backstop 은 "조용히 넘어가던 하향을 드러내는 것"이 유일한 존재 이유인데, 정확히 그 목적을 다시 침묵시킬 수 있는 경로다(같은 session_id·branch 로 여러 턴 작업하는 실사용 패턴에서 발생 가능).
  - 제안: 마커 키에 노트 텍스트(또는 그 해시, 예: `f"note{idx}_{hashlib.sha1(note.encode()).hexdigest()[:8]}"`)를 포함시켜 문서화된 동작과 일치시킬 것. 회귀 테스트로 "같은 인덱스, 다른 내용"을 연속 2회 호출하는 시나리오를 고정할 것 — 현재 `test_block_integrity.py::NotesReachBothHooksTest` 는 1회 호출만 검증해 이 결함을 통과시킨다.

- **[WARNING]** `block_integrity.summary_block_verdict()` 의 "override 배너 우선" 규칙이 실제로는 두 정규식의 문서적 위치를 비교하지 않고 "후행 텍스트 부재"를 배너의 대리 신호로 쓴다 — 최초(템플릿) 판정 줄이 규정된 후행 설명 없이 렌더링되면, 이 백스톱이 고치려던 바로 그 버그 클래스(대체된 옛 판정 채택)가 좁은 입력 형태에서 재발할 수 있다.
  - 위치: `.claude/_shared/block_integrity.py` `_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END` 정의(60~65행)와 `summary_block_verdict()` 본문(104~107행). 이 함수는 `.claude/hooks/_lib/review_guard.py` `_summary_block_is_no()`(699~715행)를 거쳐 `evaluate_review()` Gate 2(spec-impl 정합성, 961행 이하)의 차단/허용 판정에 직접 쓰인다.
  - 상세: 주석(56~59행)은 "배너가 파일에서 먼저 오든 나중에 오든 이긴다"고 서술하지만, 구현은 두 패턴 매치 사이의 실제 위치를 비교하지 않는다 — "줄 끝(후행 텍스트 없음)" 패턴에 매치가 하나라도 있으면 그중 파일에서 가장 먼저 나오는 것을 채택하고, 그런 매치가 전혀 없을 때만 "줄 시작" 패턴으로 폴백한다. SKILL 이 규정한 표준 템플릿(`consistency-summary.md` §출력 형식: `**BLOCK: {YES/NO}** — 설명`)은 항상 후행 설명이 붙으므로, 정상 케이스의 템플릿 줄은 원래 "줄 끝" 패턴에 안 걸리고 "줄 시작" 폴백으로만 잡히도록 암묵적으로 설계돼 있다. 문제는, 만약 최초 템플릿 줄이 (sub-agent 의 자연어 변동으로) 후행 설명 없이 `**BLOCK: NO**` 단독으로 렌더링되면 그 줄도 "줄 끝" 패턴에 걸려버리고, 그 뒤에 실제로 등장하는 override 배너보다 파일에서 먼저 나오므로 `search()` 가 **대체된(옛) 판정을 채택**한다.
    직접 재현(python3 로 실행, `.claude` 를 sys.path 에 넣고 실제 모듈 호출):
    - `"**BLOCK: NO**\n\n> ## 최종 판정: **BLOCK: YES**\n"` → `"NO"` 반환 (실제 최종 판정은 YES).
    - 대조군 — 템플릿에 규정된 후행 설명이 있으면: `"**BLOCK: NO** — Critical 없음\n\n> ## 최종 판정: **BLOCK: YES**\n"` → 올바르게 `"YES"` 반환.
    - 기존에 pin 된 4개 회귀 테스트(`test_block_integrity.py::VerdictIsAnchoredTest`)는 모두 "최초 판정 줄에 후행 텍스트가 있는" 형태만 다루므로 이 조합은 커버되지 않는다(25개 전체 테스트 실행 결과 OK — 이 gap 은 기존 테스트로 드러나지 않는다).
    영향 방향이 중요하다: 오판정 시 "차단해야 할 세션"이 "해소된 세션"으로 읽혀 push/턴종료 게이트가 **fail-open** 될 수 있다 — 다만 발생하려면 (a) 요약 sub-agent 가 규정 템플릿의 후행 설명을 생략하고 (b) 그 뒤에 override 배너가 실제로 추가돼야 하므로 실측 732건 corpus 에서 이 특정 조합의 빈도는 별도로 계수되지 않았고, 실제 발생 빈도는 낮을 것으로 추정된다.
  - 제안: override 배너 판별을 "후행 텍스트 부재"라는 우연적 형태 대신 실제 문서화된 배너 형태(`> ` 인용부호로 시작 등, 예: `^>\s*.*BLOCK:...`)에 고정하거나, 최소한 "초기 템플릿 줄에 후행 설명이 없고 그 뒤에 override 가 오는" 케이스를 커버하는 회귀 테스트를 추가할 것.

- **[INFO]** 두 훅이 동일한 `notes` 필드를 서로 다른 재발화 정책으로 소비한다 — push 훅은 조건이 해소될 때까지 매 `git push` 시도마다 동일 advisory 를 재출력(스로틀 없음)하는 반면, Stop 훅은 (위 결함이 있지만) session/branch 당 1회로 스로틀한다.
  - 위치: `.claude/hooks/guard_review_before_push.py` `_report_notes()`(733~750행) vs `.claude/hooks/guard_review_before_stop.py` `_run()` 366~383행.
  - 상세: 이 코드베이스는 다른 곳에서 여러 번 "항상 발화하는 경고는 아무도 안 읽는 경고" 라는 원칙을 명시한다(`_newest_resolved_impl_done_mtime` 주석, `failopen_state.report` 의 `ESCALATE_AT` 설계 등). push 훅은 상대적으로 저빈도 이벤트라 매번 재출력이 의도적 선택일 수 있으나, 그 판단이 주석으로 남아있지 않아 두 소비자의 정책 차이가 우연인지 설계인지 구분되지 않는다.
  - 제안: push 쪽도 스로틀할지, 아니면 "push 는 저빈도라 매번 보여줘도 무방"이라는 근거를 주석으로 남길지 결정해 명시할 것.

- **[INFO]** `Outcome`/`_Outcome` 셰이프가 3곳(`_lib/failopen_state.Outcome`, push/stop 훅 각각의 fallback stand-in)에 개별 선언돼 있어, 향후 필드 추가 시 "한 곳만 고치고 잊는" 드리프트가 재발할 수 있다 — 이번 PR 자체가 바로 그 클래스의 기존 결함("push 쪽 fallback 에만 `notes` 가 있었다")을 고치는 변경이다.
  - 위치: `.claude/hooks/_lib/failopen_state.py` 54행, `.claude/hooks/guard_review_before_push.py` 793~799행, `.claude/hooks/guard_review_before_stop.py` 99~114행.
  - 상세: 새로 만든 결함은 아니며 이번 diff 는 오히려 드리프트를 바로잡는 방향이다. 다만 동일 저장소가 같은 이유로 `_shared/report_paths.py`, 이번 PR 의 `_shared/retry_state.py`/`block_integrity.py` 를 추출한 선례가 있으므로, 이 3-copy fallback 셰이프도 공용 정의로 통합할 후보로 기록해 둘 만하다.

- **[INFO]** `merge_coordinator_orchestrator.py` 는 `_load_state`/`_save_state`/`_apply_status_update` 만 `_shared/retry_state.py` 로 위임하고 `reconcile_state_with_disk` 자기치유가 없어, "`--summary-state` 는 디스크와 자가 동기화된다"는 다른 두 orchestrator 의 계약이 이 orchestrator 에서만 깨져 있다.
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py` (85행 `_emit_summary_state`, 108행 결여 사실을 명시한 주석, 113~121행 위임 래퍼). `plan/in-progress/harness-review-gate-ci-backstop.md` 76~83행(항목 9)에 후속 추적으로 이미 등재됨.
  - 상세: 새 이슈는 아니다 — PR 저자가 AST 비교로 발견해 즉시 별도 후속으로 분리·기록했고, 이번 diff 의 동작 범위를 벗어난다고 명시했다. 참고용으로만 기록.

## 긍정적으로 확인된 사항 (참고)

- `ReviewDecision.notes: tuple[str, ...] = ()` 는 기존 2-인자 호출부(`test_review_guard_hardening.py:530` 등)와 하위호환 — 필드가 기본값과 함께 추가돼 breaking 없음. 전체 저장소에서 `ReviewDecision(` 생성 호출부를 grep 해 전수 확인.
- `--summary-state` CLI 의 정확한 stdout 문자열(라우터 필드 유무 차이 포함)과 stderr `reconciled` 통지가 `test_retry_state_shared.py` 로 명시적으로 pin 되어 있어, 리팩터링(3개 orchestrator → 공유 모듈 위임) 과정에서 텍스트 계약이 실제로 보존됐음을 테스트가 검증한다.
- Stop 훅의 advisory 는 stdout(`{"decision": ...}` JSON 프로토콜)을 오염시키지 않도록 항상 stderr 로만 출력되고, push 훅은 exit code 에 따라 stdout/stderr 를 올바르게 선택 — 두 소비자 모두 하네스의 스트림 계약을 코드로 올바르게 구현했다(`AdvisoryReachesTheModelTest`, `NotesReachBothHooksTest` 로 검증됨).
- checker 목록(`ALL_CHECKERS`)이 `_shared/block_integrity.py` 한 곳에서 파생되고, 세 번째 등록처(`role_instructions.CHECKER_INSTRUCTIONS`)와의 일치가 `test_role_instructions_registers_the_same_checkers` 로 별도 고정돼 있다 — "체커 하나 추가하고 한 곳에서 잊는" 실패 클래스를 구조적으로 차단.

## 요약

이번 변경은 REST API 가 아닌 내부 하네스 도구이므로 표준 API 계약 체크리스트 중 다수(버전 관리·URL 설계·페이지네이션·HTTP 인증)는 해당 없다. 실질적 계약 표면인 공유 모듈 함수 시그니처와 CLI stdout/stderr 형식은 하위호환이 유지되고 테스트로 명시적으로 고정돼 있어 전반적으로 견고하다. 다만 이번 PR 의 핵심 신규 기능인 "하향 감지 backstop" 경로에서 재현 가능한 두 결함을 확인했다 — (1) Stop 훅의 advisory 재통지 억제가 노트 내용이 아니라 리스트 위치로 키가 잡혀 있어 문서화된 동작("다른 내용은 통과한다")과 실제 동작이 어긋나며 재현됐고, (2) 판정 파서의 "override 배너 우선" 규칙이 초기 템플릿 줄에 후행 설명이 없는 좁은 입력 형태에서 대체된(옛) 판정을 채택할 수 있어, 이 경로가 고치려던 바로 그 fail-open 버그 클래스가 좁은 조건에서 재발할 수 있음을 확인했다. 둘 다 발생 빈도는 낮게 추정되지만(특정 입력 형태·동일 세션 반복 호출 필요), 전자는 "침묵하던 신호를 드러낸다"는 기능의 목적을 다시 무력화할 수 있고 후자는 게이트의 차단/허용 판정 자체에 관여하므로 정정을 권고한다.

## 위험도

MEDIUM
