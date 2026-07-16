# Consistency Check 통합 보고서 (2회차)

**BLOCK: NO** — 1회차 CRITICAL 2건 모두 해소. 5/5 checker 전수 확보 (Agent fan-out 경로 사용 — 1회차 Workflow FS-write flakiness 회피).

> 1회차: `review/consistency/2026/07/17/00_32_29/` (BLOCK: YES — Cross-Spec CRITICAL "이중 SoT" + Rationale Continuity CRITICAL "무근거 번복")

## 전체 위험도

**MEDIUM** — CRITICAL 0건. Cross-Spec 이 낸 WARNING 1건이 **target 의 근본 원인 진단 자체를 뒤집는 실측 단서**였고, 이를 추적한 결과 plan 이 전면 재작성됐다 (아래 §R1/R2 재확정). 결과적으로 **spec 개정 범위가 축소되고 수정 효과는 확대**됐다.

## Checker별 결과

| Checker | 1회차 | 2회차 | 핵심 |
|---|---|---|---|
| Cross-Spec | HIGH (CRITICAL) | **MEDIUM** | CRITICAL 해소 확인(`conversation-thread.md` 에 `9.13` 문자열 부재). **신규 WARNING** — 이력 view 갭을 EH-DETAIL-12(cross-node 전용 v2)에 위임한 것은 스코프 오귀속. 실측: `finalizeAiNode` 가 FAILED 에도 `outputData` 영속·emit, `apply-execution-snapshot.ts:91-104` 가 REST outputData 반영 → 단일 노드 렌더 게이트 문제 |
| Rationale Continuity | HIGH (CRITICAL) | **LOW** | CRITICAL 해소. INFO 2 — §10.6.1 조건문의 `port:'error'` 잔존 표현을 실측(`node.failed` 유일 경로)에 맞춰 정정할 것 / §10.6.1 → `§8.5` 역참조 링크 추가 |
| Convention Compliance | NONE | **LOW** | WARNING 1 — CT-S15/S16 서술이 확장의 **실제 델타(non-retryable)** 를 겨냥하는지 불분명. INFO 1 — 헤더 SoT 인용 `L213` → `L211` |
| Plan Coherence | MEDIUM | **LOW** | WARNING 2 — CT-S17 미등재 / §9.10 적용 파일 목록에 `result-detail.tsx` 누락(**이번 회귀가 무테스트로 통과한 구조적 이유**). INFO 3 — 필터링 결정 spec Rationale 미문서화 / **plan EOF 에 tool-call XML 잔재** / `node-cancellation-inflight-followups` 교차 참조 무관 |
| Naming Collision | NONE | **NONE** | `isErroredConversation` 전역 grep 0건. §9.13 폐기로 dangling 없음 |

## R1/R2 재확정 — Cross-Spec WARNING 추적 결과 (본 회차 최대 성과)

Cross-Spec 의 "스코프 오귀속" WARNING 을 main 이 실측 추적한 결과, **target 의 핵심 전제("`node.failed` 는 `outputData: null` 이라 store 가 유일한 복원 매체")가 틀렸음**이 확인됐다:

| 실측 | 위치 |
|---|---|
| 백엔드가 FAILED 에도 `nodeExec.outputData = finalOutput` 영속 (isFailed 분기 **이전**) | `ai-turn-orchestrator.service.ts:1249` |
| `NODE_FAILED` emit payload 에 `output: nodeExec.outputData` 동봉 | 같은 파일 `:1296-1314` |
| 프론트 `handleNodeFailed` payload 타입에 **`output` 미선언** → drop | `use-execution-events.ts:823-840` |
| `outputData: null` 하드코딩 (`node.completed` 는 `payload.output ?? null` — **비대칭**) | 같은 파일 `:866` vs `:778` |
| REST 스냅샷이 `outputData: ne.outputData` 를 상태 무관 반영 | `apply-execution-snapshot.ts:102` |

→ **진짜 근본 원인은 독립 결함 2개**: **R1** (프론트가 backend 가 보낸 output 을 버림) + **R2** (렌더 게이트의 `status === 'completed'` 요구).

**파급**:
- 초안의 "이력 view 는 EH-DETAIL-12 v2 영역" **제외 철회** — `outputData` 가 영속되므로 R2 만 고치면 이력 화면도 복구된다.
- 초안의 store 귀속 술어(`isErroredConversation`) **미리보기 판정에서 제거** — 노드 자신의 `outputData` 가 정확히 스코프된 권위 소스라 **cross-node 논쟁(Plan Coherence WARNING 1) 전제가 소멸**. 술어는 live 재시도 메타데이터 확보용으로만 좁게 잔존.
- `conversation-thread.md §9.3` **신규 행 추가 불필요** — 기존 3행(이력 복원 view)이 이미 규정하고 구현이 못 따라간 것. Naming Collision INFO·Rationale Continuity D4 INFO 도 동반 소멸.

## 처분 내역

| 발견 | 처분 |
|---|---|
| Cross-Spec CRITICAL (이중 SoT) | ✅ 1회차에 해소 — §9.13 폐기, §10.6.1 SoT 유지 |
| Rationale Continuity CRITICAL (무근거 번복) | ✅ 1회차에 해소 — ED-EX-13 개정 + §8.5 신설 근거. 2회차가 "실질 해소" 판정 |
| **Cross-Spec WARNING (스코프 오귀속)** | ✅ **plan 전면 재작성** — R1/R2 재확정, 이력 view 제외 철회 |
| Rationale Continuity INFO 1 (`port:'error'` 잔존) | ✅ Phase 1 A-2 를 "확장" → "**조건문 재작성**" 으로 변경 |
| Rationale Continuity INFO 2 (§8.5 역참조) | ✅ A-2 에 cross-ref 링크 추가 명시 |
| Convention Compliance WARNING (델타 미겨냥) | ✅ CT-S16 을 **`retryable: false` 픽스처**로 명시 확정 |
| Convention Compliance INFO (L213→L211) | ✅ 헤더 정정 |
| Plan Coherence WARNING 1 (cross-node) | ✅ **전제 소멸** (R1/R2). 논증은 live 경로용으로 보존, 교차 참조 유지 |
| Plan Coherence WARNING 2 (§9.10 파일 목록) | ✅ Phase 1 항목 6 에 `result-detail.tsx` 추가 명시 |
| Plan Coherence INFO (XML 잔재) | ✅ 제거 완료 |
| Plan Coherence INFO (필터링 Rationale) | ✅ §8.5 서술 범위에 명시 |
| Plan Coherence INFO (무관 교차참조) | ✅ 제거 |
| `cancelled` 범위 | ✅ 실측(`handleNodeCancelled` 가 conversation 미조작) → **스코프 제외**, `showTabs` cancelled 수정도 제외(무관 drift) |

## 판정

**BLOCK: NO** — spec 개정 착수 가능. R1/R2 재작성으로 spec 개정 surface 가 축소됐고(§9.3 신규 행 불필요), 새로 도입되는 결정은 §10.6.1 조건문 재작성 + Inv-8 + CT-S15~17 + §8.5 로 한정된다.
