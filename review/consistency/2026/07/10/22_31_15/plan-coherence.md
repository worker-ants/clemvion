# Plan 정합성 검토 — `resume-llm-usage-attribution.md` follow-up ↔ llm-usage doc-alignment draft

- 검토 대상 draft: `/private/tmp/claude-501/-Volumes-project-private-clemvion--claude-worktrees-llm-usage-doc-alignment-01d7a4/9b5ca835-aa0d-4284-9bf6-3602bfcb6c7a/scratchpad/spec-draft.md`
- 관련 plan: `plan/in-progress/resume-llm-usage-attribution.md`
- MODE: `--spec`

## 발견사항

### [Warning] 잔여 follow-up (a)/(c)/(d) 구현·판정 완료인데 plan 체크박스 갱신이 draft 범위 밖

- target 위치: draft `변경 1`(line 13-21, (a) 대응) · `변경 2`(line 23-41, (c) 대응) · `재검증 결과` (a)~(d) 언급 (line 5-11)
- 관련 plan: `plan/in-progress/resume-llm-usage-attribution.md:61-70` (`## 잔여 follow-up` 4항목, 전부 `- [ ]` 미체크)
- 상세: draft 는 실제로 (a) knowledge-base.md:348 + agent-memory.md:231 stale 문구 정정, (c) `1-data-model.md` §2.16.1 `LlmUsageLog` 서브섹션 신설을 구현하고, (b)/(d) 는 "변경 없음(no-op)"으로 재검증했다고 밝힌다. 그러나 draft 자체는 spec 파일만 다루는 초안이고 `plan/in-progress/resume-llm-usage-attribution.md` 를 갱신하지 않는다. `.claude/docs/plan-lifecycle.md §3` 의 push gate("branch 가 `codebase/**` 를 바꿨는데 연결된 plan 이 갱신·이동 흔적이 전혀 없으면 push 거부")는 `codebase/**` 변경이 없는 spec-only PR 에는 발화하지 않지만, `feedback_plan_checkbox_actual_state.md`(사용자 메모리 원칙) 및 이 프로젝트의 "plan 체크박스 = 실제 상태" 관행상 실제 작업이 반영된 PR 은 같은 커밋에 plan 체크박스를 갱신해야 한다.
- 제안: 이 draft 를 실제 spec 커밋으로 승격할 때, 같은 PR 에 `plan/in-progress/resume-llm-usage-attribution.md` 편집을 포함해:
  - **체크 가능** — (a) line 61-63, (c) line 66-67 (실제 구현됨), 최종 review INFO 목록의 **INFO#3** = (f) line 76-77 (draft `변경 3` 이 구현).
  - **체크 가능(단, 판정 근거 주석 필요)** — (b) line 64-65, (d) line 68-70: draft 가 "재검증 결과 = 변경 없음" 으로 판정했으나 단순 미체크 상태로 방치하면 "아직 안 함"과 "확인 결과 불필요"가 구분되지 않는다. 체크박스에 `[x]` + 판정 근거 1줄(예: "재검증 결과 캐비어트 문구 부재 확인, no-op") 을 남겨야 한다.
  - **미체크 유지 필수** — 최종 review INFO 목록의 **INFO#1** = (e) `ai-turn-executor.ts:2599` 타입 주석 (line 74-75), **INFO#4** = (g) IE collection-retry 테스트 (line 78-79). 둘 다 코드 변경이라 draft(문서 전용) 범위 밖이며, plan 자체도 (e)에 "코드 변경이라 별도 PR 로" 를 이미 명시했다 — 이 draft PR 에서 체크하면 안 된다.
  - 이 두 항목이 남으므로 이번 PR 로는 plan 을 `complete/` 로 이동할 수 없다(§발견 4 참조, 정상 동작).

### [Warning] plan (d) 항목의 `execution-engine.md` 섹션 참조가 stale — `§7.4` 아닌 `§1.3`

