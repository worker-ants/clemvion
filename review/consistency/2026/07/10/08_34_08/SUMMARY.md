# Consistency Check 통합 보고서 (--impl-done spec/5-system/)

**BLOCK: NO** — 이번 변경(`spec/5-system/14-external-interaction-api.md` §R17 terminal `result`/`error` `outputData` 마스킹 하드닝 + 구현)에 대해 5개 checker 전수 확인 결과 Critical 위배 없음.

> **주의(orchestrator payload 버그)**: `_prompts/*.md` 4개(cross_spec·convention_compliance·plan_coherence·naming_collision)에 target 문서로 무관한 `spec/5-system/1-auth.md`·`10-graph-rag.md` 전문이 임베드돼 있었다. 5개 checker 모두 이를 인지하고 **실제 `git diff origin/main...HEAD`(§R17)로 재스코프**해 검토했다. rationale_continuity 는 초기 Workflow 산출, 나머지 4개는 FS-write flakiness 로 직접 Agent 재실행.

## 전체 위험도
**LOW**

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 |
|---|---------|------|
| - | - | (이번 변경 범위 Critical 없음) |

## 경고 (WARNING)

| # | Checker | 위배 | 판정 |
|---|---------|------|------|
| 1 | cross_spec | `spec/5-system/10-graph-rag.md` §6(Graph KB WS 이벤트 5개) vs `6-websocket-protocol.md` §4.3("6개"·"12 union") vs 코드(`KbEventType` 11개, `document:graph_error` 미선언, 프론트 12개 구독) 불일치 | **본 변경 무관·선재(pre-existing) 이슈** — orchestrator 가 잘못 임베드한 `10-graph-rag.md` 를 분석해 표면화됨. 본 PR 스코프 밖(별도 backlog 로 분리). |

## 참고 (INFO)

| # | Checker | 항목 |
|---|---------|------|
| 1 | rationale_continuity | R17 제목에 2026-07-10 terminal outputData 확장 날짜 병기 권장(내용 정합, 필수 아님) |
| 2 | convention_compliance | `spec/5-system/2-api-convention.md` 가 conventions SoT 역할이나 `spec/conventions/` 밖에 위치(선재 구조) |
| 3 | naming_collision | 신규 `DEEP_REDACT_CACHE` 와 기존 `SANITIZE_CACHE`(websocket.service) 동일 목적 상이 명명(충돌 아님, 일관성 제안) |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| cross_spec | LOW | 본 변경(§R17)은 데이터모델·API계약·상태전이 등 6관점 정합. 유일 WARNING 은 선재 graph-rag/ws 불일치(본 변경 무관) |
| rationale_continuity | NONE | §R17 terminal outputData 마스킹은 PR #876 잔여 갭(P1-2) 이행, 기존 정책·SoT 정합. 번복 없음 |
| convention_compliance | NONE | `deepRedactSecrets` SoT 재사용(재구현 없음), 규약 준수 |
| plan_coherence | NONE | `plan/complete/eia-secret-masking-residuals.md` 자체 결정으로 종결, in-progress plan 충돌 없음 |
| naming_collision | NONE | 신규 식별자 충돌 없음 |

## 권장 조치
1. 본 변경(§R17)은 BLOCK: NO — 진행 가능.
2. cross_spec WARNING(graph-rag/ws 이벤트 불일치)은 **본 PR 무관 선재 이슈** → 별도 backlog 로 분리(spawn task).
3. INFO 3건은 후속 편집 시 선택 반영.
