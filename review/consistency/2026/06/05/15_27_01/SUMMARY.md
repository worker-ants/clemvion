# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 5개 checker 전체 통과. Critical 위배 0건, WARNING 4건(모두 과도기 상태 명확화 또는 문서 구조 정교화 수준), INFO 다수. 실제 시스템 invariant 파괴나 계약 충돌 없음.

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `§7.4` Worker 동작 본문이 PR-B2 완료 후 최종 상태만 기술 — 현재 과도기(멀티턴 AI fast-path 잠정 잔존) 미명시 | `spec/5-system/4-execution-engine.md §7.4` Worker 동작 행 | `§4.x` Rationale "단계적 롤아웃(B1→B2)" 주석 | §7.4 자체에 "(※ PR-B2 완료 전 과도기: 멀티턴 AI 는 §Rationale 단계적 롤아웃 참조)" 인라인 주석 추가 — PR-B2 완료 후 자연 해소 |
| W2 | Rationale Continuity | `§6.3` Multi-turn resume 행에 "frozen snapshot" 표현이 D3(fresh-per-turn) 결정과 잠재 충돌 — spec 갱신 여부 확인 필요 | `spec/5-system/4-execution-engine.md §6.3` Multi-turn resume 행 | `§Rationale` D3 항목("Phase B: fresh-per-turn 재유도로 전환") | §6.3 해당 행에 "(Phase B 완료 후: fresh-per-turn, D3 — §Rationale 참조)" 노트 추가 또는 Rationale D3 에서 §6.3 cross-link 명시. PR-B2 완료 시 행 서술 갱신 의무 |
| W3 | Convention Compliance | `skipReason` lower_snake_case 예외에 대한 `error-codes.md §3` 레지스트리 scope 경계 미명시 — 운영 진단 enum 과 error code 구분이 규약 문서에 없음 | `spec/5-system/11-mcp-client.md §6.2` | `spec/conventions/error-codes.md §3` historical-artifact 레지스트리 | `error-codes.md §3` 소개 문구에 "본 레지스트리는 `error.code` surface 한정, 운영 진단 enum(`skipReason` 등)은 별도 규약 범위" 한 줄 추가 |
| W4 | Plan Coherence | `impl-exec-concurrency-cap` worktree(`claude/impl-concurrency-cap-pr2b`)가 동일 파일(`spec/5-system/4-execution-engine.md`)의 Phase B 이전 모델 상태로 수정 중 — PR-B1 머지 전 push 시 Phase B 서술 덮어쓰기 위험 | `spec/5-system/4-execution-engine.md §4.x/§6.2/§7.4/§7.5` | `plan/in-progress/exec-intake-queue-impl.md`(worktree `impl-exec-concurrency-cap`) | PR-B1(`claude/exec-park-b1`) 머지 후 `impl-concurrency-cap-pr2b` rebase 를 선행 조건으로 `exec-intake-queue-impl.md` 에 명기. spec 변경 push 순서 조율 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `spec/0-overview.md §2.4` park/slow-path 서술 — 이미 동기화 완료 | `spec/0-overview.md §2.4` | 없음 |
| I2 | Cross-Spec | `spec/1-data-model.md §2.13` `conversation_thread`/`user_variables` 컬럼 서술 정합 | `spec/1-data-model.md §2.13` | 없음 |
| I3 | Cross-Spec | `spec/4-nodes/3-ai/3-information-extractor.md` `_resumeCheckpoint` 적용 범위 서술 정합 | `spec/4-nodes/3-ai/3-information-extractor.md §5.4` | 없음 |
| I4 | Cross-Spec | `spec/conventions/conversation-thread.md §4` durable resume 스냅샷 정책 정합 | `spec/conventions/conversation-thread.md §4` | 없음 |
| I5 | Cross-Spec | `spec/4-nodes/3-ai/1-ai-agent.md §12.x` rehydration 복원 서술 정합 | `spec/4-nodes/3-ai/1-ai-agent.md §12.1/§12.10/§12.13` | 없음 |
| I6 | Cross-Spec | `spec/5-system/11-mcp-client.md §4.1` `waiting_for_input` 세션 close — durable park 모델과 완전 정합 | `spec/5-system/11-mcp-client.md §4.1` | 없음 |
| I7 | Rationale Continuity | "신규 컬럼 없음" 원칙 번복 — Rationale 에 적용 범위 분리 근거 명시. 정합 | `spec/conventions/conversation-thread.md §8.4` | 없음 |
| I8 | Rationale Continuity | `_resumeCheckpoint` 영속 — "WARN #6 미영속" 번복 Rationale 완비 | `spec/5-system/4-execution-engine.md §Rationale` | 없음 |
| I9 | Rationale Continuity | `information_extractor` 멀티턴 확장 — "ai_agent 한정" 번복 근거 명시. 정합 | `spec/5-system/4-execution-engine.md §1.3` | 없음 |
| I10 | Rationale Continuity | D3 fresh-config-per-turn — frozen-rawConfig 번복 D3 항목으로 명시. §6.3 행 확인 필요(→W2) | `spec/5-system/4-execution-engine.md §Rationale D3` | W2 조치로 함께 해소 |
| I11 | Convention Compliance | `spec/5-system/1-auth.md §1.5.4` historical-artifact 예외 — `error-codes.md §3` 양방향 참조 완성, 모범 사례 | `spec/5-system/1-auth.md §1.5.4` | 없음 |
| I12 | Convention Compliance | `10-graph-rag.md` `## Overview` 내 numbered 섹션과 본문 이중 구조 — 독자 혼동 가능, 강제 사항 아님 | `spec/5-system/10-graph-rag.md` | 다음 편집 시 Overview/본문 경계 정리 권장 |
| I13 | Convention Compliance | `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` `order` wrapper 설명 오류(`정렬 순서...` → `(응답 객체)`) | `appstore-orders.md` `order` 행 | 수동 수정 — CI 차단 아님 |
| I14 | Plan Coherence | `plan/in-progress/exec-park-durable-resume.md` Phase 0 "이관 표기 + cross-link" 미체크 | `plan/in-progress/exec-park-durable-resume.md Phase 0` | Phase B2 착수 전 project-planner 가 `exec-intake-queue-impl.md` PR3 + `node-cancellation-infrastructure.md §2` cross-link 추가 |
| I15 | Plan Coherence | `impl-exec-concurrency-cap` `_resumeCheckpoint` 범위 서술 A2b 이전 상태 — W4 rebase 조치로 자연 해소 | `spec/5-system/4-execution-engine.md §1.3`(concurrency-cap 브랜치) | W4 조치에 포함 |
| I16 | Naming Collision | `PARK_RELEASED` Symbol — spec 신규 등장, 코드베이스 기존 구현과 일치, 충돌 없음 | `spec/5-system/4-execution-engine.md §Rationale` | 없음 |
| I17 | Naming Collision | `cancelParkedExecution` — spec 신규 등장, 코드베이스 기존 구현과 일치, 충돌 없음 | `spec/5-system/4-execution-engine.md §7.4` | 없음 |
| I18 | Naming Collision | `runNodeDispatchLoop` 반환 타입 `{ parked: boolean }` — spec 신규 명시, 구현 일치, 충돌 없음 | `spec/5-system/4-execution-engine.md §Rationale` | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 인접 spec 전반 동기화 완료. W1(§7.4 과도기 미명시) 1건 — PR-B2 완료 후 자연 해소 |
| Rationale Continuity | LOW | 주요 번복(신규 컬럼, WARN#6, ai_agent 한정, frozen-rawConfig) 모두 Rationale 완비. W2(§6.3 frozen 표현 잔류 가능) 1건 주의 |
| Convention Compliance | LOW | 에러 코드 규약·frontmatter 준수. W3(skipReason 규약 scope 경계 미명시) 1건 — 규약 문서 경계 명확화 권장 |
| Plan Coherence | MEDIUM | `impl-exec-concurrency-cap` worktree 동일 파일 Phase B 이전 상태 병렬 수정 — W4 merge conflict 위험. PR-B1 머지 후 rebase 필수 |
| Naming Collision | NONE | 신규 식별자 4건 모두 기존 구현과 일치, 의미 충돌 없음 |

## 권장 조치사항

1. **(W4 우선 — 운영 리스크)** `plan/in-progress/exec-intake-queue-impl.md` PR2b 선행 조건에 "`exec-park-durable-resume` PR-B1 머지 + `impl-concurrency-cap-pr2b` rebase 확인 후 spec 변경 push" 명기. PR-B1 머지 전 `impl-concurrency-cap-pr2b` 의 `spec/5-system/4-execution-engine.md` push 시 Phase B 서술이 덮어써진다.
2. **(W2)** `spec/5-system/4-execution-engine.md §6.3` Multi-turn resume 행의 "frozen snapshot" 표현이 D3 결정과 충돌하는지 확인하고, 잔류 시 "(Phase B 완료 후: fresh-per-turn, D3 — §Rationale 참조)" 노트 추가.
3. **(W1)** `spec/5-system/4-execution-engine.md §7.4` Worker 동작 행에 PR-B2 완료 전 과도기(멀티턴 AI fast-path 잠정 잔존) 인라인 주석 추가. PR-B2 완료 후 삭제.
4. **(W3)** `spec/conventions/error-codes.md §3` 소개 문구에 "본 레지스트리는 `error.code` surface 한정; 운영 진단 enum(`skipReason` 등)은 적용 범위 외" 한 줄 추가.
5. **(I14)** Phase B2 착수 전 project-planner 가 `exec-intake-queue-impl.md` PR3 + `node-cancellation-infrastructure.md §2` cross-link 추가로 Phase 0 체크리스트 완결.