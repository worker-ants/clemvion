# Plan 정합성 검토 — spec/data-flow/7-llm-usage.md (impl-done)

## 조사 메모 (선행 확인)

프롬프트 payload 의 "진행 중 plan 문서 모음" 은 `plan/in-progress/` 33개 파일 중 6개(알파벳순 첫 6개: `ai-agent-tool-connection-rewrite` ~ `chat-channel-visual-ssr-png`)만 포함하고 있었다. 이 6개 중 target 스펙 영역과 직접 관련된 것은 `ai-usage-attribution-hardening.md` 뿐이었다. 그러나 실제로 이 target(`spec/data-flow/7-llm-usage.md §1.3`)의 **직전 선행 plan**인 `plan/in-progress/resume-llm-usage-attribution.md`(frontmatter `spec: spec/data-flow/7-llm-usage.md §1.3`, PR #879 의 원본 plan)는 payload 에서 누락되어 있었다. `grep -rl "7-llm-usage\|llm_usage_log\|LlmCallContext" plan/in-progress/` 로 직접 재확인해 찾아냈다. 이 누락은 본 검토의 핵심 발견(아래 발견사항 1, 2)의 근거이므로, 신뢰성을 위해 별도로 기록해둔다. **[INFO] 후속 조치 제안**: orchestrator 의 plan 수집 단계가 알파벳순 앞쪽 N개로 잘리는 것으로 보이며, target spec path 와 매칭되는 plan(frontmatter `spec:`)을 우선 포함하도록 보강 권장.

## 발견사항

- **[WARNING] 완료된 후속 항목이 선행 plan 문서에 미반영(cross-plan 정합 갭)**
  - target 위치: (간접) `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2596-2599` (diff 의 B1 — `LlmCallContext` 명시 타입 주석)
  - 관련 plan: `plan/in-progress/resume-llm-usage-attribution.md` §"최종 /ai-review(02_09_15) INFO — 선택적 후속" 74-75행 — `- [ ] ai-turn-executor.ts:2599 llmContext 에 LlmCallContext 명시 타입 주석 추가(INFO#1 …)`
  - 상세: 이번 diff 의 B1 이 정확히 이 INFO#1 항목을 구현한다(`ai-usage-attribution-hardening.md` 자신도 "PR #879 의 최종 /ai-review INFO 후속" 이라고 명시). 그러나 `resume-llm-usage-attribution.md` 는 여전히 이 항목을 `[ ]` 로 남겨두고 있고, 본 diff 는 그 plan 문서를 갱신하지 않는다. 두 plan 문서 간 항목 완료 상태가 어긋나 — 이후 `resume-llm-usage-attribution.md` 를 다시 열어보는 사람은 INFO#1 이 이미 다른 PR 에서 처리됐음을 알 수 없다.
  - 제안: `resume-llm-usage-attribution.md:74-75` 의 체크박스를 `[x]` 로 갱신하고 "→ `ai-usage-attribution-hardening.md` B1 로 처리됨" cross-ref 를 추가. (developer 는 plan/** 쓰기 권한이 있으므로 본 PR 또는 완료 커밋에서 처리 가능 — spec 쓰기가 아니라 plan 문서 갱신이라 role 제약에 걸리지 않는다.)

- **[WARNING] SPEC-DRIFT 이관 대상("PR-2 A-track", "A1~A4")이 실제 plan 문서와 연결되지 않음**
  - target 위치: `spec/data-flow/7-llm-usage.md` §1.3 표 107행("AI Agent 자동 메모리 롤링 요약 압축 … 아직 미배선 — 잔여 갭") + 113행 콜아웃 + §4 Agent Memory 행 + `## Rationale` "`llm_usage_log` 의 nullable context 컬럼들" 절(204-208행, "(b) `LlmCallContext` 가 아직 배선되지 않은 caller(… AI Agent 자동 메모리 롤링 요약 압축)")
  - 관련 plan: `plan/in-progress/ai-usage-attribution-hardening.md` §"SPEC-DRIFT (PR-2 로 이관)" — "이 spec row 정정은 **PR-2(A-track project-planner spec PR)** 에서 A1~A4 와 함께 반영"
  - 상세: C1(`agent-memory-injection.ts` + `ai-memory-manager.ts` 의 `llmContext` 배선)이 실제로 코드에 반영됨을 diff 로 확인했다 — 위 4곳의 target 서술("미배선", "context 미전달 → 전부 NULL", "아직 배선되지 않은")은 이제 부분적으로 stale 하다. `ai-usage-attribution-hardening.md` 는 이 정정을 "PR-2(A-track)" 와 "A1~A4" 로 이관한다고만 적어두었는데, 그 "A1~A4" 가 어느 문서를 가리키는지 본문 어디에도 경로/링크가 없다. 실제로 이 라벨과 항목 수(4개)가 정확히 일치하는 문서는 `plan/in-progress/resume-llm-usage-attribution.md` §"잔여 follow-up(별도 project-planner 트랙…)" 61-70행의 4개 불릿(`6-knowledge-base.md`/`13-agent-memory.md` stale 문구, `7-statistics.md`/`9-user-profile.md` 캐비어트, `1-data-model.md` 서브섹션, `4-execution-engine.md`/`1-ai-agent.md` §7.4 분류)이다 — 단, 그 항목들은 §1.3 의 "메모리 압축 미배선" row 자체와는 무관한 **다른** stale 서술들이라, "A1~A4 와 함께" 반영하겠다는 계획이 이 4항목을 가리키는 것인지 추정만 가능하고 문서상 확정할 수 없다.
  - 제안: `ai-usage-attribution-hardening.md` 의 SPEC-DRIFT 절에 `resume-llm-usage-attribution.md` 경로를 명시적으로 cross-ref 하거나(그 문서의 "잔여 follow-up" 목록에 본 §1.3 row 정정을 5번째 항목으로 추가), 별도의 독립된 "PR-2" plan 문서를 신설해 A1~A4 + 본 row 정정을 명시적으로 나열한다. 어느 쪽이든 project-planner 가 뒤늦게 이 작업을 주울 때 두 소스(이번 plan 의 한 줄 메모 vs `resume-llm-usage-attribution.md` 의 4항목)를 별도로 발견해야 하는 상태를 없애야 한다 — "구현 plan 은 spec 갱신까지 정식 phase 로 포함, 외부 위임 한 줄로 묶지 말 것" 원칙과 같은 맥락(본 건은 role 상 developer 가 직접 spec 을 못 고치는 정당한 이관이지만, 이관 대상이 최소한 추적 가능한 링크여야 한다).

- **[INFO] C1 은 resume 턴 한정 배선 — 향후 §1.3 정정 시 "완전 해소"로 오기술될 위험**
  - target 위치: `spec/data-flow/7-llm-usage.md` §1.3 107행 (정정 예정 row)
  - 관련 plan: `plan/in-progress/ai-usage-attribution-hardening.md` "C1" 항목
  - 상세: diff 의 두 `injectMemoryContext` 호출부를 대조하면(`ai-turn-executor.ts:1149`(첫 턴, `config`= 사용자 노드 config)와 `:2271`(resume 턴, `config: state`= 엔진이 `workflowId`/`nodeExecutionId` 를 주입한 재구성 state)), `args.config.workflowId`/`args.config.nodeExecutionId` 는 **resume 턴에서만** 채워지고 **첫 턴에서는 여전히 `undefined`→NULL** 이다(diff 자체 주석 "첫 턴 등 미주입 시 undefined→NULL" 이 이를 인정). `executionId` 는 두 경로 모두 항상 명시 전달된다. 즉 C1 은 §1.3 다른 AI 노드 caller 들과 동일한 "첫 턴 NULL / resume 턴 채움" 패턴이지, "완전 배선" 이 아니다.
  - 제안: PR-2 에서 107행 row 를 정정할 때 다른 caller 행(105-106행)과 동일한 표현 — "첫 턴은 NULL, resume 턴은 `state.*` 로 채움" — 을 쓰도록 미리 메모해 두면 project-planner 가 별도 코드 재확인 없이 정확히 반영할 수 있다.

## 요약

target(`spec/data-flow/7-llm-usage.md`) 자체에는 이번 diff 로 인한 변경이 없고(diff 는 backend 코드 4파일 전용), 코드가 target 이 "미배선" 이라 서술한 지점(§1.3 AI Agent 메모리 롤링 요약 압축)을 부분적으로(§resume 턴 한정) 실제로 배선해 target 을 stale 하게 만들었다. 이 spec-drift 자체는 developer 가 spec 쓰기 권한이 없다는 role 제약상 project-planner PR 로 이관하는 것이 정당한 처리이며, `ai-usage-attribution-hardening.md` 도 이를 "SPEC-DRIFT (PR-2 로 이관)" 로 명시적으로 인지·기록해두어 완전히 방치된 것은 아니다. 다만 (1) 그 이관 메모가 실제 대응 plan 문서(`resume-llm-usage-attribution.md` 의 4항목 follow-up)와 링크되지 않아 추적이 끊길 위험이 있고, (2) 같은 선행 plan 의 INFO#1 항목이 이번 PR(B1)로 이미 완료됐음에도 그 plan 문서 자체는 갱신되지 않아 두 plan 간 상태 불일치가 남는다. 미해결 사용자 결정을 우회하거나 선행 조건을 무시한 CRITICAL 성격의 충돌은 없다.

## 위험도

MEDIUM
