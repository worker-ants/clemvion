# Code Review RESOLUTION

세션: `review/code/2026/05/16/00_40_16`
PR: `dead-path-removal-2f1c8a` — kb-stats.helper.ts dead path 제거 (option B)
처리자: developer
처리일: 2026-05-16

## 요약

ai-review SUMMARY — Critical 0 / Warning 0 / Info 14. PR scope 내 즉시 조치 4건 + 선택 1건(제네릭 타입 복구) 처리. 나머지는 추적.

## 조치 완료

| ID | 위치 | 조치 |
|---|---|---|
| Info #1 (documentation/maintainability) | `kb-stats.helper.ts` JSDoc | `plan/complete/kb-graph-stats-dead-path.md` 참조 제거 → `spec/5-system/6-websocket-protocol.md ## Rationale` 단독 참조. plan 이동 시점에 따른 dead reference 회피. |
| Info #2 (documentation) | `kb-stats.helper.ts` `refresh()` 본문 | `RETURNING` 절 유지 의도 + 현재 미사용 사실을 인라인 주석으로 명시. |
| Info #3 (testing) | `kb-stats.helper.spec.ts` 첫 테스트 이름 | "returns the new values" 어절 제거 — 반환값 단언 없으므로 실제 동작과 일치. |
| Info #4 (documentation/plan) | `plan/in-progress/kb-graph-stats-dead-path.md` | 완료 항목 4건 `[x]` 갱신. |
| Info #7 (maintainability) | `kb-stats.helper.ts` `dataSource.query(...)` | 제네릭 타입 파라미터 `<{ entity_count: number; relation_count: number }[]>` 복구 — `RETURNING` 절의 반환 스키마를 코드로 명세. |

재검증: lint 0 errors, kb-stats.helper.spec 3/3 통과, build OK.

## 추적 (PR scope 외 / 별도 PR)

| ID | 위치 | 이유 |
|---|---|---|
| Info #5 (testing) | spec 의 `mock.calls[0]` 접근 패턴 | 본 PR 의 새 spec 외에도 backend 전반에서 동일 패턴 광범위 사용. 일관성 정비는 별도 리팩토링. |
| Info #6 (maintainability) | spec 의 SQL 정규식 5개 | 정규식 의도는 변수명에서 추론 가능. 주석 추가는 가치 미미. |
| Info #8 (testing) | spec 에 WebsocketService 의도적 부재 주석 | 본 PR diff 자체가 그 변경의 컨텍스트라 PR 머지 후 git blame 으로 추적 충분. 추가 주석은 noise. |
| Info #9 (plan frontmatter) | `decision: option-B` 필드 | consistency-checker `plan_coherence` 가 본 PR 호출에서 BLOCK: NO 처리됨 — 실제 경고 미발생. 표준화는 skill/agent 정의 변경 영역. |
| Info #10 (database) | `entity.knowledge_base_id`, `relation.knowledge_base_id` 인덱스 | 별도 DB 마이그레이션 PR 검토 필요. 본 PR 와 무관. |
| Info #11 (performance) | `RETURNING` 절 자체 제거 | 향후 broadcast 재도입 가능성과 트레이드오프. 본 PR 에서는 인라인 주석으로 의도 명시만. |
| Info #12 (architecture) | broadcast 재도입 시 시그니처 확장 | 옵션 A 결정 시 별도 PR 에서 다룸. |
| Info #13 (security) | 상위 호출자의 UUID 검증 | 별도 점검. |
| Info #14 (performance) | `beforeEach` → `beforeAll` | 미시 최적화. 본 spec 의 테스트 수 3개라 영향 미미. |

## 후속 plan (이미 분리됨)

`plan/in-progress/kb-graph-stats-dead-path.md` 후속 섹션에 다음 4건이 별도 PR 대상으로 기록:
- `document:graph_completed` payload 필드명 정합화 (entityDelta vs entityCount) — consistency-check WARNING #1
- `GraphController.listEntities/listRelations` 반환 타입 Swagger 명시 — WARNING #4
- `spec/5-system/10-graph-rag.md §2.2` enum `failed` 추가 (project-planner) — INFO #2
- `document:graph_error` emit 코드 추가 또는 spec 갱신 — INFO #1

## 재검증

- `npx eslint <touched>` — exit 0
- `npx jest kb-stats.helper.spec.ts` — 3/3 통과
- `npm run build` — OK
- e2e: `[skip-e2e]` — backend dead path 제거, API/Auth/Workspace 영역 변경 없음
