# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `review_guard.py` 모듈 최상단 docstring의 "Fresh, resolved review" 정의가 이번 diff로 낡음(stale)
  - 위치: `.claude/hooks/_lib/review_guard.py:38-42` (모듈 docstring, diff 범위 밖 — 즉 이번 변경이 건드리지 않고 지나침)
  - 상세: 파일 최상단 docstring은 게이트 정책 전체를 요약하는 사실상의 SoT 문단이다. 거기서 "Fresh, resolved review"는 (a) risk가 NONE/LOW이거나 RESOLUTION.md가 존재, (b) freshness(코드보다 최신) 두 조건만으로 정의돼 있다. 그런데 이번 diff가 신설한 `_forced_coverage_missing()`과, 그에 맞춰 갱신된 `_summary_is_resolved()`의 함수 docstring(405-417행)은 세 번째 필수 조건 — "`agents_forced` 전원이 세션 디렉토리에 리포트를 남겼는지" — 을 "resolved"의 전제 조건으로 추가했다. 함수 단위 docstring은 정확히 갱신됐지만 모듈 최상단 요약은 갱신되지 않아, 코드를 다 읽지 않고 파일 헤더만 보는 유지보수자는 "위험도만 낮으면 forced coverage 없이도 통과"로 오해할 수 있다.
  - 제안: "Fresh, resolved review =" 블록에 세 번째 조건 추가. 예: `- coverage: every agents_forced reviewer for the session left a report on disk (see _forced_coverage_missing), AND`

- **[WARNING]** `_summary_is_resolved` 갱신 docstring의 불리언 로직이 평면 글머리 목록이라 실제 코드와 반대로 오독될 수 있음
  - 위치: `.claude/hooks/_lib/review_guard.py:405-417` (`_summary_is_resolved` 함수 docstring)
  - 상세: docstring은 "True when: - X(coverage), AND - Y(RESOLUTION.md), OR - Z(risk 낮음+무행)" 형태의 평면 글머리 목록이다. 실제 코드 로직은 `X AND (Y OR Z)`(coverage가 먼저 충족돼야 하고, 그 다음에 RESOLUTION 존재 **또는** 위험도 낮음+무행 중 하나)이다. 그런데 글머리 목록에는 괄호·들여쓰기로 그루핑이 표시되지 않아, 논리 연산자의 통상 우선순위(AND가 OR보다 먼저 묶임)로 읽으면 `(X AND Y) OR Z`로 해석된다 — 즉 "위험도가 낮고 발견사항이 없으면 forced coverage가 빠져도 resolved"로 잘못 읽힐 소지가 있다. 이는 정확히 이번 PR이 막으려는 결함(RESOLUTION.md만 있거나 위험도만 낮으면 커버리지 누락도 통과시키던 160/575 세션 사고, 그중 107건이 RESOLUTION.md 보유)과 같은 모양의 오독이라 다른 곳보다 위험도가 낮지 않다.
  - 제안: 그루핑을 명시적으로 표기. 예:
    ```
    True when BOTH:
      1. every `agents_forced` reviewer left a report (see `_forced_coverage_missing`), AND
      2. EITHER a sibling RESOLUTION.md exists, OR the report's overall risk is
         NONE/LOW AND neither the Critical nor the Warning table has a data row.
    ```

- **[INFO]** `_forced_coverage_missing`의 "consistency dir that never had one" 부연이 실제 호출 경로와 어긋남
  - 위치: `.claude/hooks/_lib/review_guard.py` `_forced_coverage_missing()`의 `except (OSError, ValueError):` 분기 주석 (355-403행 부근, 신규 함수)
  - 상세: manifest 부재 사례로 "hand-written session"과 "a consistency dir that never had one"을 든다. 그러나 이 함수는 현재 `_summary_is_resolved` → `_newest_resolved_review_mtime` → `_iter_summaries`(`review/code/**` 전용) 경로로만 호출되어 `review/consistency/**` 디렉토리에는 애초에 적용되지 않는다(grep으로 호출부 확인). 또한 consistency-checker 세션은 `_retry_state.json` 자체는 항상 생성하므로(단지 `agents_forced` 키가 없을 뿐), 설령 호출된다 해도 이 `except` 분기가 아니라 바로 아래 `if not forced: return []` 분기로 fail-open 된다. 예시가 실제로는 도달 불가능한 경로를 가리켜 향후 유지보수자에게 혼선을 줄 수 있다.
  - 제안: "hand-written / pre-manifest session" 등으로 단순화하거나, 이 함수를 향후 consistency 세션에도 재사용할 계획이 있다면 그 계획을 명시.