- target 위치: draft `재검증 결과` 항목 (d), line 9-11: "`spec/4-nodes/3-ai/1-ai-agent.md:720` + `spec/5-system/4-execution-engine.md` §1.3 에 ... 이미 반영"
- 관련 plan: `plan/in-progress/resume-llm-usage-attribution.md:68-70` — "`spec/5-system/4-execution-engine.md` §7.4 재구성 설명 + `spec/4-nodes/3-ai/1-ai-agent.md` §7.4 — credential/context-binding 2분류 서술에 3번째 ... 문구 추가"
- 상세: 현재 main 기준 `spec/5-system/4-execution-engine.md` §7.4(`4-execution-engine.md:873`)는 "분산 실행 (Multi-instance)"이고, credential/context-binding 2채널 재유도 서술(조작 필드/식별 필드)은 실제로 **§1.3 "블로킹/재개 컨트랙트"**(`4-execution-engine.md:119-196`, 특히 `:167`·`:171`)에 있다. 이 서술은 커밋 `6acaaa23a`(`docs(spec): execution-engine — #501 resume-turn usage-log attribution 문서 정합화 (#884)`)가 §1.3 에 추가한 것으로 `git blame` 으로 확인했다 — 커밋 메시지도 "execution-engine.md: §1.3: credential/context-binding 재유도를 두 채널로 세분화" 라고 명시한다. 즉 **plan 의 `execution-engine.md §7.4` 참조는 stale** 하고, draft 의 no-op 판정 자체는 (내부적으로 §1.3 을 정확히 인용했으므로) 실질적으로 맞다. 다만 draft 는 plan 원문의 잘못된 섹션 번호를 조용히 우회했을 뿐 plan 을 고치지 않는다.
  - 참고로 `spec/4-nodes/3-ai/1-ai-agent.md` 쪽 `§7.4`(`1-ai-agent.md:633-723`, "Multi Turn 모드 — 사용자 입력 대기") 참조는 stale 이 아니다 — 실제 2채널 서술(`1-ai-agent.md:720`)이 그 섹션 범위 안에 있다(같은 커밋 `6acaaa23a` 가 "ai-agent.md: 생명주기 표·요약 문장 두-채널 nuance + §1.3 포인터" 로 추가).
- 제안: (d) 를 `[x]` 처리할 때 plan 문구의 `execution-engine.md §7.4` 를 `§1.3` 으로 정정(또는 체크 시 주석으로 정정 근거 명시)해, 향후 plan history 를 읽는 사람이 잘못된 섹션을 찾아 헤매지 않도록 한다.

### [Info] plan (b) 항목의 `spec/data-flow/7-statistics.md` 경로 오기 — 독립 검증 결과 draft 판정은 정확

- target 위치: draft `재검증 결과` 항목 (b), line 7-8
- 관련 plan: `plan/in-progress/resume-llm-usage-attribution.md:64-65` — "`spec/data-flow/7-statistics.md` §3 · `spec/2-navigation/9-user-profile.md` §6.3"
- 상세: `spec/data-flow/7-statistics.md` 는 **존재하지 않는다**(`ls` 확인). 실제 경로는 `spec/2-navigation/7-statistics.md`(§3 = "API", `7-statistics.md:105`)이다. draft 는 이미 올바른 경로(`spec/2-navigation/7-statistics.md`)로 재검증했다고 적었다. 독립적으로 두 실제 파일을 읽어 확인한 결과:
  - `spec/2-navigation/7-statistics.md` §3(`:105-121`)에는 "attribution 갭" 관련 캐비어트 문구가 없다(`workflowId`/`NULL`/`attribution` grep 전부 무관 매치).
  - `spec/2-navigation/9-user-profile.md` §6.3(`:376-386`, "알림 규칙 API")에도 attribution 캐비어트 없음.
  - `git log -p` 로 두 파일 히스토리를 훑어도 그런 캐비어트 문구가 존재했다 제거된 흔적이 없다.
  - 따라서 draft 의 "(b) no-op" 판정은 **경로 오기를 이미 인지하고 우회한 뒤 내린 정확한 결론**이다.
- 제안: (b) 를 `[x]` 처리할 때 plan 문구의 `spec/data-flow/7-statistics.md` 를 `spec/2-navigation/7-statistics.md` 로 정정(§발견 2 와 동일 패턴 — stale 참조를 체크 시점에 durable 하게 고쳐 두는 것을 권장).

