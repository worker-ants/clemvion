# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 2건의 WARNING (plan 포인터 stale + 링크 비일관성), 다수 INFO 수준 크로스 레퍼런스 보강 권고. Critical 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Plan Coherence | MakeShop·Cafe24 signal 전파 구현이 활성 plan 에 미등록 — 추적 공백 | `spec/conventions/node-cancellation.md` §6 표 MakeShop·Cafe24 행 비고 | `plan/complete/node-cancellation-infrastructure.md` (완료), `plan/in-progress/node-cancellation-inflight-followups.md` (미포함) | `node-cancellation-inflight-followups.md` 에 두 항목 추가하거나 spec §6 비고 포인터를 해당 파일로 교정 |
| W-2 | Plan Coherence | IE resume 경로 abort 가 "별도 추적 중" 으로 표현되나 실제로는 by-design best-effort 유예 확정 | `spec/conventions/node-cancellation.md` §2.1 Anthropic SDK 행 비고 | `plan/complete/node-cancellation-infrastructure.md` (완료·by-design 처리), `plan/in-progress/parallel-p2-followups.md §1` | spec §2.1 괄호 설명을 "by-design best-effort 유예 (`parallel-p2-followups.md §1` 기록)" 로 교정 |
| W-3 | Convention Compliance | `§7.5` plain 텍스트 참조가 본 문서 내 미존재 섹션 번호를 가리킴 | `spec/conventions/node-cancellation.md` line 118 §5.1 blockquote | `spec/5-system/4-execution-engine.md#75-resume-after-restart-rehydration` | `§7.5` → `[실행 엔진 §7.5](../5-system/4-execution-engine.md#75-resume-after-restart-rehydration)` 로 교체 |
| W-4 | Convention Compliance | `../../spec/` 이중 경로 패턴과 `../` 관용 경로 혼재 | `spec/conventions/node-cancellation.md` §5.1 line 108, §2.1 blockquote 등 다수 | 동일 문서 §2.3 의 올바른 `../5-system/...` 패턴 | `../../spec/5-system/...` → `../5-system/...`, `../../spec/1-data-model.md` → `../1-data-model.md` 로 정규화 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `execution.node.cancelled` 생산자 목록 불일치 — target §5.1 에 "(향후) Workflow timeout" 있으나 WS spec §4.1 에 미반영 | `spec/conventions/node-cancellation.md` §5.1 | WS spec §4.1 의 해당 이벤트 행에 "향후 생산자: Workflow timeout (Planned)" 추가 |
| I-2 | Cross-Spec | graceful shutdown NodeExecution 단말 전이 예상 변경 — 구현 시 execution-engine §11 갱신 필요 | `spec/conventions/node-cancellation.md` §2.3 | §2.3 Planned 항목에 "구현 시 execution-engine §11 미완료 NodeExecution 단말을 `cancelled` 로 변경" 메모 추가 |
| I-3 | Cross-Spec | graceful shutdown 현재 `failed`+`SERVER_INTERRUPTED` 경로와 Planned abortSignal 경로 관계 미명시 | `spec/conventions/node-cancellation.md` §2.3 | §2.3 Planned 항목에 현재 `SERVER_INTERRUPTED` 경로 명시 |
| I-4 | Cross-Spec | IE `processMultiTurnMessage` abortSignal 미전파 크로스 레퍼런스 부재 | `spec/4-nodes/3-ai/3-information-extractor.md` §4.2 | IE spec §4.2 또는 §6 에 "resumption 경로의 abortSignal 미전파 제한은 node-cancellation.md §2.1 참조" 추가 |
| I-5 | Convention Compliance | spec §6 표 chat-channel 행이 N/A 결론 미반영 — "Planned" 처럼 보임 | `spec/conventions/node-cancellation.md` §6 표 chat-channel 행 | 비고를 "N/A — workflow 노드가 아닌 message-channel adapter 로 signal 전파 대상 부재 (infrastructure plan 결론)" 로 갱신 |
| I-6 | Convention Compliance | plan 파일명이 backtick/링크 없이 plain 텍스트로 참조되고 complete 경로 미반영 | `spec/conventions/node-cancellation.md` §2.1, §6 | `node-cancellation-infrastructure.md` → `[node-cancellation-infrastructure.md](../../plan/complete/node-cancellation-infrastructure.md)` 링크화 |
| I-7 | Convention Compliance | `## Overview` 헤딩 없이 `## 1. 목적` 으로 시작 — 3섹션 권장 구조 불일치 | `spec/conventions/node-cancellation.md` 전체 구조 | `## 1. 목적` → `## Overview` 또는 `## 1. 목적 (Overview)` 로 표기 맞춤 |
| I-8 | Rationale Continuity | 모든 핵심 결정(AbortSignal 채택·시그니처 불변·rehydration 이분·active-running 타임아웃)이 Rationale 과 정합 — 이상 없음 | `spec/conventions/node-cancellation.md` Rationale 전체 | 현행 유지 |
| I-9 | Naming Collision | 전 식별자(frontmatter id, enum `cancelled`, WS 이벤트, API endpoint) 코퍼스 전체에서 단일 의미 일관 사용 — 충돌 없음 | `spec/conventions/node-cancellation.md` 전체 | 현행 유지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 교차 spec 간 모순 없음. 4건 INFO — 크로스 레퍼런스 보강 및 Planned 항목 관계 명시 권고 |
| Rationale Continuity | NONE | 4대 핵심 결정 모두 Rationale 및 참조 spec 과 정합. 번복·우회 없음 |
| Convention Compliance | LOW | 2건 WARNING — §7.5 미존재 섹션 참조, `../../spec/` 이중 경로 혼재. 2건 INFO — Overview 헤딩·plan 링크 |
| Plan Coherence | MEDIUM | 2건 WARNING — 완료된 plan 을 활성 추적 포인터로 참조, MakeShop·Cafe24 추적 공백 |
| Naming Collision | NONE | 신규 식별자 전체 코퍼스 대비 충돌 없음 |

## 권장 조치사항
1. **(W-1) 추적 공백 해소**: `plan/in-progress/node-cancellation-inflight-followups.md` 에 MakeShop·Cafe24 signal 전파 항목 추가 및 spec §6 비고 포인터 현행화.
2. **(W-2) IE resume 표현 교정**: spec §2.1 Anthropic SDK 행 비고를 "by-design best-effort 유예 (`parallel-p2-followups.md §1` 기록)" 로 수정.
3. **(W-3) §7.5 링크 정합**: plain `§7.5` 를 `[실행 엔진 §7.5](../5-system/4-execution-engine.md#75-resume-after-restart-rehydration)` 로 교체.
4. **(W-4) 경로 패턴 정규화**: `../../spec/` 패턴을 `../` 관용 패턴으로 일괄 교체.
5. **(I-5) chat-channel N/A 반영**: spec §6 표 chat-channel 행 비고 갱신.
6. **(I-1) WS spec 동기화**: WS spec §4.1 `execution.node.cancelled` 행에 "향후 생산자: Workflow timeout (Planned)" 추가 (spec 변경이므로 project-planner 위임).
7. 나머지 INFO(I-2~I-4, I-6~I-7)는 가독성·크로스 레퍼런스 개선으로 비긴급 처리 가능.
