# Consistency Check 통합 보고서 (--spec, EH-DETAIL-06 ID 분리 draft)

**BLOCK: NO** — 5개 checker 전량 수집(cross_spec·convention_compliance 는 subagent write 격리로
워크플로가 파일 미기록 → journal `wf_69efdc97-165` 에서 main 이 복원). Critical 0. convention_compliance
WARNING 1건은 **draft 보강으로 해소**(아래).

> 대상 draft: `plan/in-progress/spec-draft-eh-detail-06-id-split.md`.
> `EH-DETAIL-06` 을 단일 노드 Preview(✅) 와 cross-node 재구성(신규 `EH-DETAIL-12`, ❌ v2)로 분리.

## 전체 위험도
**LOW** — Critical 0. 최초 판독 시 convention_compliance WARNING 1건이 있었으나, draft 에 §6.3
로드맵 미러 + Rationale 보강을 추가해 해소함.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING) — 조치 완료

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| 1 | convention_compliance | `14-execution-history.md`(frontmatter `status: implemented`)에 미구현 `❌ (v2)` 요구사항(EH-DETAIL-12)을 신설하는 것이 `spec-impl-evidence.md §3`("implemented=전 약속 완료")와 마찰. 저장소 선례(Graph RAG·conversation-thread 의 v2/❌)는 문서 status 를 implemented 로 두고 v2 항목을 `0-overview.md §6.3 로드맵` 표에 **짝지어 등재**함 — draft 는 그 짝이 없었음 | **해소**: draft 에 §6.3 로드맵 미러 행(edit #5) + Rationale "`status: implemented` 유지 사유" 추가. 적용된 spec 도 `0-overview.md §6.3` 에 EH-DETAIL-12 행 + `14-execution-history.md` R-6 Rationale 반영. 선례와 정합 |

## 참고 (INFO) — 조치 완료

| # | Checker | 항목 | 처리 |
|---|---------|------|------|
| 1 | rationale_continuity | 과거(2026-06-05/06-11) "무해" INFO 판정 재평가 계보 미명시 | draft Rationale 에 판정 계보 한 줄 추가 |
| 2 | plan_coherence | 향후 v2 착수 plan 은 EH-DETAIL-12 인용 안내 부재 | draft Rationale 에 안내 한 줄 추가 |
| 3 | naming_collision | `EH-DETAIL-12` 충돌 없음(표 다음 순번, 재사용 이력 0) | 확인, 조치 불요 |
| 4 | cross_spec | 4개 편집 지점 line-by-line 정확 확인, §6.3 미등재 완결성 격차 | edit #5 로 §6.3 등재 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW→해소 | 4개 편집 지점 정확·EH-DETAIL-12 충돌 없음. §6.3 미러 권고 → 반영 |
| rationale_continuity | NONE | ID 라벨 정정만, 결정 실체(컬럼 채택 등) 불변. 계보 INFO → 반영 |
| convention_compliance | LOW→해소 | implemented+v2 항목 조합은 §6.3 로드맵 짝 등재 시 허용(선례) → 반영 |
| plan_coherence | NONE | 완료 plan(#866)이 위임한 후속을 정확 이행. 즉시 stale plan 없음 |
| naming_collision | NONE | EH-DETAIL-12 신규 ID 충돌 없음 |

## 결론
BLOCK: NO. WARNING·INFO 전량 draft/spec 반영 완료. spec 구조 가드(spec-link-integrity·
spec-area-index·spec-status-lifecycle·spec-frontmatter 등 17파일 2473테스트) 통과.
