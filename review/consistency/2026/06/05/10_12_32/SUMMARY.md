# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음, 차단 불필요

검토 일시: 2026-06-05
검토 모드: `--impl-done` (scope=`spec/5-system/`, diff-base=`origin/main`)
대상 브랜치: `claude/exec-park-durable-resume`

---

## 전체 위험도
**MEDIUM** — Critical 0건, Warning 6건(cross-spec 3 + plan-coherence 4 중 중복 제거 후). 모두 Phase B 착수 전 또는 Phase B PR 완료 시점에 해소해야 하는 예정된 spec 갱신·plan 정합성 항목. Phase A1 구현 결과 자체의 무결성은 침해하지 않음.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | 상태 전이 표 `waiting_for_input → waiting_for_input` 행이 Phase B("pendingContinuations 재등록" 제거) 이후 모순 예정 | `spec/5-system/4-execution-engine.md` §1.2 L62 | 동 파일 §7.4 L822 + plan Phase B | Phase B PR에서 해당 행을 "rehydration slow-path 일원화"로 정정 |
| W2 | Cross-Spec | `_resumeCheckpoint` "ai_agent 한정" 서술이 3곳에 분산 — Phase A2 완료 시 동기 갱신 누락 시 spec 내부 충돌 발생 | `spec/5-system/4-execution-engine.md §1.3 L111`, `spec/4-nodes/3-ai/3-information-extractor.md L357`, `spec/4-nodes/3-ai/1-ai-agent.md L703` | plan A2 consistency I1/I4 | Phase A2 PR에서 세 곳 한 PR 동기 갱신 의무화, 완료 후 consistency-check --spec 재실행 |
| W3 | Cross-Spec / Rationale | §7.4 Worker 동작 행의 "local fast-path resolve" 서술이 Rationale "Sticky fast-path 제거 — 항상 BullMQ enqueue" 원칙 및 Phase B2/B3와 선제적 긴장 (두 checker가 동일 충돌 지적 — 강한 등급으로 통합) | `spec/5-system/4-execution-engine.md` §7.4 L822, §7.5 L870-871 | 동 파일 Rationale L1206-1208 + plan Phase B2/B3 | Phase B PR에서 §7.4 Worker 동작 행을 "rehydration 단일 경로"로 정정, §7.5 diagram case 1/2 이분법 → 단일 흐름으로 수정 |
| W4 | Plan-Coherence | Phase 0 cross-link 미완료 — exec-intake-queue-impl.md §PR3에 "exec-park 이관" 표기 없어 중복 착수 오해 가능 | `plan/in-progress/exec-park-durable-resume.md §Phase 0` | `plan/in-progress/exec-intake-queue-impl.md §PR3` | exec-intake-queue-impl.md §PR3에 "→ exec-park Phase A2/B2 이관(2026-06-05 D5)" 표기 추가 (planner) |
| W5 | Plan-Coherence | exec-intake-queue-impl.md §PR2a 상태가 "OPEN" — PR #469는 이미 origin/main에 MERGED | `plan/in-progress/exec-intake-queue-impl.md §PR2a` | origin/main 커밋 `722edf7a` | §PR2a 상태를 `[x] PR #469 MERGED(2026-06-05)`로 갱신 (planner) |
| W6 | Plan-Coherence | D2/D3 미확정 상태에서 Phase A3·Phase B 착수 시 spec §7.5 `variables` 복원 약속이 사전 커밋 drift 패턴 발생 가능 | `plan/in-progress/exec-park-durable-resume.md §미해결 결정` D2, D3 | `spec/5-system/4-execution-engine.md §7.5` | Phase A3 착수 전 D2 확정, spec §7.5 variables 서술은 D2 확정 + 구현 완료 후 추가. D3는 Phase B 착수 직전 확정 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | Phase B 완료 후 §4.x 구현 메모(`firstSegmentBarriers`/`signalParkBarrier`/`settleFirstSegment`)가 제거된 메커니즘으로 잔류 예정 | `spec/5-system/4-execution-engine.md §4.x L403-405` | Phase B PR에서 구현 메모 블록을 "즉시 해제 + slow-path" 설명으로 교체 |
| I2 | Cross-Spec | D4 turn-단위 park Rationale(채택 근거·기각 대안)이 spec §4.x에 미기술 — Plan Spec 변경 W4 항 이행 전 | `plan/in-progress/exec-park-durable-resume.md §Phase B1` / `spec/5-system/4-execution-engine.md §4.x` | Phase B 착수 전 planner가 spec §4.x 또는 §Rationale에 D4 결정 근거 명문화 |
| I3 | Cross-Spec | `conversation_thread` 컬럼 및 W1 해소 — 이미 spec 전 파일 정합 완료 | `spec/1-data-model.md §2.13 Execution L465` | 없음 (정합 상태) |
| I4 | Rationale | `conversation-thread.md §8.4` "신규 컬럼 없음" 원칙 번복 근거·기각 대안이 Rationale에 충분히 기록됨 | `spec/conventions/conversation-thread.md §8.4 L330-340` | 없음 (정합 완료) |
| I5 | Convention | `1-auth.md` §1.5.4 초대 토큰 에러 코드 6개가 `lower_snake_case` — UPPER_SNAKE_CASE 규약 직접 위반 | `spec/5-system/1-auth.md §1.5.4` | `invitation_not_found` → `INVITATION_NOT_FOUND` 등 6개 변환, 구현 코드 리터럴 동기 갱신 |
| I6 | Convention | `10-graph-rag.md` `## Overview (제품 정의)` 와 `## 1. 개요` 이중 섹션 — spec 3섹션 권장 구조 위반 | `spec/5-system/10-graph-rag.md` | `## 1. 개요`를 본문 진입으로 통합하거나 제거 |
| I7 | Convention | `10-graph-rag.md §6` WebSocket 채널 `kb:{documentId}` — `kb:{knowledgeBaseId}` 일 가능성, `8-embedding-pipeline.md §8` 교차 확인 필요 | `spec/5-system/10-graph-rag.md §6` | `8-embedding-pipeline.md §8` 채널명과 비교, 불일치 시 SoT 결정 후 통일 |
| I8 | Convention | `11-mcp-client.md §6.2` `skipReason` lower_snake_case가 의도적 예외이나 `error-codes.md §3` 예외 레지스트리 미등재 | `spec/5-system/11-mcp-client.md §6.2` | `error-codes.md §3` 또는 `node-output.md §3.2`에 "진단용 enum 필드 lower_snake_case 허용" 근거 명시 |
| I9 | Convention | `11-mcp-client.md §3.2` credentials 표 `비밀` 컬럼에 이모지(🔒) 사용 — 동 영역 다른 문서와 불일치 | `spec/5-system/11-mcp-client.md §3.2` | `🔒` → `암호화` 또는 `yes` 텍스트 표현으로 통일 |
| I10 | Plan-Coherence | PR2b(impl-exec-concurrency-cap) migration V085 race 위험 — PR-A1 머지 전후 번호 조율 필요 | `plan/in-progress/exec-intake-queue-impl.md §PR2b` | PR-A1 머지 후 PR2b 착수 시 V085 재부여 확인, 동시 착수 시 두 plan 간 번호 조율 |
| I11 | Plan-Coherence | `spec/1-data-model.md §2.13` `conversation_thread` 컬럼이 ai-context-memory 계열 plan과 역할 분리 명확 | `spec/1-data-model.md §2.13` | ai-context-memory-followup-v2.md에 선택적 cross-note 가능 |
| I12 | Naming | plan 내 `D1`~`D5` 결정 레이블이 `spec/5-system/13-replay-rerun.md`, `conversation-thread.md §9.3`의 동일 레이블과 의미 충돌 — 현재 plan 로컬 식별자로 spec 충돌 아님 | `plan/in-progress/exec-park-durable-resume.md` | spec 본문 인용 시 `exec-park:D1` 등 plan 고유 prefix 또는 의미 있는 anchor 링크 사용 권장 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | WARNING 3건 (상태 전이 표·_resumeCheckpoint 3곳 동기·§7.4 fast-path 서술) — 모두 Phase B 완료 시 해소 예정인 spec 갱신 추적 항목 |
| Rationale Continuity | LOW | INFO 1건 — §7.4/§7.5 본문이 Rationale "fast-path 제거" 결정을 미반영 (Cross-Spec W3와 동일 근원, 통합됨) |
| Convention Compliance | LOW | INFO 5건 (에러 코드 케이스 위반, 문서 구조 이중 섹션, WebSocket 채널명 불확실, skipReason 예외 미등재, 이모지) |
| Plan Coherence | LOW | WARNING 4건 (cross-link 미완료, PR2a stale, D2/D3 미확정, V085 race) |
| Naming Collision | NONE | Critical/Warning 없음. V084 번호 정합, 함수명 충돌 없음 |

