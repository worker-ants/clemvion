# Documentation Review — harness Workflow 계약 충돌 fix (P0·P1·P2)

## 발견사항

### [CRITICAL] "terminal write 차단" 오진 서술이 8개 파일에 그대로 남아 본 PR 이 신설한 §7 실측과 정면 모순

- **위치**: `.claude/agents/code-review-summary.md:17`, `.claude/agents/consistency-summary.md:25`, `.claude/agents/integration-risk-summary.md:17`, `.claude/commands/ai-review.md:16`, `.claude/commands/consistency-check.md:17`, `.claude/commands/merge-coordinate.md:35`, `.claude/skills/merge-coordinator/SKILL.md:63`, `.claude/workflows/merge-coordinate.js:76-85`
- **상세**: 본 diff 는 `.claude/docs/subagent-call-contract.md` §7 을 신설해 "차단은 **basename 정확 일치** 규칙이며 **agent 의 terminal 여부와 무관**하다"는 실측(2026-07-17, probe `wf_61290a15-aec` / `wf_45d76e40-507`)을 명문화하고, 그 근거로 `code-review-agents/SKILL.md`·`consistency-checker/SKILL.md` 두 곳의 "terminal summary write 는 차단될 수 있고" 서술을 정정했다 — plan 체크리스트 항목 4가 이를 "정정"으로 표시한다. 그러나 정확히 동일한 취지의 문구(terminal 위치가 차단 원인이라는 인과)가 위 8개 파일에 `grep` 으로 확인된 채 그대로 남아 있다. 그중 `code-review-summary.md`/`consistency-summary.md`/`integration-risk-summary.md` 3개는 배경 문서가 아니라 **summary sub-agent 자신의 system prompt** 다 — 즉 매 실행마다 agent 에게 그대로 주입되는, 이제는 틀린 것으로 판명된 인과 설명이다. 더 심각하게는 `.claude/docs/orchestrator-workflow-migration.md`(2026-05-30, 미변경)가 "**Verified mechanism (5 live probes)**: the block is the harness `worktree.bgIsolation` guard, NOT a report-file guard … filename is irrelevant … every sub-agent — reviewers/checkers/analyzers AND the summary — writes its own file directly (legacy contract restored)" 라고 이번 §7 보다 훨씬 정교하고 확신에 찬 **정반대 진단**을 "CORRECTED diagnosis" 로 못박아 놓았는데, 이 PR 은 이 파일을 전혀 건드리지 않았다. 두 문서 모두 "probe 로 실측 검증됨"을 자처하므로 향후 독자·에이전트가 어느 쪽을 신뢰해야 할지 알 수 없고, 최악의 경우 이번에 도입한 basename 기반 인라인-반환 설계를 "옛 bgIsolation 진단이 맞다"며 되돌릴 위험이 있다 — 이 프로젝트에서 이미 한 번(오리지널 오진 → "CORRECTED diagnosis") 발생한 진단 뒤집기 패턴의 3회차 재발 소지다. 이 파일은 `code-review-agents/SKILL.md §0`, `ai-review.js` 상단 주석에서 지금도 "배경" 링크로 활성 참조된다.
- **제안**: (1) `orchestrator-workflow-migration.md` 의 "CORRECTED diagnosis"/"Verified mechanism" 절 상단에 "2026-07-17 §7 로 재정정됨" 배너 + 상호 링크 추가. (2) 8개 파일의 "terminal (이라서) write 차단" 문구를 basename 기반 서술로 일괄 교체 — 특히 3개 summary agent system prompt 파일이 최우선(실제 실행 중 agent 에게 주입되는 문구이므로).

### [CRITICAL] `merge-coordinate.js` 가 이번에 고친 P0 결함(가짜 success 기본값 · findings 유실)을 그대로 보유

