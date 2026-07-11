# Consistency Check 통합 보고서

**대상**: `spec/data-flow/7-llm-usage.md` — 검토 모드: `--impl-done` (scope=`spec/data-flow/7-llm-usage.md`, diff-base=`origin/main`)

**BLOCK: NO** (최초 convention_compliance CRITICAL → §1.3 4개 위치 정정 + `reverify/` 재검증으로 해소 — 상세 [RESOLUTION.md](RESOLUTION.md)).

최초 회차: convention_compliance 가 CRITICAL 로 판정한 SoT(단일 진실) 붕괴 1건. 5개 checker 전원이 동일 근본 원인(코드가 닫은 attribution 갭을 target 문서가 여전히 "미배선/NULL"로 서술)을 서로 다른 각도·등급으로 지적. 규약("동일 위배는 가장 강한 등급으로 통합")에 따라 CRITICAL 로 병합.

**재검증(`reverify/`, 커밋 `0fa772406`)**: convention_compliance = 직전 CRITICAL **해소 확인**(HEAD spec 4곳 ↔ 코드 1:1 정합) + 신규 LOW WARNING(콜아웃 RerankService 오분류) → 같은 커밋에 추가 정정. cross_spec = NONE. rationale_continuity = NONE. plan_coherence = INFO(비차단). → **Critical 0, BLOCK: NO 확정.**

> **처분(호출자 반영)**: `spec/data-flow/7-llm-usage.md` §1.3 4개 위치(L107·L113·L162·Rationale)를 실제 구현 상태로 정정하는 것을 **본 PR(PR-1)에 포함** → drift window 0. rationale_continuity 가 확인하듯 이는 Rationale 이 이미 결정한 방향의 실현(신규 설계 아님)이라 factual 정정. 재검증에서 CRITICAL 해소 확인 → BLOCK: NO. 상세 RESOLUTION.md.

## 전체 위험도
**HIGH → 해소** — 코드(PR-1)는 AI Agent 자동 메모리 롤링 요약 압축 chat 의 `llm_usage_log` attribution 배선을 완결했으나, 최초 diff 는 `spec/data-flow/7-llm-usage.md` 를 갱신하지 않아 4개 위치가 코드와 어긋났다. 본 PR 에 spec 정정을 포함해 해소.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 제안 |
|---|---------|------|-------------|------|
| 1 | convention_compliance (CRITICAL) + cross_spec (WARNING) + rationale_continuity (WARNING/MEDIUM) | 구현 diff(`ai-turn-executor.ts`, `ai-memory-manager.ts`, `agent-memory-injection.ts`)가 AI Agent 자동 메모리 롤링 요약 압축 chat 에 `LlmCallContext`(단발 `context.*` / resume `state.*`)를 배선해 attribution 갭을 완결했으나, target 문서는 4곳에서 여전히 "미배선/전부 NULL/잔여 갭"으로 서술 — 문서 자신이 선언한 "단일 진실"(L113) 위반 | `:107`(§1.3 표), `:113`(잔여 NULL 콜아웃), `:162`(§4 Agent Memory 행), `:189-208`(Rationale "(b)" 항) | 병합 전(같은 PR) 4개 위치 정정: (1) §1.3 L107 행 "context 채움", (2) L113 콜아웃에서 제거, (3) §4 L162 "context NULL"→"context 채움(추출 processor 만 NULL)", (4) Rationale (b) 에서 제거 + 완결 시점 기록 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `LlmCallOptions` JSDoc 이 미존재 `spec/5-system/3-llm.md` 를 SoT 로 인용(범위 밖, 기존 코드) | `llm.service.ts:52` | 별도 PR 에서 `spec/5-system/7-llm-client.md` 로 교정 |
| 2 | plan_coherence | `ai-usage-attribution-hardening.md` §SPEC-DRIFT "A1~A4" 라벨이 목적지 plan 신규 5번째 항목(A5) 미반영 | `plan/in-progress/ai-usage-attribution-hardening.md` | "A1~A5"로 갱신(본 PR 반영) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | target §1.3/§4/Rationale 4곳 self-drift(WARNING) — 타 spec 영역 정면 모순 없음. 부수적 `LlmCallOptions` JSDoc 경로 오류(INFO, 범위 밖) |
| rationale_continuity | MEDIUM | 구현이 target 자신의 Rationale "(b) 잔여 NULL" 항을 완결했음에도 target 미갱신(WARNING) — Rationale 이 정해둔 방향 실현이라 원칙 위반/기각안 재도입 아님 |
| convention_compliance | HIGH | 구현 diff 가 닫은 갭을 target 이 4곳에서 여전히 "미배선/NULL"로 서술(CRITICAL) — 병합 전 정정 필요 |
| plan_coherence | LOW | target 자체는 diff 에 없음(정상). 직전 두 회차 WARNING 해소 확인. 남은 것은 SPEC-DRIFT 절 라벨 미반영(INFO) |
| naming_collision | NONE | `llmContext`/`LlmCallContext` 는 `llm.service.ts` 기존 타입 재사용 — 충돌 없음 |

## 권장 조치사항
1. **(BLOCK 해소, 본 PR)** `spec/data-flow/7-llm-usage.md` 4개 위치(L107, L113, L162, L189-208)를 실제 구현 상태로 정정 → drift window 0.
2. Rationale "(b)" 항목을 "RerankService listwise grading" 단독으로 좁히고 메모리 압축 완결 사실을 이력으로 추가.
3. `ai-usage-attribution-hardening.md` §SPEC-DRIFT "A1~A4"→"A1~A5" 라벨 정정.
4. (비차단, 별도 PR) `llm.service.ts:52` `LlmCallOptions` JSDoc SoT 참조 `spec/5-system/3-llm.md`(미존재)→`7-llm-client.md` 교정.