---

## 권장 조치사항

1. **(Phase B 착수 전 — 선행 필수)** planner가 `spec/5-system/4-execution-engine.md §4.x` 또는 §Rationale에 D4 turn-단위 park 결정 근거를 명문화 (Plan Spec 변경 W4 항 이행). D3 미확정 시 Phase B 착수 차단 검토.
2. **(Phase A3 착수 전)** D2(user-defined variables 복원 범위) 확정. spec §7.5 `variables` 복원 서술은 D2 확정 + 구현 완료 이후 추가.
3. **(planner — 즉시)** `plan/in-progress/exec-intake-queue-impl.md §PR2a` 상태를 `MERGED`로 갱신, §PR3에 "exec-park Phase A2/B2 이관(2026-06-05 D5)" cross-link 추가.
4. **(Phase A2 PR)** `_resumeCheckpoint` 관련 세 spec 파일(`4-execution-engine.md §1.3`, `3-information-extractor.md L357`, `1-ai-agent.md L703`) 동기 갱신 의무화.
5. **(Phase B PR)** §7.4 Worker 동작 행 및 §7.5 diagram을 "항상 rehydration 단일 경로"로 정정. §1.2 상태 전이 표 `waiting_for_input → waiting_for_input` 행 정정. §4.x 구현 메모 블록을 "즉시 해제 + slow-path" 설명으로 교체.
6. **(convention 정리 — 낮은 우선순위)** `spec/5-system/1-auth.md §1.5.4` 에러 코드 6개를 UPPER_SNAKE_CASE로 변환(구현 코드 동기). `spec/conventions/error-codes.md §3`에 `skipReason` 예외 근거 등재. `spec/5-system/10-graph-rag.md §6` WebSocket 채널명 교차 확인.
7. **(PR-A1 머지 후)** PR2b 착수 시 V085 migration 번호 재확인 — 동시 착수 불가피 시 두 plan 간 번호 조율.