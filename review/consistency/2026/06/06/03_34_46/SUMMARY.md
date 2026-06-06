# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 함

## 전체 위험도
**HIGH** — Critical 2건(설계 결정 레이블 D6 의미 충돌, active worktree spec 파일 충돌 위협), Warning 5건

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| C1 | NamingCollision | 설계 결정 레이블 `D6` 가 두 개의 독립된 의미로 중복 사용됨 — 실행 엔진 spec 의 신규 `D6`("중첩 sub-workflow call stack 영속화")와 AI 노드 spec 의 기존 `D6`("AI 노드 output 경로 단일화") 가 동일 레이블을 공유해 cross-reference 독자에게 직접 혼선 야기 | `spec/5-system/4-execution-engine.md` §6.2, §7.5, §Rationale "D6" 항목 전체 | `spec/4-nodes/3-ai/1-ai-agent.md:749`, `spec/4-nodes/3-ai/2-text-classifier.md:340,350`, `spec/4-nodes/3-ai/3-information-extractor.md:332,368,384,428`, `spec/conventions/conversation-thread.md:118,215,317,415` | 실행 엔진 spec 의 신규 결정 레이블을 `D7`(또는 `EE-D6`)으로 변경하고 해당 문서 내 모든 참조 일괄 갱신 — 또는 AI 노드 측 `D6` 리네임 후 모든 참조 갱신 — 양쪽 D6 공존 상태 즉시 해소 필요 |
| C2 | PlanCoherence | active worktree `impl-exec-concurrency-cap`(branch `claude/impl-concurrency-cap-pr2b`) 이 `spec/5-system/4-execution-engine.md` 를 동시 수정 중 — PR-B2 spec 완료형 재전환(C5) 머지 시 해당 브랜치가 rebase 없이 push 하면 full-durable 서술이 덮어쓰이는 실질적 충돌 위협 | `spec/5-system/4-execution-engine.md` (§4.x banner·§7.4·§Rationale L1257·§6.2 resume_call_stack 추가 예정 변경) | `plan/in-progress/exec-intake-queue-impl.md` PR2b 착수조건 — rebase 의무 명기 있으나 두 plan 간 인터락 체크박스 연결 없음 | `exec-intake-queue-impl.md` PR2b 착수조건 항목에 "PR-B2 spec 머지 확인 후 rebase 이행" 체크박스 명시 추가; 인터락 문서화 완료 전까지 PR-B2 spec 변경 머지 차단 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | ConventionCompliance | `1-auth.md §1.5.4` 의 `forbidden`·`rate_limited` "초대 흐름 한정" 단서가 `error-codes.md §3` 레지스트리 row 에 미기재 — 양방향 참조자 혼동 가능 | `spec/5-system/1-auth.md §1.5.4` | `spec/conventions/error-codes.md §3` Historical-artifact 레지스트리 표 | `error-codes.md §3` `forbidden`·`rate_limited` row 에 "초대 흐름 한정" 단서 1~2단어 추가로 동기화 |
| W2 | ConventionCompliance | `10-graph-rag.md` — `## Overview (제품 정의)` + `## 1. 개요` 이중 계층 혼재 — 제품 정의와 기술 명세 경계 모호 | `spec/5-system/10-graph-rag.md §1. 개요` vs `§ Overview (제품 정의)` | `CLAUDE.md §정보 저장 위치` Overview/본문/Rationale 3섹션 권장 | Overview 섹션을 순수 제품 정의로 축약하고 기술 상세는 본문(§1~)으로 통합; 또는 CLAUDE.md 에 통합 허용 명시 |
| W3 | ConventionCompliance | `10-graph-rag.md §6` — `document:graph_error` dead-declared 이벤트 미emit·spec 표 미등재 상태이나 코드 cleanup `pending_plans` 연결 없음 | `spec/5-system/10-graph-rag.md §6 WebSocket 이벤트` | `spec/conventions/node-output.md` Principle 0; `spec-impl-evidence.md §3 partial` | dead-declaration cleanup 을 `pending_plans` 에 등록 또는 spec `status` 를 `partial` 로 정정 |
| W4 | PlanCoherence | PR-B2 spec 변경(C5) commit 순서 미확인 — spec 완료형 재전환이 코드 변경보다 앞선 commit 이면 --impl-done 판정이 spec↔구현 역전을 내포 | `spec-draft-exec-park-b2-durable.md` C5 "적용 전제(W3)" 조항 / `plan/in-progress/exec-park-durable-resume.md §진행 메모 W4` | `spec/5-system/4-execution-engine.md §4.x banner "PR-B2 미적용"` 제거 commit | git log 로 C5 spec 재전환 commit 이 코드 변경(B3 제거·단발 turn 처리기) commit 이후에 위치하는지 확인 |
| W5 | PlanCoherence | D6 재귀 executeInline 재진입 경로와 `node-cancellation-infrastructure.md §2` abortSignal.aborted 사전체크 삽입 지점의 겹치는 범위가 cancellation plan 에 미기재 | `plan/in-progress/node-cancellation-infrastructure.md §2` | `plan/in-progress/exec-park-durable-resume.md` PR-B2 D6 설계 / `driveResumeDetached` 확장 경로 | `node-cancellation-infrastructure.md §2` cross-link 항목에 "D6 재귀 재진입 경로도 B3 결과에 포함 — rebase 시 해당 경로 abortSignal 사전체크도 커버" 한 줄 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | CrossSpec | `Execution.active_running_ms` — data-model 에 마이그레이션 번호(V083) 미기재 | `spec/1-data-model.md §2.13` | 원하는 경우 `active_running_ms \| Integer \| ... (V083)` 형태로 통일 — OPTIONAL |
| I2 | CrossSpec | `spec/5-system/1-auth.md §5` — `POST /auth/resend-verification` 엔드포인트 목록 누락 (§1.1 본문에는 서술됨) | `spec/5-system/1-auth.md §5 API 엔드포인트` | §5 표에 `POST /api/auth/resend-verification` 행 추가 (throttle 5/min, 인증 불요) |
| I3 | CrossSpec | `10-graph-rag.md §6` — `kb:{documentId}` 채널명이 `8-embedding-pipeline.md §8` 에서 명시적으로 확인되지 않음 | `spec/5-system/10-graph-rag.md §6` | `8-embedding-pipeline.md §8` 에 `kb:{documentId}` 채널명 명시 권장 |
| I4 | RationaleContinuity | B1·B2 "분리 불가" 원칙과 "PR 분리 허용" 서술이 동일 단락 혼재 — 모순처럼 보일 수 있음 | `spec/5-system/4-execution-engine.md §Rationale "단계적 롤아웃"` | "분리 불가는 동일 park-site 내 B1+B2 동시 적용 의무, park-site 단위 PR 분리는 이 원칙과 충돌 안 함" 명시 |
| I5 | RationaleContinuity | D6(`resume_call_stack`) 과 기각된 `_continuationCheckpoint` 의 목적 구분이 Rationale 본문에 있으나 전면에 배치되지 않아 번복 오해 소지 | `spec/5-system/4-execution-engine.md §Rationale D6 항목` | "_continuationCheckpoint 기각은 DB 스키마 변경 자체 금지가 아님, resume_call_stack 은 다른 목적" 문장을 D6 항목 첫 줄에 배치 |
| I6 | RationaleContinuity | §7.4 Worker 동작 표에 최종 상태(pendingContinuations 제거)와 과도기 예외(멀티턴 AI 잠정 경로) 혼용 서술 | `spec/5-system/4-execution-engine.md §7.4` | 시점 태그("현황 2026-06-06") 또는 시각적 분리(blockquote·배너)로 두 상태 구분 |
| I7 | ConventionCompliance | `1-auth.md` — 명시적 `## Overview` 섹션 제목 없음 | `spec/5-system/1-auth.md` | `## Overview` 섹션 추가 또는 `_product-overview.md` 위임 링크 선언 |
| I8 | ConventionCompliance | `10-graph-rag.md §Overview` — `✅` 이모지 사용 (CLAUDE.md 이모지 금지 방침) | `spec/5-system/10-graph-rag.md §Overview (제품 정의)`, §3 요구사항 표 | `✅` → `[완료]` / `implemented` 등 텍스트 상태 표지로 일괄 대체 |
| I9 | ConventionCompliance | `cafe24-api-catalog/_overview.md` — `_*.md` 면제 의도성 미명시 (frontmatter 면제는 정상) | `spec/conventions/cafe24-api-catalog/_overview.md` | `spec-impl-evidence.md §1` 면제 설명에 카탈로그 진입 컨벤션 문서 포함 명시 |
| I10 | ConventionCompliance | `11-mcp-client.md §6.2` — `skipReason` lowercase enum 이 `error-codes.md` SoT 범위 밖임을 error-codes.md 에서 역참조 없음 | `spec/5-system/11-mcp-client.md §6.2` | `error-codes.md §1` 적용 범위에 "진단용 내부 enum(skipReason 등)은 범위 밖" 한 줄 추가 |
| I11 | PlanCoherence | PR3 이관 3항목(rehydration 일반화·jobId 멱등 재검증·완료노드 미재실행)이 `exec-park-durable-resume.md` Phase A2/B2 체크박스에 대응 미기재 | `plan/in-progress/exec-park-durable-resume.md Phase B2` | Phase B2 설계 또는 Phase 0 에 PR3 이관 항목 각각 어느 코드 변경에 대응하는지 체크박스 등재 |
| I12 | NamingCollision | `CALL_STACK_SCHEMA_VERSION` 과 `CHECKPOINT_SCHEMA_VERSION` 이름 유사·현재 값 동일(`1`) — 혼용 위험 | `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts:48` vs `execution-engine.service.ts:284` | PR-B2 구현 시 두 상수를 한 파일로 통합하지 않도록 주의; 기존 독립 주석으로 현 수준 충분 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| CrossSpec | NONE | spec/5-system ↔ 기존 영역 간 직접 모순 없음; PR-B1 3개 컬럼(V084·V085·V087) 삼자 정합 확인 |
| RationaleContinuity | NONE | 기각 대안 재도입·invariant 무근거 위반 없음; 모든 항목 서술 명확성 보강 INFO 수준 |
| ConventionCompliance | MEDIUM | `11-mcp-client.md pending_plans` 파일 실존 여부 조건부 Critical(실존 시 FP); WARNING 3건(error-codes 미동기·graph-rag 이중 계층·dead-declared 이벤트 plan 연결 부재) |
| PlanCoherence | HIGH | CRITICAL 1건(active worktree 충돌 위협); WARNING 3건(commit 순서·D6 cancellation 겹침·PR3 이관 대응 미기재) |
| NamingCollision | HIGH | CRITICAL 1건(D6 레이블 의미 충돌 — 실행 엔진 vs AI 노드 spec 간); INFO 1건(schema version 상수 유사성) |

