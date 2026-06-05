# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 차단 사유 없음.

## 전체 위험도
**LOW** — Phase B 착수 전 spec 선행 갱신이 연관 문서(`data-flow/3-execution.md`, `spec/4-nodes/6-presentation/0-common.md`)에 미전파된 WARNING 4건, 구조·참조 이슈 WARNING 3건. Critical 0건.

---

## Critical 위배 (BLOCK 사유)

_없음._

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `4-execution-engine.md §7.4` 의 slow-path 일원화·fast-path 제거 선언이 `data-flow/3-execution.md` 시퀀스 다이어그램에 미전파 — `alt 로컬 pendingContinuations hit (fast path)` 분기가 현행 경로처럼 기술됨 | `spec/5-system/4-execution-engine.md §7.4` | `spec/data-flow/3-execution.md` L111 | Phase B 착수 또는 착수 시점에 `data-flow/3-execution.md` 다이어그램을 slow-path 단일 경로로 갱신; `alt` 분기 제거 |
| W2 | Cross-Spec / NamingCollision (중복 통합) | `pendingContinuations` 기반 invariant 서술이 Phase B 제거 모델과 충돌 — 동일 식별자를 Naming Collision 에서도 확인 | `spec/5-system/4-execution-engine.md §7.4 / §Rationale` | `spec/4-nodes/6-presentation/0-common.md` L413 | Phase B 구현 시 invariant 서술을 rehydration 모델 기준("`button_click` → `else` 분기 graceful degradation")으로 재작성 |
| W3 | NamingCollision | `exec:seq:<id>` Redis 키가 `§9.2` 캐노니컬 테이블에 미등재 — `exec:cont:seq:`, `exec:run:seq:` 와 유사 네임스페이스 공유하나 cross-reference 없음 | `spec/5-system/4-execution-engine.md §9.2` | `spec/5-system/14-external-interaction-api.md` L885 (`exec:seq:<id>`) | `§9.2` 테이블에 `exec:seq:<executionId>` 행 추가, `14-external-interaction-api.md` cross-link 포함 |
| W4 | ConventionCompliance | `10-graph-rag.md` 에 `### Overview (제품 정의)` (h3) 와 `## 1. 개요` (h2) 중복 구조 — 어느 쪽이 규약 Overview 섹션인지 모호 | `spec/5-system/10-graph-rag.md` | `CLAUDE.md §정보 저장 위치` (Overview / 본문 / Rationale 3섹션) | `### Overview` 를 `## Overview` (h2) 로 승격 후 `## 1. 개요` 내용과 통합 |
| W5 | ConventionCompliance | `11-mcp-client.md §1` 본문에서 존재하지 않는 `§11.1` ("만료 스캐너") 참조 | `spec/5-system/11-mcp-client.md §1 개요` | 해당 파일 내 `## 11` 섹션 없음 | `"§11.1"` 텍스트 참조 제거 또는 올바른 문서 링크로 교체 |
| W6 | PlanCoherence | `exec-park-durable-resume`(Phase B 미착수) 과 `exec-intake-queue-impl` PR3("rehydration 일반화") 이 `spec/5-system/4-execution-engine.md §7.5` 동시 수정 가능성 — exec-park 측 흡수 선언이 exec-intake-queue-impl plan 에 이관 표기 완료 여부 불명 | `spec/5-system/4-execution-engine.md §7.5` | `plan/in-progress/exec-intake-queue-impl.md` PR3 (active worktree) | Phase B 착수 전 `exec-intake-queue-impl` PR3 착수 여부 명시 조율; 미착수 시 해당 plan 에 "exec-park-durable-resume 으로 이관됨" 표기 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `data-flow/3-execution.md` frontmatter 에 `pending_plans: exec-park-durable-resume.md` 미등록 | `spec/data-flow/3-execution.md` | YAML frontmatter 추가 또는 `pending_plans` 블록에 plan 등록 |
| I2 | NamingCollision | Phase B 제거 대상 `applyContinuation` fast-path 내부 로직(`Eng->>Eng: waitForX 직접 invoke`) 이 `data-flow/3-execution.md` L115 에 현재 시제로 기술 (W1 연장선) | `spec/data-flow/3-execution.md` L112-116 | Phase B PR 에서 slow-path 단일 분기로 단순화; 과도기 중 `> Note: Phase B 이전 fast-path 경로는 §Rationale` 주석 추가 |
| I3 | PlanCoherence | `node-cancellation-infrastructure §2` 와의 직렬화 순서·status 가드 겹침이 Phase 0 체크박스로 미확정 | `plan/in-progress/exec-park-durable-resume.md §Phase 0` | Phase B 착수 전 직렬화 순서 확정 또는 "node-cancellation §2 는 본 plan Phase B 완료 후 후행" 명문화 |
| I4 | PlanCoherence | D2 미결 결정(user-defined variables 영속 범위)이 `spec/5-system/4-execution-engine.md §7.5` rehydration 서술 범위에 영향 | `plan/in-progress/exec-park-durable-resume.md §미해결 결정 D2` | Phase B spec 갱신 전 D2 결정 확정; 또는 `§7.5` 를 conversationThread 복원만으로 먼저 작성, variables 는 D2 확정 후 보강 |
| I5 | ConventionCompliance | `1-auth.md` `## Overview` 섹션 없음 (`## 1. 인증` 으로 바로 시작); `10-graph-rag.md` 와 일관성 차이 | `spec/5-system/1-auth.md` | `## 1. 인증` 앞 짧은 `## Overview` 섹션 추가 (강제 아님) |
| I6 | ConventionCompliance | `1-auth.md §4.1` AuditLog action 코드(`password_change`, `workspace.create` 등) 에 대한 명명 규약이 `spec/conventions/` 에 미명시 | `spec/5-system/1-auth.md §4.1` | action 코드가 `error.code` 와 다른 도메인임을 §4.1 에 명시하거나, `spec/conventions/` 에 audit-log 액션 코드 규약 추가 |
| I7 | ConventionCompliance | `10-graph-rag.md §3.3` LLM 응답 `displayName` (camelCase) 과 DB 컬럼 `display_name` (snake_case) 매핑 명시 부재 | `spec/5-system/10-graph-rag.md §3.3` | `§3.3` 에 "LLM 응답 camelCase → snake_case DB 컬럼 매핑" 한 줄 노트 추가 |
| I8 | ConventionCompliance | `10-graph-rag.md §6` `document:graph_error` 이벤트가 dead-declared (emit 안 됨) 인데 삭제 여부 결정 부재 | `spec/5-system/10-graph-rag.md §6` | 타입 union 에서 제거하거나 `spec: backlog` 형태로 향후 사용 의도 명시 |
| I9 | ConventionCompliance | `11-mcp-client.md §6.2` 미구현 항목 광범위 — `pending_plans` 의 `spec-sync-mcp-client-gaps.md` 가 전체 커버하는지 확인 필요 | `spec/5-system/11-mcp-client.md §6.2` | 구현 착수 전 해당 plan 파일의 미구현 항목 전체 커버 여부 검토 |
| I10 | PlanCoherence | `auth-config-webhook-followups §1/§3`, `spec-sync-auth-gaps` (LDAP/SAML), `spec-sync-mcp-client-gaps` 미해결 항목이 scope 내 파일에 잔존 — 본 plan 직접 충돌 없음 | `spec/5-system/1-auth.md`, `11-mcp-client.md` | 본 plan 착수 무관. 각 plan 의 담당 project-planner 가 별도 처리 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | Phase B 목표 spec(`4-execution-engine.md`)과 연관 문서(`data-flow/3-execution.md`, `0-common.md`) 간 fast-path/slow-path 모델 불일치 2건 (WARNING). 나머지 spec/5-system/ 내부 일관성 확보. |
| Rationale Continuity | NONE | 기각 대안 재도입 0건, 합의 원칙 위반 0건, 무근거 번복 0건, invariant 충돌 0건. 전면 정합. |
| Convention Compliance | LOW | `10-graph-rag.md` Overview 중복 구조, `11-mcp-client.md` 존재하지 않는 §11.1 참조 (WARNING 2건). frontmatter/Rationale 규약 3개 문서 모두 준수. |
| Plan Coherence | LOW | `exec-intake-queue-impl` PR3 이중 수정 위험 (WARNING 1건). `node-cancellation §2` 직렬화 순서·D2 미결 결정 (INFO 2건). CRITICAL 없음. |
| Naming Collision | LOW | 신규 식별자 실제 충돌 0건. `pendingContinuations` 설계 설명 불일치(W1/W2와 통합) 및 `exec:seq:` §9.2 미등재 (WARNING). |

