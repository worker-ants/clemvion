# Security Review — harness-block-backstop

## 발견사항

- **[WARNING]** Stop 훅의 note 중복억제가 "인덱스" 기준이라, 자체 주석이 약속하는 "다른 모순은 통과시킨다"를 어긴다
  - 위치: `.claude/hooks/guard_review_before_stop.py:366-377` (`_run` 함수 내 note 출력 루프, 특히 373행 `marker = _marker_path(session_id, token, f"note{idx}")`)
  - 상세: 바로 위 주석(369-370행)은 "The marker keys on the note text, so a DIFFERENT contradiction still gets through" 라고 명시한다. 그러나 실제 구현은 `enumerate`의 **루프 인덱스**(`idx`)로 마커 파일명을 만들 뿐, note의 텍스트나 해시는 전혀 쓰지 않는다. `notes`는 통상 원소 1개(`_newest_resolved_impl_done_mtime`이 `best_dir` 단 하나의 모순만 수집 — `review_guard.py:756-759`)이므로: 같은 (session_id, branch) 아래서 세션 A의 모순이 `note0`으로 한 번 nudge 되어 마커가 생성된 뒤, 이후 호출에서 게이트가 채택하는 세션이 B로 바뀌어 **전혀 다른 내용의** 모순이 발생해도 그 note는 여전히 `idx=0`이라 `note0` 마커가 이미 존재해 `_already_nudged()`가 True를 반환하고 **조용히 스킵**된다. 이는 이 백스톱이 막으려는 "하향이 아무도 안 읽는 곳에서 조용히 통과"와 정확히 같은 실패 형태를, 그 하향을 알리기 위한 채널 자체에서 재현한다. (Push 훅의 `_report_notes`(`guard_review_before_push.py:733-750`)는 스로틀이 없어 매번 다시 출력하므로 이 결함은 Stop 훅에만 있다 — 다만 Stop은 hard gate가 아니라 nudge이므로 실제 push 차단(Gate 1/2의 `blocked`)에는 영향이 없다.)
  - 제안: 마커 키를 인덱스가 아니라 note 텍스트의 해시(예: `hashlib.sha256(note.encode()).hexdigest()[:16]`)로 바꾸거나 `_sanitize_component(note)`로 note 자체를 컴포넌트에 포함시켜 "내용이 다르면 다른 마커"가 되도록 한다. 회귀 테스트로 "같은 session/token에서 서로 다른 note가 연속 호출돼도 둘 다 stderr에 나타나야 한다"를 pin할 것.

- **[WARNING]** `summary_block_verdict()`가 END-모양 매치 중 텍스트상 가장 먼저 나오는 것을 채택해, 최신이 아니라 stale 판정을 고를 수 있음 (직접 실행으로 재현 확인)
  - 위치: `.claude/_shared/block_integrity.py:96-107` (`summary_block_verdict` 함수, 특히 104-106행 `.search()` 순서). 이 결과가 advisory뿐 아니라 실제 blocking 판정에도 쓰이는 곳: `.claude/hooks/_lib/review_guard.py:699-715` (`_summary_block_is_no`, Gate 2의 세션 채택 여부에 직결).
  - 상세: 구현은 "`_BLOCK_AT_LINE_END` 매치가 있으면 그중 `.search()`가 찾는 가장 이른 것을 채택, 없으면 `_BLOCK_AT_LINE_START` 중 가장 이른 것"이다. 이 규칙은 docstring이 실측한 4가지 실제 불일치 사례(과거 세션을 산문으로 서술하는 문장 등)는 모두 올바르게 처리하지만, "END 모양에 매치되는 줄이 문서 안에 **둘 이상**" 존재하는 경우(예: 군더더기 없는 초안 판정 줄과 최종 판정 줄이 둘 다 `**BLOCK: X**` 단독 형태)는 다루지 않는다. 직접 실행해 재현:
    ```python
    text = "**BLOCK: YES**\n\n(위 판정은 초안, 재검토 후 실제 최종은 아래)\n\n**BLOCK: NO**\n"
    summary_block_verdict(text)  # → 'YES'  (텍스트상 첫 번째 줄일 뿐, 의도된 최종 판정 'NO' 가 아님)
    ```
    `.search()`는 파일 내 **가장 먼저** 나오는 END-모양 매치를 반환하므로 "가장 최신/최종"이 아니라 "가장 먼저 등장"이 이긴다. 732개 세션 실측에는 이 다섯 번째 형태가 없었다고 하지만, 이 함수는 "신뢰할 수 없는 verdict 서술 속에서 진짜 판정을 가려내는" 보안 관련 파서이며 그 반환값이 Gate 2(spec-impl consistency, `evaluate_review` 962-992행)의 실제 차단 여부 계산에도 쓰이므로, 잔여 모호성으로 남겨두기보다 하드닝 대상에 포함할 가치가 있다.
  - 제안: "banner"를 명시적 마커(예: `>` 인용부호, "최종 판정" 문구)로만 인정하도록 좁히거나, END 매치 중 **마지막**(문서 최하단) 것을 채택(`list(pattern.finditer(text))[-1]`)해 "가장 나중에 쓰인 판정이 이긴다"는 의도에 맞출 것. 두 개의 bare `**BLOCK: X**` 줄이 있는 케이스를 회귀 테스트로 추가.

