# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 성공·전문 확보, CRITICAL 0건.

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 4건 중 하나(plan 자체 체크리스트의 자기모순)가 재발 방지 관점에서 가장 무겁지만(개별 checker는 MEDIUM으로 매김), 실제 spec 파일(WS protocol §4.4)은 이미 안전한 문구로 정정돼 있어 라이브 invariant 위반은 아니다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | plan "작업" 체크리스트가 `16_41_05` CRITICAL로 이미 폐기된 근거("동일 이름·다른 계층")를 `[x]` 완료 항목으로 취소선 없이 여전히 서술 — 문서 내부 자기모순 | `plan/in-progress/planner-doc-batch.md` line 165-166 | 같은 문서 line 155-157(정정 반영분) · `review/consistency/2026/08/24/16_41_05/RESOLUTION.md` CRITICAL 1 · 실제 spec `spec/5-system/6-websocket-protocol.md` §4.4(정정됨) | line 165-166 원문에 취소선 긋고 "→ `16_41_05` CRITICAL로 반증, 실제 각주는 line 155-157 참조"식 정정 주석 추가 |
| 2 | cross_spec | 신설 각주가 "노드 종류를 읽으려면 `waitingNodeType`을 쓰라"고 무자격 권고 — EIA §R17의 "node.type은 외부 소비 매핑 없음, waitingNodeType은 WS 내부 전용" 정책과 충돌 | `spec/5-system/6-websocket-protocol.md` §4.4 line 529-530 | `spec/5-system/14-external-interaction-api.md` §R17 line 736-740 · 같은 문서 §4.4 도입부(line 451) 및 `## Rationale`(line 1058) | (a) "단, waitingNodeType은 WS 내부 전용이며 외부 클라이언트는 interactionType으로 분기(EIA §R17)" 한 문장 추가, 또는 (b) 해당 문장 삭제하고 "대체 경로 없음, interactionType이 유일 SoT"로 대체 |
| 3 | convention_compliance | plan 파일명이 "spec draft batch" 명명 선례(`spec-draft-<name>.md`)를 따르지 않음 (build guard 미강제) | `plan/in-progress/planner-doc-batch.md` 파일명/frontmatter | `.claude/skills/project-planner/SKILL.md` 워크플로 3번 · 선례 `plan/complete/spec-draft-cross-audit-doc-batch.md` | 파일명을 `spec-draft-planner-doc-batch.md`로 정정하거나, "직접 편집+판정 기록" 유형을 SKILL.md에 별도 명명 패턴으로 인정 |
| 4 | plan_coherence | 신규 등재한 harness 갭("`--spec` 번들러가 spec_impact 대상을 후보 집합에 못 넣음")이 기존 harness 트래커와 교차 참조 없이 고립 등재 — 중복 진단 위험 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 신규 항목 | `plan/in-progress/harness-consistency-summary-downgrade-rule.md`(2026-08-09 실측, 동일 처방 미구현) · `plan/in-progress/harness-review-gate-followups.md:462` | 새 항목에 두 harness 트래커로 상호 참조 추가, 또는 항목을 그쪽으로 이관해 단일 진실 유지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | naming_collision | B5 `background:run:{id}` 표기가 §3.3 형제 행과 일치하도록 정정됨(이전 WARNING `{runId}` 해소 확인) | `spec/5-system/6-websocket-protocol.md:128` | 조치 불요 — 확인용 기록 |
| 2 | naming_collision | `wire 전용` 갈래 라벨이 EIA §R17과 정확히 일치(이전 WARNING 해소 확인) | `spec/conventions/node-output.md:54-55` | 조치 불요 |
| 3 | naming_collision | cross-document `{id}`/`<id>` 표기 분기 잔존 (target 책임 밖, pre-existing) | `12-background.md`/`redis-keys.md:84`/`data-flow/3-execution.md` | 별도 후속 항목으로만 추적, 이번 배치 재작업 불요 |
| 4 | naming_collision | `### 4.4` 헤딩 중복 (pre-existing, `13_30_49` RESOLUTION에서 이미 처분) | `spec/5-system/6-websocket-protocol.md` line 447/842 | 재조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `16_41_05` CRITICAL 1건·WARNING 4건 전부 해소 확인. 단 정정 각주 자체가 EIA §R17과 새로 충돌하는 문장 1개 발견(WARNING) |
| rationale_continuity | MEDIUM | B1·B2·B4·B5·B6·B7 정합 확인. plan 체크리스트에 폐기된 근거가 취소선 없이 잔존(자기모순) |
| convention_compliance | LOW | B1·B2·B4·B5·B7 spec 표기·필드정의 인용 전부 정합. 파일명 명명 관행 이탈 1건(build guard 미강제) |
| plan_coherence | LOW | 7건 spec_impact 항목 전부 실제 diff와 정합. 신규 harness 진단이 기존 트래커와 고립 |
| naming_collision | NONE | 신규 식별자 도입 없음(전부 기구현 코드/기존 spec 표현의 재인용). 이전 라운드 WARNING 2건 해소 확인 |

## 권장 조치사항
1. (자기모순 우선 정정) `plan/in-progress/planner-doc-batch.md` line 165-166에 취소선 처리 + "→ `16_41_05` CRITICAL로 반증, 실제 각주는 line 155-157 참조" 정정 주석 추가.
2. `spec/5-system/6-websocket-protocol.md` §4.4 line 529-530에 `waitingNodeType`이 WS 내부 전용임을 명시하는 스코프 문장 추가(또는 해당 문장 삭제).
3. plan 파일명을 `spec-draft-planner-doc-batch.md`로 정정하거나 SKILL.md 명명 규약을 갱신할지 택일.
4. `spec-sync-external-interaction-api-gaps.md`의 신규 harness 항목에 `harness-consistency-summary-downgrade-rule.md` 및 `harness-review-gate-followups.md:462`로 상호 참조 추가.