---

## 권장 조치사항

1. **[Phase B 착수 전 — 즉시]** `exec-intake-queue-impl` plan 담당자와 PR3 이관 여부 명시 조율 (W6). 이중 수정 방지.
2. **[Phase B 착수 전]** `plan/in-progress/exec-park-durable-resume.md §Phase 0` 미결 체크박스 — `node-cancellation §2` 직렬화 순서 확정 또는 후행 명문화 (I3).
3. **[Phase B 착수 전]** D2 결정(user-defined variables 영속 범위) 확정 (I4).
4. **[Phase B spec 갱신 시 동기 필수]** `spec/data-flow/3-execution.md` 시퀀스 다이어그램 slow-path 단일 경로로 갱신; `alt pendingContinuations hit` 분기 제거; `pending_plans` frontmatter 등록 (W1, I1, I2).
5. **[Phase B spec 갱신 시 동기 필수]** `spec/4-nodes/6-presentation/0-common.md` L413 `pendingContinuations` invariant 서술을 rehydration 모델 기준으로 재작성 (W2).
6. **[낮은 우선순위 — 별도 처리]** `spec/5-system/4-execution-engine.md §9.2` 테이블에 `exec:seq:<executionId>` 행 추가 및 §14 cross-link (W3).
7. **[낮은 우선순위]** `10-graph-rag.md` `### Overview` h2 승격·통합 (W4), `11-mcp-client.md §11.1` 참조 제거 (W5). 본 plan 범위 외.
