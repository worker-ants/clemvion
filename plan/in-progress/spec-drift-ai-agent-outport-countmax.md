---
started: 2026-07-16
owner: project-planner
---

# Spec drift — AI Agent: multi-turn `out` 포트 + `AI_AGENT_TOOL_COUNT_MAX` vs 카탈로그

> **성격**: `spec/` 내부 자기모순 2건 (코드가 아니라 spec 문서끼리 어긋남). project-planner 가
> 실제 코드 동작을 SoT 로 확정 후 한쪽 spec 을 정정해야 한다. **durable 추적 앵커** — 원래
> `ai-agent-tool-payload-budget-followups.md`(PR #955·후속 W4/W2)의 backlog 로만 적혀 있었으나,
> 그 plan 이 complete 로 이동하면 유일한 durable 텍스트가 소실되므로(consistency plan_coherence
> 4회 연속 WARNING) 별도 in-progress 앵커로 분리한다. 최초 발견: consistency `--impl-prep`
> 10:41 → 12_22_49 → 13_55_11 → 14_46_28 cross_spec Critical.

> ephemeral task 참조: `task_3ac39ebd` (session-scoped, 재시작 시 소실 가능 — 본 문서가 durable SoT).

## Critical 1 — Multi Turn `out` 포트 유무가 요구사항 vs 기술 spec 정반대

- `spec/4-nodes/3-ai/1-ai-agent.md:216` "Multi Turn 모드에는 **`out` 포트가 존재하지 않는다**", `:231-232` (조건 0개 multi_turn 의 `out` 엣지 dangling 처리 — 마이그레이션 절)
- vs `spec/4-nodes/3-ai/_product-overview.md:84` (ND-AG-24 "조건 0개 시 `out` + `error` 제공 (하위 호환)"), `spec/4-nodes/_product-overview.md:215` (동일 ND-AG-24 "하위 호환") — **정반대 서술**
- 처분: 실제 코드(`ai-agent.handler.ts`/`ai-turn-executor.ts`) out-port 동작을 확정 후 (a) 기술 spec 이 맞으면 두 `_product-overview.md` 의 하위호환 문구 삭제, (b) 반대면 `1-ai-agent.md` §3.2·마이그레이션 절 정정.

## Critical 2 — `AI_AGENT_TOOL_COUNT_MAX=128` 기본값이 Cafe24/MakeShop 기본 연결 상시 초과

- `spec/4-nodes/3-ai/1-ai-agent.md:329` (기본 128, 초과 시 hard 취급), `:1346` (§12.15 Rationale, Cafe24 383개 실측)
- vs `spec/0-overview.md` §6.1 (79-80, "모두 구현 완료"), `spec/4-nodes/4-integration/4-cafe24.md:29`·`:446` ("~180")
- 처분: (1) `4-cafe24.md` "~180" → 실제 카탈로그 수(383)로 정정 또는 집합 차이 명시. (2) `1-ai-agent.md` §1/§2 에 "Cafe24/MakeShop 은 기본값 초과 → allowlist 설정 사실상 필수" 경고 명문화. (3) `spec/0-overview.md` §6.1 "구현 완료" 서술에 제약 각주.

## 범위 밖 (별도 task)

- `task_07c120ce` — `LlmService.embed()` withTimeout leak (item B chat fix 와 동형). 코드 결함이라 본 spec-drift 와 무관.

## Rationale

W4/W2 리팩터(`operation-tool-schema.ts` 공유 추출)는 이 두 drift 와 무관하지만, 그 작업의 consistency 게이트가 반복 노출시켰다. 코드 변경 없이 spec 문서만 정정하는 project-planner 작업이므로 developer 구현 PR 과 분리해 durable 추적한다.
