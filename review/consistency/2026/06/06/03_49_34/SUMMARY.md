# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 해당 없음.

---

## 전체 위험도
**MEDIUM** — Plan Coherence 에서 3건의 WARNING 이 식별됨. 실행 엔진 spec 미구현 설계 확정 + PR-B2 착수조건 미해소 + spec 덮어쓰기 위험. 즉각적 기능 모순은 없으나 PR-B2 착수 전 plan 정리 필요.

---

## Critical 위배 (BLOCK 사유)

_없음._

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `RESUME_INCOMPATIBLE_STATE` WS 프로토콜 오류 코드 표에 `resume_call_stack` 미래 버전 케이스 미기술 — 운영자·FE가 롤링 배포 실패 원인을 오인할 수 있음 | `spec/5-system/4-execution-engine.md §7.5` | `spec/5-system/6-websocket-protocol.md` 오류 코드 표 (라인 298) | WS spec `RESUME_INCOMPATIBLE_STATE` 행에 "또는 `resume_call_stack.version` > `CALL_STACK_SCHEMA_VERSION` 인 경우(exec-park D6)" 주석 추가 |
| W2 | Cross-Spec | `applyCancellation` async 전환이 WS 프로토콜 취소 흐름에 미반영 — form/button park execution 취소 시 DB 직접 마킹 경로가 WS spec에 없음 | `spec/5-system/4-execution-engine.md §7.4` | `spec/5-system/6-websocket-protocol.md §4.2` | WS spec 취소 흐름 절에 "park-released execution 취소는 DB 직접 CANCELLED 마킹 → EXECUTION_CANCELLED 이벤트 발행" 주석 추가 |
| W3 | Convention Compliance | `1-auth.md §1.5.4` 에서 `forbidden`/`rate_limited` 의 "초대 흐름 전용 historical-artifact" 성격이 미기술 — conventions 레지스트리와 완전 동기화 안 됨 | `spec/5-system/1-auth.md §1.5.4` | `spec/conventions/error-codes.md §3` historical-artifact 레지스트리 | `1-auth.md §1.5.4` 주석에 "초대 흐름 전용 historical artifact" 한 문장 추가 |
| W4 | Convention Compliance | `10-graph-rag.md` 에 `## Overview (제품 정의)` 와 `## 1. 개요` 이중 도입부 구조 — 3섹션 경계 불명확 | `spec/5-system/10-graph-rag.md` 전체 | CLAUDE.md §정보 저장 위치 (3섹션 구성) | `## 1. 개요` 를 제거하거나 본문 첫 섹션으로 흡수. 현 diff 에 신규 변경분 없으면 강제 수정 불필요 |
| W5 | Plan Coherence | exec-park D6 미구현 상태(`resume_call_stack` park stage·재귀 재진입)가 spec 에 "설계 확정"으로 기술된 채 Phase 0 선행항목 3건이 미체크 — PR-B2 착수조건 미해소 | `spec/5-system/4-execution-engine.md §6.2, §7.5, §Rationale` | `plan/in-progress/exec-park-durable-resume.md` Phase 0 / Phase B | Phase 0 각 항목 현행 상태 업데이트. 해소됐으면 체크, 미해소면 PR-B2 착수 차단 명시 |
| W6 | Plan Coherence | `impl-concurrency-cap-pr2b` 브랜치가 PR2b 착수 시 `spec/5-system/4-execution-engine.md` Phase B 서술 덮어쓰기 위험 — exec-intake-queue-impl plan 에 rebase 선행 착수조건 미명기 | `spec/5-system/4-execution-engine.md` Phase B 서술 전반 | `plan/in-progress/exec-intake-queue-impl.md` PR2b 항목 | `exec-intake-queue-impl.md` PR2b 항목에 "착수 전 origin/main(PR-B1 포함) rebase 선행" 조건 명기 |
| W7 | Plan Coherence | Phase 0 미해소 항목 3건이 PR-B2 착수 선행조건임에도 계속 미체크 — PR-B2 가 §7.5 재귀 재진입·멀티턴 turn-park·pendingContinuations 제거를 담으므로 실질 차단 | `plan/in-progress/exec-park-durable-resume.md` Phase 0 체크박스 3개 | `spec/5-system/4-execution-engine.md §7.5` (PR-B2 전제) | W5 와 동일 조치. Phase 0 체크박스 완결 또는 미완 사유 명기 |

