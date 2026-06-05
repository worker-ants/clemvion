# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 5개 checker 모두 Critical 0건. WARNING 3건(plan 미완료 항목 2건 + 마이그레이션 번호 경합 1건) + Convention WARNING 1건(Rationale 섹션 부재). 나머지는 INFO 수준의 문서화 개선 권장.

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Plan Coherence | `rag-rerank-followup.md` 의 미해소 후속 항목 — `spec/5-system/1-auth.md §3.2` RerankConfig RBAC 행·`§4.1` audit 로그 `rerank_config.*` 미반영 | `spec/5-system/1-auth.md §3.2`, `§4.1` | `plan/in-progress/rag-rerank-followup.md` I1·I2 항목 | `rag-rerank-followup.md` I1·I2 처리 PR 조기 진행하거나 project-planner 가 spec 갱신. 현 `exec-park` 작업 자체는 차단 안 됨. |
| W2 | Plan Coherence | `spec-update-pr2a-active-running-invariants.md` 주요 항목(INFO #1 `>=` 보수적 판정 명시)이 spec 에 이미 반영됐으나 plan 이 `in-progress/` 에 잔존 | `spec/5-system/4-execution-engine.md §8`, `§Rationale` | `plan/in-progress/spec-update-pr2a-active-running-invariants.md` | 잔여 항목(INFO #2·#3) 완료 여부 확인 후 `plan/complete/` 로 이동. `4-execution-engine.md` `pending_plans` 제거 여부도 함께 판단. |
| W3 | Naming Collision | 마이그레이션 번호 V085 — 병렬 브랜치 `claude/impl-concurrency-cap-pr2b` 와 번호 경합 가능성 | `codebase/backend/migrations/V085__execution_user_variables.sql` | `claude/impl-concurrency-cap-pr2b` migrations 디렉터리 | PR 머지 전 해당 브랜치의 최신 migrations 디렉터리 재확인. 충돌 시 V086 으로 renumber (`plan §A3 renumber 절차`). |
| W4 | Convention Compliance | `spec/5-system/11-mcp-client.md` 에 `## Rationale` 섹션 부재 — 설계 근거(transport 선택, Internal Bridge 분리, 도구 평탄화 등)가 각 섹션에 산재 | `spec/5-system/11-mcp-client.md` (전체) | CLAUDE.md "결정의 배경·근거는 `## Rationale`" 규약 | 문서 말미에 `## Rationale` 추가. 각 섹션 내 설계 근거(§2.2 stdio 미지원, §2.3 Internal Bridge, §4.3 세션 풀링 미적용, §5 도구 평탄화)를 통합·요약. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | Phase B 이후 제거될 `pendingContinuations` fast-path 관련 서술(`§1.1` 전이표 / `§4.x` 구현 메모 / `§7.4` Worker 동작 / `§7.5` case 1 분기)이 현재 spec 에 살아있음 — plan §Spec 변경에 포함돼 충돌은 아니나 Phase B 착수 전 정리 필요 | `spec/5-system/4-execution-engine.md §1.1, §4.x, §7.4, §7.5` | Phase B 착수 직전 spec 갱신 시 §1.1 전이표·§4.x 메모 블록도 갱신 대상 목록에 명시적 추가 |
| I2 | Rationale Continuity | `Execution.user_variables` 컬럼 도입 결정 근거가 plan 문서에만 있고 `spec/5-system/4-execution-engine.md ## Rationale` 에 없음 | `spec/5-system/4-execution-engine.md ## Rationale` | Rationale 에 "user-defined variables durable 영속 — `Execution.user_variables` 컬럼 채택 (A3)" 항목 추가. 최소: (a) park 중 변수 손실 운영 영향, (b) `conversation_thread` 패턴 재사용 근거, (c) Redis 의존 기각 사유 |
| I3 | Rationale Continuity | `spec/5-system/4-execution-engine.md §7.5` 다이어그램에서 "Redis 우선" 복원과 durable 컬럼 복원 관계가 서술상 모호 — durable 컬럼이 Redis 와 무관하게 항상 복원됨을 명시하지 않음 | `spec/5-system/4-execution-engine.md §7.5 lines 885-890` | 해당 줄을 "단 thread/variables 는 Redis 상태와 무관하게 항상 위 전용 컬럼에서 복원됨" 으로 명시 |
| I4 | Convention Compliance | LoginHistory event enum(`login_success` 등) 및 AuditLog action(`password_change` 등)이 `lower_snake_case` 사용 — DB 내부 enum으로 `error.code` 와 별도 도메인이나, 규약 문서에 명시적 면제 기재 없음 | `spec/5-system/1-auth.md §4.3` | `error-codes.md §3` 또는 해당 섹션에 "DB internal enum/audit action 은 API code 적용 범위 제외" 단서 추가 |
| I5 | Convention Compliance | `spec/5-system/11-mcp-client.md §6.2` `skipReason` 값이 `lower_snake_case` — 문서 내 명시적 근거 있으나 `error-codes.md` 또는 `node-output.md` 에 예외 등재 없음 | `11-mcp-client.md §6.2` | `error-codes.md §3` 또는 `node-output.md §3.2` 에 "운영 진단용 enum은 `lower_snake_case` 예외" 한 줄 추가로 false-positive 방지 |
| I6 | Convention Compliance | `spec/5-system/1-auth.md` 에 `## Overview` 섹션 없음 — `_product-overview.md` 분리 구조로 수용 가능하나 3섹션 패턴에서 이탈 | `spec/5-system/1-auth.md` | 형식 일관성 목적으로 도입 가능. 의무 아님. |
| I7 | Convention Compliance | `spec/5-system/10-graph-rag.md` — `## Overview (제품 정의)` 와 `## 1. 개요` 두 서두 섹션 병존 | `spec/5-system/10-graph-rag.md lines 29, 206` | 허용 범위 내. 패턴 공식화(4레이어) 또는 `## 1. 개요`를 `## Overview` 에 통합 검토 |
| I8 | Naming Collision | `user_variables` DB 컬럼 / `userVariables` TypeORM 속성 / `stageDurableResumeSnapshot`·`rehydrateUserVariables`·`filterUserVariables` private 메서드 — 기존 식별자와 충돌 없음, 네이밍 적절 | `codebase/backend/` execution-engine 관련 파일 | 조치 불필요 |
| I9 | Plan Coherence | `exec-park-durable-resume` Phase B / D3·D4 미결 — 의도된 순서 의존성으로 현 spec 과 충돌 없음 | `plan/in-progress/exec-park-durable-resume.md §B, §D3, §D4` | Phase B 착수 전 D3 확정 후 `4-execution-engine.md §Rationale` 에 "워크플로 정의 편집 시 재개 정책" 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | Phase B 이후 제거될 fast-path 관련 서술이 spec 4곳에 잔존 (INFO 4건). plan §Spec 변경에 포함됐으므로 충돌 아님. |
| Rationale Continuity | LOW | `user_variables` 컬럼 도입 Rationale spec 에 미기재, §7.5 Redis/durable 컬럼 복원 관계 서술 모호 (INFO 2건) |
| Convention Compliance | LOW | `11-mcp-client.md` `## Rationale` 부재(WARNING 1건), 나머지 명명 이슈는 의도적 구분 또는 기존 등재로 처리됨 |
| Plan Coherence | LOW | `rag-rerank-followup.md` I1·I2 미반영(WARNING 1건), `spec-update-pr2a` plan 생명주기 미정리(WARNING 1건). exec-park 자체는 차단 없음. |
| Naming Collision | LOW | V085 마이그레이션 번호 병렬 브랜치 경합 가능성(WARNING 1건). 신규 식별자 자체 충돌 없음. |

## 권장 조치사항

1. **(V085 머지 전 필수)** PR 머지 전 `claude/impl-concurrency-cap-pr2b` 브랜치 migrations 재확인 — V085 선점 시 V086 으로 renumber (W3).
2. **(Phase B 착수 전 필수)** project-planner 가 `spec/5-system/4-execution-engine.md §1.1·§4.x·§7.4·§7.5` 의 fast-path/pendingContinuations 관련 서술 정리 및 D3·D4 Rationale 명문화 (I1, I9 / plan 에 이미 명시된 선행 의무).
3. **(권장)** `spec/5-system/4-execution-engine.md ## Rationale` 에 `user_variables` 컬럼 도입 근거 항목 추가 (I2). §7.5 Redis/durable 복원 관계 서술 명확화 (I3).
4. **(권장)** `spec-update-pr2a-active-running-invariants.md` 잔여 항목 확인 후 `plan/complete/` 이동 처리 (W2).
5. **(권장)** `rag-rerank-followup.md` I1·I2 (`spec/5-system/1-auth.md §3.2·§4.1`) 후속 처리 PR 진행 (W1).
6. **(권장)** `spec/5-system/11-mcp-client.md` 말미에 `## Rationale` 섹션 추가 (W4).
7. **(선택)** `error-codes.md §3` 또는 `node-output.md §3.2` 에 DB internal enum / 운영 진단용 enum 의 명명 예외 명시 (I4, I5).