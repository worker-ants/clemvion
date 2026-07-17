# Consistency Check — `--impl-prep` (구현 착수 직전)

**BLOCK: YES → 해소 완료.** CRITICAL 2건 전부 spec/plan 정정으로 처분.

대상: `plan/in-progress/rag-tool-row-distinct-ui.md` Phase 2 (spec 개정 커밋 `e9c1b1122` 이후)
checker: convention_compliance (HIGH) · plan_coherence (LOW)

## Critical (2건 — 전부 해소)

| # | 발견 | 조치 |
|---|---|---|
| 1 | **`spec/conventions/interaction-type-registry.md` §2 매트릭스에 `rag` 미등록** — 이 문서가 source 별 **AST 가드 사이트 + 렌더 분기 + exhaustive switch 의무**를 관장하는 SoT 인데 Phase 1 개정 대상에서 **통째로 누락**됐다 | ✅ frontend union 6→**7값** 서술 갱신 + `rag` 행 신설 (가드 사이트·렌더 분기·spec cross-ref) + switch case 의무 주석 |
| 2 | **Phase 2 파일 목록에 `conversation-timeline-item.tsx` 누락** — `result-timeline.tsx` 는 이 컴포넌트에 **위임만** 하고 자체 source 분기가 없다. 빠뜨리면 §9.6 이 강제하는 **양 surface 중 한쪽에서 🔎 행이 깨진다** | ✅ Phase 2 항목 6 신설 |

## Warning (전부 처분)

| 발견 | 조치 |
|---|---|
| `ConversationTurnSource` 7값 확장이 exhaustive switch 컴파일 계약과 충돌 — §9.5 "switch 에 6 case" 서술과 모순 | ✅ 실측(`conversation-utils.ts:209-322` — 6 case + `_exhaustive: never`) 후 **§9.5 → 7 case** 정정. `rag` 도 `system_error` 처럼 **방어 case 를 갖는다** (wire 미도달이나 유니온 값이므로 컴파일이 강제) — registry §2 에 주석 |
| §9.11 "세 변환 path" 헤더가 4행 표와 불일치 — **내 개정이 남긴 잔여 drift** | ✅ "네 변환 path" 로 정정 |
| **`TurnRagDelta`/`RagSource` 가 `components/` 계층에만 존재 — `lib/` 배치 미결정** | ✅ **레이어 역전 회피 결정** — 아래 §레이어 결정 |
| Phase 3 테스트 목록에 CT-S18 이 요구하는 `result-timeline.test.tsx` 누락 | ✅ Phase 3 반영 |
| **e9c1b1122 의 plan 이동이 다른 in-progress plan 의 상대링크를 끊음** | ✅ `node-output-redesign/ai-agent.md:213` → `../../complete/...` 정정 |

## 레이어 결정 (impl-prep WARNING)

`mergeRagRetrievalItems` 는 §9.11 계약상 `lib/conversation/conversation-utils.ts` 에 산다. 그 함수가 `TurnRagDelta` 를 `components/editor/run-results/output-shape.ts` 에서 import 하면 **`lib/` → `components/` 레이어 역전**이다.

**실측**: `grep -rn 'from "@/components' lib/` → **0건**. 즉 저장소 최초의 역전이 될 뻔했다.

**선례**: [`components/editor/run-results/conversation-utils.ts:1-4`](../../../../../codebase/frontend/src/components/editor/run-results/conversation-utils.ts) 가 정확히 같은 문제를 같은 방법으로 해결 — *"conversation utility 는 `@/lib/conversation/` 에 둬서 `@/lib/websocket/` 이 레이어 역전 없이 소비하게 하고, 이 디렉터리는 안정성을 위해 로컬 경로 import 유지"*.

→ **결정**: `RagSource`/`TurnRagDelta` 를 `lib/conversation/` 으로 이동하고 `output-shape.ts` 는 re-export 로 남긴다 (Phase 2 항목 0). 기존 소비처는 무변경.

## 판정

**BLOCK 해소 — Phase 2 구현 착수 가능.** 개정된 spec: `interaction-type-registry.md`(신규) + `conversation-thread.md`(§9.5·§9.11 카운트).