> W5 / W7 은 동일 근원(Phase 0 미해소)의 두 각도 — 중복 제거 후 한 건으로 취급 가능. 테이블에는 출처 Checker 를 분리해 기재.

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `spec/0-overview.md §2.4` 실행 엔진 설명에 durable park 전환(Phase B) 미반영 | `spec/0-overview.md §2.4` | "park 즉시 해제 + rehydration 단일 경로" 설명 + 3 durable 컬럼 링크 추가 권장 |
| I2 | Cross-Spec | `spec/1-data-model.md §2.13` `resume_call_stack` 항목에 PR-B2 미구현 상태 주석 없음 | `spec/1-data-model.md §2.13` (라인 467) | "(V087; park stage·재귀 재진입은 PR-B2 후속 — 현재 컬럼 NULL 유지)" 한 줄 추가 |
| I3 | Cross-Spec | 실행 엔진 spec D6 레이블이 AI 노드 spec D6 와 동명 — 편도 경고만 있음 | `spec/5-system/4-execution-engine.md §Rationale` | 단방향 경고로 충분. AI 노드 spec 역방향 메모는 선택사항 |
| I4 | Convention Compliance | `11-mcp-client.md §6.2` `skipReason` lower_snake_case — 진단 enum 임을 spec 이 이미 명시 | `spec/5-system/11-mcp-client.md §6.2` | 조치 불필요. spec 자기 선언 충분 |
| I5 | Convention Compliance | `11-mcp-client.md` Rationale 섹션 부재 — 기술 결정 근거가 인라인 분산 | `spec/5-system/11-mcp-client.md` 전체 | 향후 갱신 시 `## Rationale` 섹션으로 통합 권장 |
| I6 | Convention Compliance | `cafe24-api-catalog/application.md` 미문서화 endpoint `paginated` 컬럼 wire 미검증 | `spec/conventions/cafe24-api-catalog/application.md` | 이미 `cafe24-backlog-residual.md §G-2` 추적 중. 현행 테스트 통과면 위반 없음 |
| I7 | Convention Compliance | `appstore-orders.md` `Retreive` 오타 — Cafe24 공식 docs 오타 복사 | `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` | 생성기 산출물 원칙(§7.3) 상 원문 보존 정책. 조치 불필요 |
| I8 | Convention Compliance | `cafe24-api-catalog/application.md` `## 표` 섹션 제목 패턴이 `_overview.md` 에 미정의 | `spec/conventions/cafe24-api-catalog/application.md` | `_overview.md` 에 권장 섹션 제목 명시 또는 현 상태 유지 가능 |
| I9 | Plan Coherence | `spec-sync-execution-engine-gaps.md` worktree cleanup 완료, 실질 미해소 항목 없음 | `spec/5-system/4-execution-engine.md` frontmatter `pending_plans` | plan complete 폴더 이동 + spec frontmatter 에서 제거 검토 |
| I10 | Plan Coherence | `1-auth.md` pending_plans 의 `auth-config-webhook-followups.md` 미착수 백로그 유지 — 직접 충돌 없음 | `spec/5-system/1-auth.md` frontmatter | 현행 partial 상태와 plan 추적 정합. 변경 불필요 |
| I11 | Plan Coherence | `ai-agent-tool-connection-rewrite.md` 미착수, EIA §5.2 tool 이름 namespace drift 잠재 | `spec/5-system/14-external-interaction-api.md §5.2` | plan 활성화 시 EIA spec 동기화 필요를 현행 plan 에 추적 메모 추가 |
| I12 | Naming Collision | exec-park D6 vs AI 노드 D6 — 양쪽 이미 자체 주석으로 인지 처리됨 | `spec/5-system/4-execution-engine.md §Rationale` | 추가 조치 불필요 |
| I13 | Naming Collision | `interactionType` JSON 키 — interaction_data 기록 enum vs WaitingInteractionType 대기 분류 enum 동명 | `spec/1-data-model.md` 라인 501 | 이미 "이름만 같고 별개 enum" 주석 명시. 추가 조치 불필요 |
| I14 | Naming Collision | `EXECUTION_TIME_LIMIT_EXCEEDED` vs 기존 `EXECUTION_TIMEOUT` — 유사명, 범위 상이 | `spec/5-system/4-execution-engine.md §8`, `spec/5-system/3-error-handling.md` | `spec/conventions/error-codes.md` 또는 `3-error-handling.md §1.4` 에 두 코드 범위 구분 한 줄 추가 권장 |

