# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**MEDIUM** — `spec/5-system/1-auth.md` §1.5.4 의 에러 코드 UPPER_SNAKE_CASE 위반(Critical 1건), 복수 WARNING(cross-spec 미동기 3건, Rationale 미기록 1건, 구조 누락 2건)

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| C1 | Convention Compliance | `1-auth.md` §1.5.4 초대 에러 코드 6개가 `lower_snake_case` — UPPER_SNAKE_CASE 규약 직접 위반, 내부 불일치(WebAuthn 에러 코드는 UPPER_SNAKE_CASE) | `spec/5-system/1-auth.md` §1.5.4 (line 225–230) | `spec/conventions/error-codes.md §1`, `spec/5-system/3-error-handling.md §2.1` | `invitation_not_found` → `INVITATION_NOT_FOUND`, `invitation_expired` → `INVITATION_EXPIRED`, `invitation_already_used` → `INVITATION_ALREADY_USED`, `invitation_email_mismatch` → `INVITATION_EMAIL_MISMATCH`, `forbidden` → `FORBIDDEN`(또는 `INVITATION_FORBIDDEN`), `rate_limited` → `RATE_LIMITED` 로 정정 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `RESUME_INCOMPATIBLE_STATE` 트리거 조건 — 미래 버전 케이스 누락 | `spec/5-system/4-execution-engine.md` §7.5 | `spec/5-system/6-websocket-protocol.md` line 298 | `6-websocket-protocol.md` §4.2 에러 코드 표에 "미래 버전(`schemaVersion` > `CHECKPOINT_SCHEMA_VERSION`) — 롤링 배포 중 구 인스턴스가 신 포맷 pickup" 케이스 추가 |
| W2 | Cross-Spec | `_resumeCheckpoint` 소비 설명 — 버전 검사 단계 및 미래 버전 graceful reset 케이스 미반영 | `spec/5-system/4-execution-engine.md` §1.3 | `spec/4-nodes/3-ai/1-ai-agent.md` line 703 | 소비 열을 "부재/손상/미래 버전 시 graceful reset (`RESUME_INCOMPATIBLE_STATE`)" + 버전 검사 단계 반영으로 동기화 |
| W3 | Cross-Spec | `_resumeCheckpoint` 소비 설명 — 미래 버전 케이스 및 기본값 보강 동작 미반영 | `spec/5-system/4-execution-engine.md` §1.3 | `spec/conventions/node-output.md` line 208 Principle 4.2.1 | "부재/손상/미래 버전 시 graceful reset (`RESUME_INCOMPATIBLE_STATE`)" + 기본값 보강 동작 추가 |
| W4 | Rationale Continuity | Phase B2 — fast-path `pendingContinuations` "완전 제거"가 아닌 "의존 금지 강등" 경로 존치 가능성 — 기존 Rationale("항상 BullMQ enqueue", sticky fast-path 기각 확정)과 긴장 관계, 새 근거 없음 | `plan/in-progress/exec-park-durable-resume.md` Phase B2 | `spec/5-system/4-execution-engine.md` §Rationale "Sticky fast-path 제거" + §7.4 | B Phase 착수 전 "강등 유지 vs 완전 제거" 재검토 근거를 spec §Rationale 에 명시하거나, "완전 제거"로 확정해 기존 Rationale 과 일치시킴 |
| W5 | Rationale Continuity | D4 turn-단위 park 결정이 spec §Rationale 에 미기록 — plan 이 B Phase 구현 전 의무로 스스로 인식 중 | `plan/in-progress/exec-park-durable-resume.md` §Spec 변경 | `spec/5-system/4-execution-engine.md` §4.x / §Rationale | B1 착수 전 `4-execution-engine.md §Rationale` 에 "대화 전체=단일 waiting 기각, turn-단위 park 채택 근거(메모리 bounded + slow-path 일원화), 기각 대안" 기록 |
| W6 | Convention Compliance | `11-mcp-client.md` — Overview / Rationale 섹션 누락, 3섹션 구조 미준수 | `spec/5-system/11-mcp-client.md` 전체 | `CLAUDE.md` 문서 구조 규약 (3섹션), 동일 영역 `10-graph-rag.md` 패턴 | 문서 상단에 `## Overview`(왜 MCP 클라이언트가 필요한가) + 문서 끝에 `## Rationale`(transport 선택·도구 평탄화 등 설계 근거 통합) 추가 |
| W7 | Convention Compliance | `10-graph-rag.md` — Overview 섹션이 제품 정의 역할이 아닌 구현 현황 요약으로 사용 — 다른 파일의 Overview 의미 패턴과 불일치 | `spec/5-system/10-graph-rag.md` (Overview 섹션 line 586) | `CLAUDE.md` 문서 구조 규약 (Overview = 제품 정의) | Overview 를 "왜 Graph RAG 가 필요한가, 사용자 가치" 중심으로 재작성; 구현 현황 배너는 별도 섹션으로 분리 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `schemaVersion` 필드가 `_resumeCheckpoint` 에 추가됐으나 `node-output.md §4.2.1` 의 포함 필드 목록에 미언급; `_retryState` 와의 포함 필드 차이도 미명시 | `spec/5-system/4-execution-engine.md` §1.3, `spec/conventions/node-output.md §4.2.1` | `node-output.md §4.2.1` 의 `_resumeCheckpoint` 설명에 `schemaVersion` 포함 여부 명시 + `_retryState` 와의 차이 정리 (정보 동기화 권장) |
| I2 | Rationale Continuity | B3 에서 `firstSegmentBarriers`/`pendingContinuations` 제거 후 `spec §4.x` 구현 메모 동기 갱신이 plan 의 Spec 변경 목록에 명시적으로 열거되지 않아 누락 위험 | `plan/in-progress/exec-park-durable-resume.md` §Spec 변경, `spec/5-system/4-execution-engine.md §4.x` | plan 의 "Spec 변경" 항목에 "§4.x 구현 메모(`firstSegmentBarriers` 기술) 제거/갱신" 을 B3 대응 항목으로 명시 추가 |
| I3 | Rationale Continuity | A2b — `information_extractor` 멀티턴 checkpoint 확장 시 `§Rationale "ai_agent 한정"` 항목 갱신 의무; plan 이 인식 중이나 A2b PR 에서 누락 위험 | `plan/in-progress/exec-park-durable-resume.md` Phase A2b, `spec/5-system/4-execution-engine.md §Rationale` | A2b PR 체크리스트에 §Rationale "ai_agent 한정" → "ai_agent + information_extractor 지원" 갱신 항목 명시 |
| I4 | Plan Coherence | exec-park-durable-resume Phase 0 — exec-intake-queue PR3 항목 이관 표기(cross-link) 미완료 체크박스; 후속 개발자의 중복 착수 위험 | `plan/in-progress/exec-park-durable-resume.md §Phase 0`, `plan/in-progress/exec-intake-queue-impl.md` | exec-intake-queue-impl.md PR3 항목에 "→ exec-park-durable-resume Phase A2/B2 로 이관" 주석 추가 (project-planner) |
| I5 | Plan Coherence | node-cancellation §2 와의 직렬화 순서·status 가드 확정이 Phase 0 체크박스에 미완 — B Phase 착수 전 선행 확정 필요 | `plan/in-progress/exec-park-durable-resume.md §Phase 0`, `plan/in-progress/node-cancellation-infrastructure.md §2` | B Phase 착수 직전 직렬화 순서(cancellation §2 선행 vs 후행) 결정 후 Phase 0 체크박스 닫기 |
| I6 | Convention Compliance | `1-auth.md §1.5.4` 흐름 다이어그램 — `/api/auth/...` vs `/auth/...` prefix 혼용(운영 혼동 소지 낮으나 가독성 문제) | `spec/5-system/1-auth.md §1.5.4`, §1.1 표 | spec 전반 API 경로 표기를 `/api/` prefix 포함으로 통일 |
| I7 | Naming Collision | `CHECKPOINT_SCHEMA_VERSION`(상수), `schemaVersion`(JSONB 필드) — 코드베이스 전체 및 spec 전체에 동일 이름 선행 정의 없음, 충돌 없음 | `execution-engine.service.ts:267`, `buildResumeCheckpoint` | 조치 불필요 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `RESUME_INCOMPATIBLE_STATE` 트리거 조건 및 `_resumeCheckpoint` 소비 설명이 3개 downstream spec 에 미동기 (WARNING 3건) |
| Rationale Continuity | LOW | B2 fast-path 강등 경로 vs 기존 "항상 BullMQ" 확정 긴장, D4 Rationale 미기록 — B Phase 착수 전 처리 필요 (WARNING 2건) |
| Convention Compliance | MEDIUM | `1-auth.md §1.5.4` 에러 코드 6개 UPPER_SNAKE_CASE 위반 (CRITICAL 1건) + 구조 미준수 WARNING 2건 |
| Plan Coherence | NONE | A1/A2a 완료 시점 정합성 양호, B Phase 착수 전 의무 3건은 INFO 수준 |
| Naming Collision | NONE | 신규 식별자 2건 충돌 없음 |

