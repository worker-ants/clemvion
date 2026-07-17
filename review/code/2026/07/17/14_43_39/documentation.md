# 문서화(Documentation) 리뷰 보고서

## 발견사항

- **[WARNING]** `.claude/tests/README.md` 의 "What's covered" 카탈로그 표에 신설 `test_summary_agent_contract.py` 미등재
  - 위치: `.claude/tests/README.md` (라인 19-29 표), 신설 파일 `.claude/tests/test_summary_agent_contract.py`
  - 상세: `README.md` 는 `.claude/tests/` 하위 각 테스트 파일이 "무엇을 guard 하는지" 를 표로 인덱싱하는 명시적 컨벤션을 갖고 있다("## What's covered"). 이번 diff 는 `test_summary_agent_contract.py` 를 신설했지만(모듈 docstring 이 매우 상세하고 가치 있는 배경 설명을 담고 있음 — agent 정의가 반증된 메커니즘을 가르치고 있었고 PR #962 와 직접 모순됐다는 이력) 이 표에는 행을 추가하지 않았다. 확인해 보니 이 표는 이미 이전부터 상당히 낡아 있었다 — 현재 `.claude/tests/*.py` 19개 중 표에 등재된 것은 9개뿐이고(`test_check_e2e_playwright_config.py`, `test_consistency_impl_done.py`, `test_consistency_orchestrator_state.py`, `test_consistency_target_validation.py`, `test_plan_guard.py`, `test_reap_merged_worktrees.py`, `test_report_playwright_flaky.py`, `test_run_test_watchdog.py`, `test_workflow_scripts.py` 도 이미 누락) 이번 diff 가 그 격차를 만든 것은 아니다. 다만 이 diff 의 취지 자체가 "문서 드리프트를 막는 계약 테스트 신설" 이라는 점에서, 그 테스트 자신이 색인에서 빠지는 것은 특히 아쉽다.
  - 제안: `README.md` 표에 한 줄 추가 — 예: `| test_summary_agent_contract.py | 3 summary agent 시스템 프롬프트가 실제 workflow(.claude/workflows/*.js) 가 보내는 입력과 어긋나지 않는지 고정(basename 차단 규칙·인라인 전문 지시 양방향 pin). |`. 표 전체의 광범위한 누락은 이번 diff 범위를 넘으므로, 즉시 고치기 부담스럽다면 `plan/in-progress/harness-report-contract-followups.md` 에 항목을 하나 추가해 추적하는 것도 대안.

- **[INFO]** 신규 하이퍼링크와 기존 인라인-코드 인용이 파일별로 혼용됨 (`subagent-call-contract.md §7` 참조 스타일 불일치)
  - 위치: `.claude/commands/ai-review.md:16`, `.claude/commands/consistency-check.md:17`, `.claude/commands/merge-coordinate.md:35` vs `.claude/agents/{code-review-summary,consistency-summary,integration-risk-summary}.md`, `.claude/skills/merge-coordinator/SKILL.md`
  - 상세: 3개 agent 정의 파일과 `merge-coordinator/SKILL.md` 는 새로 추가된 근거 문장에서 `subagent-call-contract.md §7` 를 실제 마크다운 하이퍼링크로 건다 (예: `[`subagent-call-contract.md §7`](../docs/subagent-call-contract.md)`, 상대경로 모두 실제 파일로 정상 resolve 됨을 확인함). 반면 3개 command 파일(`ai-review.md`/`consistency-check.md`/`merge-coordinate.md`)은 동일 근거 문장에서 같은 대상을 인라인 코드 텍스트로만 인용하고(``subagent-call-contract.md §7``) 어디에도 실제 링크를 걸지 않는다 — grep 결과 이 3개 command 파일 전체에서 `subagent-call-contract` 문자열이 등장하는 곳은 이 한 줄씩뿐이라, 그 문서 안에는 클릭 가능한 경로가 아예 없다. 내용은 정확하므로 기능적 결함은 아니지만, 같은 커밋에서 같은 근거를 인용하는 방식이 파일군에 따라 갈리는 것은 사소한 일관성 흠이다.
  - 제안: command 3개 파일도 `[`subagent-call-contract.md §7`](../docs/subagent-call-contract.md)` 형태로 통일 (동일 depth `.claude/commands/` → `../docs/...`).

- **[INFO]** 3개 agent 정의 파일이 인용하는 "실측" 예시 파일명이 서로 다름 — SoT 의 실제 probe 대상과 부분적으로 불일치
  - 위치: `.claude/agents/code-review-summary.md` ("terminal agent 의 `security.md` Write 는 성공"), `.claude/agents/consistency-summary.md` ("terminal agent 의 `cross_spec.md` Write 는 성공"), `.claude/agents/integration-risk-summary.md` ("terminal agent 의 일반 파일 Write 는 성공") vs `.claude/docs/subagent-call-contract.md §7`
  - 상세: SoT(`subagent-call-contract.md §7`)가 실제로 실측했다고 명시하는 probe 는 `wf_61290a15-aec`(비-terminal → `SUMMARY.md` 차단 / terminal → **`cross_spec.md`** 성공) 하나뿐이다. `consistency-summary.md` 는 이 실제 probe 파일명을 정확히 인용하지만, `code-review-summary.md` 는 `security.md` 로, `integration-risk-summary.md` 는 "일반 파일" 로 각색해 인용한다. "basename 정확 일치, terminal 무관" 이라는 규칙 자체는 일반화 가능하므로 틀린 진술은 아니지만, `security.md` 를 별도로 실측한 것처럼 읽힐 여지가 있다.
  - 제안: 세 파일 모두 §7 이 실제로 측정한 `cross_spec.md` 를 예시로 통일하거나, "예시로" 라는 프레이밍을 명시해 실측 대상과 일반화된 예시를 구분.

- **[INFO]** `test_summary_agent_contract.py` 의 테스트 메서드 절반이 인라인 근거 주석 없음
  - 위치: `.claude/tests/test_summary_agent_contract.py` — `test_every_definition_states_the_basename_rule` (근거 주석 없음), `test_every_definition_tells_the_agent_to_persist_missing_files`/`test_no_definition_still_blames_terminal_position`/`test_workflows_actually_send_what_the_definitions_expect` (근거 주석 있음)
  - 상세: 모듈 최상단 docstring 이 전체 배경을 매우 잘 설명하고 있어 심각하지 않으나, `test_every_definition_states_the_basename_rule` 만 유일하게 "왜 이 assertion 인지" 에 대한 인라인 설명이 없다. 사소하지만 향후 이 파일을 수정하는 사람이 문맥 없이 이 한 메서드만 볼 경우 "basename" 이라는 정확한 문자열을 왜 강제하는지 바로 알기 어려움.
  - 제안: `# The correct mechanism this replaces "non-terminal"/"terminal" with.` 정도의 1줄 주석 추가.

## 검증 노트 (문제 아님 — 확인 완료)

- `.claude/docs/subagent-call-contract.md §7` (하네스 제약, 실측 2026-07-17)이 실제로 존재하며, diff 가 인용하는 "basename 정확 일치·terminal 무관" 주장과 표를 그대로 담고 있음을 확인. 3개 agent 파일·`merge-coordinator/SKILL.md` 의 상대경로 링크(`../docs/...`, `../../docs/...`) 모두 실제 파일로 정상 resolve.
- `.claude/workflows/{ai-review,consistency-check,merge-coordinate}.js` 에 이미 `누락 파일 영속화`·`inlineReports` 문자열이 존재함을 확인 — 신설 테스트 `test_workflows_actually_send_what_the_definitions_expect` 가 검증하는 대상이 실제로 참임. `test_summary_agent_contract.py` 4건을 직접 실행해 전부 `OK` 확인.
- `.claude/skills/code-review-agents/SKILL.md`, `.claude/skills/consistency-checker/SKILL.md` (diff 밖 파일)는 이미 "basename" 서술로 정정되어 있어, 이번 diff 가 언급하는 "복제된 7곳"(agent 3 + command 3 + merge-coordinator SKILL 1)에서 빠짐없이 정합함을 재확인. `.claude/docs/orchestrator-workflow-migration.md` 도 같은 날짜(2026-07-17)에 별도 "재정정" 절로 이미 일관됨.
- `CHANGELOG.md` 는 `codebase/` 제품 변경 전용으로 운용되며(과거 harness-only 커밋들도 CHANGELOG 미기재 전례 확인), 이번 diff 는 `.claude/**`+`plan/**` 뿐이라 CHANGELOG 미변경이 기존 컨벤션과 일치. README(레포 루트)·API 문서·신규 환경변수·예제 코드 항목은 이번 diff 범위에 해당 사항 없음.
- `plan/complete/forced-coverage-gate.md` 의 frontmatter `spec_impact: none` + 근거 주석은 `.claude/docs/plan-lifecycle.md` §4 Gate C 요건을 충족. `plan/in-progress/harness-report-contract-followups.md` 의 `worktree: (unstarted)`/`started`/`owner` 3필드도 스키마 준수. 이번 "terminal 정정" 자체가 별도 `plan/in-progress/*.md` 없이 진행된 점은, `plan-lifecycle.md` 가 "연결된 plan 이 없는 ad-hoc/hotfix 작업은 차단되지 않는다" 고 명시적으로 허용하는 escape 이므로 결함 아님.
- 커밋 메시지(`78ffd9983`)가 변경 이유·검증 방법(mutation 검증 2건 red/green, 하네스 247 OK)·이관 사유를 상세히 기록 — 문서화 관점에서 모범 사례.

## 요약

이 diff 는 문서화 관점에서 전반적으로 **양(+)의 변화**다 — 3개 summary agent 의 system prompt(런타임에 에이전트가 실제로 읽는 지시문)에 반증된 기술 설명("terminal 위치 때문에 차단")이 7개 파일에 복제돼 있던 것을 실측으로 검증된 올바른 설명("basename 정확 일치")으로 일괄 정정하고, 이 정합을 지키는 회귀 테스트(`test_summary_agent_contract.py`)까지 신설해 재발을 구조적으로 막았다. SoT(`subagent-call-contract.md §7`) 링크는 모두 실제로 resolve 되고 내용도 정확히 일치하며, 워크플로 스크립트가 실제로 보내는 입력과 에이전트 정의의 기대가 어긋나지 않음을 직접 실행으로 재확인했다. 남은 이슈는 모두 경미하다 — `.claude/tests/README.md` 테스트 카탈로그에 신설 테스트가 반영되지 않은 것(다만 이 표는 이전부터 절반 이상 누락된 상태라 이번 diff 고유의 퇴행은 아님), 그리고 인용 스타일(하이퍼링크 유무·예시 파일명)의 사소한 불일치 몇 건이다. CHANGELOG·README(루트)·API 문서·설정 문서·예제 코드는 이번 diff 성격(내부 하네스 프롬프트 정정)상 해당 사항이 없다.

## 위험도

LOW
