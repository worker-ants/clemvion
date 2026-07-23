# 문서화(Documentation) 리뷰

## 발견사항

- **[CRITICAL]** `main()` 진입점이 파일 끝에 두 번 정의됨 (`if __name__ == "__main__": sys.exit(main())` 중복)
  - 위치: `.claude/hooks/guard_review_before_push.py:491-492` (신규 추가분) 및 `:495-496` (기존 블록, diff 컨텍스트 유지)
  - 상세: diff 는 게이트 로직을 `main()` 밖으로 빼내며 새 `if __name__ == "__main__": sys.exit(main())` 블록을 (구 `return 0` 자리에) 추가했는데, 파일 끝에 원래 있던 동일 블록을 제거하지 않아 파일에 **완전히 동일한 진입점 블록이 두 번** 남았다. 실행 시 `sys.exit()`이 `SystemExit`을 던져 두 번째 블록은 도달 불가능한 죽은 코드이므로 런타임 동작에는 영향이 없지만, 이 파일은 상단 모듈 docstring 에서 "Contract" 를 명시적으로 서술하는 등 자기서술성을 중시하는 파일이다. 아무 설명 주석 없이 동일 블록이 반복되면 향후 리더/편집자가 "의도된 이중 안전장치인가, 머지 실수인가"를 판단할 근거가 없고, 실제로는 diff 정리 누락으로 보인다.
  - 제안: 중복된 두 번째 `if __name__ == "__main__": sys.exit(main())` 블록(495-496행)을 제거한다.

- **[WARNING]** `plan/in-progress/harness-guard-followups.md` 최상위 체크리스트의 E 항목이 본문 구현 완료 상태와 불일치
  - 위치: `plan/in-progress/harness-guard-followups.md:336` (`- [ ] E — fail-open 정책 사용자 결정`)
  - 상세: 같은 파일 §E 섹션 본문(211-232행)은 "사용자 결정 (2026-07-23): 3안" 이 확정됐고 `- [x] 사용자 결정 → 구현 (E PR)`(217행) 로 구현까지 완료됐다고 기록한다. 그런데 파일 하단 "## 체크리스트" 요약 목록(330행)의 E 행은 여전히 `- [ ]`(미완료)로 남아 있어, A/B/D/F 행이 구현 완료 시 `[x]`로 갱신된 것과 대비된다. 이 프로젝트는 plan 체크박스가 실제 상태를 반영해야 한다는 규약을 명시적으로 두고 있고(체크박스 ≠ 실제 상태 시 재작업·오판 유발), 요약 체크리스트만 훑는 향후 세션이 "E 는 아직 사용자 결정 대기 중"으로 오판할 위험이 있다.
  - 제안: 336행을 `- [x] E — fail-open 정책 관측가능화 구현 완료 (E PR)` 등으로 갱신해 본문과 정합시킨다.

