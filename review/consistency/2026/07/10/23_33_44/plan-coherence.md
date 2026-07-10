# Plan 정합성 검토 — llm-usage-attr-hardening-4648ca (--impl-done)

diff: `git diff origin/main...HEAD` (커밋 `5e6f70b76` 코드 + `bc1810eb3` review 산출물).
plan 파일(`plan/in-progress/resume-llm-usage-attribution.md`) 은 diff 에 **포함되지 않음**(주장대로 확인됨 — `git diff origin/main...HEAD -- plan/in-progress/resume-llm-usage-attribution.md` 무출력).

교차 검증을 위해 `#898` 실제 branch(`.claude/worktrees/llm-usage-doc-alignment-01d7a4`, 로컬에 실재)의 diff 를
직접 읽어 2차 소스가 아닌 1차 소스로 확인했다.

## 발견사항

### [Warning] RESOLUTION.md §1 종결 조건이 plan 내 미체크 항목(라인 53) 을 빠뜨림 — Q2

- target 위치: `review/code/2026/07/10/23_20_30/RESOLUTION.md:39-43` ("종결 조건 (후속 pass 가 할 일)" — "INFO#1·INFO#4 를 `[x]` 로 갱신 → 그 시점에 잔여 follow-up 이 전부 소진되므로 ... `git mv` → `plan/complete/`")
- 관련 plan: `plan/in-progress/resume-llm-usage-attribution.md:53` — `## 워크플로 체크리스트` 절의 `- [ ] PR (push + gh pr create)` 가 **여전히 미체크**. `plan-lifecycle.md:68` 의 이동 전 self-check("본 PR 의 변경으로 plan 의 **모든** 체크박스가 `[x]` 인가")은 섹션 구분 없이 문서 전체를 대상으로 한다.
- 상세: `#898`(로컬 `llm-usage-doc-alignment-01d7a4` 워크트리, commit `895087c2a`, 아직 origin/main 미머지) 의 실제 diff 를 직접 읽어 확인한 결과, `#898` 은 정확히 "잔여 follow-up" 4항목(2건 실편집 + 2건 no-op 종결) + "최종 review INFO" 중 INFO#3 만 `[x]` 로 체크한다 — plan-coherence(22_52_18) 의 사전 서술과 일치. 그런데 그 diff 에는 `## 워크플로 체크리스트` 절의 라인 53 은 포함돼 있지 않다. 이 항목은 이미 main 에 머지된 `#879`(`fix(ai): resume 턴 llm_usage_log attribution 소비 사이트 교정 ... (#879)`, `origin/main` 커밋 `79669505c`) 가 남긴 pre-existing 미체크 상태로 — 그 PR 이 실제로 push/merge 됐음에도(즉 이 checklist 항목이 서술하는 작업 자체는 이미 실행됨) 체크박스만 flip 되지 않은 채 남아 있다. 따라서 `#898` + 본 PR(INFO#1·INFO#4) 이 모두 반영돼도 문서에는 여전히 라인 53 하나가 `[ ]` 로 남아, RESOLUTION 이 말하는 "잔여 follow-up 전부 소진 → `plan/complete/` 이동 가능" 이 문자 그대로는 성립하지 않는다.
- 제안: 이 자체가 지금 당장 고쳐야 할 결함은 아니다(본 PR 범위 밖, `#879`·`#898` 어느 쪽 diff 에도 포함되지 않았던 pre-existing 누락). 다만 RESOLUTION.md §1 이 명시한 "종결 조건" 목록에 이 항목을 추가해야 정확하다 — 후속 최종 consolidation pass(RESOLUTION 이 예고한 "durable 후속")가 INFO#1·INFO#4 뿐 아니라 **라인 53도 함께 `[x]` 로 갱신**해야 실제로 `plan-lifecycle.md` §5 self-check 를 통과하고 `git mv → plan/complete/` 가 가능하다. RESOLUTION.md 또는 task chip(`task_e03a0b87`) 설명에 이 한 줄을 보강 권고. spec_impact 후보 목록(5개 spec 파일 — `spec/1-data-model.md`, `spec/5-system/4-execution-engine.md`, `spec/data-flow/7-llm-usage.md`, `spec/data-flow/6-knowledge-base.md`, `spec/data-flow/13-agent-memory.md`) 자체는 `#898` diff 와 대조해 정확함을 확인했다 — 이 부분은 정정 불요.

### [Info] Q1/Q3 — plan 체크박스 미갱신은 push-gate 를 우회하는 게 아니라,애초에 gate 가 이 plan 에 대해 armed 되지 않은 상태