- **[INFO]** README.md("세부 운영 가이드")가 이번 diff의 핵심 동작 변화를 반영하지 않음
  - 위치: `.claude/skills/code-review-agents/README.md` §"Router safety policy" (62-81행) / `_retry_state.json` 스키마 섹션 (128-171행). SKILL.md는 "세부 운영 가이드 (router safety 매트릭스·디버그 로그 위치): `./README.md`"로 안내(해당 줄 자체는 이번 diff 미변경).
  - 상세: README의 Router safety 섹션은 `agents_forced`를 router 단계의 "안전망"으로만 설명한다. 이번 diff로 신설된 "push/stop 가드(`review_guard`)가 forced 커버리지 누락을 RESOLUTION.md 유무와 무관하게 기계적으로 차단한다"는 운영상 중요한 변화와, `--verify-coverage`/`--sync-from-disk`/`--summary-state`·`--resume` 자가 치유 동작은 README에 전혀 언급이 없다(grep 결과 0건: `verify-coverage`, `sync-from-disk`, `summary-state`, `reconcile` 전부 미검출). SKILL.md·`subagent-call-contract.md`는 이미 정확히 반영했으므로 기능적 공백은 아니지만, "세부 운영 가이드"로 README를 가리키는 SKILL.md의 안내와는 어긋난다. (참고: 동일 사유로 `.claude/skills/consistency-checker/`에는 SKILL.md가 참조하는 `./README.md` 자체가 존재하지 않는데, 이는 이번 diff 이전부터의 pre-existing 상태라 이번 변경 범위 밖.)
  - 제안: README의 Router safety policy 섹션 말미에 "미이행 시 review_guard가 push/stop에서 차단(subagent-call-contract.md §7)" 한 줄과, `_retry_state.json` 스키마 섹션 근처에 self-healing 동작 한 줄을 추가.

- **[INFO]** `--sync-from-disk` CLI `--help` 문구가 자가 치유 도입 후에도 예전 뉘앙스 그대로
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:972-976` (`--sync-from-disk` `add_argument` help 문자열)
  - 상세: 같은 파일의 `_sync_from_disk()` 함수 docstring은 "Mostly redundant now — `--summary-state` and `--resume` reconcile on read"로 갱신됐지만, `argparse`의 `--help` 문구는 이전 그대로 "Use after fanning reviewers out with the Agent tool directly, which bypasses --update ..."라 여전히 필수 절차처럼 읽힌다. 소스를 읽지 않고 `--help`만 참고하는 사용자는 자가 치유 사실을 알 수 없다.
  - 제안: help 문구 끝에 "(read paths like --summary-state/--resume now self-heal; explicit call is for fixing a committed session on purpose)" 구절 추가.

## 요약

이번 diff는 review_guard 강제 게이트·orchestrator 자가 치유 로직에 대해 함수 단위 docstring과 SKILL.md·`subagent-call-contract.md` 산문을 대체로 꼼꼼하고 정확하게 갱신했다 — 신규 함수(`_forced_coverage_missing`, `_reconcile_state_with_disk`, `_report_paths`)는 모두 근거·실측 수치(160/575, 537/575 등)를 포함한 상세 docstring을 갖췄고, 두 SKILL.md와 `subagent-call-contract.md`의 "산문 의무 → 기계 강제 + 자동" 전환 서술도 코드 동작과 일치하며, 신규 테스트도 시나리오별 근거 주석이 충실하다. 다만 실질적인 문서 드리프트가 두 곳 남아있다: (1) `review_guard.py` 최상단 모듈 docstring의 "Fresh, resolved review" 정의가 이번에 신설된 forced-coverage 조건을 반영하지 못해 낡았고, (2) `_summary_is_resolved`의 갱신된 docstring은 불리언 우선순위가 모호한 평면 글머리 목록이어서 표준 해석(AND가 OR보다 먼저 묶임)으로 읽으면 이 PR이 막으려던 바로 그 결함("위험도만 낮으면 커버리지 무시")으로 오독될 수 있다 — 코드 자체는 올바르므로 기능적 결함은 아니지만 설명 텍스트의 정확성 문제다. 그 외 README.md 미반영, `_forced_coverage_missing` 부연 설명의 사소한 부정확성, `--sync-from-disk` help 문구의 뉘앙스 차이는 경미한 개선 여지다. 새 환경변수·REST API 엔드포인트·`CHANGELOG.md` 대상(codebase/) 변경은 없어 해당 항목들은 이슈 없음.

## 위험도

MEDIUM — 기능을 차단하는 요소는 없으나(코드·테스트 232건 모두 통과, 게이트 로직 자체는 정확), 게이트 핵심 불변식을 설명하는 두 군데 docstring이 실제 로직과 어긋나거나 오독 위험이 있는 형태로 남아 있어 조치를 권장한다(WARNING 2건). 나머지는 INFO 수준의 사소한 보완 여지.
