# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 호출자 차단 불필요.

## 전체 위험도
**LOW** — 5개 checker 모두 Critical 0건. WARNING 4건(phase 착수 전 선행 조치 필요), INFO 8건.

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `RESUME_INCOMPATIBLE_STATE` 트리거 조건 3원화가 `3-error-handling.md §1.3` 에러 코드 카탈로그에 미반영 — 2건 기술과 3건 실제 불일치 | `spec/5-system/3-error-handling.md` line 94 | `spec/5-system/4-execution-engine.md §7.5`, `spec/5-system/6-websocket-protocol.md §4.2` | `RESUME_INCOMPATIBLE_STATE` 설명에 "미래 버전(`schemaVersion` 이 현재 코드 지원 버전 초과 — 롤링 배포 중 구 인스턴스가 신 포맷 pickup)" 케이스 추가 |
| W2 | Rationale-Continuity | D4(멀티턴 turn-단위 park) 가 확정 결정으로 기록됐으나 spec §Rationale 명문화가 Phase B 착수 전 의무임에도 현재 spec에 미작성 | `spec/5-system/4-execution-engine.md §4.x`(또는 §Rationale 신설) | `plan/in-progress/exec-park-durable-resume.md` Phase B 선행 의무 | Phase B(B1/B2/B3) 착수 전 project-planner 가 D4 turn-단위 park 결정 및 Rationale(기존 방식 대비 채택 근거·기각 대안) 작성 의무 이행 |
| W3 | Convention-Compliance | `11-mcp-client.md §6.2` `skipReason` 값이 `lower_snake_case` — `node-output.md Principle 3.2`(`UPPER_SNAKE_CASE`) 및 `error-codes.md §1` 적용 범위와 충돌. `error-codes.md §3` 레지스트리에도 미등재 | `spec/5-system/11-mcp-client.md §6.2` | `spec/conventions/node-output.md Principle 3.2`, `spec/conventions/error-codes.md §1` | (a) `skipReason` 값을 `UPPER_SNAKE_CASE` 로 변경하거나 (b) `error-codes.md §3` 레지스트리 또는 §1 적용 범위에 "운영 진단 내부 enum 제외" 명시하여 규약 갱신 |
| W4 | Plan-Coherence | `impl-exec-concurrency-cap` worktree 가 PR #469·#470 이전 main 기준으로 구버전 `spec/5-system/4-execution-engine.md` 로컬 보유 — 그대로 push 시 durable park spec 덮어쓰기 충돌 발생 | `impl-exec-concurrency-cap` worktree 로컬 `spec/5-system/4-execution-engine.md` (§4.3·§4.x) | `origin/main` (PR #470 반영 현재 상태) | PR2b 착수 전 `origin/main` 으로 rebase 하여 A1/A2a spec 변경분 흡수 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `forbidden`·`rate_limited` historical-artifact 등재 시 대문자판 `FORBIDDEN`·`RATE_LIMITED` 와의 구별 메모 미기재 — 독자 혼동 여지 | `spec/conventions/error-codes.md §3`, `spec/5-system/1-auth.md §1.5.4` | 레지스트리 행 설명에 "(대문자판은 `2-api-convention.md §5.3` 범용 기본값과 별개 — 초대 API 한정)" 메모 추가 |
| I2 | Cross-Spec | `telegram.md §5.7` graceful 안내 조건 열거에 미래 버전 checkpoint 케이스 미추가 | `spec/4-nodes/7-trigger/providers/telegram.md` line 192 | 미래 버전 checkpoint(`schemaVersion` > 현재 지원 버전) 케이스를 조건 열거에 추가 |
| I3 | Rationale-Continuity | Phase B2/B3 `pendingContinuations` fast-path 제거가 spec §Rationale "Sticky fast-path 제거"(publisher 측)와 별개임을 spec·plan 모두 명확히 연결하지 않아 혼동 가능 | `spec/5-system/4-execution-engine.md §7.4 Worker 동작`, `plan/in-progress/exec-park-durable-resume.md §Phase B2/B3` | plan Phase B2/B3 항목에 "Phase B 완료 후 pendingContinuations Map에 키가 쌓이지 않아 worker-side fast-path dead code 화됨 — publisher 측 §Rationale 원칙과 별개" 명시 |
| I4 | Rationale-Continuity | Phase A2/B2 rehydration 일반화(`ai_agent` 한정 해제)에 대한 Rationale 가 spec에 미기재 — 번복 근거 없이 선언만 된 상태 | `spec/5-system/4-execution-engine.md §Rationale`, `plan/in-progress/exec-park-durable-resume.md §A2` | Phase A2 착수 전 spec에 "checkpoint 일반화 — `ai_agent` 한정 해제" Rationale 추가 또는 기존 결정 근거를 번복 사유로 갱신 |
| I5 | Convention-Compliance | `1-auth.md` 에 `## Overview` 섹션 누락 | `spec/5-system/1-auth.md` 상단 | frontmatter 아래에 `## Overview` 섹션(1~3 문장) 추가 |
| I6 | Convention-Compliance | `11-mcp-client.md` 에 `## Rationale` 섹션 누락 — 설계 결정이 본문 인라인 주석에 분산 | `spec/5-system/11-mcp-client.md` 끝부분 | `## Rationale` 섹션 추가하여 transport 선택·skipReason 분리·세션 per-execution 정책 근거 통합 |
| I7 | Convention-Compliance | `cafe24-api-catalog/application/appstore-orders.md` — `order` wrapper row 설명이 `sort_order` 계열 설명으로 오기재 (파싱 버그) | `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` GET·POST 응답 `order` 행 | wrapper row 설명을 `(응답 객체)` 로 수정; `_generator.py` wrapper row 추출 로직 점검 |
| I8 | Plan-Coherence | D2(user-defined variables 복원 범위 — 본 plan 포함 vs 별도 plan) 미확정 시 Phase B 완성 후 §7.5 "무손실" 주장이 부분 허위 될 수 있음 | `plan/in-progress/exec-park-durable-resume.md §A3`, `spec/5-system/4-execution-engine.md §7.5` | D2를 Phase B 착수 전 확정; 별도 plan 분리 시 §7.5 "무손실" 범위를 conversationThread/checkpoint 한정으로 명시 보강 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `3-error-handling.md` 에러 코드 카탈로그의 `RESUME_INCOMPATIBLE_STATE` 트리거 설명 미동기(WARNING 1건), telegram.md·error-codes.md 보완 INFO 2건 |
| Rationale-Continuity | LOW | D4 turn-단위 park Rationale 미명문화(WARNING), Phase B 완료 후 worker-side fast-path 제거 논리 연결 미흡(INFO), ai_agent 한정 해제 Rationale 공백(INFO) |
| Convention-Compliance | LOW | `skipReason` lower_snake_case 규약 충돌(WARNING), `1-auth.md` Overview 누락·`11-mcp-client.md` Rationale 누락·cafe24 카탈로그 파싱 버그(INFO) |
| Plan-Coherence | LOW | `impl-exec-concurrency-cap` worktree 구버전 spec 로컬 보유(WARNING), D4 Rationale 의무 타이밍(rationale_continuity W2와 동일 이슈), D2 미확정(INFO) |
| Naming-Collision | NONE | `CHECKPOINT_SCHEMA_VERSION`·`schemaVersion`·초대 에러 코드 6종 모두 충돌 없음. INFO 1건(forbidden/FORBIDDEN 공존 — 런타임 충돌 없음) |