- **위치**: `.claude/workflows/merge-coordinate.js:54-57`(`parseStatus` 미변경), `:59-68`(Analyze phase 에 REVIEWER_CONTRACT 류 지시 없음)
- **상세**: `plan/in-progress/harness-workflow-contract-fix.md` 의 P0 결함 사슬은 "`.claude/workflows/{consistency-check,ai-review}.js` 의 `parseStatus` 가 `return m ? m[1] : 'success'`" 를 근본 원인으로 지목하고 두 파일만 고쳤다(`parseAgentReturn` 로 교체, 기본값 `'no_status'`, 전문 인라인 회수). 그러나 세 번째 형제 workflow 인 `merge-coordinate.js` 는 동일한 `parseStatus`(줄 54-56, STATUS 없으면 `'success'`)를 그대로 가지고 있고, 4개 analyzer 를 fan-out 하는 `phase('Analyze')` 호출(줄 61-68)에는 `REVIEWER_CONTRACT`/`CHECKER_CONTRACT` 에 해당하는 "STATUS + delimiter + 전문 반환" 지시가 추가되지 않았다. 신설된 `subagent-call-contract.md §7` 이 명시하듯 "텍스트로 반환하라"는 하네스 지시는 **차단되지 않는 파일명에도** 걸려 sub-agent 가 Write 를 건너뛰는 일이 흔하다(§7 실측: "5개 checker 중 4개가 Write 호출 0회"). 즉 analyzer 가 `output_file` Write 를 건너뛰고 prose 로만 반환하면, `merge-coordinate.js` 는 구버전 로직 그대로 그 본문을 어디에도 보존하지 않고 STATUS 라인이 없으니 `'success'` 로 오판한다 — `/merge-coordinate` 의 `BLOCK: YES/NO` 판정이 바로 이 PR 이 고치려는 것과 동일한 클래스의 거짓 음성에 그대로 노출돼 있다. plan 파일 어디에도 이 제외가 의도적이라는 근거가 없다 — "결함 사슬" 근거 수집이 `review/code`·`review/consistency` 세션만 인용하고 `review/merge` 세션은 언급하지 않는 것으로 볼 때 사각지대로 보인다.
- **제안**: `merge-coordinate.js` 에도 동일한 `parseAgentReturn`/analyzer-contract/`recovered[]` 패턴을 적용하거나, 최소한 plan 에 "merge-coordinate 는 이번 스코프 제외, 후속 이슈로 추적" 을 명시하고 `merge-coordinator/SKILL.md` 및 관련 커맨드 문서에 알려진 제약(known gap)으로 기록해야 한다. 기능적 확인은 architecture/testing 리뷰어와 교차 검증 권장.

### [WARNING] consistency-checker fallback 절이 code-review-agents 스크립트를 설명 없이 재사용 — reviewer 전용 문구·예시가 그대로 노출

- **위치**: `.claude/skills/consistency-checker/SKILL.md` (fallback 경고 블록, `--sync-from-disk` 예시), `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` `_sync_from_disk` docstring 및 `--sync-from-disk` argparse help
- **상세**: consistency-checker SKILL.md 의 "직접 fan-out 은 상태 기록 책임이 main 으로 넘어온다" 경고 블록은 `python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --sync-from-disk <session_dir>` 를 실행하라고 안내한다 — **다른 skill 의 스크립트**를 consistency-checker 세션에 대해 호출하라는 지시다. 실제로 `consistency_orchestrator.py` 에는 `--sync-from-disk`/`--verify-coverage` 가 구현돼 있지 않다(`grep` 무결과로 확인). 두 오케스트레이터가 `_retry_state.json` 스키마(`subagent_invocations`/`agents_pending`/`agents_success`/`agents_fatal`)를 공유하므로 기능적으로는 동작하지만, 이 사실이 SKILL.md 어디에도 설명돼 있지 않아 처음 보는 독자는 오탈자/복붙 실수로 오인하기 쉽다. 게다가 재사용되는 함수 자체의 문서도 "reviewer" 전용 어휘·예시를 쓴다 — `_sync_from_disk` docstring 은 "the sibling SUMMARY.md reports **8/14** success"(14 는 code-review-agents 의 reviewer 총수)를 예로 들고, `--sync-from-disk` 의 argparse help 는 "Reconcile … the **reviewer** files …" 라고 쓴다. consistency-checker 컨텍스트(checker 5개)에서 `--help` 를 확인하면 문맥이 어긋난다.
- **제안**: consistency-checker SKILL.md 경고 블록에 "code-review-agents 와 `_retry_state.json` 스키마를 공유하므로 이 CLI 를 재사용합니다" 한 줄 추가. `_sync_from_disk`/`--sync-from-disk` 문서 문구를 "reviewer/checker" 또는 "sub-agent" 등 skill-불특정 어휘로 완화.

### [WARNING] `code-review-agents/README.md` 의 "sub-agent return contract" 절이 이번 diff 의 Workflow 기본 경로와 모순

- **위치**: `.claude/skills/code-review-agents/README.md:175-183`
- **상세**: README 는 "본문은 sub-agent 가 `output_file` 에 Write 한다 — main 에게 본문을 반환하지 않는다 (main 의 context window 부담 최소화)" 라고 단정한다. 그러나 이번 diff 로 `ai-review.js`/`consistency-check.js` 의 **기본** Workflow 경로는 정반대로, 모든 reviewer/checker 가 항상 `STATUS + delimiter + 전문`을 반환하도록 강제한다(`REVIEWER_CONTRACT`/`CHECKER_CONTRACT`, `subagent-call-contract.md §2` 신설 예외 + §7). README 는 이번 diff 의 대상 파일이 아니어서 갱신되지 않았고, "본문을 반환하지 않는다"는 서술은 이제 direct-Agent fallback 경로에만 해당하는데 그 범위 제한이 명시돼 있지 않아 README 만 읽은 독자는 최신 Workflow 계약과 반대로 이해하게 된다.
- **제안**: 해당 절 앞에 "(direct Agent fan-out 경로 한정 — Workflow 기본 경로는 `subagent-call-contract.md §7` 참고)" 같은 스코프 한정 문구 추가.