---

## 권장 조치사항

1. **(BLOCK 해소 — 즉시)** `spec/5-system/1-auth.md` §1.5.4 에러 코드 6개를 UPPER_SNAKE_CASE 로 정정: `INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_ALREADY_USED`, `INVITATION_EMAIL_MISMATCH`, `FORBIDDEN`(또는 `INVITATION_FORBIDDEN`), `RATE_LIMITED`. 프론트엔드 `code` 기반 분기 계약 보호.
2. **(B Phase 착수 전 의무)** `spec/5-system/4-execution-engine.md §Rationale` 에 D4 turn-단위 park 결정 근거(채택 이유·기각 대안) 기록 — plan 이 B1 착수 전 gate 로 명시한 항목.
3. **(B2 착수 전)** fast-path `pendingContinuations` 완전 제거 vs 강등 유지 결정 명확화: 강등 유지 시 새 근거를 spec §Rationale 에 추가, 완전 제거 시 plan 문구를 단일화해 기존 Rationale 과 정렬.
4. **(권장 — 단기)** `6-websocket-protocol.md` §4.2, `1-ai-agent.md` line 703, `node-output.md §4.2.1` 의 `_resumeCheckpoint`/`RESUME_INCOMPATIBLE_STATE` 설명을 `4-execution-engine.md §7.5` 개정 내용(미래 버전 케이스, 버전 검사 단계)과 동기화 (W1–W3).
5. **(권장 — 중기)** `11-mcp-client.md` 에 Overview / Rationale 섹션 추가, `10-graph-rag.md` Overview 섹션 역할 재정립 (W6–W7).
6. **(INFO 처리)** plan Spec 변경 목록에 B3 대응 `§4.x 구현 메모` 갱신 항목 명시, exec-intake-queue PR3 이관 cross-link 완성, node-cancellation §2 직렬화 순서 확정 (B Phase 착수 전).