# Consistency Check RESOLUTION — 22_22_19 (`--impl-done`)

대상: `spec/data-flow/7-llm-usage.md` (+ 커밋 `0fa772406` diff), diff-base=`origin/main`.
브랜치: `claude/ai-usage-attribution-hardening-358929`.

## 최종 판정: **BLOCK: NO** (최초 BLOCK:YES → 정정 + 재검증으로 해소)

## 1. 최초 회차 발견 (5 checker)

| Checker | 등급 | 발견 | 처분 |
|---|---|---|---|
| convention_compliance | **CRITICAL** | §1.3 표 L107·콜아웃 L113·§4 L162·Rationale (b) 4곳이 C1 배선(AI Agent 메모리 롤링 요약 압축 attribution)을 여전히 "미배선/NULL"로 서술 — SoT 붕괴 | **FIX**: 4개 위치 정정, 본 PR 에 포함 |
| cross_spec | WARNING | 위 self-drift (동일 근본 원인). 타 spec 정면 모순 없음 | 위 FIX 로 해소 |
| rationale_continuity | WARNING/MEDIUM | 구현이 Rationale (b) 를 완결했으나 target 미갱신 | 위 FIX 로 해소 |
| plan_coherence | INFO | §SPEC-DRIFT "A1~A4" 라벨이 목적지 plan A5 미반영 | **FIX**: plan 라벨/이관 서술 정정 |
| naming_collision | NONE | `llmContext`/`LlmCallContext` 기존 타입 재사용 — 충돌 없음 | — |

## 2. 적용한 정정 (커밋 `0fa772406`)

- **CRITICAL 해소** — `spec/data-flow/7-llm-usage.md` 4개 위치 정정:
  1. §1.3 표 L107: "context 미전달 → 전부 NULL" → "**채움**(단발 `context.*`/resume `state.*`, AI Agent 메인 chat 과 동일 패턴)".
  2. §1.3 콜아웃 L113: 잔여 NULL 목록에서 "AI Agent 메모리 롤링 요약 압축" 제거 + 노드 발 채움 문장 추가.
  3. §4 Agent Memory 행 L162: "롤링 요약 압축 chat (context NULL)" → "노드 발 — context 채움(추출 processor 만 NULL)".
  4. Rationale (b) L204~208: 잔여 NULL 에서 메모리 압축 제거(→ `RerankService` listwise 단독), 진행 이력에 2026-07 배선 근거 문장 추가.
- **plan INFO 해소** — `ai-usage-attribution-hardening.md` §SPEC-DRIFT 를 "PR-2 이관" → "본 PR 해소"로 갱신(4개 위치 `[x]`), `resume-llm-usage-attribution.md` 구 A5 를 "PR-1 완료"로 이관 기록. 두 plan 상호 일관.
- **처분 근거**: 당초 §1.3 정정은 PR-2(project-planner)로 분리 예정이었으나, code-review·consistency 두 SUMMARY 가 "drift window 0 을 위해 본 PR 포함"을 권고, rationale_continuity 가 "Rationale 이 이미 결정한 방향의 factual 실현(신규 설계 아님)"임을 확인, #879 선례(developer PR 이 동일 파일 결합 spec 정정 동반)도 있어 **본 PR 에 포함**.

## 3. 재검증 (커밋 `0fa772406`, `reverify/`)

| Checker | 등급 | 결과 |
|---|---|---|
| convention_compliance | LOW | **직전 CRITICAL 해소 확인** (HEAD spec 4곳 ↔ `agent-memory-injection.ts`/`ai-turn-executor.ts`/`buildRetryReentryState` 코드 1:1 정합). **신규 LOW WARNING**: 콜아웃이 `RerankService` listwise 를 "워크플로우 밖·non-node" 로 라벨 → Rationale (b)("노드 컨텍스트 있으나 미배선")와 모순 (코드상 `kb-tool-provider.ts` 노드 tool-loop 내 호출이라 Rationale 이 정확). |
| cross_spec | NONE | self-drift 해소, 인접 spec 전수 grep — 상충 없음, §1.3 내부 정합. |
| rationale_continuity | NONE | 기존 결정("코드 수정 채택")의 연속적 factual 정정, 기각안 재도입 없음, invariant 유지. |
| plan_coherence | INFO×2 | A1~A4 라벨 INFO 해소. 잔여: node-output-redesign plan 라인 좌표 drift(무해, 그 plan 주기적 재확정) + RESOLUTION.md 미생성(본 파일로 해소). |

## 4. 재검증 WARNING 추가 정정

convention_compliance 재검증이 지적한 **콜아웃 RerankService 오분류(pre-existing, LOW)** 를 커밋
`0fa772406` 에 함께 반영: 콜아웃 "워크플로우 밖·non-node caller(...·`RerankService` listwise·...)" →
"워크플로우 밖 caller(`GraphExtractionService`·AgentMemory 추출 processor)와 노드 실행 중이나 아직
미배선인 `RerankService` listwise (§Rationale (a)/(b) 구분)". 콜아웃 ↔ Rationale (a)/(b) 완전 정합 확인(grep 대조).

## 5. 잔여 (본 PR 밖, 추적됨)

- 인접 문서 stale 문구(6-knowledge-base.md·13-agent-memory.md "모든 LLM 호출 적재" 등) 정정 →
  `resume-llm-usage-attribution.md` §"잔여 follow-up" A1~A4 (project-planner 트랙).
- `llm.service.ts:52` `LlmCallOptions` JSDoc 이 미존재 `spec/5-system/3-llm.md` 인용 → 별도 PR (cross_spec INFO, 범위 밖).
- node-output-redesign plan 라인 좌표 drift → 그 plan 소유 트랙에서 재확정 (INFO).

**BLOCK: NO — Critical 0 (재검증 확정).**
