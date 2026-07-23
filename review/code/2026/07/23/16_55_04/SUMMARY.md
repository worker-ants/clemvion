# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 즉시 차단할 결함은 없으나, "fail-open 을 관측 가능하게 만든다"는 이 변경의 목적 자체를 부분적으로 무력화할 수 있는 설계 갭(BYPASS 가 활성 streak 를 미확인 상태로 리셋, `_run_gates` 진입 전 예외 미관측, 동시 push 시 카운터 lost-update)이 다수 reviewer 에 의해 독립적으로 지적됨 + 파일 끝 `if __name__ == "__main__":` 블록 중복(1개 reviewer 는 CRITICAL, 6개 reviewer 는 기능 영향 없음의 WARNING/INFO 로 판정 — 기술적 실측(런타임 무해, dead code)에 근거해 WARNING 으로 병합) + plan 체크리스트 미동기화. 강제 화이트리스트(forced) 7명 전원 결과 확보 확인됨 — 누락 없음.

## Critical 발견사항

없음 (documentation reviewer 가 아래 #1 항목을 CRITICAL 로 판정했으나, 6개 reviewer 가 독립적으로 "런타임 동작에 영향 없는 dead code" 로 실측 확인해 WARNING 으로 병합 — 상세는 경고 표 #1 참고).

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability/scope/side_effect/architecture/requirement/testing/documentation | `if __name__ == "__main__": sys.exit(main())` 블록이 파일 끝에 완전히 중복(491-492행 신규, 495-496행 기존 잔존). 첫 블록의 `sys.exit()` 가 `SystemExit` 을 던져 두 번째는 도달 불가능한 dead code — 런타임 동작 영향 없음(6개 reviewer 실측 일치). 다만 documentation reviewer 는 "자기서술성을 중시하는 파일에 설명 없는 중복이 남으면 의도된 이중 안전장치인지 머지 실수인지 판단 근거가 없다"는 이유로 CRITICAL 로 판정 — 머지 전 정리 필요 | `.claude/hooks/guard_review_before_push.py:491-496` | 중복 블록 중 하나(예: 495-496행) 제거 |
| 2 | requirement | `_report_fail_open()` 의 "정상 판정 시 streak 리셋" 로직이 `degraded` 가 비어있으면 무조건 리셋하는데, 이는 "게이트가 실제로 재확인되어 건강함이 확인됨"과 "이번엔 BYPASS 로 아예 평가되지 않음"을 구분하지 않는다. REVIEW 가 degraded 상태로 streak=2 인 상태에서 세 번째 push 에 `BYPASS_REVIEW_GUARD=1`(REVIEW 와 무관한 사유) + PLAN clean 이면, REVIEW 미평가로 `degraded=[]` 가 되어 streak 이 실제 수정 확인 없이 0 으로 리셋됨 — 이 기능이 막으려는 "게이트가 꺼져 있는데 아무도 모른다"를 재현할 수 있는 엣지케이스. 기존 테스트는 이 회귀 경로를 커버하지 않음 | `.claude/hooks/guard_review_before_push.py` `_report_fail_open()` (streak reset 분기), `_run_gates()` BYPASS 분기 | "확인된 clean"과 "이번엔 평가 안 됨(bypass)"을 구분 — bypass 로 스킵된 게이트는 streak 을 증가도 리셋도 하지 않도록 변경, 또는 이 트레이드오프를 §E 에 의식적으로 문서화 |
| 3 | side_effect | 새 fail-open 관측 메커니즘(`try/finally: _report_fail_open`)이 `_run_gates()` 내부만 감싸고, 그 앞에서 실행되는 `_read_payload()`/`_is_git_push(command)` 의 미처리 예외는 관측 대상 밖에 있음. `_is_git_push`/`_redact_inert_text` 는 이 파일이 스스로 "3라운드 연속 실버그 재현"이라 기록한 코드 경로(ReDoS·인용부호 처리·false-negative)라, 여기서 예외가 재발하면 streak 기록도 경고도 전혀 발동하지 않음 — plan 이 명시한 "3중 fail-open" 중 ③(main() 미처리 예외) 항목이 실질적으로 미해결로 남은 채 완료 처리됨 | `.claude/hooks/guard_review_before_push.py` `main()` L474-488 (`_read_payload`/`_is_git_push` 가 try/finally 밖) | try 범위를 `_read_payload`/`_is_git_push` 호출까지 확장하거나, 최소한 "이 관측은 `_run_gates` 진입 이전 예외는 커버하지 않는다"는 known-limitation 을 코드/plan 에 명시 |
| 4 | concurrency | 공유 상태 파일 `.claude/state/push_guard_failopen.json` 에 대한 "읽기→+1→쓰기" 시퀀스에 락이 없어, 동일 worktree 안에서 두 push 시도가 시간적으로 겹치면(병렬 Bash 호출 등) lost-update 로 streak 이 실제보다 적게 카운트될 수 있음. 게이트의 차단/허용 판정 자체에는 영향 없고 보조 관측 카운터에만 영향(에스컬레이션 지연/부정확). 이 저장소에는 동일 클래스 문제에 대한 선례(mermaid install marker, "recurring 해지면 `fcntl.flock` 도입")가 있음 | `.claude/hooks/guard_review_before_push.py` `_read_streak()`(L372-379)·`_write_streak()`(L381-388)·`_report_fail_open()`(L403-404) | 카운트 정확성이 중요해지면 read-increment-write 구간을 `fcntl.flock` 으로 감싸거나, 이 residual 위험을 주석으로 의도적 승인 기록 |
| 5 | testing | 에스컬레이션 임계값(`_FAILOPEN_ESCALATE_AT=3`) 테스트가 streak=3 에서 `"‼️"` 존재만 단언하고, streak=1·2 에서 부재를 단언하지 않음 — `>= 1` 등 off-by-one 회귀가 있어도 스위트 전체 통과 가능 | `.claude/hooks/guard_review_before_push.py:418-423`, `.claude/tests/test_guard_review_before_push_main.py:292-300` | 1·2회차 응답에 `assertNotIn("‼️", stderr)` 추가 |
| 6 | testing | "BYPASS_* 는 degraded 로 집계되지 않는다"는 핵심 계약이 "정상이지만 차단된(blocked)" 게이트로만 검증되고, "실제로 import 실패/예외를 던지는 게이트를 BYPASS 로 건너뛰는" 조합(이 기능이 구분하려는 정확한 경계)은 미검증 | `.claude/hooks/guard_review_before_push.py:431-437` (docstring), `.claude/tests/test_guard_review_before_push_main.py:311-317` | `review="import_error"` + `bypass_review=True` 조합으로 streak 미증가·미보고를 확인하는 테스트 추가 |
| 7 | testing | 두 게이트(REVIEW+PLAN)가 동시에 degraded 되는 시나리오에서 streak 이 1회만 증가하는지, 두 게이트 모두 stderr/상태파일에 기록되는지 검증하는 테스트 없음 | `.claude/hooks/guard_review_before_push.py:402-404` | 양쪽 `import_error` 설정 후 streak==1, stderr 에 REVIEW/PLAN 양쪽 문구 모두 포함을 단언하는 테스트 추가 |
| 8 | documentation | 모듈 최상단 docstring "Contract" 절이 신규 fail-open 관측 부작용(stderr 경고 배너, `.claude/state/push_guard_failopen.json` 연속 카운트, 3회 에스컬레이션)을 전혀 언급하지 않아 상단만 읽는 유지보수자가 정책 변화를 놓칠 수 있음 | `.claude/hooks/guard_review_before_push.py:10-13` | Contract 절 또는 하단에 fail-open 관측 정책 1~2줄 추가 |
| 9 | documentation | `plan/in-progress/harness-guard-followups.md` 최상위 체크리스트의 E 항목이 `- [ ]`(미완료)로 남아, 같은 파일 §E 본문(구현 완료 기록)과 불일치 — 체크리스트만 훑는 향후 세션이 "E 는 아직 미착수"로 오판할 위험 | `plan/in-progress/harness-guard-followups.md:336` (본문 근거: `:211-232`) | 336행을 `- [x] E — fail-open 정책 관측가능화 구현 완료` 로 갱신 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 예외 메시지(`str(exc)`)가 가공 없이 stderr 와 `.claude/state/push_guard_failopen.json` 에 영속화됨. 다만 대상이 로컬 개발자 세션 자신이라(신뢰 경계 내) 즉시 위협은 아님 | `.claude/hooks/guard_review_before_push.py:447-448, 462-463, 381-388` | 조치 불요(옵션: `type(exc).__name__` 만 영속화) |
| 2 | security | `_state_path()` 가 `CLAUDE_PROJECT_DIR` 을 검증 없이 결합 — 기존 파일 전반의 관례와 동일해 이 diff 가 새로 만든 리스크 아님 | `.claude/hooks/guard_review_before_push.py:367-369` | 조치 불요 |
| 3 | security/concurrency | state 파일 쓰기가 원자적이지 않고(torn write) symlink 를 따라감. `_read_streak()` 이 모든 파싱 실패를 `except Exception: return 0` 으로 흡수해 self-heal 됨(설계 원칙과 일치) | `.claude/hooks/guard_review_before_push.py:381-388` | 조치 불요(락 도입 시 `tempfile`+`os.replace` 동반 고려) |
| 4 | architecture | 신규 fail-open 관측 로직이 `_lib/` 분리 패턴을 따르지 않고 훅 본체에 인라인 — 기존 다른 훅들도 동일 관례라 위반은 아니나, 2번째 소비처가 생기면 공유 모듈화 고려 대상 | `.claude/hooks/guard_review_before_push.py:363-472` | 지금은 조치 불요(YAGNI), 2번째 소비처 발생 시 재검토 |
| 5 | architecture/side_effect/testing | `_run_gates(degraded)` 가 리스트를 출력 파라미터로 mutate 하는 방식이라 순수성이 낮고 단위 테스트가 어려움 | `.claude/hooks/guard_review_before_push.py:431` | `(exit_code, degraded)` 튜플 반환으로 전환 고려(현재 규모에선 사소함) |
| 6 | architecture/maintainability | REVIEW/PLAN 두 게이트 블록의 5단계 구조(BYPASS 확인→None 체크→try/except→판정→메시지)가 계속 복제됨(이번 diff 이전부터 존재) | `.claude/hooks/guard_review_before_push.py:438-469` | 3번째 게이트 추가 시 공통 헬퍼 추출 재검토 |
| 7 | maintainability | `_write_streak(streak, gates)` 매개변수명이 파일 전체가 쓰는 `degraded` 용어와 불일치 | `.claude/hooks/guard_review_before_push.py:381` | `gates` → `degraded`(또는 `degraded_gates`)로 통일 |
| 8 | maintainability/concurrency | `_report_fail_open()` 정상 리셋 경로가 `os.path.exists`+`os.remove` 의 check-then-act(TOCTOU) — 전체가 `except Exception: pass` 로 감싸져 무해하나, 저장소 관용구(`remove`-first + `FileNotFoundError` catch)와 다름 | `.claude/hooks/guard_review_before_push.py:398-401` | 다음 편집 시 `try: os.remove() except FileNotFoundError: pass` 로 정리 |
| 9 | testing | `_read_streak`/`_write_streak`/`_state_path` 의 손상된 state 파일(비정수·음수·비-dict JSON) 방어 로직에 대한 직접 단위 테스트 부재(subprocess E2E 로만 간접 커버) | `.claude/hooks/guard_review_before_push.py:372-378` | (선택) 손상 케이스 직접 주입 테스트 1~2건 추가 |
| 10 | testing | `CLAUDE_PROJECT_DIR` 미설정 시 `os.getcwd()` 폴백 분기가 어떤 테스트에서도 실행되지 않음 | `.claude/hooks/guard_review_before_push.py:367-369` | (우선순위 낮음) env 미설정 + cwd 지정 테스트 1건 추가 |
| 11 | documentation | `_FAILOPEN_ESCALATE_AT=3` 값의 선정 근거 주석 부재 — 이 파일의 다른 매직넘버(`_OWNER_WINDOW` 등)는 모두 근거를 상세히 설명하는 관례와 비일관 | `.claude/hooks/guard_review_before_push.py:364` | 상수 옆에 근거 한 줄 추가 |
| 12 | documentation | `_state_path`/`_read_streak`/`_write_streak` 에 docstring 없음(같은 블록의 `_report_fail_open`/`_run_gates` 는 상세 docstring 보유) — 밀도 비일관 | `.claude/hooks/guard_review_before_push.py:367-389` | 한 줄씩 docstring 추가 |
| 13 | documentation | 테스트 모듈 docstring "Scope" 목록이 신규 관측성 커버리지(7개 신규 테스트)를 반영하지 않음 | `.claude/tests/test_guard_review_before_push_main.py:1-17` | Scope 목록에 "fail-open announce+streak 관측(§E)" 항목 추가 |
| 14 | requirement | 관련 근거 문서 확인 — `plan/in-progress/harness-guard-followups.md` §E 요구사항 7항목 전부가 코드·테스트에 line-level 대응 확인됨(spec drift 아님, 정상) | `plan/in-progress/harness-guard-followups.md:197-233` | 해당 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 예외 메시지 영속화·state 경로 신뢰·비원자적 쓰기 등 전부 INFO, 로컬 신뢰 경계 내. fail-open 정책 자체는 이번 diff 범위 밖(§E 기 결정) |
| architecture | LOW | 파일 끝 `__main__` 중복(WARNING), 그 외 인라인 관측 로직·출력 파라미터·게이트 보일러플레이트 복제는 INFO |
| requirement | LOW | `__main__` 중복(WARNING) + streak 리셋이 bypass 와 확인된-정상을 구분 못함(WARNING). plan §E 요구사항 7항목 코드 대응 확인 |
| scope | LOW | 3개 파일 모두 plan §E 범위 내. `__main__` 중복만 diff 정리 미흡(WARNING) |
| side_effect | LOW | `__main__` 중복(WARNING) + `_run_gates` 진입 전 예외가 관측 사각지대(WARNING). 새 파일시스템 부작용은 gitignore·예외흡수·테스트격리로 잘 통제됨 |
| maintainability | LOW | `__main__` 중복(WARNING). 그 외 네이밍 불일치·TOCTOU 관용구·게이트 복제는 INFO |
| testing | LOW | 에스컬레이션 경계·BYPASS+실제고장 조합·동시 이중-degraded 미검증(WARNING 3건). 신규 7테스트는 주요 경로 잘 커버 |
| documentation | MEDIUM | `__main__` 중복을 CRITICAL 로 판정(타 reviewer 는 기능무해 실측), plan 체크리스트 E 미동기화(WARNING), Contract 절 미갱신(WARNING) |
| concurrency | LOW | streak 파일 read-modify-write 레이스로 lost-update 가능(WARNING, 차단 판정엔 영향 없음). 비원자적 쓰기는 self-heal(INFO) |

## 발견 없는 에이전트

없음 (전원 최소 INFO 이상 발견)

## 권장 조치사항

1. 파일 끝 `if __name__ == "__main__": sys.exit(main())` 중복 블록 제거 (`.claude/hooks/guard_review_before_push.py:495-496`) — 머지 전 필수 정리.
2. `_report_fail_open()` 의 streak 리셋 로직을 "확인된 clean" vs "이번엔 BYPASS 로 미평가"로 구분하도록 수정하거나, 최소한 이 트레이드오프를 §E 에 의식적으로 문서화.
3. try/finally 관측 범위를 `_read_payload()`/`_is_git_push()` 까지 확장하거나, 이 관측이 `_run_gates` 진입 이전 예외는 커버하지 않는다는 known-limitation 을 명시.
4. 테스트 3건 보강: (a) 에스컬레이션 임계값 경계(streak 1·2 에서 `‼️` 부재 단언), (b) BYPASS+실제 import_error/raise 조합, (c) 두 게이트 동시 degraded 시 streak=1·양쪽 보고 단언.
5. `plan/in-progress/harness-guard-followups.md:336` 체크리스트 E 항목을 `[x]` 로 갱신해 본문과 정합.
6. (우선순위 낮음) streak 카운터의 동시성 lost-update — 정확도가 중요해지면 `fcntl.flock` 도입, 아니면 residual 위험을 주석으로 명시.
7. (선택) 모듈 Contract docstring 에 fail-open 관측 정책 요약 추가, `_FAILOPEN_ESCALATE_AT` 근거 주석 추가, `_write_streak` 매개변수명 `degraded` 로 통일.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency` (9명)
  - **제외**: 표 참고 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보 확인됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이 변경(로컬 devtool 훅 관측성 추가)과 관련성 낮음(구체적 사유는 라우팅 결정에 미상세) |
  | dependency | 라우터 판단 — 신규 의존성 없음 |
  | database | 라우터 판단 — DB 접근 없음 |
  | api_contract | 라우터 판단 — API 계약 변경 없음 |
  | user_guide_sync | 라우터 판단 — 사용자 대면 문서 영향 없음(내부 하네스 도구) |