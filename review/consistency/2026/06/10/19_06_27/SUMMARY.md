# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 호출자 차단 불요.

target: `plan/in-progress/refactor/01-performance.md` (성능 refactor 백로그 유효 13건 구현 착수, `--impl-prep`)

## 전체 위험도
**LOW** — cross-layer 모순·식별자 충돌 없는 순수 성능 리팩터. 착수 전 베이스 rebase 1건과 spec 문구 동기화 1건만 챙기면 됨.

> 주의: `convention_compliance` checker 는 status=success 로 보고됐으나 산출 파일이 디스크에 없음 → **재시도 필요**. 컨벤션 위배 1건이라도 Critical 이면 결론이 바뀔 수 있으나, 나머지 4개 checker(특히 naming_collision 이 컨벤션 인접 영역 일부 커버)에서 Critical 부재가 일관 확인됨.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Plan Coherence | #12 RAG CTE 통합 대상 파일(`rag-search.service.ts`)이 PR #511(kb-unsearchable) MERGED 로 변경됨 → plan 의 `:630-656` 라인 stale 가능 + worktree 베이스가 머지 이전일 수 있음 | #12, `rag-search.service.ts:630-656` | `plan/in-progress/kb-unsearchable-warning.md` (PR #511 MERGED) | #12 착수 직전 `perf-backlog-01` 을 PR #511 포함 main 위로 rebase 후 CTE 라인 grep 재특정(라인 고정 금지). plan 텍스트 수정 불요, 베이스 갱신만. stale worktree `kb-unsearchable-warning-b47e20` 는 cleanup 권장 |
| W2 | Naming Collision | #7 신규 테스트 리셋 헬퍼명이 같은 파일 기존 자매 헬퍼 `resetExpressionCacheForTesting` 와 토큰 구조 엇갈림(충돌 아닌 명명 일관성) | #7, `workflow-assistant/prompts/system-prompt.ts` 신규 `resetNodeCatalogCacheForTesting` | 동일 파일 `system-prompt.ts:35` `resetExpressionCacheForTesting` | 한 파일 내 두 리셋 헬퍼 토큰 패턴 통일(변수 `nodeCatalogCache` + 헬퍼 `resetNodeCatalogCacheForTesting`). 구현 단계 결정, plan 수정 불요 |
| — | Convention Compliance | **검토 미완 — 재시도 필요** (status=success 보고됐으나 산출물 부재) | — | — | convention_compliance checker 재실행 후 통합 갱신 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | #2 S3 배치 삭제 — `data-flow/4-file-storage.md` "for 루프" code-sync 문구가 stale 화(의미론 best-effort/warn 은 불변) | `4-file-storage.md:100,103` | 코드 전환 동반 spec 문구를 "배치 삭제(`DeleteObjectsCommand`)"로 갱신, project-planner 위임. line 93 "GC batch" 문구는 유지(독립) |
| I2 | Cross-Spec / Rationale | #1 rehydration 배치 조회 — `4-execution-engine.md §7.4·§7.5` latency 운영리스크 지목 및 ExecutionNodeLog 순서 invariant 와 정합 | #1 | 권장안 A 채택 시 노드 순서 SoT 무변경. spec 갱신 불요 판정 타당 |
| I3 | Cross-Spec | #7 프롬프트 캐시 — spec §5 가 이미 채택한 prefix-cache 패턴의 미적용 잔여(정합) | #7 | 권장안 A 선택. B 선택 시 §5 5-block 규율 동반 점검 |
| I4 | Cross-Spec / Naming | #12 RAG CTE — KB-GR-SR-06 `traversedEntityCount` 표면 수치 불변이 전제(seed 동등성 검증 선행) | #12 | 권장안 A. 권장안 B(검증 생략) 금지. SQL alias `traversed_entity_count` 권장 |
| I5 | Cross-Spec | #4 dashboard 분모(status 무관 7일 전체) 의미론 보존, API shape 무변경 | #4 | `dashboard.service.spec.ts` 기대값 불변 검증 게이트 유지 |
| I6 | Plan Coherence | #1 ↔ exec-park-durable-resume 가 `execution-engine.service.ts` 인접(현재 diff 미포함, 직접 충돌 없음) | #1 | 둘이 같은 시기 손대면 머지 직렬화(먼저 머지되는 쪽 기준 rebase) |
| I7 | Plan Coherence | #1 ↔ 05-database.md M-4 동일 근원(suite 내부 의도된 교차참조) | 헤더 중복참조 | #1 구현 시 05-database.md M-4 체크박스 동반 종결 |
| I8 | Naming | `S3Service.deleteMany` / `nodeResultIndex` / `startedAtEpoch` / CTE `traversal_stats` 등 신규 표면 — 기존 사용처와 충돌 없음 | #2/#8/#3/#12 | `deleteMany` 반환형 `{errored}` 가 TypeORM DeleteResult 와 다름을 JSDoc 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 데이터모델·API·요구사항ID·상태전이·RBAC 어느 축도 모순 없음. 유일 동기화 = #2 file-storage "for 루프" 문구(의미 불변) |
| Rationale Continuity | NONE | #1·#2·#4·#7 인용 Rationale 원문 대조 정확, 기각 대안 재도입·invariant 우회 없음 |
| Convention Compliance | **재시도 필요** | status=success 였으나 산출 파일 부재 — 미통합 |
| Plan Coherence | LOW | active worktree 라인 직접충돌 0. #12 대상은 stale worktree(PR #511 MERGED) → 베이스 재확인 WARNING |
| Naming Collision | LOW | 신규 식별자 재정의 충돌 0. #7 리셋 헬퍼 명명 일관성 1건(WARNING) |

## 권장 조치사항
1. (BLOCK 없음 — 착수 가능) **#12 착수 직전** `perf-backlog-01` 을 PR #511 포함 최신 main 위로 rebase 후 graph-traversal CTE 라인을 grep 으로 재특정 (W1).
2. stale worktree `kb-unsearchable-warning-b47e20` cleanup (`./cleanup-worktree-all.sh --yes --force`).
3. #7 구현 시 신규 리셋 헬퍼명을 동일 파일 자매 헬퍼와 토큰 통일 (W2).
4. #2 코드 전환과 동반해 `data-flow/4-file-storage.md` "for 루프" 문구를 project-planner 트랙으로 갱신 (I1) — 의미론 불변이라 비차단.
5. #12 는 seed 동등성 검증 선행(권장안 A), #4 는 dashboard 분모 status-무관 의미론 보존을 구현 게이트로 준수.
6. **convention_compliance checker 재실행** 후 본 SUMMARY 재통합 — 컨벤션 Critical 발견 시 BLOCK 재판정.

---

> (재실행 추기, main session) convention_compliance 는 아래 별도 재실행 결과로 보완 — `convention_compliance.md` 참조.
