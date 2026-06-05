# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 모든 발견 사항은 WARNING 이하.

## 전체 위험도
**LOW** — 5개 checker 중 4개 결과 통합 완료. cross_spec 결과 파일 누락(manifest status=success 이나 output_file 미존재 — 아래 §주석 참조). 나머지 4개 checker 전원 위험도 LOW/NONE.

## Critical 위배 (BLOCK 사유)

_해당 없음_

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | — | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec/5-system/11-mcp-client.md` `## Rationale` 섹션 전체 누락 | `spec/5-system/11-mcp-client.md` 전체 | `CLAUDE.md` "결정의 배경·근거 → `## Rationale`" + project-planner SKILL §Spec 문서 3섹션 권장 | 파일 끝에 `## Rationale` 추가. 본문 인라인 근거(transport 선택·Internal Bridge·skipReason·SSRF·stateless JWT)를 집약. |
| 2 | Convention Compliance | `spec/5-system/11-mcp-client.md` §9 preview-test 성공 응답이 `{ data: ... }` 래핑 없이 표기됨 | `spec/5-system/11-mcp-client.md` §9 성공 응답 JSON 예시 | `spec/5-system/2-api-convention.md §5` "모든 응답은 `{ data: ... }` 로 래핑" | (a) 예시를 `{ "data": { ... } }` 로 수정, 또는 (b) `4-integration.md` Rationale 의 TransformInterceptor 우회 근거를 본 spec 에도 명시 참조. |
| 3 | Plan Coherence | `spec/5-system/4-execution-engine.md` frontmatter `pending_plans` 에 `exec-park-durable-resume.md` 미등록 (main 기준) | `spec/5-system/4-execution-engine.md` frontmatter | `plan/in-progress/exec-park-durable-resume.md` | PR-A2b 포함 또는 별도 후속 커밋으로 main 에 `pending_plans` 행 추가. |
| 4 | Plan Coherence | Phase B 선행 조건 (D4 Rationale 명문화) 해소 확인 체크포인트 미존재 | `plan/in-progress/exec-park-durable-resume.md` §Phase B 선행 의무 | — | Phase B PR 착수 직전 체크박스를 plan 에 명시적으로 추가. 현재 비차단. |
| 5 | Plan Coherence | `spec/4-nodes/3-ai/1-ai-agent.md` 를 exec-park 브랜치와 PR #473(OPEN) 이 동시 수정 — textual 머지 충돌 위험 | `spec/4-nodes/3-ai/1-ai-agent.md` | `claude/agent-memory-summary-model-fa4efb` (PR #473 OPEN) | PR #473 머지 후 exec-park A2b rebase 권장. |
| 6 | Plan Coherence | node-cancellation §2 직렬화 순서·status 가드 겹침 미확정 | `plan/in-progress/exec-park-durable-resume.md` §Phase 0 세 번째 체크박스 | `plan/in-progress/node-cancellation-infrastructure.md` §2 | Phase B 착수 직전 pre-check 항목으로 plan 유지 필요. 현재 비차단. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | `information_extractor` checkpoint 지원 확장 — 과거 Rationale "일반화는 후속 작업"의 실현, 번복 근거 명시됨. §Rationale 내 기존 "ai_agent 한정" bullet 과 병존해 독자 혼동 가능 | `spec/5-system/4-execution-engine.md` §Rationale | 기존 bullet 에 "(A2b 에서 확장됨 — 아래 항목 참조)" 단서 추가 또는 두 bullet 통합 편집 권장. |
| 2 | Rationale Continuity | `spec/5-system/17-agent-memory.md` §6 삭제 + `spec/2-navigation/16-agent-memory.md` 파일 삭제 — "완료" 항목이 "미완료 로드맵"으로 역전됐으나 Rationale 에 판단 근거 미기록 | `spec/5-system/17-agent-memory.md §Rationale` | §Rationale 또는 PR 설명에 "AGM-12/13 API·UI 정의는 별도 plan/spec 으로 이관" 취지 한 줄 추가 권장. |
| 3 | Convention Compliance | `spec/5-system/10-graph-rag.md` 자기 파일을 "PRD Graph RAG" 링크로 자기 참조 — 독자 혼란 유발 | `spec/5-system/10-graph-rag.md` 라인 25 | `[PRD Graph RAG](./10-graph-rag.md)` 링크를 제거하거나 `_product-overview.md` 내 절로 대체. |
| 4 | Convention Compliance | `spec/5-system/1-auth.md` `## Overview` 섹션 없이 기술 명세로 직행 | `spec/5-system/1-auth.md` 전체 구조 | 파일 상단에 간략한 `## Overview` 추가. 강제 의무 아님. |
| 5 | Convention Compliance | `spec/conventions/cafe24-api-catalog/_overview.md` `## Rationale` 없음 | `spec/conventions/cafe24-api-catalog/_overview.md` | 파일 끝에 `## Rationale` 추가 — 카탈로그 2-레이어 구조·sync 테스트 설계 결정 정리. 즉각 의무 아님. |
| 6 | Plan Coherence | `spec/5-system/4-execution-engine.md` §4.x fast-path 서술이 현행 구현 설명으로 남아있음 | `spec/5-system/4-execution-engine.md` §4.x | Phase B 완료 후 spec 갱신 체크박스에 따라 갱신. 현재 정상. |
| 7 | Plan Coherence | `plan/in-progress/exec-intake-queue-impl.md` 후속(project-planner) 미완 2건 — exec-park Phase B 착수 시 data-flow 계열 갱신과 scope 조율 필요 | `plan/in-progress/exec-intake-queue-impl.md` | Phase B 착수 시 data-flow §2.2 BullMQ 표 갱신과 scope 조율. |
| 8 | Plan Coherence | D2 (user-defined variables 복원 범위) 미결 결정 — A3 착수 전 user/planner 합의 필요 | `plan/in-progress/exec-park-durable-resume.md` §미해결 결정 D2 | A3 착수 전 결정 확인. |
| 9 | Naming Collision | `DEFAULT_IE_MAX_COLLECTION_RETRIES = 3` 와 `information-extractor.handler.ts` `?? 3` 중복 선언 — 동기화 해제 위험 | execution-engine.service.ts vs information-extractor.handler.ts | 향후 IE handler 기본값 변경 시 두 위치 동시 갱신 필요. 주석 또는 상수 참조 명시 권장. |
| 10 | Naming Collision | `_resumeCheckpoint.partialResult` / `collectionRetryCount` 가 세 레이어(checkpoint·runtime state·output DTO)에서 동명 등장 — 코드 추적 혼동 가능 | `spec/5-system/4-execution-engine.md` §1.3 + IE handler | 의도적 구조이며 spec §1.3 에 명시됨. 충돌 없음. |
| 11 | Naming Collision | 삭제된 `AGM-12`/`AGM-13`, `NAV-AM-01~06` dangling reference 없음 확인 | spec/ + codebase/ 전체 | 이상 없음. 확인 사항만 기록. |
| 12 | Cross-Spec | 결과 파일 미존재 — manifest status=success 이나 output_file 디스크 부재. 재실행 권장. | — | cross_spec checker 재실행 후 SUMMARY 갱신. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | **UNKNOWN** | output_file 미존재 (manifest status=success 이나 파일 없음 — 재실행 권장) |
| Rationale Continuity | **LOW** | information_extractor 확장 근거 기록됨(양호). agent-memory §6 삭제 근거 Rationale 미기록(INFO). |
| Convention Compliance | **LOW** | `11-mcp-client.md` Rationale 섹션 누락(WARNING) + preview-test 성공 응답 래핑 불명확(WARNING). |
| Plan Coherence | **LOW** | pending_plans main 미등록(WARNING) + PR #473 textual 충돌 위험(WARNING). Phase B 전 미결 사항 다수이나 현 시점 비차단. |
| Naming Collision | **NONE** | 신규 식별자 충돌 없음. `DEFAULT_IE_MAX_COLLECTION_RETRIES` 중복 선언 동기화 주의(INFO). |

