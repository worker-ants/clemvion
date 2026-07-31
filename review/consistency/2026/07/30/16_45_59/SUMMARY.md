# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원이 CRITICAL/WARNING 없이 완주. 발견은 전부 INFO(완결성 제안) 등급.

대상: `plan/in-progress/workflow-duplicate-nodes-edges.md` (spec_impact: `spec/data-flow/11-workflow.md`, `spec/2-navigation/1-workflow-list.md`)

## 전체 위험도
**LOW** — CRITICAL/WARNING 0건. 5개 checker 모두 실제 spec/코드/plan 을 직접 대조(prompt 번들 생략분까지 보완 확인)했고, target 이 뒤집으려는 `spec/data-flow/11-workflow.md:137` "nodes/edges 는 복제하지 않는다" 문구가 감사 커밋(`db496a3c2`)의 drift-sync 부작용이었다는 target 의 핵심 전제도 `git show` 로 실측 확인됨. 남은 6건은 모두 문서 완결성(INFO) 제안.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `Trigger`(webhook/schedule) 및 `WorkflowTestDataset` 의 복제 제외 범위가 target 본문에 명시되지 않음 — export/import 전례와는 이미 일치하지만, "Manual Trigger 노드"와 "Trigger 엔티티" 명칭이 겹쳐 구현자가 오독할 여지 | §1.1 TO-BE / §2 구현계획 (`spec/1-data-model.md` §2.8 Trigger, §2.13.3 WorkflowTestDataset 과 대조) | §1.1 TO-BE 또는 §1.4 Rationale 에 "Trigger·WorkflowTestDataset 은 복제 범위 제외(export/import 와 동일 정책)" 한 줄 추가 + unit 체크리스트에 "해당 row 개수 불변" 단언 추가 |
| 2 | cross_spec | `spec/2-navigation/1-workflow-list.md` §3 API 표의 duplicate 행이 §2.6 갱신(신규 data-flow §1.5 링크) 대비 상세도가 비대칭 | 동일 파일 §3 API 표 124행 | §3 표 124행에도 `→ data-flow §1.5` 각주/링크 추가 (필수 아님) |
| 3 | rationale_continuity | §1.4 실행 지시문이 "별 경로 근거"·"버전 이력 비승계 근거"만 명시하고, 이미 작성된 `### 기각한 대안`(Manual Trigger 자동생성 기각·spec 하향 기각) 절의 spec 이관을 명시적으로 지목하지 않음 | §1.4 (line 109-111), 체크리스트 (line 126) | §1.4 문구를 "본 문서 `## Rationale` 전체(기각한 대안 2건 포함)를 `spec/data-flow/11-workflow.md` Rationale 로 이관"으로 구체화 |
| 4 | rationale_continuity | `spec/3-workflow-editor/3-execution.md:753` 인용은 "복제 후 자기 소유" **소유권 패턴** 선례이지 "노드/엣지 내용 복사" 선례를 직접 진술하지 않음 — 3개 counter-reference 중 가장 간접적 | Rationale > "왜 spec 을 코드에 맞추지 않는가" 문단 (line 145-147) | 인용 역할을 "소유권 패턴 선례"로 한정 표기하거나, 주 근거(NAV-WF-04 + workflow-list.md §2.6)와 보조 정황을 구분 표기 |
| 5 | convention_compliance | `POST :id/duplicate` 의 `@ApiOperation.description`(현재 "노드/엣지 복사 여부 미언급")이 이번 fix 로 새로 생기는 부수효과(캔버스 전체 복제 + UUID 재매핑)를 반영하도록 갱신하는 항목이 구현 체크리스트에 없음 | §2 구현계획 체크리스트 (라인 124-134) — `spec/conventions/swagger.md §3` ("부수효과 포함 설명") 대비 | 구현 체크리스트에 `@ApiOperation` description 을 "노드·엣지를 포함한 캔버스 전체를 복제합니다" 등으로 보강하는 항목 추가 |
| 6 | convention_compliance + naming_collision | §1.3 이 §1.1/§1.2 와 달리 정확한 AS-IS/TO-BE 텍스트 없이 지시문으로만 기술되고, 신규 "복제" 흐름 표 행 스코프도 `node`/`edge`로만 명시돼 `workflow` 테이블 자체(현재 "생성" 행만 존재)의 복제 행 반영 여부가 불명확 | §1.3 (라인 106-108, `spec/data-flow/11-workflow.md` §2.1 Postgres 표 대상) | `developer`/`planner` 착수 시 §2.1 표에 추가할 정확한 행 문구를 미리 초안하되, `workflow` 테이블에도 "복제" 행(또는 "생성" 행 각주)을 넣어 `node`/`edge`와 표기 대칭을 맞출 것 (필수 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | Trigger/WorkflowTestDataset 복제 제외 범위 미명시(INFO), workflow-list.md §3 표 상세도 비대칭(INFO). 데이터모델·API계약·요구사항ID·상태전이·RBAC·버전이력·계층책임 전 축 대조 결과 모순 없음. target 이 진단한 "3-way spec 불일치"도 실측 확인되며 target 계획이 이를 해소함(새 모순 아님) |
| Rationale Continuity | LOW | §1.4 체크리스트의 "기각한 대안" 이관 미명시(INFO), execution.md:753 인용 정밀화 필요(INFO). target 이 뒤집는 spec 문구가 trade-off 기록된 합의 결정이 아니라 감사 시점 drift-sync 부작용이라는 핵심 전제를 `git show db496a3c2` 로 실측 확인. 3개 counter-reference 모두 허구 없음 |
| Convention Compliance | LOW | Swagger description 갱신 누락(INFO), §1.3 형식 비일관(INFO). plan frontmatter 스키마(Gate C 리스트 형식)·3섹션 구조·명명 규약(DB 컬럼 vs JSONB 필드)·신규 anchor(slugify 파이프라인 재현 검증 통과) 전부 정합. 신규 마이그레이션/에러코드/DTO 변경 없어 해당 규약 저촉 지점 자체가 없음 |
| Plan Coherence | NONE | 47개 in-progress plan 전수 grep 대조 결과 target 표면(`WorkflowsService.duplicate()`, 대상 2개 spec 절)과 실질적으로 겹치거나 충돌하는 미해결 결정 없음. 근접 후보 3건(marketplace, node-output-redesign, ai-agent-tool-connection-rewrite) 모두 다른 절/메커니즘이거나 기존 패턴 재사용뿐이라 비저촉 |
| Naming Collision | NONE | 신규 식별자(엔티티/API endpoint/이벤트/env var/요구사항 ID) 도입 없음. 언급되는 모든 명칭이 기존 spec·코드와 의미 일치. §1.3 표 행의 `workflow` 테이블 표기 대칭 메모 1건(INFO)만 존재, 명칭 충돌 아님 |

## 권장 조치사항

BLOCK 사유가 없으므로 아래는 구현 착수 전/중 반영 권장 순으로 정리(전부 선택적 보강):

1. **Rationale 이관 명문화** — §1.4 체크리스트 문구를 "본 문서 `## Rationale` 전체(별 경로 근거·버전 이력 비승계 근거·`기각한 대안` 2건 포함)를 `spec/data-flow/11-workflow.md` Rationale 로 이관"으로 구체화. (rationale_continuity #3)
2. **Swagger description 갱신 항목 추가** — 구현 체크리스트에 `@ApiOperation` description 을 실제 부수효과(캔버스 전체 복제)로 보강하는 항목 추가. (convention_compliance #5)
3. **Trigger/WorkflowTestDataset 제외 범위 명시** — §1.1 TO-BE 또는 §1.4 에 "Trigger(webhook/schedule)·WorkflowTestDataset 은 복제 범위 제외 — export/import 와 동일 정책" 한 줄 추가 + unit 체크리스트에 row 개수 불변 단언 추가. (cross_spec #1)
4. **§1.3 표 행 정밀화 + workflow 테이블 스코프 결정** — §2.1 표에 추가할 정확한 행 문구를 §1.1/§1.2 수준으로 미리 초안하고, `workflow` 테이블 자체의 "복제" 행(또는 "생성" 행 각주) 포함 여부를 함께 결정. (convention_compliance #6 + naming_collision #6)
5. **(선택) 인용·링크 정밀화** — execution.md:753 인용을 "소유권 패턴 선례"로 한정 표기(rationale_continuity #4), workflow-list.md §3 API 표 124행에도 §2.6 과 동일한 `→ data-flow §1.5` 각주 추가(cross_spec #2).

이상 5건 모두 완료해도 target 의 구현 착수 자체를 지연시킬 필요는 없다 — CRITICAL/WARNING 이 전무하므로 `developer` 는 즉시 착수 가능하며, 위 항목은 spec 반영(§1.1~§1.4 체크리스트 수행) 시점에 함께 처리하는 것을 권장한다.
