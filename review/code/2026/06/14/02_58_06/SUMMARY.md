# 코드 리뷰 통합 SUMMARY — impl-workflow-list-gaps

- **대상**: `claude/impl-workflow-list-gaps-f4f815` (`origin/main..HEAD`)
- **변경 성격**: spec §2.4 정렬 UI/백엔드 미구현 갭 풀스택 구현 (backend `last_run` correlated subquery 정렬 + frontend `NativeSelect` 정렬 드롭다운 + i18n + 테스트 + spec/plan doc-sync)
- **위험도(RISK)**: MEDIUM
- **Critical**: 0 · **Warning**: 6 · **Info**: 다수

## Reviewer 위험도

| Reviewer | 위험도 | 핵심 |
| --- | --- | --- |
| requirement | LOW | W4 `hasActiveFilters` 가 `sortKey` 비기본값 미반영 |
| testing | MEDIUM | W5/W6 frontend 정렬 단위 테스트 부재 + hasActiveFilters 버그 미검증 |
| performance | MEDIUM | W1 `last_run` correlated subquery 인덱스 의존 / W2·W3 기존 코드 |
| database | LOW | `execution(workflow_id, started_at)` 인덱스 필요 (W1 과 동일) |
| security | LOW | 화이트리스트 + 고정 문자열 subquery — injection 안전 |
| 기타(scope·side_effect·maintainability·documentation·api_contract·user_guide_sync) | LOW | 차단 사항 없음 |

## Warning 처리 결과

| ID | 출처 | 내용 | 처리 |
| --- | --- | --- | --- |
| **W1** | performance/database | `last_run` correlated subquery 가 `execution(workflow_id, started_at)` 인덱스 미존재 시 O(N×M) | **해소(기존 인덱스)** — `migrations/V002__indexes.sql:18` 에 `idx_execution_workflow_started ON execution (workflow_id, started_at DESC)` 가 **이미 존재**. 리뷰어는 diff 만 보아 마이그레이션을 보지 못함. 신규 마이그레이션 불필요 |
| **W4** | requirement/testing | `hasActiveFilters` 가 `sortKey !== "created"` 미포함 → 비기본 정렬 0건 시 잘못된 CTA | **수정** — 조건 추가 + 주석 |
| **W5** | testing | frontend 정렬 단위 테스트 전무 | **추가** — `workflows-page.test.tsx` 에 정렬 describe(5케이스) |
| **W6** | testing | `hasActiveFilters` 버그 미검증 | **추가** — 비기본 정렬 0건 → Reset CTA + reset 복귀 테스트 |
| **W2** | performance | `getCount()`/`getMany()` 순차 2회 왕복 | **범위 외(기존 코드)** — 본 PR 미변경, 별도 최적화 항목 |
| **W3** | performance | `exportWorkflow` `findIndex` O(N×E) | **범위 외(기존 코드)** — 본 PR 미변경 |

## Info 처리

- I9/I12 `getSortColumn` 화이트리스트 다층 방어 의도 → **주석 추가**.
- I (requirement) `last_run` @Matches 통과·NULLS LAST 방향·spec 일치 → 확인만(조치 불필요).
- I14 plan frontmatter `worktree` → 이미 존재(`worktree: spec-sync-audit`).
- testing INFO (backend name/updated_at 케이스·e2e·i18n parity) → 비차단, 핵심 경로는 커버됨.

## 결론

Critical 0. 실질 조치 대상 Warning(W4·W5·W6)은 본 PR 에서 수정/테스트 추가로 해소. W1 은 기존 인덱스로 이미 충족. W2·W3 은 본 PR 무관 기존 코드로 범위 외. **BLOCK 없음 — 머지 가능.**