### [Info] 타 in-progress plan 과의 충돌 없음 확인

- `llm_usage_log` / `1-data-model.md` / `execution-engine.md §6.1` / `CHANGELOG.md` 를 언급하는 다른 in-progress plan: `rag-quality-improvement.md:99`, `competitive-analysis-n8n-flowise.md:22,105,224`, `rag-dynamic-cut.md`(frontmatter `spec_impact` 후보 목록 line 5-12, 체크리스트 line 33-43).
- 확인 결과 전부 **이미 완료된 과거 작업의 기록**(rag-quality-improvement §"spec 갱신" 항목은 2026-06-06 완료 표시, competitive-analysis 는 read-only 리서치 인용)이거나, rag-dynamic-cut.md 는 4a(spec 갱신) 단계가 `[x]` 로 이미 끝나 있고 남은 유일한 미완 항목(`eval-retrieval` 골든셋 블록, line 42)은 draft 대상 파일·섹션과 무관하다. draft 가 건드리는 `spec/data-flow/6-knowledge-base.md:348`(외부 의존 표 LLM Usage 행)·`spec/1-data-model.md` §2.16.1 신설 위치와 겹치는 **미해결** 계획 항목은 없다.
- 결론: 후속 항목 누락/충돌 없음.

### [Info] plan 은 이번 PR 로도 `complete/` 이동 불가 — 확인(정상)

- `plan/in-progress/resume-llm-usage-attribution.md` 의 최종 review INFO 목록 중 **INFO#1**(e, line 74-75, `ai-turn-executor.ts` 타입 주석)과 **INFO#4**(g, line 78-79, IE collection-retry 테스트)는 코드 변경이라 draft(문서 전용) 로 해소되지 않는다.
- `.claude/docs/plan-lifecycle.md §3/§5`: "모든 체크박스 `[x]` + 미해결 follow-up 0건이 되는 PR 안에서만" `complete/` 이동 — (e)/(g) 가 남으므로 이번 PR 로 이동 조건 미충족. 이는 draft 의 의도된 설계(§ "잔여 follow-up" 절 "별도 project-planner 트랙, 본 PR 범위 밖")와 일치하며 문제 없음.
- `spec_impact` frontmatter: 현재 plan frontmatter(`plan/in-progress/resume-llm-usage-attribution.md:1-8`)에는 `spec_impact` 필드가 없다. `plan-lifecycle.md §4`: "`spec_impact` 는 완료 시점 필드(Gate C) — in-progress 단계에선 의무 아님." plan 이 아직 `in-progress/` 에 머무르는 한 위반 아님. `complete/` 이동 시점(전체 (e)/(g) 까지 종결된 미래 PR)에 리스트 형식(`- path`, bare string 금지)으로 선언해야 함을 상기만 해 둔다.

## 요약

Draft 는 `resume-llm-usage-attribution.md` 잔여 follow-up 4항목((a)(b)(c)(d))과 최종 review INFO 3항목((e)(f)(g)) 중 (e)/(g)(코드 변경)를 제외한 전부를 정확히 재판정했다 — (a)/(c)/(f) 는 실질 문서 변경으로, (b)/(d) 는 독립 검증으로도 재확인되는 no-op 으로. 다만 draft 자체(스크래치패드 초안)는 plan 파일을 건드리지 않으므로, 이를 실제 커밋으로 승격하는 시점에 plan 체크박스 갱신(어떤 항목을 `[x]`, 어떤 항목을 미체크로 남길지는 위 표 참조)과 plan (d)/(b) 항목에 남아있는 stale 섹션·경로 참조(`execution-engine.md §7.4`→`§1.3`, `data-flow/7-statistics.md`→`2-navigation/7-statistics.md`) 정정을 같은 PR 에 포함해야 plan 이 실제 상태를 정확히 반영한다. 다른 in-progress plan 과의 충돌은 없고, (e)/(g) 코드 항목이 남아 있어 plan 을 `complete/` 로 옮기지 않는 draft 의 판단도 정확하다.

## 위험도

LOW

STATUS: DONE
