# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 진행 가능하나 WARNING 6건 해소 권장.

## 전체 위험도
**MEDIUM** — 구조적 모호성(봉투 패턴 혼합, skipReason 의미 범위) 2건이 소비 코드 판별 혼란으로 이어질 수 있음. plan frontmatter 누락은 build guard 실패 위험.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `ragDiagnostics.skipReason` 에 `kb_unsearchable` 추가 시 기존 "전체 skip" 의미와 "개별 KB unsearchable" 의미 범위 중첩 — `attempted=true`, `resultCount>0` 이면서 `skipReason=kb_unsearchable` 인 모순 조합 가능 | 변경 1 §4.2 | `spec/5-system/9-rag-search.md §4.2` | `skipReason` 대신 `ragDiagnostics.unsearchableKbs: string[]` 신설 검토. 유지 시 "모든 호출 KB 가 unsearchable 인 경우에만 세팅" 조건을 spec 에 명시하고 `no_results` 와의 경계 규정 |
| 2 | Cross-Spec | 신규 `status:"not_searchable"` + `reason:` 2-키 봉투가 기존 1-키 봉투(`error`, `grounding`) 패턴과 구조 불일치 — 소비 코드 판별 키 불명확 | 변경 1 §2.2 | `spec/5-system/9-rag-search.md §2.2` | 기존 `error` 키 확장(`error:"kb_unsearchable"`)으로 단일화하거나, §2.2 에 "봉투 판별 우선순위: `error` → `status` → `grounding`" 명시 + 봉투 패턴 카탈로그 표 추가 |
| 3 | Cross-Spec | `9-rag-search.md §3.1` 의 `embedding_dimension IS NULL` KB 에 대한 "사전 차단" vs "쿼리 내 자연 배제" 경로가 spec 상 미명시 | 변경 3 (8-embedding-pipeline §line 249 보강) | `spec/5-system/9-rag-search.md §3.1`, `spec/5-system/8-embedding-pipeline.md` | 변경 3 반영 시 `9-rag-search.md §2.1 또는 §3.1` 에 "사전 차단(`not_searchable` 봉투 반환) vs 쿼리 내 자연 배제" 경로 명시 |
| 4 | Convention Compliance | `plan/in-progress/kb-unsearchable-warning.md` frontmatter 에 `owner` 필드 누락 — plan-lifecycle §4 필수 필드, `plan-frontmatter.test.ts` build guard 실패 위험 | `plan/in-progress/kb-unsearchable-warning.md` frontmatter | `.claude/docs/plan-lifecycle.md §4` | `owner: project-planner` 추가. 비표준 `name:` 키 제거 또는 보조 필드로 유지 |
| 5 | Convention Compliance | 신규 `status:"not_searchable"` / `reason:` 값의 snake_case 표기가 `node-output.md §3.2` UPPER_SNAKE_CASE 규약 레이어와의 관계 미선언 — tool_result content 레이어 표기 정책 SoT 부재 | 변경 1 §2.2, 변경 1 §4.2 | `spec/conventions/node-output.md §3.2`, `spec/conventions/error-codes.md §1` | spec §2.2 에 "tool_result content 문자열 값은 snake_case (기존 `search_failed`·`none` 선례 일관)" 1줄 명시 |
| 6 | Plan Coherence | `5-knowledge-base.md` 가 `status: implemented` 인데 신규 미구현 UI surface(경고 카드) 추가 — `spec-status-lifecycle.test.ts` 위반 위험 | 변경 2 §2.2.1 | `spec/2-navigation/5-knowledge-base.md` frontmatter | spec draft 적용 시 `status: partial` + `pending_plans: [후속 구현 plan 경로]` 로 갱신 필수 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `reembedStatus` (camelCase, draft) vs `reembed_status` (snake_case, 기존 spec API §5) 표기 불일치 | 변경 2 §2.2.1, `spec/2-navigation/5-knowledge-base.md §5` | 반영 시 API 응답 필드를 camelCase 로 통일하거나 변경 2 에 "응답 DTO camelCase ← DB snake_case" 주석 명시 |
| 2 | Cross-Spec | KB 목록 카드 경고가 `spec/0-overview.md §3.4` 상태 표시 사용처 목록에 미포함 | 변경 2 §2.2.1 | Inline Alert 채택 시 `0-overview.md §3.4 현재 사용처` 목록에 KB 목록 카드 경고 추가 |
| 3 | Convention Compliance | `spec_impact` 에 `spec/5-system/8-embedding-pipeline.md` 미선언 (변경 3 이 명시적 대상) | `plan/in-progress/kb-unsearchable-warning.md` frontmatter `spec_impact` | plan 완료 전 `spec_impact` 에 `spec/5-system/8-embedding-pipeline.md` 추가 (Gate C 통과 요건) |
| 4 | Plan Coherence | Rationale 참조 `kb-model-change-reembed-followup.md` plan 파일 미존재 — `pending_plans:` 등재 시 빌드 가드 실패 | target 문서 §Rationale | (a) `plan/in-progress/kb-model-change-reembed-followup.md` 함께 생성, 또는 (b) "향후 별도 plan 신설" 표현으로 완화해 `pending_plans:` 미등재 |
| 5 | Plan Coherence | `9-rag-search.md` frontmatter `pending_plans:` 에 target plan 경로 미등재 | `spec/5-system/9-rag-search.md` frontmatter | spec 작성 시 `pending_plans:` 에 target plan 경로 추가 |
| 6 | Plan Coherence | `8-embedding-pipeline.md` 변경 3 은 기존 동작의 정확한 기술(cross-ref 추가) — status 변경 불필요 | 변경 3 | 현행 `status: implemented` 유지 가능 |
| 7 | Naming Collision | `status:"not_searchable"` 키가 `AgentToolResult` outer wrapper `status` 와 동명이나 완전히 다른 레이어(content JSON 내부 vs 반환 객체 메타) — 실질 충돌 없음 | 변경 1 §2.2 | spec §2.2 에 봉투 판별 우선순위 명시로 가독성 보완 권장 |
| 8 | Naming Collision | `ragDiagnostics.skipReason` 과 `mcpDiagnostics.serverSummaries[].skipReason` 동일 필드명, 경로 분리로 런타임 충돌 없음 | `spec/5-system/9-rag-search.md §4.2` | `mcp-client.md §6.2` vocabulary 와 별개임을 주석으로 구분 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `skipReason` 의미 범위 중첩 + 봉투 패턴 구조 불일치 (WARNING 2건), `idle+NULL` 처리 경로 구멍 (WARNING 1건) |
| Rationale Continuity | NONE | 기각된 대안 재도입 없음. silent→신호 전환 번복도 새 Rationale 함께 작성으로 절차 준수 |
| Convention Compliance | LOW | `owner` 필드 누락 build guard 위험 (WARNING 1건), tool_result content 레이어 표기 정책 미선언 (WARNING 1건) |
| Plan Coherence | LOW | `5-knowledge-base.md` status 불일치 (WARNING 1건), follow-up plan 파일 미존재 (INFO), `pending_plans` 갱신 필요 (INFO) |
| Naming Collision | NONE | 신규 식별자 3종 모두 기존 식별자와 실질 충돌 없음 |