---

## Checker 별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 2건 (WS 프로토콜 RESUME_INCOMPATIBLE_STATE 미기술, applyCancellation async 취소 흐름 미기술). INFO 3건. 기능 모순 없음 |
| Rationale Continuity | **재시도 필요** | output_file 미생성 — 결과 없음 |
| Convention Compliance | LOW | WARNING 2건 (auth historical-artifact 설명 누락, graph-rag 이중 도입부). INFO 6건. CRITICAL 없음 |
| Plan Coherence | MEDIUM | WARNING 3건 (D6 Phase 0 미해소·PR-B2 착수조건 미완결·PR2b spec 덮어쓰기 위험). INFO 3건. CRITICAL 없음 |
| Naming Collision | NONE | INFO 3건 모두 자체 주석으로 이미 인지 처리됨. 기능 충돌 없음 |

---

## 권장 조치사항

1. **(BLOCK 없음 — WARNING 해소 우선순위)**
2. **W5/W7 (Plan Coherence) — PR-B2 착수 전**: `exec-park-durable-resume.md` Phase 0 체크박스 3건(PR3 rehydration 일반화, node-cancellation 직렬화 순서, 출처 plan 이관)의 현행 완료 여부를 확인해 체크 처리하거나 미완 사유 명기. PR-B2 착수 전 선결 조건.
3. **W6 (Plan Coherence)**: `exec-intake-queue-impl.md` PR2b 항목에 "착수 전 origin/main(PR-B1 포함) rebase 선행" 한 줄 추가.
4. **W1 (Cross-Spec)**: `spec/5-system/6-websocket-protocol.md` `RESUME_INCOMPATIBLE_STATE` 행에 `resume_call_stack.version` 초과 케이스 주석 추가.
5. **W2 (Cross-Spec)**: `spec/5-system/6-websocket-protocol.md` 취소 흐름 절에 park-released execution 취소 경로 주석 추가.
6. **W3 (Convention Compliance)**: `spec/5-system/1-auth.md §1.5.4` 에 "초대 흐름 전용 historical artifact" 설명 한 문장 추가.
7. **W4 (Convention Compliance)**: `spec/5-system/10-graph-rag.md` `## 1. 개요` 섹션을 Overview 또는 본문에 흡수(현 diff 신규 변경 없으면 낮은 우선순위).
8. **I9**: `spec-sync-execution-engine-gaps.md` plan complete 이동 + spec frontmatter 제거 검토.
9. **I14**: `spec/conventions/error-codes.md` 또는 `3-error-handling.md §1.4` 에 `EXECUTION_TIMEOUT` vs `EXECUTION_TIME_LIMIT_EXCEEDED` 범위 구분 추가 (낮은 우선순위).
10. **Rationale Continuity 재시도**: output_file 미생성으로 결과 없음 — 필요 시 단독 재실행.

---

_생성일시: 2026-06-06 | 검토 대상: `spec/5-system` (exec-park-durable-resume --impl-done)_