- **[INFO]** `_newest_resolved_impl_done_mtime()`의 신규 `contradiction_note()` 호출에 로컬 예외 처리가 없어, 향후 `block_integrity.py` 변경이 예외를 던지면 advisory 계산 실패가 그 target에 대한 Gate 2 전체를 fail-open 시킨다
  - 위치: `.claude/hooks/_lib/review_guard.py:756-759`
  - 상세: `note = _block_integrity.contradiction_note(best_dir)`는 `try/except` 없이 직접 호출된다. 현재 `block_integrity.py` 내부(`_read`의 `OSError` 흡수, `downgraded_criticals`의 방어적 구현 등)는 예외를 잘 흡수하도록 짜여 있어 실제로 터지지는 않는다(`test_unreadable_reports_do_not_crash_the_gate`로 검증됨). 그러나 이 **호출부 자체**는 방어되어 있지 않다: 예외가 나면 `_newest_resolved_impl_done_mtime()` 전체가 raise → `evaluate_review()`가 raise → `guard_review_before_push.py::_evaluate_over_targets`의 per-target `except Exception`(832-837행)이 이를 잡아 해당 target의 REVIEW 게이트를 "degraded"(fail-open, 다만 traceback 출력 + 연속횟수 카운트 + 3연속시 escalation banner)로 기록한다. 즉 "참고용 note 계산"의 버그가, 이미 계산되어 있던 (또는 계산되었어야 할) **실제 차단 판정**까지 그 target에 대해 건너뛰게 만드는 결합이 새로 생겼다. 이 프로젝트가 이미 채택한 "fail-open, 그러나 관측·카운트" 철학과는 일관되므로 완전히 새로운 위험은 아니지만, 신규 코드경로에 새로운 결합점을 추가한 것이므로 기록해 둔다.
  - 제안: `note = _block_integrity.contradiction_note(best_dir)` 호출을 자체 `try/except Exception`으로 감싸, 이 advisory 전용 계산의 실패가 이미 계산된 freshness/차단 판정에 영향을 주지 않도록 국소화할 것.

- **[INFO]** 이 diff는 커맨드/SQL/LDAP 인젝션, 하드코딩 시크릿, 안전하지 않은 역직렬화, 신규 서드파티 의존성, 평문 자격증명 전송 등 전형적 OWASP Top-10 웹앱 표면과 무관하다 — 로컬 개발 하네스(git hook, markdown/JSON 파싱, subprocess list-form 호출)만 다룬다. 확인한 사항:
  1. 신규 정규식(`_CRITICAL_TAG`, `_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END`, `block_integrity.py:40,60-65`)은 중첩 quantifier가 없고 서로 다른 문자 클래스가 겹치지 않아 ReDoS 안전.
  2. 모든 `subprocess.run(["git", ...])` 호출(`review_guard.py:_run_git`, `guard_review_before_push.py:_worktree_branches`, `guard_review_before_stop.py:_throttle_token`, 테스트 파일들)은 list 형태이며 `shell=True`가 없어 커맨드 인젝션 벡터 없음.
  3. `session_dir`/`best_dir`는 항상 `os.walk()`로 저장소 내부(`review/consistency/**`, `review/code/**`)에서 발견되며 외부 입력이 직접 경로에 도달하지 않아 경로 탐색(path traversal) 벡터 없음.
  4. Stop 훅의 마커 파일명(`_marker_path`)은 `_MARKER_SAFE = re.compile(r"[^A-Za-z0-9._-]")` 화이트리스트로 `session_id`/`token`을 세니타이즈하며, note의 텍스트 자체는 파일명 구성에 쓰이지 않음(인덱스만 사용) — 파일명 인젝션 벡터 없음.
  5. `grep -niE "api[_-]?key|secret|password|token=..."` 등으로 하드코딩된 시크릿·자격증명 패턴 없음 확인.
  6. `save_state()`의 원자적 쓰기(temp + `os.replace`)는 오히려 TOCTOU/부분쓰기 경쟁을 줄이는 방향의 개선.

## 요약

이번 diff는 "checker가 `[CRITICAL]`을 냈는데 통합 SUMMARY가 `BLOCK: NO`로 하향한 경우"를 감지하는 신규 backstop(`block_integrity.py`)과 세 orchestrator의 중복 상태관리 통합(`retry_state.py`)으로, 그 자체가 보안 통제를 **강화**하는 변경이다. 인젝션·시크릿 하드코딩·안전하지 않은 암호화·인증 우회 같은 고전적 취약점은 발견되지 않았고(로컬 CI 하네스 코드라 웹앱형 OWASP Top-10 대부분이 표면적으로 해당하지 않는다), subprocess 호출·정규식·경로 처리·파일명 세니타이즈 모두 이 저장소의 기존 신중한 관례(list-form subprocess, ReDoS 회피, 화이트리스트 기반 sanitize, 원자적 쓰기)를 그대로 따른다. 다만 이번에 신설된 통제 메커니즘 자체에서 실증 가능한 결함 두 가지를 발견했다. (1) Stop 훅의 note 중복억제가 note 텍스트가 아니라 루프 인덱스로 키를 잡아, 채택 세션이 바뀌어 **다른** 모순이 발생해도 이전에 nudge 된 인덱스와 겹치면 조용히 스킵된다 — 정확히 자기 주석이 하지 않겠다고 약속한 실패 형태(하향이 조용히 통과)를 알림 채널 자신에서 재현한다. (2) `summary_block_verdict()`는 END-모양 매치가 문서 안에 둘 이상 있을 때 최신이 아니라 텍스트상 먼저 나오는 것을 채택하도록 되어 있어 stale 판정을 고를 수 있음을 직접 실행으로 확인했다 — 이 함수는 advisory 뿐 아니라 Gate 2의 실제 차단 여부 계산에도 쓰인다. 두 문제 모두 CRITICAL급(원격 인증우회·데이터 유출·직접적 인젝션)은 아니지만, "리뷰 게이트 판정의 무결성"을 다루는 신규 코드 자체의 결함이며 이 PR의 목적(하향을 조용히 놓치지 않는 것)과 정면으로 관련되므로 WARNING으로 보고한다.

## 위험도

MEDIUM