### [INFO] `ai-review.js`/`consistency-check.js` 의 반환값 요약 주석이 신규 안전 필드를 완전히 커버하지 않음

- **위치**: `.claude/workflows/ai-review.js` Summary phase 진입 직전 "Return contract:" 블록, `.claude/workflows/consistency-check.js` return 문 인근
- **상세**: `ai-review.js` 의 "Return contract:" 주석은 `summary_output`/`summary_markdown`/`summary_written` 세 필드만 나열하고, 이번 diff 로 추가된 안전-관련 필드 `recovered[]`/`forced_missing[]`/`reviewers[].has_report` 는 언급하지 않는다(각 필드 선언부에 개별 인라인 주석은 있어 완전 미문서화는 아님). `consistency-check.js` 는 애초에 이런 "Return contract:" 요약 블록 자체가 없다. SKILL.md 쪽 설명은 충실하지만, 구현에 가장 가까운 코드 주석에는 새 필드가 반영되지 않아 코드만 보는 유지보수자에게는 간극이 있다.
- **제안**: 필수는 아니나 "Return contract" 블록에 새 필드 3-4개를 한 줄씩 추가하면 코드-주석 동기화가 더 견고해진다.

### [INFO] 잘 문서화된 부분 (참고)

- Python 신규 함수 `_sync_from_disk`/`_verify_coverage`/`_require_target`(둘 다 `code_review_orchestrator.py`, 후자는 `consistency_orchestrator.py`)는 "왜 이 함수가 필요한가"를 날짜·세션 근거(2026-07-17, 7개 세션/5-checker fan-out 낭비 등)와 함께 명시하는 우수한 docstring 을 갖췄다.
- 신규 테스트 `test_consistency_target_validation.py`, `test_orchestrator_state.py` 추가분 모두 모듈/케이스 docstring 에 "이 테스트가 막는 실제 사고"를 명시해 회귀 방지 의도가 분명하다.
- `subagent-call-contract.md §7` 은 실측 basename 차단/허용 표를 근거로 명확히 코드화했고, 세 워크플로 주석(ai-review.js/consistency-check.js) 및 SKILL.md 2곳과 표 내용이 서로 일치한다(단, 위 CRITICAL 항목에서 지적한 8개 파일에는 전파되지 않음).

## 요약

이번 diff 에 포함된 10개 파일 자체는 문서화 수준이 높다 — 신규 Python 함수와 테스트는 날짜·세션 근거가 명시된 우수한 docstring 을 갖췄고, `subagent-call-contract.md §7` 은 하네스의 미묘한 Write 차단 규칙을 실측 표로 정확히 코드화했으며, 두 SKILL.md(code-review-agents·consistency-checker)는 스스로 예전의 잘못된 "terminal write 차단" 인과 설명을 정정하는 드문 사례다. 그러나 바로 그 정정이 **완전히 전파되지 않았다**: 동일한 "terminal 이라서 차단된다"는 취지의 문구가 grep 으로 확인된 것만 최소 8개 파일(그중 3개는 summary sub-agent 자신의 system prompt)에 남아 새 §7 실측과 직접 모순되며, `orchestrator-workflow-migration.md` 는 이보다 더 정교한 반대 진단("bgIsolation guard, not report-file guard")을 "확정(CORRECTED)"으로 서술한 채 방치돼 있어 향후 세 번째 진단 뒤집기 위험을 안고 있다. 더 심각한 것은, 이 PR 이 고치는 P0 결함 클래스("STATUS 없으면 success 로 오판 + findings 유실 → BLOCK/RISK 거짓 음성")가 세 번째 형제 workflow 인 `merge-coordinate.js` 에는 전혀 적용되지 않아 그대로 남아 있다는 점이다 — 이는 단순 문서 불일치를 넘어 실제 안전 가드 회귀 위험이며, 이미 이 프로젝트에서 3회 이상 실측된 것과 같은 실패 패턴이다. 그 외 consistency-checker 가 code-review-agents 스크립트를 설명 없이 재사용하는 점과 README.md 의 구식 return-contract 서술은 상대적으로 경미한 명확성 문제다.

## 위험도

HIGH