- target 위치: `plan/in-progress/resume-llm-usage-attribution.md:2` (`worktree: elastic-shannon-e52824`)
- 관련 근거: `.claude/hooks/_lib/plan_guard.py:206-224`(`_linked_plans` — 현재 worktree 디렉토리 basename 또는 `claude/` 를 뗀 branch 명과 plan 의 정규화된 `worktree:` 값이 일치할 때만 "연결된 plan"), `:291-314`(`evaluate_plan` — `plan_rels` 가 빈 리스트면 `none`(미차단) 반환)
- 상세: 현재 worktree 디렉토리 basename `llm-usage-attr-hardening-4648ca`, 현재 branch `claude/llm-usage-attr-hardening-4648ca` → 매칭 키 `{"llm-usage-attr-hardening-4648ca"}`. `plan/in-progress/*.md` 전체를 grep 한 결과(`worktree:` 필드 전수 확인) 이 키와 일치하는 plan 은 **하나도 없다** — `resume-llm-usage-attribution.md` 의 `worktree:` 값은 `elastic-shannon-e52824`(직전 세션의 워크트리)로 그대로 남아 있다. 따라서 `_linked_plans()` 는 빈 리스트를 반환하고 `evaluate_plan()` 은 `PlanDecision(untouched=False, ...)` 을 돌려줘 **push 는 애초에 차단되지 않는다** — plan 파일을 안 건드려서 "통과한" 것이 아니라, 이 worktree/branch 조합에 대해 gate 자체가 이 plan 을 인지하지 못하는 구조다. `.claude/docs/plan-lifecycle.md:34` 의 "연결된 plan 이 없는 ad-hoc/hotfix 작업은 차단되지 않는다(자연스러운 escape)" 서술과 정확히 일치하는 케이스.
- 참고(CRITICAL 아님의 근거): plan 이 "결정 필요" 로 남겨둔 항목을 본 PR 이 일방적으로 override 하는 사례는 없음(INFO#1/INFO#4 는 이미 합의된 저비용 후속 실행 항목이지 미해결 쟁점이 아님) — 시스템 프롬프트의 CRITICAL 기준("미해결 결정 우회")에 해당하지 않는다. WARNING 기준("후속 항목 누락·선행 plan 미해소")은 위 첫 항목에서 별도로 다뤘다.
- 제안: 조치 불요(정보 확인용). 다만 이 워크트리 불일치 자체가 "동일 plan 을 여러 세션/워크트리에 걸쳐 이어서 처리"하는 이 저장소의 실제 작업 패턴과 `worktree:` 필드의 "1 plan ↔ 1 worktree" 암묵 전제 사이의 구조적 간극을 드러낸다는 점만 기록 — `plan-lifecycle.md:60-62` 가 이미 이런 종류의 cross-worktree 신뢰성 한계를 알고 있고(과거 `plan_coherence` 의 동시성 검출 기능을 신뢰성 문제로 제거한 전례), 본 PR 이 새로 만든 문제가 아니므로 별도 조치를 요구하지 않는다.

### [Info] Q4 — 신규 plan 충돌 없음 (재검증)

- target 위치: 코드 diff 전체(`ai-turn-executor.ts:2599` 부근 타입 주석, `information-extractor.handler.spec.ts` 신규 `it` 954행 부근)
- 관련 plan: `plan/in-progress/parallel-p2-followups.md:22`, `plan/in-progress/spec-sync-mcp-client-gaps.md:46`, `plan/in-progress/node-output-redesign/ai-agent.md`, `plan/in-progress/node-output-redesign/information-extractor.md`
- 상세: 위 4개 plan 이 같은 파일(`ai-turn-executor.ts` 또는 `information-extractor.handler.ts`)을 언급하나, 인용 라인·관심사가 모두 본 PR 의 변경 지점(2599행 object literal 타입 주석, collection-retry 루프의 신규 attribution 단언 테스트)과 겹치지 않음을 직접 grep 으로 재확인했다(`spec-sync-mcp-client-gaps.md:46`→`McpDiagnosticsAccumulator`, `parallel-p2-followups.md:22`→abort-signal 전파·이미 완료 표기, `node-output-redesign/*`→1209/1439/1507-1525 등 single-turn 잔여 갭·`turnDebugHistory` cap). `--impl-prep` 단계 plan-coherence(22_52_18) 의 "교차 확인" 결론과 동일 — 신규 충돌 없음.
- 제안: 조치 불요.

## 요약

본 PR 이 plan 문서를 의도적으로 건드리지 않은 결정은 (1) 미해결 결정을 우회하는 것이 아니라 실행이 이미 합의된 저비용 후속(INFO#1/INFO#4) 을 인접 문서 PR(#898) 과의 merge 충돌 회피를 위해 순서를 미룬 것이고, (2) 두 근거 문서(plan-coherence 22_52_18, RESOLUTION 23_20_30) 가 실제로 diff 에 포함돼 저장소에 영구 기록되며, (3) 현재 worktree/branch 조합은 이 plan 의 `worktree:` frontmatter 와 애초에 매칭되지 않아 push-gate hook 이 이 plan 을 "연결된 plan" 으로 인지하지 않으므로 기계적 차단 대상도 아니다 — CLAUDE.md/plan-lifecycle.md 기준으로 push 를 막을 사유(Critical)는 없다. 다만 RESOLUTION.md §1 이 서술한 "종결 조건"은 `#898`+본 PR 반영 후에도 `plan/in-progress/resume-llm-usage-attribution.md:53`(`- [ ] PR (push + gh pr create)`, `#879` 가 남긴 pre-existing 누락)이 여전히 미체크로 남는다는 사실을 놓치고 있어, 향후 최종 consolidation pass 가 이 한 줄까지 함께 반영해야 실제로 `plan-lifecycle.md` §5 self-check 를 통과해 `plan/complete/` 로 이동할 수 있다(WARNING). 다른 in-progress plan 과의 신규 충돌은 재검증 결과 없음.

## 위험도

LOW

STATUS: DONE
