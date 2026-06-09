# Consistency Check 통합 보고서 (--impl-done)

**BLOCK: NO** — Critical 발견 없음. 채택 차단 사유 없음.

## 전체 위험도
**LOW** — WARNING 1건(plan 후속 착수 시 spec 선갱신 의무 명문화)이 있으나 현재 구현 범위를 차단하지 않음. 나머지 4개 checker 는 NONE.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `kb-model-change-reembed-followup.md` 의 3가지 미결 정책 선택지가 열려 있는 상태에서 후속 구현 착수 시 spec 선갱신 없이 진행될 위험 | `plan/in-progress/kb-model-change-reembed-followup.md §검토할 선택지` | `spec/5-system/8-embedding-pipeline.md §7.3`, `spec/5-system/9-rag-search.md §5` | follow-up plan 에 "착수 전 project-planner spec 선갱신 의무" 조항 1줄 명시 권장. 현재 `kb-unsearchable-warning` 구현은 어떤 선택지와도 충돌 없음 — 현재 worktree 차단 아님. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 |
|---|---------|------|------|
| 1 | Cross-Spec | `skipReason` 어휘 — `1-ai-agent.md §9.1` 이 §4.2 링크 위임, 직접 모순 없음 | `9-rag-search §4.2`, `1-ai-agent §9.1` |
| 2 | Cross-Spec | `ragDiagnostics.skipReason` vs `mcpDiagnostics...skipReason` — 네임스페이스 분리, 중복 없음 | `9-rag-search §4.2`, `11-mcp-client §6.2` |
| 3 | Cross-Spec | `status:"not_searchable"` 봉투 — 판별 우선순위 명시, 비충돌 | `9-rag-search §2.2` |
| 4 | Cross-Spec | `8-embedding-pipeline §7.3` silent→신호 자기일관성 갱신 | `8-embedding-pipeline §7.3` |
| 5 | Cross-Spec | `5-knowledge-base §2.2.1` 경고 배지 — RBAC 권한 충돌 없음 | `5-knowledge-base §2.2.1`, `1-auth §3.2` |
| 6 | Cross-Spec | `reembed_status` — data-model §2.11 Enum 일치 | `9-rag-search §3.1`, `1-data-model §2.11` |
| 7 | Rationale Continuity | silent→명시 신호 전환: 신규 Rationale + cross-ref 동반, 무근거 번복 아님 | `9-rag-search §Rationale`, `8-embedding §Rationale` |
| 8-9 | Rationale Continuity | byte-identical 폐기 / conditional escalate 번복 — 출처 cross-ref 명시 | `9-rag-search §Rationale` |
| 10-11 | Convention Compliance | tool_result content `snake_case` / `skipReason` `lower_snake_case` — 에러 코드 레이어와 구분 명시, 위반 아님 | `9-rag-search §2.2/§4.2` |
| 12 | Plan Coherence | spec 변경(PR #508) origin/main 반영, worktree diff 는 codebase 전용 — 분리 패턴 정상 | `kb-unsearchable-warning.md` |
| 13 | Plan Coherence | stale worktree 후보 3건 — 물리 미존재, 파일 경합 없음 (별도 housekeeping) | rag-* plans |
| 14-15 | Naming Collision | `skipReason` 네임스페이스 분리 / `kb_unsearchable` 우선순위 명시 — 충돌 없음 | `9-rag-search §4.2` |

## Checker별 위험도

| Checker | 위험도 |
|---------|--------|
| Cross-Spec | NONE |
| Rationale Continuity | NONE |
| Convention Compliance | NONE |
| Plan Coherence | LOW (WARNING 1) |
| Naming Collision | NONE |

## 권장 조치사항

1. **(BLOCK 해소 불필요)** Critical 없음 — 즉시 PR 진행 가능.
2. **(WARNING — 적용)** follow-up plan 에 "착수 전 project-planner spec 선갱신 필수" 명문화. ✅ 본 턴 반영.
3. (housekeeping) stale worktree 참조 3건 정리 — 별도.
4-5. (선택) node-output §3.2 레이어 구분 / §4.2 네임스페이스 주석 — 선택적 보강.