- **[WARNING]** 모듈 docstring "Contract" 절이 신규 fail-open 관측 부작용(stderr 경고·상태 파일 기록)을 언급하지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:10-13` (Contract 절), 신규 로직은 `:354-472`
  - 상세: 파일 최상단 docstring 은 "exit 0 → allow / exit 2 → block / any other → fail-open" 세 줄로 계약을 정의하고, 바로 아래 "Only `git push` commands…" 단락에서 두 게이트와 BYPASS 변수만 설명한다. 이번 변경으로 fail-open 시 (1) stderr 에 한국어 경고 배너 출력, (2) `.claude/state/push_guard_failopen.json` 에 연속 횟수 기록, (3) 3회 연속 시 에스컬레이션 문구라는 **새로운 관측 가능한 부작용**이 생겼는데, 모듈 최상단 docstring 은 이를 전혀 언급하지 않는다. 이 훅은 "hard gate" 를 자처하는 파일이라 상단만 읽는 유지보수자가 fail-open 이 이제 침묵하지 않는다는 정책 변화를 놓칠 수 있다.
  - 제안: Contract 절 또는 그 아래 단락에 "게이트가 답하지 못하면(import 실패/예외) fail-open 이지만 stderr 경고 + `.claude/state/push_guard_failopen.json` 연속 카운트로 관측 가능하다(3회 연속 시 에스컬레이션)" 한두 줄을 추가.

- **[INFO]** `_FAILOPEN_ESCALATE_AT = 3` 값 선정 근거 주석 부재 (파일의 기존 관례와 비일관)
  - 위치: `.claude/hooks/guard_review_before_push.py:364`
  - 상세: 이 파일은 `_OWNER_WINDOW`(117-118행), `_MAX_REDACTION_INPUT`(120-127행) 등 매 매직 넘버마다 "왜 이 값인가"를 상세히 설명하는 뚜렷한 관례를 갖고 있다. 반면 새로 추가된 `_FAILOPEN_ESCALATE_AT = 3`은 왜 3회인지(예: "우연한 1회성 blip 과 구분하기 위한 최소값" 등) 근거 주석이 없다. plan 문서(§E, `plan/in-progress/harness-guard-followups.md:223-225`)에는 "3회 연속이면 에스컬레이션"이라는 서술만 있고 선정 근거는 마찬가지로 없다.
  - 제안: 상수 옆에 한 줄로 근거(임의 정책값임을 명시하거나 선정 이유)를 남긴다.

- **[INFO]** 신규 private 헬퍼 간 docstring 밀도가 비일관
  - 위치: `.claude/hooks/guard_review_before_push.py:367-389` (`_state_path`, `_read_streak`, `_write_streak` — docstring 없음) vs `:391-471` (`_report_fail_open`, `_run_gates` — docstring 有)
  - 상세: 파일 전반이 사소한 헬퍼에도 짧게라도 의도를 설명하는 편(예: `_is_inert`, `_blank_spans`)인데, `_state_path`/`_read_streak`/`_write_streak` 세 함수는 docstring 없이 구현만 있다. 기능은 자명한 편이라 치명적이지 않지만, 같은 블록 안 `_report_fail_open`/`_run_gates` 는 상세한 docstring 을 갖고 있어 밀도 차이가 눈에 띈다.
  - 제안: 세 함수에 한 줄 docstring(예: `_read_streak`: "Return the last recorded consecutive fail-open count, or 0 if absent/corrupt.")을 추가해 일관성을 맞춘다.

- **[INFO]** 테스트 모듈 docstring의 "Scope" 목록이 신규 관측성 커버리지를 반영하지 않음
  - 위치: `.claude/tests/test_guard_review_before_push_main.py:1-17` (모듈 docstring), 신규 테스트는 `:268-339`
  - 상세: 모듈 docstring 은 커버 범위를 "exit codes, REVIEW-then-PLAN 순서, BYPASS_*, triple fail-open, stdin JSON handling" 으로 나열한다. 이번 diff 는 fail-open 발생 시의 **관측(announce+count) 동작** 전체(7개 신규 테스트: 계수·연속 누적·에스컬레이션·클린 리셋·BYPASS 미계수·차단 경로 동시 보고·쓰기 실패 무해)를 새로 커버하지만, 최상단 Scope 서술에는 반영되지 않았다. 각 테스트 그룹 앞에 로컬 주석(268-271행)이 있어 즉각적인 이해에는 지장이 없지만, 파일 전체를 훑는 "이 파일이 무엇을 검증하는가" 목록에서는 빠져 있다.
  - 제안: docstring 목록에 "fail-open 발생 시의 announce+streak 관측(§E)" 한 항목을 추가.

## 요약

이번 변경은 정책적으로 승인된 fail-open 관측성 기능(§E)을 구현 코드·테스트·plan 문서 세 곳에 걸쳐 일관되게 반영하려는 시도이며, 신규 코드 자체의 docstring/인라인 주석 밀도는 이 저장소의 높은 기준에 대체로 부합한다(특히 `_report_fail_open`/`_run_gates`의 설계 의도 설명, 테스트의 왜(why) 중심 assert 메시지). 다만 diff 정리 과정에서 파일 끝에 진입점 블록이 중복 남았고(런타임 무해하나 자기모순적 소스), plan 문서의 최상위 체크리스트가 본문의 완료 상태와 어긋나 있으며, 신규 부작용(stderr 경고·상태 파일 기록)이 모듈 최상단 계약 서술에는 아직 반영되지 않았다 — 이 세 가지를 정리하면 문서화 관점에서 깨끗하다.

## 위험도

MEDIUM