## 권장 조치사항

1. **(W4 — 즉시)** `impl-exec-concurrency-cap` worktree 를 `origin/main` 으로 rebase — PR2b push 전 필수. A1/A2a spec 변경 덮어쓰기 방지.
2. **(W1 — Phase B 착수 전)** `spec/5-system/3-error-handling.md` line 94 의 `RESUME_INCOMPATIBLE_STATE` 설명에 미래 버전 케이스 추가 — 4-execution-engine.md·6-websocket-protocol.md 와 동기화.
3. **(W2 — Phase B 착수 전 의무)** `spec/5-system/4-execution-engine.md §4.x` 또는 신규 §Rationale 에 D4 turn-단위 park 결정 Rationale 작성 — plan 자체 선행 의무.
4. **(W3 — Phase B 착수 전)** `11-mcp-client.md §6.2` `skipReason` 처리 방향 결정: `UPPER_SNAKE_CASE` 전환 또는 `error-codes.md §1` 적용 범위에 예외 명시.
5. **(I3/I4 — Phase B/A2 착수 전)** plan Phase B2/B3 항목에 worker-side fast-path dead code 화 근거 명시; Phase A2 착수 전 spec에 checkpoint 일반화 Rationale 추가.
6. **(I8 — Phase B 착수 전)** D2(variables 복원 범위) 확정; 별도 plan 분리 시 spec §7.5 "무손실" 범위 한정 명시.
7. **(I1·I2 — 낮은 우선순위)** `error-codes.md §3` 에 대/소문자 구별 메모 추가; `telegram.md §5.7` 조건 열거에 미래 버전 케이스 추가.
8. **(I5·I6 — 낮은 우선순위)** `1-auth.md` Overview 섹션 추가; `11-mcp-client.md` Rationale 섹션 추가.
9. **(I7 — 낮은 우선순위)** `appstore-orders.md` wrapper row 설명 오기재 수정; `_generator.py` wrapper 추출 로직 점검.