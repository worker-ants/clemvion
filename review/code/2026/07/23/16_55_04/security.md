# 보안 리뷰 — push guard fail-open observability

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_guard_review_before_push_main.py`,
`plan/in-progress/harness-guard-followups.md` (§E)

## 발견사항

- **[INFO]** 예외 메시지가 로컬 state 파일 및 stderr 에 그대로 노출
  - 위치: `.claude/hooks/guard_review_before_push.py:447-448`(`degraded.append(("REVIEW", f"{type(exc).__name__}: {exc}"))`), `:462-463`(PLAN 쪽 동일 패턴), `:381-388`(`_write_streak`, 이 문자열을 `.claude/state/push_guard_failopen.json` 에 그대로 기록)
  - 상세: `evaluate_review()`/`evaluate_plan()` 이 던진 예외의 `str(exc)` 가 가공 없이 stderr 출력과 로컬 JSON state 파일 양쪽에 영속화됩니다. 예외 메시지에 내부 경로·환경 변수 값 등이 우연히 섞여 들어갈 경우 그대로 디스크에 남습니다. 다만 이 훅은 네트워크 응답이 아니라 **로컬 개발자 세션의 stderr/로컬 파일**이 대상이라(같은 신뢰 경계 내), 공격자가 별도로 접근 권한을 얻는 시나리오는 아닙니다 — 정보 노출의 대상이 이미 그 정보에 접근 가능한 본인입니다.
  - 제안: 현재 위협 모델상 필수 조치는 아님. 다만 exception message 를 그대로 영속화하는 대신 `type(exc).__name__` 만 state 파일에 남기고 원문 메시지는 stderr(비영속)에만 출력하는 절충도 가능합니다(문서화 참고용, 없어도 무방).

- **[INFO]** state 파일 경로가 `CLAUDE_PROJECT_DIR` 환경변수를 검증 없이 결합
  - 위치: `.claude/hooks/guard_review_before_push.py:367-369` (`_state_path()`)
  - 상세: `os.path.join(project_dir, ".claude", "state", _FAILOPEN_STATE_NAME)` 에서 `project_dir` 가 `CLAUDE_PROJECT_DIR` 환경변수를 검증 없이 그대로 사용합니다. 이 값이 만약 외부에서 조작 가능하다면 경로 조작(예: 임의 위치에 쓰기)의 소재가 될 수 있습니다. 그러나 이 환경변수는 Claude Code harness/세션이 설정하는 신뢰된 값이고(공격자가 이 훅을 실행시키는 Bash 명령의 `tool_input.command` 를 조작해도 훅 프로세스 자신의 `CLAUDE_PROJECT_DIR` 는 바뀌지 않음), 파일 전반에서 `THIS_DIR`/`os.getcwd()` 폴백과 동일한 신뢰 가정을 이미 쓰고 있어 이 diff 가 새로 도입한 신뢰 경계 문제는 아닙니다.
  - 제안: 조치 불요(기존 코드베이스 관례와 일관). 참고용으로만 기록.

- **[INFO]** state 파일 쓰기가 원자적이지 않고 심볼릭 링크를 따라감(symlink 추종)
  - 위치: `.claude/hooks/guard_review_before_push.py:381-388` (`_write_streak`), `:373-378` (`_read_streak`)
  - 상세: `open(path, "w")` 는 대상이 심볼릭 링크면 그 링크를 따라가며, 임시파일+rename 방식이 아니므로 동시 실행 시 파일이 손상될 수 있습니다. 다만 (a) 이 파일은 같은 로컬 사용자만 쓰는 devtool 상태 파일이라 별도 권한 경계를 넘는 공격이 아니고, (b) `_read_streak()` 가 JSON 파싱 실패·타입 불일치를 전부 `except Exception: return 0` 로 흡수하므로 손상되어도 게이트 판정(가장 안전한 fail-open 카운터 리셋)에는 영향이 없습니다.
  - 제안: 조치 불요. 필요 시 `os.O_NOFOLLOW`/`tempfile`+`os.replace` 원자적 교체로 방어 심도를 높일 수 있으나 현재 위협 모델상 우선순위는 낮습니다.

- **[INFO]** 파일 말미에 `if __name__ == "__main__": sys.exit(main())` 블록이 중복으로 남아있음
  - 위치: `.claude/hooks/guard_review_before_push.py:491-492`, `:495-496` (동일 블록 2회, `Read` 로 직접 확인)
  - 상세: diff 가 새 블록(491-492)을 추가하면서 파일 말미의 기존 블록(495-496)을 제거하지 않아 동일한 `if __name__ == "__main__": sys.exit(main())` 이 파일에 두 번 존재합니다. 실행 시 첫 블록의 `sys.exit()` 가 프로세스를 즉시 종료시키므로 두 번째 블록은 도달 불가능해 기능적 영향(보안 영향 포함)은 없습니다.
  - 제안: 보안 이슈는 아니지만 정리 권장 — 정리하지 않으면 향후 편집 시 "어느 블록이 진짜인지" 혼동해 회귀를 낼 수 있는 코드 위생 문제입니다.

- **[INFO]** fail-open 정책 자체는 이 diff 의 범위가 아니며, 기존 신뢰 경계를 변경하지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:431-471` (`_run_gates`), `plan/in-progress/harness-guard-followups.md` §E
  - 상세: `evaluate_review`/`evaluate_plan` import 실패나 예외 발생 시 push 를 계속 허용(fail-open)하는 동작은 이 diff 이전부터 있던 **의도된 정책**이며(§E 에 사용자 결정 2026-07-23 기록), 이번 변경은 그 결정을 뒤집지 않고 **관측 가능하게(로그+연속 카운트+3회 에스컬레이션)** 만듭니다. `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 의식적 우회는 여전히 `degraded` 로 집계되지 않도록 명확히 구분되어(코드 `:439`, `:454` 의 `!= "1"` 게이트) 신호가 희석되지 않습니다. 보안 관점에서 이 diff 는 기존 fail-open 이라는 잔여 리스크를 줄이는 방향(silent → loud)이며 새로운 우회 경로를 추가하지 않습니다.
  - 제안: 없음(긍정적 변경으로 평가).

## 요약

이 변경은 애플리케이션(사용자 대면) 코드가 아니라 로컬 개발 하네스의 pre-push 가드 훅에 관측성(로그·연속 실패 카운트·에스컬레이션)을 추가하는 인프라성 diff입니다. 신규 인젝션 벡터, 하드코딩 시크릿, 인증/인가 우회, 안전하지 않은 암호화는 발견되지 않았습니다. 기존에 정책적으로 결정된 fail-open 동작(가드가 응답하지 못하면 push 를 통과시킴) 자체는 그대로 유지되지만, 이번 diff 는 그 상태를 침묵에서 가시화(연속 카운트 파일 + stderr 경고 + 3회 임계 에스컬레이션)로 전환해 실질적으로 보안 리스크를 완화하는 방향입니다. 모든 관측 로직이 `try/except`로 감싸여 있어 관측 실패가 가드 판정에 영향을 주지 않도록 설계됐고(`test_unwritable_state_dir_does_not_break_the_guard` 로 검증됨), `BYPASS_*` 의식적 우회와 무응답(degraded) 상태가 명확히 분리되어 신호 희석도 방지합니다. 남은 항목은 전부 로컬 단일 사용자 신뢰 경계 내의 정보 노출/경로 신뢰/코드 위생 수준의 INFO 이며 즉시 조치가 필요한 항목은 없습니다.

## 위험도

LOW
