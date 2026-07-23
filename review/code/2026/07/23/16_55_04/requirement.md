# 요구사항(Requirement) 리뷰

## 발견사항

- **[WARNING]** 리팩터 과정에서 `if __name__ == "__main__":` 진입 블록이 중복 삽입됨
  - 위치: `.claude/hooks/guard_review_before_push.py:491-496`
  - 상세: diff 는 `main()` 함수 본문을 `_run_gates()`/`_report_fail_open()` 로 리팩터하면서, 그 직후에 새 `if __name__ == "__main__": sys.exit(main())` 블록(491-492행)을 추가했다. 그런데 파일 끝에 이미 존재하던 원래 블록(495-496행)을 제거하지 않아 동일한 블록이 두 번 남았다. `git show a07ae56ae:.claude/hooks/guard_review_before_push.py` 로 대조하면 리팩터 전에는 이 블록이 정확히 1개였음을 확인했다 — 이번 diff 가 만든 복사·붙여넣기 잔재다. `sys.exit()` 가 먼저 실행되며 프로세스를 종료시키므로 두 번째 블록은 도달 불가능한 죽은 코드라 **현재 동작에는 영향이 없다**. 다만 향후 누군가 첫 블록만 보고 수정(예: 인자 처리 추가)하면 조용히 다른 블록과 어긋날 수 있는 위생 문제.
  - 제안: 495-496행의 중복 블록 삭제.

- **[WARNING]** "정상 판정 시 리셋" 로직이 "BYPASS 로 건너뜀"과 "실제로 건강함이 확인됨"을 구분하지 않아, 의식적 우회가 활성 fail-open 연속 카운터를 조용히 리셋할 수 있음
  - 위치: `.claude/hooks/guard_review_before_push.py` `_report_fail_open()` (373-401행경, `if not degraded: ... os.remove(_state_path())` 부분) 및 `_run_gates()` (`if os.environ.get("BYPASS_REVIEW_GUARD") != "1":` 분기)
  - 상세: 설계 의도(모듈 docstring 및 plan §E)는 "**BYPASS_\* 는 degraded 아님** — 의식적 우회이지 조용한 실패가 아니다"이며, 목적은 "연속 N회 fail-open 시 사실상 꺼져 있다고 경고"하는 것이다. 그런데 구현은 `degraded` 가 비어 있으면(=이번 실행에서 아무 게이트도 "답하지 못함"으로 기록되지 않으면) 무조건 스트릭 파일을 삭제한다. 시나리오: REVIEW 게이트가 import 실패로 두 번 연속 degraded(streak=2)가 쌓인 상태에서, 세 번째 push 에서 사용자가 (그 import 문제와 무관한 이유로) `BYPASS_REVIEW_GUARD=1` 을 걸고 PLAN 은 clean 이면, REVIEW 는 이번엔 아예 평가되지 않아 `degraded=[]` 가 되고 `_report_fail_open` 은 실제로 게이트가 고쳐졌는지 확인한 적 없이 스트릭을 0 으로 리셋한다. 다음 실행에서 REVIEW 가 다시 깨져도 카운터는 1부터 다시 시작해, 실질적으로는 게이트가 3회 이상 연속으로 죽어 있었음에도 에스컬레이션(`‼️` 경고)이 영영 발화하지 않을 수 있다. 이는 이 기능이 막으려는 바로 그 실패 모드("게이트가 꺼져 있는데 아무도 모른다")를 다시 열어준다. 기존 테스트(`test_conscious_bypass_is_not_counted_as_degradation`)는 스트릭 파일이 애초에 없는 상태에서만 검증하므로 이 회귀 경로는 커버되지 않는다.
  - 제안: "확인된 clean"(게이트가 실제로 평가되어 정상 응답)과 "이번엔 평가되지 않음(bypass)"을 구분 — bypass 로 스킵된 게이트는 스트릭에 영향을 주지 않고(증가도, 리셋도 하지 않음) 그대로 보존하도록 변경. 또는 최소한 이 트레이드오프를 의식적 결정으로 문서화(plan §E 또는 코드 주석에 "bypass 는 마스킹할 수 있다"는 한계 명시).