## 권장 조치사항

1. **[WARNING #4 — build 차단 우선]** `plan/in-progress/kb-unsearchable-warning.md` frontmatter 에 `owner:` 필드 추가. `plan-frontmatter.test.ts` 가 강제하므로 PR 전 반드시 해소.
2. **[WARNING #6 — spec lifecycle 가드 우선]** spec draft 반영 전 `spec/2-navigation/5-knowledge-base.md` frontmatter 를 `status: partial` + `pending_plans:` 로 갱신. 미조치 시 `spec-status-lifecycle.test.ts` 실패.
3. **[WARNING #1 — 설계 결정]** `ragDiagnostics.skipReason` 에 `kb_unsearchable` 유지 여부 결정: 유지 시 "모든 KB 가 unsearchable 인 경우에만" 조건 명시; 미유지 시 `unsearchableKbs: string[]` 신설로 수정.
4. **[WARNING #2 — 봉투 구조 통일]** `9-rag-search.md §2.2` 에 봉투 판별 우선순위 규칙 또는 패턴 카탈로그 표 추가. `error` 키 확장 대안도 검토.
5. **[WARNING #3 — 사전 차단 경로 명시]** `9-rag-search.md §2.1 또는 §3.1` 에 `embedding_dimension IS NULL` KB 처리 경로(사전 차단 vs 자연 배제) 명시.
6. **[WARNING #5 — 규약 선언]** spec §2.2 에 "tool_result content 값은 snake_case" 한 줄 추가.
7. **[INFO #3]** plan 완료 전 `spec_impact` 에 `spec/5-system/8-embedding-pipeline.md` 추가.
8. **[INFO #4]** `kb-model-change-reembed-followup.md` 를 함께 생성하거나 `pending_plans:` 미등재 방식으로 참조 완화.
9. **[INFO #5]** `9-rag-search.md` frontmatter `pending_plans:` 에 target plan 경로 병기.
