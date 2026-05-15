# Consistency Check SUMMARY (--impl-prep)

**BLOCK: NO**

대상: `backend/src/modules/knowledge-base/graph` (kb-stats.helper.ts dead path 제거 PR)
세션: `review/consistency/2026/05/16/00_32_47`

## Critical 위배

없음.

## Warning (5건)

| # | Checker | 위배 | 처리 |
|---|---|---|---|
| 1 | cross_spec | `document:graph_completed` payload 의 `entityDelta`/`relationDelta` 가 spec `entityCount`/`relationCount` 와 불일치 | **본 PR scope 외**. 별도 plan 으로 분리 (spec 또는 코드 정합화 결정 필요). |
| 2 | cross_spec + rationale_continuity | `kb:graph_stats_updated` broadcast 가 dead path 로 spec 폐기됐는데 코드에 잔존 | **본 PR 가 직접 해소**: L41-49 제거 + WebsocketService 의존성 정리. |
| 3 | plan_coherence | `plan/in-progress/kb-graph-stats-dead-path.md` frontmatter `worktree` 미설정 | **본 PR 에서 갱신** (worktree: dead-path-removal-2f1c8a, 옵션 B 결정). |
| 4 | convention_compliance | `GraphController.listEntities/listRelations` 반환 타입 미선언 (Swagger 추론 저하) | **본 PR scope 외**. 별도 PR. |
| 5 | plan_coherence (HIGH→WARNING) | 옵션 A/B 미결로 분류됐으나 호출자 컨텍스트로 옵션 B 결정 완료 | 본 PR 자체가 옵션 B 구현. plan 갱신으로 자연 해소. |

## Info (6건)

`document:graph_error` 미발행, spec §2.2 enum `failed` 누락, dead path 제거 시 의존성 정리, import 정렬, entity type 동적 삽입, `as never` 캐스트 자연 해소 — 모두 본 PR scope 외 또는 본 PR 변경으로 자연 해소.

## 권장 조치사항 (본 PR)

1. `kb-stats.helper.ts` L41-49 broadcast 블록 제거 + WebsocketService import/constructor 의존성 정리.
2. `plan/in-progress/kb-graph-stats-dead-path.md` frontmatter `worktree` 갱신 + 옵션 B 결정 기록.
3. 신규 `kb-stats.helper.spec.ts` 작성 — refresh() 의 SQL UPDATE 동작 회귀 방지.

별도 plan/PR 항목 (본 PR 분리):
- `document:graph_completed` payload 필드명 정합화 (entityDelta vs entityCount)
- GraphController 반환 타입 Swagger 명시
- spec §2.2 enum `failed` 추가 (project-planner)
- 기타 INFO 잡항목
