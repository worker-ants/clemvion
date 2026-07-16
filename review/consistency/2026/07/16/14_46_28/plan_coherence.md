# Plan 정합성 검토 — spec/4-nodes/3-ai/ (--impl-done, PR #3 완료 직전 · plan/complete 이동 판단)

> 검토 대상: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md` 전체 + `plan/in-progress/**`
> 트리거: `plan/in-progress/ai-agent-tool-payload-budget-followups.md` "실행 체크리스트 — 후속 PR #3"(W4
> provider dedup + W2 parity)가 거의 완료되어 plan 을 `plan/complete/` 로 옮기려는 시점.
> **재확인 대상**: 직전 회차 `review/consistency/2026/07/16/13_55_11/plan_coherence.md` 가 WARNING 으로
> 지적한 "plan 종결 시 `task_3ac39ebd` durable 앵커 소실" 리스크가 이번 아카이빙 시도로 실제로 해소됐는지.

## 조사 방법

1. `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 라이브 파일을 target 문서 dump 와 대조 —
   내용 동일(미변경). 마지막 두 체크박스(9.4 consistency-check, PR+plan/complete 이동)만 미완료.
2. `grep -rl task_3ac39ebd plan/` — 전체 `plan/in-progress/**` 재스캔.
3. `spec/4-nodes/3-ai/1-ai-agent.md` §3.2 · `spec/4-nodes/3-ai/_product-overview.md` ND-AG-24 ·
   `spec/4-nodes/_product-overview.md` ND-AG-24 · `spec/4-nodes/4-integration/4-cafe24.md` op count ·
   `1-ai-agent.md:329`(`AI_AGENT_TOOL_COUNT_MAX`)/`:1346`(383 오퍼레이션)을 라이브 파일에서 직접 재확인.
4. `1-ai-agent.md` / `_product-overview.md` frontmatter `pending_plans:` 를 재확인해 `task_3ac39ebd` 항목이
   신규 등록됐는지 확인.
5. `.claude/docs/plan-lifecycle.md` Gate C (`spec_impact`) 규정을 확인해 자동 게이트가 이 리스크를
   강제로 막는지 확인.

## 발견사항

### [WARNING] `plan/complete` 이동 시 pre-existing 스펙 Critical 2건의 유일한 durable 앵커가 소실 — 4회 연속 미해소, 이번이 실제 실행 시점

- **target 위치**:
  - `spec/4-nodes/3-ai/1-ai-agent.md:216`("Multi Turn 모드에는 **`out` 포트가 존재하지 않는다**"), `:231-232`
    (조건 0개 multi_turn 의 `out` 엣지는 dangling 처리 — 마이그레이션 절)
  - vs `spec/4-nodes/3-ai/_product-overview.md:84`(ND-AG-24 "조건 0개 시 `out` + `error` 제공 (하위 호환)")
    / `spec/4-nodes/_product-overview.md:215`(동일 ND-AG-24, "하위 호환") — **정반대 서술, 여전히 원문 그대로**
  - `spec/4-nodes/3-ai/1-ai-agent.md:329`(`AI_AGENT_TOOL_COUNT_MAX` 기본값 `128`) / `:1346`("scope 허용
    383개 오퍼레이션") vs `spec/4-nodes/4-integration/4-cafe24.md:29`("~180 endpoint") — 오퍼레이션 수치
    불일치(180 vs 383)가 여전히 미정정. `enabledTools` allowlist 미설정(기본값) 상태의 Cafe24(383
    op)/MakeShop(161 op) 연결이 `count_max=128` 만으로 **상시 hard 실패**하는데, 이 사실이 `spec/0-overview.md`
    나 `4-cafe24.md` 사용 안내에 disclose 되지 않은 상태도 그대로 유지
- **관련 plan**: `plan/in-progress/ai-agent-tool-payload-budget-followups.md` L27, L45, L55(라이브 라인
  번호 동일)
  - L27: `"pre-existing Critical 2건(out 포트 서술 모순·count_max vs 카탈로그)은 item B 무관 →
    project-planner task task_3ac39ebd 위임(사용자 결정)"`
  - L45(이번 회차 대상 — 후속 PR #3 착수 로그): `"⚠ plan_coherence WARNING: complete 이동 시 위 2 Critical
    의 durable 앵커 소실 우려 → plan-complete 단계에서 처리."` — 즉 **plan 스스로 "plan-complete 단계에서
    처리하겠다"고 약속**한 문구
  - L55(마지막 미완료 체크박스, 바로 다음 실행 대상): `"PR + 본 plan 의 모든 체크박스 확인 후 plan/complete
    이동 (backlog 잔여 task_3ac39ebd·task_07c120ce 는 별 task 라 이관 불필요)"` — L45 의 "처리하겠다"는
    약속과 **정면으로 모순**되게, 실제 실행 시점에는 "이관 불필요"로 결론짓고 있음
- **상세**:
  - 이 리스크는 `10:41:10` 회차 `cross_spec` checker 가 최초 발견(Critical 2건) → `12_22_49` → `13_55_11`
    두 차례 plan_coherence 가 WARNING 으로 재확인 → 이번(`14_46_28`)이 **4번째 회차**다. 매 회차 "여전히
    미수정"으로 확인됐고, 이번도 §3 조사에서 동일하게 확인됨 — 4개 target 라인(ND-AG-24 두 곳,
    `out` 포트 서술, op count 두 곳) 모두 원문 그대로.
  - `task_3ac39ebd`(project-planner 위임 task)는 **session-scoped ephemeral ID** 다. 이를 추적하는
    유일한 durable 텍스트는 지금 `followups.md` 의 L27/L45/L55 세 줄뿐이며, `1-ai-agent.md` /
    `_product-overview.md`(3-ai, 4-nodes 양쪽) frontmatter `pending_plans:` 어디에도 `task_3ac39ebd`
    관련 항목이 등록돼 있지 않다(`1-ai-agent.md` 의 유일한 `pending_plans` 엔트리는
    `ai-agent-tool-connection-rewrite.md`뿐 — 재확인 완료).
  - `.claude/docs/plan-lifecycle.md` Gate C(`spec_impact`)는 `plan/complete/` 이동 시 "spec 변경 유무"만
    선언을 강제하고, "미해소 pre-existing Critical 을 추적하는 신규 plan 이 있는가"는 강제하지 않는다 —
    즉 **자동 게이트가 이 리스크를 막아주지 않는다.** L55 체크박스가 그대로 실행되면:
    (a) `followups.md` 가 `plan/complete/` 로 옮겨지며 L27/L45/L55 세 줄이 "완료된 plan 의 과거 체크리스트
    문구"로 격하되고, (b) 이후 모든 `plan/in-progress/**` 스캔 기반 plan-coherence 검토(본 checker 포함)는
    이 두 Critical 을 더 이상 발견하지 못한다 — 발견 경로가 비정규(archive 우연 열람)로 전환된다.
  - PR #3 자체(W4 provider dedup + W2 parity)는 이 두 Critical 과 무관하고 새로 우회하지도 않는다 — 이
    부분은 3회차와 동일하게 재확인됨(정합). 문제는 PR #3 의 **결과물(spec 무수정 리팩터)** 이 아니라
    **plan 종결 이라는 행위 자체**가 이 리스크를 실현시킨다는 점이다.
- **제안**: L55 를 실행(`plan/complete` 이동)하기 **전에** 다음 중 하나를 먼저 수행한다.
  1. 신규 `plan/in-progress/ai-agent-spec-drift-followups.md`(또는 유사 이름) 를 만들어 두 Critical(①
     `out` 포트 하위호환 여부 확정, ② `count_max` 기본값과 Cafe24/MakeShop 기본 연결의 상시 실패 disclose)
     을 명시적 작업 항목으로 옮기고, `1-ai-agent.md` / `spec/4-nodes/3-ai/_product-overview.md` /
     `spec/4-nodes/_product-overview.md` frontmatter `pending_plans:` 에 그 파일을 등록한다.
  2. 또는 이미 같은 노드를 다루는 활성 plan(`node-output-redesign/ai-agent.md` — §12.16 이 이미 이 plan 을
     인용 중이므로 자연스러운 편입처)의 절로 두 Critical 을 편입한다.
  3. 최소 대안: `followups.md` 를 당장 옮겨야 한다면, L55 의 "이관 불필요" 판단을 재검토해 L27/L45/L55
     세 줄만이라도 위 1·2 안의 신규/기존 plan 파일로 먼저 옮긴 뒤 `followups.md` 를 `plan/complete/` 로
     이동한다.
  - 이번 회차에도 착수 판단(PR #3 코드 작업) 자체를 막을 사유는 아니지만, **`plan/complete` 이동
    체크박스(L55)는 위 조치 없이 실행하지 말 것을 권고**한다 — L45 에서 스스로 약속한 "plan-complete
    단계에서 처리"가 이행되지 않은 채 L55 로 넘어가는 것은 plan 문서 내부에서도 자기모순이다.

### [INFO] (재확인, 낮은 우선순위) single-turn 일반 오류 라우팅 gap — 이번 회차도 §7.3/§10/frontmatter 미disclose 유지

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.3(예외 없이 "모든 오류 상황"으로 서술) · §10
  에러 코드 표(`LLM_CALL_FAILED`/`LLM_RESPONSE_INVALID` 를 예외 조건 없이 등재) · frontmatter
  `pending_plans`(`node-output-redesign/ai-agent.md` 미등록, §12.16 본문 인용 1건만 존재 — 재확인 완료)
- **관련 plan**: `plan/in-progress/node-output-redesign/ai-agent.md` — single-turn `executeSingleTurn`
  의 `llmService.chat` 이 try/catch 없이 엔진 `FAILED` 로 전파되는 것을 P0/CRITICAL 로 계속 추적 중
- **상세**: `07:31:34`·`12:22:49`·`13:55:11` 세 차례 연속 동일 관찰이 보고됐고, 이번 회차도 §12.16
  본문(`1-ai-agent.md:1358`)이 이 gap 을 인라인 언급하지만 §7.3/§10/frontmatter 는 여전히 disclose 하지
  않는다. 후속 PR #3(W4/W2)는 이 영역을 건드리지 않으므로 이번 착수·완료를 직접 차단하지 않는다.
- **제안**: 다음 spec 갱신 사이클에서 §7.3/§10 에 "⚠ 구현 현황(Planned)" 주석 추가 + `pending_plans` 에
  `node-output-redesign/ai-agent.md` 정식 등록. 위 WARNING 처리(신규/편입 plan 작성) 시 같은 파일에
  묶어 처리하면 효율적.

### [INFO] "후속 백로그" 섹션이 PR #3 완료로 이미 해소됐는데 plan 본문에서 미정리

- **target 위치**: (plan 자체) `plan/in-progress/ai-agent-tool-payload-budget-followups.md` L94-97
  "## 후속 백로그" 절 — cafe24/makeshop provider JSON schema·allowlist 중복 추출(W4), WorkflowsService↔
  IntegrationsService parity 테스트(W2) 두 항목
- **상세**: 이 두 항목은 정확히 "후속 PR #3" 체크리스트(L46-51)가 구현·테스트로 완결한 대상과 동일하다
  (W4 = `operation-tool-schema.ts` 추출, W2 = `workflows.service.spec.ts` parity 회귀). 그러나 L94-97
  절은 여전히 "미착수" 뉘앙스로 남아 있어, plan 을 나중에 다시 읽는 사람이 이미 끝난 항목을 미해결로
  오인할 수 있다.
- **제안**: `plan/complete` 이동 전에 L94-97 을 "완료(PR #3)"로 갱신하거나 제거. 사소한 plan 위생 항목이라
  PR #3 자체를 막지 않음.

## 정합 확인 (문제 없음으로 판정한 항목, 재확인)

- **PR #3 체크리스트(W4/W2) 자체**: `ai-agent-tool-connection-rewrite.md` 의 미해결 5개 결정(TBD 그대로,
  이번 회차도 미변경 확인)과 아키텍처적으로 직교 — `tool_*` 일반 도구 연결 모델과 `mcp_*`
  Cafe24/MakeShop Internal Bridge 는 다른 네임스페이스. 결정 우회 없음.
- **worktree 겹침 없음**: `plan/in-progress/**` 를 재스캔한 결과 본 세션(`funny-mahavira-50d003`)과
  `worktree:` frontmatter 를 공유하는 다른 plan 없음.
- **estimator 계약 무변경**: W4/W2 는 `estimateAgentToolPayload` 계약이나 예산 값을 변경하지 않는 순수
  리팩터/테스트 작업 — spec 이 이미 확정한 계약과 충돌 없음.

## 요약

`ai-agent-tool-payload-budget-followups.md` 의 "후속 PR #3"(W4 provider JSON-schema/allowlist dedup +
W2 integration-load parity test) 자체는 다른 in-progress plan 의 결정을 우회하지 않으며 정합하다 —
이 판단은 3회차(`13_55_11`)와 동일하게 재확인됐다. 그러나 사전 경고했던 리스크, 즉 "plan 을
`plan/complete/` 로 옮기면 pre-existing 스펙 Critical 2건(Multi Turn `out` 포트 하위호환 여부의 요구사항
vs 기술 spec 모순, `AI_AGENT_TOOL_COUNT_MAX=128` 이 Cafe24/MakeShop 기본 연결을 상시 실패시키는 문제 +
오퍼레이션 수치 불일치)을 추적하던 유일한 durable 텍스트가 사라진다"는 리스크는 **이번 회차에도 해소되지
않았다.** 오히려 plan 자체가 L45 에서 "plan-complete 단계에서 처리하겠다"고 명시했음에도, 실제 그 단계인
L55(다음 실행 대상)에서는 "이관 불필요"로 스스로 뒤집은 상태로 남아 있어, 이번이 이 리스크가 실제로
실현되기 직전인 지점이다. 자동 Gate(Gate C `spec_impact`)도 이 상황을 강제로 막지 않으므로, `plan/complete`
이동은 이 사람의 판단에 전적으로 달려 있다. PR #3 자체의 착수·병합을 막을 사유는 아니지만, **plan 을
`plan/complete/` 로 옮기는 마지막 체크박스(L55)는 두 Critical 을 위한 durable 앵커(신규/기존 plan 파일 +
`pending_plans` frontmatter 등록)를 먼저 만든 뒤 실행할 것을 강하게 권고한다.**

## 위험도

MEDIUM
