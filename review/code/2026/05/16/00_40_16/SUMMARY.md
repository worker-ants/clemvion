# Code Review SUMMARY

세션: `review/code/2026/05/16/00_40_16`
PR: `dead-path-removal-2f1c8a` — kb-stats.helper.ts dead path 제거 (option B)
13 reviewer 전원 완료 (pending 0 / fatal 0)

## 전체 위험도

**LOW** — 기능 손실 없는 dead path 제거. Critical/Warning 없음.

## Critical 위배

없음.

## Warning

없음.

> architecture 가 DataSource 직접 의존을 WARNING 으로 분류했으나 atomic UPDATE 실용성 + JSDoc 명시로 INFO 로 재분류.

## Info — PR scope 내 즉시 조치

1. **JSDoc plan 경로 dead reference 우려** — `kb-stats.helper.ts` 가 `plan/complete/kb-graph-stats-dead-path.md` 참조하지만 현재 파일은 `plan/in-progress/`. plan `git mv` 와 코드 참조 동기화 또는 spec Rationale 단독 참조로 교체.
2. **`RETURNING` 미사용 의도 불분명** — SQL 에 `RETURNING entity_count, relation_count` 가 있지만 반환값 미바인딩. 인라인 주석으로 의도 명확화.
3. **테스트 이름 불일치** — `"runs a single atomic UPDATE that recounts entity + relation and returns the new values"` 가 실제로는 반환값 단언 없음. 이름 수정.
4. **plan 체크박스 갱신 누락** — `kb-stats.helper.spec.ts 신규 작성`, `kb-stats.helper.ts broadcast 블록 제거` 두 항목이 이번 diff 로 완료됐는데 `[ ]` 상태 잔존.

## Info — PR scope 내 선택적

5. `mock.calls[0]` → `mock.lastCall` 또는 `toHaveBeenCalledWith` 패턴 (표현력)
6. SQL 정규식 5개 패턴별 의도 주석
7. **`dataSource.query<…>()` 제네릭 타입 유지 (반환 구조 문서적 가치)** — 본 PR 에서 자동 fix 가 제네릭을 제거했음. 복구 권장.
8. spec test `WebsocketService` 의존성 의도적 제외 주석
9. plan frontmatter `decision` 필드 표준화

## Info — PR scope 외 (별도 plan/PR)

10. `entity.knowledge_base_id`, `relation.knowledge_base_id` 인덱스 누락 가능성 — 별도 마이그레이션 PR 검토
11. `RETURNING` 절 자체 제거 또는 시그니처 확장 — 장기 검토
12. 향후 broadcast 재도입 시 시그니처 확장 — 장기 검토
13. 상위 호출자의 `knowledgeBaseId` UUID 검증 — 별도 점검
14. `beforeEach` → `beforeAll` 마이그레이션 — 미시 최적화

## Checker별 위험도

| 에이전트 | 등급 | 이슈 수 |
|---|---|---|
| security | LOW | 4 |
| performance | LOW | 3 |
| architecture | LOW | 7 |
| requirement | LOW | 4 |
| scope | NONE | 5 (모두 의도 일치) |
| side_effect | LOW | 4 |
| maintainability | LOW | 8 |
| testing | LOW | 3 |
| documentation | LOW | 7 |
| dependency | NONE | 4 (모두 정상) |
| database | LOW | 3 |
| concurrency | LOW | 2 |
| api_contract | NONE | 0 |