- **[INFO]** 모듈 최상단 docstring 이 이번에 추가된 fail-open 관측/에스컬레이션 동작을 언급하지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:1-24` (모듈 docstring)
  - 상세: 새 섹션 자체의 주석(354-362행)은 정책과 근거를 잘 설명하지만, 파일 최상단 docstring("Contract", "Two independent gates run…")은 갱신되지 않아 이 모듈을 처음 읽는 사람이 상단만 보고는 fail-open 시 stderr 경고·`.claude/state/push_guard_failopen.json` 카운팅·3회 연속 에스컬레이션이 존재한다는 것을 알 수 없다. 기능 결함은 아니고 문서 완결성 이슈.
  - 제안: docstring 에 한두 줄로 "fail-open 은 조용하지 않다 — 카운트되고 3연속 시 경고된다" 추가.

- **[INFO]** 관련 spec 부재는 정상 — 이 변경은 `spec/` 산출물이 아니라 `.claude/` 하네스 도구이며, 대응하는 근거 문서는 `plan/in-progress/harness-guard-followups.md` §E 이다
  - 위치: `plan/in-progress/harness-guard-followups.md:197-233`
  - 상세: §E 가 요구한 항목(1. `_run_gates()` 분리 + `degraded` 수집, 2. BYPASS_\* 는 degraded 아님, 3. `finally` 로 차단 경로에서도 보고, 4. `.claude/state/push_guard_failopen.json` 에 연속 카운트·정상 시 리셋·3회 연속 에스컬레이션, 5. 보고 전체가 try/except 로 감싸져 관측이 판정을 깨뜨리지 않음, 6. 테스트 7건, 7. `CLAUDE_PROJECT_DIR` 격리 부수 작업)이 코드·테스트와 line-level 로 대응한다: `_FAILOPEN_ESCALATE_AT = 3`, `_report_fail_open` 전체가 `try/except Exception: pass`, `main()` 의 `try/finally` 구조, `.claude/tests/test_guard_review_before_push_main.py` 의 새 테스트 7건(`test_import_failure_is_announced_and_counted` ~ `test_unwritable_state_dir_does_not_break_the_guard`) 모두 확인. plan 문서 자체의 편집이므로 spec drift 는 아니며 착수 근거 문서와 구현이 일치한다.

## 검증 내역

- `python3 -m pytest .claude/tests/test_guard_review_before_push_main.py -q` → 27 passed (신규 7건 포함, 기존 20건 회귀 없음).
- `git show a07ae56ae:.claude/hooks/guard_review_before_push.py`(리팩터 전 커밋) 대조로 `if __name__ == "__main__":` 중복이 본 diff 에서 새로 생긴 것임을 확인.
- `.claude/state/` 는 `.gitignore` 에 이미 등재(기존 다른 가드들과 동일 컨벤션)되어 있어 신규 상태 파일 `push_guard_failopen.json` 이 저장소에 커밋될 위험 없음.
- `.claude/settings.json` 에서 `CLAUDE_PROJECT_DIR` 이 실제 하네스 환경변수로 훅 경로 해석에 쓰이고 있음을 확인 — `_state_path()` 의 1차 조회가 프로덕션에서 유효.

## 요약

fail-open 을 "조용히" 에서 "시끄럽고 카운트됨"으로 바꾸는 핵심 목표는 정확히 구현됐고, plan(`harness-guard-followups.md §E`)이 명시한 7개 요구사항 전부가 코드·테스트에 line-level 로 반영되어 있으며 신규/회귀 테스트 27건이 모두 통과한다. 다만 두 가지 흠이 있다: (1) 리팩터 잔재로 파일 끝에 `if __name__ == "__main__":` 블록이 중복 삽입됐다(기능엔 무해하나 위생 문제), (2) "연속 fail-open 카운터가 정상 판정 1회에 리셋된다"는 로직이 "게이트를 실제로 재확인해 건강함을 확인"과 "이번엔 BYPASS 로 아예 평가하지 않음"을 구분하지 않아, 의식적 우회가 활성 중이던 degradation 스트릭을 실제 수정 확인 없이 지워버릴 수 있다 — 이는 이 기능이 막으려는 "게이트가 꺼져 있는데 아무도 모른다"는 실패 모드를 부분적으로 재현할 수 있는 엣지 케이스이며 테스트로 커버되지 않는다. 두 발견 모두 즉시 차단할 정도는 아니지만 후속 수정이 필요하다.

## 위험도
LOW