> **ConventionCompliance CRITICAL 비고**: `11-mcp-client.md` 의 `pending_plans: plan/in-progress/spec-sync-mcp-client-gaps.md` 실존 여부는 본 검토 범위 밖이다. 파일이 실제로 존재하면 FP이므로 통합 BLOCK 사유로 포함하지 않는다. 실존 확인 후 파일 부재가 확인되면 별도 BLOCK 사유 추가 필요.

## 권장 조치사항

1. **(BLOCK C1 해소 — 필수)** `spec/5-system/4-execution-engine.md` 의 신규 설계 결정 레이블 `D6` 를 `D7`(또는 스코프 한정 레이블)로 변경하고 해당 문서 내 모든 참조(`§6.2`, `§7.5`, `§Rationale`)를 일괄 갱신. AI 노드 측 기존 D6는 현행 유지(또는 합의 후 리네임).
2. **(BLOCK C2 해소 — 필수)** `plan/in-progress/exec-intake-queue-impl.md` PR2b 착수조건 항목에 "PR-B2 spec 머지 확인 후 `claude/impl-concurrency-cap-pr2b` rebase 이행" 체크박스 명시 추가; 인터락 문서화 완료 전까지 PR-B2 spec 변경 머지 차단.
3. **(W1 — 권장)** `spec/conventions/error-codes.md §3` `forbidden`·`rate_limited` row 에 "초대 흐름 한정" 단서 추가 (1~2단어).
4. **(W3 — 권장)** `spec/5-system/10-graph-rag.md` `document:graph_error` dead-declaration cleanup 을 `pending_plans` 에 등록 또는 `status` 를 `partial` 로 정정.
5. **(W4 — 권장)** PR-B2 브랜치에서 git log 로 C5 spec 재전환 commit 이 코드 변경 commit 이후인지 순서 검증.
6. **(W5 — 권장)** `plan/in-progress/node-cancellation-infrastructure.md §2` 에 D6 재귀 재진입 경로 포함 명시.
7. **(I2 — 선택)** `spec/5-system/1-auth.md §5` 에 `POST /api/auth/resend-verification` 행 추가.
8. **(I4, I5, I6 — 선택)** `spec/5-system/4-execution-engine.md §Rationale` 서술 명확성 보강 (B1·B2 분리 불가 원칙 한 문장 추가, D6 목적 구분 전면 배치, §7.4 시점 태그 추가) — project-planner 위임.