## 권장 조치사항

1. **[WARNING 1 해소]** `spec/5-system/11-mcp-client.md` 끝에 `## Rationale` 섹션을 추가하고 본문 인라인 핵심 결정 근거를 집약한다.
2. **[WARNING 2 해소]** `spec/5-system/11-mcp-client.md` §9 성공 응답 예시를 `{ "data": { ... } }` 로 수정하거나 TransformInterceptor 우회 근거를 명시 참조한다.
3. **[WARNING 3 해소]** PR-A2b 포함 또는 별도 커밋으로 `spec/5-system/4-execution-engine.md` frontmatter `pending_plans` 에 `plan/in-progress/exec-park-durable-resume.md` 행을 main 에 반영한다.
4. **[WARNING 5 해소]** PR #473 과 exec-park A2b 의 `1-ai-agent.md` 동시 수정 충돌 — PR #473 먼저 머지 후 exec-park A2b rebase 순서를 팀 내 조율한다.
5. **[Cross-Spec 재실행]** cross_spec checker output_file 이 디스크에 존재하지 않는다. 해당 checker 를 재실행해 SUMMARY 를 갱신할 것을 권장한다.
6. **[INFO 1 후속]** `spec/5-system/4-execution-engine.md` §Rationale 의 "ai_agent 한정" bullet 에 "A2b 에서 확장됨" 단서를 추가하거나 두 bullet 을 통합해 독자 혼동을 줄인다.
7. **[INFO 2 후속]** `spec/5-system/17-agent-memory.md §Rationale` 에 "AGM-12/13 이관 경위" 한 줄을 추가한다.
8. **[Phase B 착수 전]** D4 Rationale 명문화, node-cancellation §2 직렬화 순서 확정, D2 user-defined variables 범위 합의 — 세 항목을 Phase B PR 착수 pre-check 으로 plan 에 체크박스로 명시한다.

---

> **주석 — cross_spec 결과 파일 누락**: workflow manifest 는 `cross_spec` checker 를 `status=success` 로 보고했으나 `cross_spec.md` 파일이 디스크에 존재하지 않는다(`_retry_state.json` 에도 `agents_pending` 로 남아 있음). 해당 checker 결과가 포함되지 않았으므로 본 보고서의 BLOCK 결정은 나머지 4개 checker 기준이다. Cross-Spec 영역에서 Critical 이 발견될 경우 BLOCK 결정이 변경될 수 있다.