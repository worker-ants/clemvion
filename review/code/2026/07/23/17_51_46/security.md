# 보안(Security) 리뷰 — push guard fail-open 관측가능화 (§E, 3라운드 누적 재검토)

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_guard_review_before_push_main.py`,
`plan/in-progress/harness-guard-followups.md` (§E), 그리고 이 diff 에 포함된
`review/code/2026/07/23/16_55_04/**`·`review/code/2026/07/23/17_22_18/**` (이전 두 라운드 산출물, 신규 커밋으로
diff 에 포함됨).

이 세션은 `origin/main` 대비 3개 커밋(`dd4311678` 최초 구현 → `e617a19a0` W1~W9 반영 → `af849ba25`
17_22_18 CRITICAL+W2~W6 반영)의 누적 결과다. 코드를 `Read` 로 직접 열어 현재 워크트리 최종 상태를
기준으로 독립적으로 재검토했다(이전 두 라운드가 지적·수정한 항목이 실제로 파일에 반영됐는지 스스로
확인 후, 그 위에서 신규 결함 스캔).

## 발견사항

- **[INFO]** 17_22_18 라운드가 CRITICAL 로 판정한 "정상 차단(block) push 가 타 게이트의 활성 streak
  를 경고 없이 리셋" 결함은 현재 파일에서 수정 확인됨
  - 위치: `.claude/hooks/guard_review_before_push.py:442-451` (`_report_fail_open` 리셋 분기)
  - 상세: `if outcome.bypassed or set(outcome.answered) != _ALL_GATES: return` — 두 게이트(`_ALL_GATES
    = frozenset({"REVIEW", "PLAN"})`)가 **모두** `answered` 에 들어간 경우에만 리셋(`os.remove`)으로
    진행한다. REVIEW 가 정상 차단해 `_run_gates()`(L522-526)가 PLAN 블록 도달 전에 `return 2` 하는
    경우 `outcome.answered == ["REVIEW"]` 로 집합 비교가 실패해 리셋되지 않고 카운터가 보존된다 —
    17_22_18 이 실측 재현했던 회귀는 더 이상 재현되지 않으며, 회귀 테스트
    `test_a_blocking_gate_does_not_reset_the_other_gates_streak`(`.claude/tests/test_guard_review_before_push_main.py:432-453`)
    로 고정돼 있다. 이 리셋 술어는 이번이 v3(명시적 named-set 비교)이며, v1(BYPASS 가 지움)·
    v2(아무 게이트나 답하면 지움) 모두 리뷰가 실제로 잡아낸 이력이 코드 주석(L427-434)에 정직하게
    남아 있다. 이 항목은 결함이 아니라 "수정이 실제로 반영됐는가"에 대한 확인 기록이다.
  - 제안: 해당 없음(이미 해결, 회귀 테스트로 고정됨).

- **[INFO]** 예외 메시지(`str(exc)`)가 가공 없이 stderr 와 로컬 state 파일에 영속화됨
  - 위치: `.claude/hooks/guard_review_before_push.py:521`(REVIEW: `degraded.append(("REVIEW",
    f"{type(exc).__name__}: {exc}"))`), `:540`(PLAN 동일 패턴), `:399-410`(`_write_streak` 가 이
    문자열을 `.claude/state/push_guard_failopen.json` 에 JSON 으로 기록), `:576-577`(`main()` 의
    DETECTION 예외도 동일 패턴)
  - 상세: `evaluate_review()`/`evaluate_plan()`/push 탐지 코드가 던진 예외의 원문 메시지가 그대로
    디스크(gitignore 처리된 `.claude/state/`, `.gitignore:19` 확인)와 stderr/stdout(하네스가 모델
    컨텍스트에 주입하는 채널 포함, `_report_fail_open` L474)에 노출된다. 예외 메시지에 우연히 로컬
    경로·환경변수 값이 섞여 들어가면 그대로 남는다. 다만 이 훅은 **로컬 개발자 세션 자신의**
    stderr/state 파일만을 대상으로 하며(네트워크 응답이나 제3자 로그가 아님), 노출 대상이 이미 그
    정보에 접근 가능한 본인이라 위협 모델상 새로운 신뢰 경계 침해는 아니다. 이전 두 라운드
    (16_55_04, 17_22_18)에서 동일하게 INFO 로 판정되고 RESOLUTION 에서 "조치 불요"로 의식적으로
    보류됨 — 재검토 결과 이견 없음.
  - 제안: 조치 불요. 강화하고 싶다면 state 파일에는 `type(exc).__name__` 만 남기고 원문 메시지는
    비영속 stderr 에만 출력하는 절충 가능(필수 아님).

- **[INFO]** `_state_path()` 가 `CLAUDE_PROJECT_DIR` 환경변수를 검증 없이 경로 결합에 사용
  - 위치: `.claude/hooks/guard_review_before_push.py:383-386`
  - 상세: `os.path.join(project_dir, ".claude", "state", _FAILOPEN_STATE_NAME)` 에서 `project_dir`
    검증이 없다. 그러나 같은 저장소의 다른 훅들(`_lib/review_guard.py`, `guard_default_branch_bash.py`,
    `mark_resolution_in_flight.py` 등)도 동일한 `os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()`
    패턴을 검증 없이 쓰는 기존 관례이며, 이 값은 harness/세션이 설정하는 신뢰된 값이다 — push 명령의
    `tool_input.command` 를 조작해도 훅 프로세스 자신의 환경변수는 바뀌지 않으므로, 이 diff 가 새로
    도입한 경로 조작(path traversal) 벡터는 아니다.
  - 제안: 조치 불요(기존 코드베이스 관례와 일관). 참고용으로만 기록.

- **[INFO]** streak 카운터의 read-increment-write 에 락이 없어 동시 push 시 lost-update 가능
    (동시성 성격이지만 "보안 통제 자체는 우회되지 않는다"는 판단 근거를 보안 관점에서도 확인)
  - 위치: `.claude/hooks/guard_review_before_push.py:389-410`(`_read_streak`/`_write_streak`),
    `_report_fail_open()` L453(`streak = _read_streak() + 1`)
  - 상세: 이 레이스는 게이트의 차단/허용 판정(`_run_gates`, 실제 push 보안 통제)에는 전혀 영향을
    주지 않고, "연속 N회" 표시용 **보조 관측 카운터**에만 영향을 준다 — 최악의 경우도 에스컬레이션
    경고가 한 push 늦어지는 정도다. 코드 자체가 이 트레이드오프를 `_report_fail_open` docstring
    (L436-440, "Known residual (accepted)")에 명시적으로 문서화하고 있어, 이전 라운드가 지적했던
    "의도적 승인인지 우연인지 알 수 없다"는 우려도 이번 라운드에서 해소됐다.
  - 제안: 조치 불요. 정확도가 중요해지면 `fcntl.flock` 도입(저장소에 mermaid install marker 등
    "recurring 해지면 도입" defer 선례 있음, §G).

- **[INFO]** 신규 인젝션 벡터·하드코딩 시크릿·인증/인가 우회·안전하지 않은 암호화·평문 전송·취약
  의존성 — 전부 해당 없음
  - 위치: 전체 diff (`.claude/hooks/guard_review_before_push.py`, 테스트, plan 문서, review 산출물)
  - 상세: 이 diff 는 신규 외부 의존성을 추가하지 않는 로컬 devtool 훅의 관측성 확장이다.
    push 탐지 정규식(`_GIT_PUSH`, `_redact_inert_text` 등, L61-321)은 이번 변경 범위 밖(이전
    라운드들이 이미 별도 트래커로 하드닝)이며 diff 로 손대지 않았다. `BYPASS_REVIEW_GUARD`/
    `BYPASS_PLAN_GUARD` 는 이 diff 이전부터 존재하던 의식적 로컬 우회이고, 이번 변경은 이를
    `degraded`(관측 대상)와 명시적으로 분리해(`_run_gates()` L510, L529 의 `== "1"` 분기)
    신호가 희석되지 않도록 만들 뿐, 새로운 우회 경로를 추가하지 않는다. 테스트 파일의
    `subprocess.run([sys.executable, self.hook], ...)` 는 인자를 리스트로 전달해(`shell=True`
    미사용) 커맨드 인젝션 벡터가 없고, 임시 디렉터리(`tempfile.mkdtemp()`)는 `addCleanup` 으로
    정리된다. review 산출물(`.md`/`.json`)은 순수 문서/메타데이터로 비밀값·자격증명을 포함하지
    않는다.
  - 제안: 해당 없음.

## 요약

이 diff 는 사용자 대면 애플리케이션 코드가 아니라 로컬 pre-push 하네스 훅에 "fail-open을 침묵에서
가시화(경고 배너+연속 카운트+3회 에스컬레이션)로 전환"하는 관측성 기능을 추가하며, 3개 커밋에 걸쳐
두 차례의 이전 리뷰 라운드(16_55_04 Warning 9건, 17_22_18 CRITICAL 1건+Warning 5건)를 거쳤다.
현재 워크트리 파일을 직접 읽어 확인한 결과, 17_22_18 이 실측 재현했던 CRITICAL("정상 차단 push 가
타 게이트의 활성 streak 를 경고 없이 리셋")은 `set(outcome.answered) != _ALL_GATES` 명시적 집합
비교로 수정되어 있고 회귀 테스트로 고정돼 있다. 신규 인젝션 벡터, 하드코딩 시크릿, 인증/인가 우회,
안전하지 않은 암호화, 취약 의존성은 발견되지 않았다. 남은 항목(예외 메시지 원문 영속화,
`CLAUDE_PROJECT_DIR` 무검증, streak 카운터 lost-update)은 모두 로컬 단일 사용자 신뢰 경계 내의
저위험 잔여이며, 이전 라운드에서 이미 검토·승인됐고 이번 재검토에서도 이견이 없다. 전체적으로 이
diff 는 기존 fail-open 잔여 리스크(가드가 조용히 꺼져 있어도 아무도 모름, OWASP A09 로깅/모니터링
부재류 문제)를 완화하는 방향의 순보안 개선(net security improvement)이다.

## 위험도

NONE
