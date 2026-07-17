# Requirement Review — forced-coverage-gate (W2)

## 발견사항

### 1. [WARNING] consistency-checker SKILL.md 가 구현되지 않은 자가 치유(self-heal)를 "자동" 이라고 주장
- 위치:
  - `.claude/skills/consistency-checker/SKILL.md:94` (이번 diff 가 신규 추가한 문장)
  - 관련 공유 규약: `.claude/docs/subagent-call-contract.md` §7 (신규 추가된 "상태 기록은 신경 쓰지 않아도 된다" 단락, code-review-agents 전용으로 범위가 좁혀져 있지 않음)
- 상세: 이번 diff 의 핵심 구현(Part B, 상태 자가 치유)은 **`code_review_orchestrator.py` 에만** 적용됐다 — `_reconcile_state_with_disk()` 신설, `_emit_summary_state`(`--summary-state`) 와 `--resume` 핸들러가 이를 호출하도록 변경(`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:158-234`, `:1017-1023`). 그런데 `consistency-checker/SKILL.md` 는 동시에 다음 문장을 새로 추가했다:
    > "**상태 기록은 자동이다** — `--summary-state`/`--resume` 가 읽을 때 디스크로 자가 reconcile 하므로 수동 호출 의무는 없다."
  이 diff 는 `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 를 전혀 건드리지 않았다(`git diff origin/main...HEAD --stat -- .claude/skills/consistency-checker/` → `SKILL.md` 1개 파일만 변경). 실제로 그 스크립트의 `_emit_summary_state`/`--resume` 는 이전 그대로이며 disk 재조정 로직이 없다. 직접 재현:
  ```
  # cross_spec.md, naming_collision.md 둘 다 디스크에 존재하는 상태에서
  $ python3 .claude/skills/consistency-checker/scripts/consistency_orchestrator.py --summary-state <dir>
  pending=2 success=0 fatal=0 last_reset=null      # ← 거짓 — 실제로는 2/2 성공
  $ python3 .claude/skills/consistency-checker/scripts/consistency_orchestrator.py --resume <dir>
  # _retry_state.json 그대로: agents_success=[] agents_pending=['cross_spec','naming_collision']
  ```
  이는 정확히 이 PR 이 없애려는 "커밋된 증거가 서로 모순" 버그(SUMMARY 는 성공을 보고하는데 `_retry_state.json` 은 그대로 pending)를 **consistency-checker 쪽에서는 그대로 재현**하면서, 새 문서는 "신경 쓰지 않아도 된다" 고 반대로 말한다. 같은 SKILL.md 90행이 이미 "state CLI 는 `test_orchestrator_state.py` 류로 검증되는 안정 인터페이스" 라고 적어 두 orchestrator 를 혼용해 온 전례(이번 diff 이전부터 있던 문구)가 있어, 이번 신규 문장이 그 혼용을 한 겹 더 쌓은 모양이다 — `test_orchestrator_state.py` 는 `code_review_orchestrator.py` 만 구동하며, `consistency_orchestrator.py` 의 상태 CLI(`--summary-state`/`--resume`/`--update`)는 테스트가 전혀 없다.
  - 실질 영향은 제한적이다: consistency-checker 의 BLOCK 판정은 `_retry_state.json` 이 아니라 `SUMMARY.md` 의 `BLOCK:` 줄만 보므로(안전 게이트 자체가 이 상태에 의존하지 않음), 이 gap 은 `/loop --resume` 재진입 시 이미 끝난 checker 를 헛되이 재호출하거나 `--summary-state` 가 오도하는 숫자를 보고하는 수준에 그친다. 문서에 남아 있는 수동 우회(`code_review_orchestrator.py --sync-from-disk <session_dir>`, 90-97행)는 상태 스키마가 호환되어 실제로 정상 동작함을 직접 확인했다(같은 consistency 세션 디렉토리에 대해 `success=1 pending=1` 로 정확히 동기화됨).
- 제안: 둘 중 하나로 정합화. (a) `_reconcile_state_with_disk` 와 동등한 자가 치유를 `consistency_orchestrator.py` 의 `_emit_summary_state`/`--resume` 에도 이식해 실제로 "자동" 을 만든다(이 PR 의 취지와 가장 부합). (b) 당장 이식이 어렵다면 `consistency-checker/SKILL.md:94` 와 `subagent-call-contract.md` §7 의 "자동" 서술을 code-review-agents 한정으로 명시적으로 좁히고, consistency-checker 절에는 여전히 `--sync-from-disk` 수동 호출이 필요하다고 되돌린다.

### 2. [INFO] `_forced_coverage_missing` 이 `subagent_invocations` 의 비-list 형태(malformed) 를 방어하지 않음
- 위치: `.claude/hooks/_lib/review_guard.py:649-674` (`_forced_coverage_missing`)
- 상세: `except (OSError, ValueError)` 는 파일 열기·JSON 파싱 실패만 잡는다. `_retry_state.json` 이 문법적으로는 유효한 JSON이지만 `"subagent_invocations": null` 처럼 예상 밖 타입이면 `for i in state.get("subagent_invocations", [])` 이 `TypeError` 를 던진다(직접 재현 확인). 모듈 독스트링이 스스로 약속하는 "any internal error (fail-open)" 계약은 함수 자체가 아니라 호출부인 `guard_review_before_push.py`/`guard_review_before_stop.py` 의 `try/except Exception` 이 떠받치고 있어(둘 다 직접 확인) 실제 차단으로 이어지지는 않지만, 방어 위치가 이 함수 자신이 아니라 상위 호출자에 암묵적으로 의존한다. 오케스트레이터가 이런 값을 쓴 적은 없어(`prepare_session` 은 항상 list) 실무적으로 도달 가능성은 낮다. 같은 파일의 기존 `_is_impl_done_session`/`_summary_block_is_no` 등도 동일하게 좁은 except 를 쓰는 기존 관례라 이 diff 만의 새로운 패턴은 아니다.
- 제안: 여유가 있다면 `except (OSError, ValueError, TypeError)` 로 넓히거나 `state.get("subagent_invocations") or []` 형태로 방어. 필수는 아님(상위 fail-open 이 실제 차단 결과를 막아 준다).

### 3. [INFO] `spec/` 에 이 변경을 규율하는 문서가 없음 (예상된 결과)
- 위치: N/A — `spec/` 전수 검색(`review_guard`, `agents_forced`, `code-review-agents`, `_retry_state`)에서 관련 문서를 찾지 못함(우연히 매칭된 `spec/5-system/4-execution-engine.md`·`6-websocket-protocol.md` 의 `_retryState` 는 실행 엔진의 노드 재시도 상태로 이 변경과 무관한 동명이인).
- 상세: 이 변경은 전부 `.claude/**`(하네스 리뷰 게이트 자체) + `plan/**` 이며 `codebase/**` 를 건드리지 않는다. `review_guard.py` 자신의 모듈 독스트링에도 "Scope decision — only `codebase/**` counts as 'code that needs review'" 라고 명시되어 있어, 이 영역은 애초에 `spec/`(제품 정의) 의 대상이 아니라 `.claude/docs/subagent-call-contract.md` + 두 SKILL.md 가 사실상의 SoT 다. 위 발견사항 1 을 제외하면 이 SoT 문서들과 코드 구현은 line-level 로 일치한다(§7 의 "판정은 세션 디렉토리의 리포트 파일 기준", "RESOLUTION.md 가 있어도 인정되지 않는다" 등 모두 코드와 정확히 매치).
- 제안: 조치 불필요(정보 제공 목적).

## 기능 완전성 점검 요약 (핵심 구현)

- `_forced_coverage_missing()`(review_guard.py:627) + `_summary_is_resolved()`(:677) 편입: plan 이 선언한 공식 "forced 전원 산출물 존재 ∧ (RESOLUTION.md ∨ 위험도 NONE/LOW+무행)" 과 정확히 일치. `missing_forced` 체크가 RESOLUTION.md 존재 확인보다 **먼저** 실행되어 "RESOLUTION.md 가 있어도 인정 안 됨" 요구사항을 정확히 구현.
- 경로 오탐 버그 fix: `_report_paths()`(orchestrator) / `_forced_coverage_missing()`(review_guard) 둘 다 `output_file` 의 절대경로 대신 `os.path.join(session_dir, os.path.basename(recorded))` 로 세션-상대 해소 — "삭제된 워크트리" 시나리오를 커버.
- 판정은 `agents_success` 등 자기보고 상태가 아니라 디스크 파일 존재로만 이뤄짐 — "꾸민 success" 방어 요구사항 충족(테스트로 확인).
- `agents_forced` 비어있거나 manifest 자체가 없으면 fail-open(`[]` 반환) — 수기 세션/구 히스토리 무영향 요구사항 충족.
- `_reconcile_state_with_disk()` 는 `agents_success`/`agents_pending` 만 재계산하고 `rate_limit_episodes`/`last_reset_hint_sec` 는 보존 — "rate-limit 부기 보존" 요구사항 충족(`test_reconcile_on_read_preserves_rate_limit_bookkeeping` 로 검증).
- 엣지 케이스(빈 forced 리스트, manifest 부재, corrupt JSON, claimed-success-without-file, dead-worktree path) 전부 전용 테스트로 커버, 232개 하네스 테스트 전체 통과 확인(`python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 직접 실행 — Ran 232 tests, OK). plan 의 자체 보고("하네스 232 OK")와 일치.
- TODO/FIXME/HACK/XXX 계열 주석 없음(diff 전수 grep 확인).
- 실측: 이 브랜치 자체는 `codebase/**` 변경이 없어 신설된 게이트가 자기 자신에는 적용되지 않음(`evaluate_review()` 직접 호출 → `blocked=False, reason="no codebase/ changes..."`) — 설계상 정상(하네스 자기 변경은 `ai-review` 범위 밖, `consistency-check` 영역).

## 요약

핵심 배포물인 `review_guard.py` 의 forced-coverage 하드 게이트(Gate A)와 워크트리 경로 오탐 fix 는 plan 이 선언한 공식·롤아웃 방침과 line-level 로 정확히 일치하며, 엣지 케이스(빈 리스트/manifest 부재/corrupt JSON/꾸민 success/삭제된 워크트리)를 전용 테스트로 촘촘히 커버하고 하네스 전체 232 테스트가 통과함을 직접 재현 확인했다. 다만 문서만 갱신되고 구현은 이식되지 않은 비대칭이 하나 있다 — `consistency-checker/SKILL.md` 가 "`--summary-state`/`--resume` 가 자동으로 디스크와 자가 reconcile 한다" 고 신규로 주장하지만, 실제로 그 자가 치유(`_reconcile_state_with_disk`)는 이번 diff 에서 `code_review_orchestrator.py` 에만 구현됐고 `consistency_orchestrator.py` 는 손대지 않아 이전과 동일하게 stale 상태로 남는다(직접 재현: 두 checker 보고서가 모두 디스크에 있어도 `--summary-state` 는 `success=0` 을 보고). 이 PR 이 바로 "산문 의무는 압력 속에 무너진다" 는 진단에서 출발했다는 점에서, 같은 성격의 문서-구현 괴리를 인접 서브시스템에 남긴 것은 아이러니하지만, 실제 BLOCK 판정은 `_retry_state.json` 이 아니라 `SUMMARY.md` 의 `BLOCK:` 줄에만 의존하므로 안전 게이트 자체를 무력화하지는 않고 영향은 `/loop` 비효율·상태 라인 오보 수준으로 제한된다.

## 위험도

MEDIUM
