# Consistency Check — 백엔드 후속 ⑤⑦ (`--impl-done`)

BLOCK: NO

- 대상 브랜치: `claude/agent-ab5333a68e686d2b1` (커밋 `ce6a210f`, base `b8fa1b29` = PR #633 merged)
- 범위: `--impl-done` / spec 영역 `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration`
- 방식: **single-agent inline 분석** — API 529 과부하로 5-checker fan-out 대신 main 이 diff(`b8fa1b29..ce6a210f`)를 직접 평가. (정식 fan-out 보다 보수적으로 판정.)

## 변경 요약 (diff)
순수 perf/refactor, **spec/ 파일 미변경**:
- `migrations/V099__node_config_gin_index.sql` (+ `.conf`): `idx_node_config_gin`(GIN `jsonb_path_ops`, `@>` containment), `idx_node_config_integration_id`(expression B-tree, `->>'integrationId'` 등치). `CREATE INDEX CONCURRENTLY` + `executeInTransaction=false`.
- `integrations.service.ts`: 사용처 조회를 private `queryUsageNodes(id, workspaceId)` 헬퍼로 추출, `remove()` 가 헬퍼 직접 호출(이중 `findById` 제거). 공개 `getUsages` 시그니처·NotFound throw·응답 shape 보존.
- `integrations.service.spec.ts`: remove NotFound 등 보강.
- `plan/in-progress/integration-mcp-usage-followups.md`: ⑤⑦ 완료 표기(⑥ 미변경).

## 5관점 결과
| 관점 | 판정 | 근거 |
|---|---|---|
| Cross-Spec | PASS | spec 미변경. `getUsages` 공개 계약(시그니처/NotFound/응답 shape) 보존 — §7.1/§7.2 계약과 무충돌. 헬퍼 추출은 동작 보존. |
| Rationale Continuity | PASS | PR #633 Rationale 가 "`@>` 는 GIN 인덱스를 탈 수 있어 확장 가능"이라 예고 → 본 V099 가 그 결정을 구현. 번복 없음. |
| Convention Compliance | PASS | V099 네이밍(`V0NN__name.sql`), `CREATE INDEX CONCURRENTLY` + 동봉 `.conf executeInTransaction=false` 가 기존 인덱스 마이그레이션(예 V095) 패턴과 일치. SQL 주석 충분. |
| Plan Coherence | PASS | followups plan ⑤⑦ 완료 표기, ⑥(프론트, PR #634)은 미변경 — 분리 일관. |
| Naming Collision | PASS | `idx_node_config_gin`, `idx_node_config_integration_id`, `queryUsageNodes` — 기존 식별자와 충돌 없음(grep 확인). |

## 결론
Critical 0 / Warning 0. **BLOCK: NO.** 선행 ai-review(`review/code/2026/06/19/14_43_16/`, 4 reviewer, BLOCK:NO)와 합치.
