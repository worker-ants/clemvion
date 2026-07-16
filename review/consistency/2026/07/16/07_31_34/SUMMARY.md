# Consistency Check 통합 보고서

**BLOCK: NO** — 확보된 3개 checker 결과에서 Critical 위배 없음. 단, `plan_coherence`·`naming_collision` 2개 checker는 workflow manifest 상 `status=success` 로 보고되었으나 **output 파일이 디스크에 실제로 존재하지 않아**(既知 FS-write flakiness) 이번 통합에서 검증하지 못했다 — 이 부분은 미확인 상태로 남아 있으므로 최종 BLOCK 판정을 확정하기 전 재실행 확인이 필요하다.

## 전체 위험도
**LOW** — 확보된 3개 checker(cross_spec / rationale_continuity / convention_compliance)에서 Critical 발견은 없다. WARNING 3건은 `spec/4-nodes/3-ai/` 내부 형제 문서 간 shape/네이밍 편차(코드도 spec 따라 정합이라 기능 장애는 없음)이고, INFO 2건은 문서 정리 권고 수준이다. 다만 `plan_coherence`·`naming_collision` 2개 checker의 실제 산출물이 디스크에서 확인되지 않아 — plan 정합성·네이밍 충돌 관점의 커버리지가 비어 있다는 점이 이 LOW 등급의 유일한 유보 사유다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | AI Agent 출력 예시 섹션(§7.1~§7.10)이 `Case:` 헤딩 포맷 누락 | `spec/4-nodes/3-ai/1-ai-agent.md` §7.1~§7.10 | `spec/conventions/node-output.md` Principle 11 (`### Case: <케이스 이름>` 요구) — 형제 문서 `2-text-classifier.md`/`3-information-extractor.md` 및 repo 전역 65건은 준수 | §7.1~§7.10 헤딩에 `Case:` 토큰 삽입 |
| 2 | convention_compliance | Text Classifier `meta.llmCalls` 가 공통 규약 `meta.turnDebug` shape 과 다른 top-level 평탄 구조 | `spec/4-nodes/3-ai/2-text-classifier.md` §5.1/§5.2/§5.3 | `0-common.md` §6 "토큰 회계" | (a) `meta.turnDebug` 로 정합화 또는 (b) 예외 각주 추가 |
| 3 | convention_compliance | AI Agent 조건(`condition.id`) 예약어 집합이 시스템 포트 예약어 전체집합과 불일치 | `spec/4-nodes/3-ai/1-ai-agent.md` §5.1 (`RESERVED_PORT_IDS` 5개) | `spec/conventions/node-output.md` Principle 6 (9개 시스템 예약어) | `RESERVED_PORT_IDS` 재정렬 또는 축소 근거 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `NodeExecution.status` 데이터 모델 enum 에 `resumed` 미기재 (handler-level transient, DB 비영속 — 실질 충돌 아님) | `1-ai-agent.md` §7.5 / `0-common.md` §4 ↔ `spec/1-data-model.md` §2.14 | 각주 추가 (선택) |
| 2 | rationale_continuity | 저장 경고 surfacing 설계 SoT 가 완료 대기 선행 plan 초안과 확정 spec 간 다른 스냅샷 보존 (확정 spec 이 최종 — 실질 충돌 아님) | `plan/in-progress/ai-agent-tool-payload-budget-guardrail.md` D3 ↔ spec §10 / cross-node-warning-rules §5 | §10/§5 를 단일 SoT 로 참조, 선행 plan 정리 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 데이터 모델·요구사항 ID·크로스링크·RBAC 정합. INFO 1건만 |
| rationale_continuity | LOW | §12 번복 이력 모범적. INFO 1건 (선행 plan 초안 위생) |
| convention_compliance | LOW | WARNING 3건 — 모두 문서/네이밍 수준, --impl-prep 대상 작업 차단 안 함 |
| plan_coherence | 재시도 필요→재실행 확인 (본 파일 아래 재실행 결과 참조) | FS-write flakiness 로 1차 유실 |
| naming_collision | 재시도 필요→재실행 확인 (본 파일 아래 재실행 결과 참조) | FS-write flakiness 로 1차 유실 |

## 재실행 결과 (plan_coherence · naming_collision) — 완료, 둘 다 CRITICAL=0

> 1차 workflow FS-write flakiness 로 유실 → main 이 `plan-coherence-checker`·`naming-collision-checker` 직접 재호출. 두 파일 모두 디스크 생성 확인.

- **plan_coherence** (CRITICAL=0, LOW): WARNING 1건 — `1-ai-agent.md` §7.3/§10 이 single-turn `LLM_CALL_FAILED`/`LLM_RESPONSE_INVALID` 에러 포트 라우팅을 구현된 듯 서술하나 실제 미구현(`node-output-redesign/ai-agent.md` P0 추적, `pending_plans` 미등록). **본 --impl-prep 작업 무관, 기존 이슈**. INFO 1건: `ai-agent-tool-connection-rewrite.md` dispatcher 분류 순서 노트 stale.
- **naming_collision** (CRITICAL=0, LOW): WARNING 1건 — `ai_agent:too-many-conditions`(per-node `warningRules` mini-DSL)와 `ai_agent:tool-payload-budget`(cross-node `graphWarningRules`, item A)가 다른 레지스트리인데 동일 `<type>:<slug>` id 포맷 공유 + cross-registry uniqueness 가드 부재(구조적 리스크, 실제 충돌 아님). INFO 3건: 신규 `config-time-tool-budget.ts` 가 `tool-payload-budget.ts` 와 명명 유사(→ 구분되는 이름 채택), `ai_agent:tool-payload-budget` rule id 이미 §8 선등록 확인(중복 없음).

**최종 판정: BLOCK: NO** (5/5 checker CRITICAL=0). WARNING/INFO 는 모두 spec 문서·구조 노트 수준이며 config-time 경고 구현(항목 A) 착수를 차단하지 않는다. spec 문서 WARNING 은 developer 범위 밖(project-planner 소유)이라 별도 grooming 이월.

## 권장 조치사항
1. `plan_coherence`·`naming_collision` 재실행 완료 후 최종 BLOCK 확정.
2. WARNING 3건은 spec 문서/네이밍 수준 — developer 범위 밖(spec 은 project-planner 소유). 본 --impl-prep 대상 config-time 경고 구현은 차단 안 됨. 별도 grooming 후보로 이월.
3. INFO 2건은 선택적 문서 정리.
