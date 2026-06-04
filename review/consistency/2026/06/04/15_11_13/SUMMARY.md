# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — spec 3개 파일이 완료된 구현과 직접 모순됨 (에러 코드명 불일치, 필드 미등재, "미구현" 표기 잔존); 나머지 checker 는 WARNING 이하.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/5-system/4-execution-engine.md §8` 이 "미구현 aspirational" 표기 유지 + 에러 코드 `EXECUTION_TIMEOUT`, 설정 출처 `Workflow.settings` 로 기술하나 구현은 `EXECUTION_TIME_LIMIT_EXCEEDED` + env `EXECUTION_MAX_ACTIVE_RUNNING_MS` 로 완료 상태 | `spec/5-system/4-execution-engine.md §8` (line 924–938) | 구현 diff (`execution-limits.ts`, `workflow-errors.ts`, `execution-engine.service.ts`, `V073`) | (1) 블록쿼트의 "미구현" → "구현 완료(PR2a)" 교체, (2) 에러 코드 `EXECUTION_TIMEOUT` → `EXECUTION_TIME_LIMIT_EXCEEDED`, (3) 한도 출처 `Workflow.settings` → `EXECUTION_MAX_ACTIVE_RUNNING_MS` env (기본 30분) |
| 2 | Cross-Spec | 신규 에러 코드 `EXECUTION_TIME_LIMIT_EXCEEDED` 가 공식 카탈로그 `spec/5-system/3-error-handling.md §1.4` 및 분류 표 `spec/conventions/chat-channel-adapter.md §3.1` 에 미등재 — spec 독자가 timeout 분류를 판단 불가 | `codebase/backend/src/nodes/core/error-codes.ts` (PR2a) | `spec/5-system/3-error-handling.md §1.4`, `spec/conventions/chat-channel-adapter.md §3.1` | `3-error-handling.md §1.4` 표에 `EXECUTION_TIME_LIMIT_EXCEEDED` 행 추가; `chat-channel-adapter.md §3.1` 에 `EXECUTION_TIME_LIMIT_EXCEEDED → executionFailedTimeout` 행 추가 |
| 3 | Cross-Spec | `Execution.active_running_ms` 컬럼(V073)이 데이터 모델 단일 진실 `spec/1-data-model.md §2.13` 에 미등재 — DB 스키마와 spec 직접 모순 | `execution.entity.ts` + `V073__execution_active_running_ms.sql` | `spec/1-data-model.md §2.13 Execution` 필드 표 | `§2.13` 표에 `active_running_ms \| Integer \| 누적 active-running 시간(ms). waiting_for_input 제외. 기본 0. §8 타임아웃 기준` 행 추가 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `execution-run` 큐가 큐 카탈로그 3곳에 미등재 — E2E 가 13개 큐를 기대하는데 spec 은 12개로 기술 | `system-status.constants.ts` (MONITORED_QUEUES), `test/system-status.e2e-spec.ts` | `spec/data-flow/0-overview.md §4`, `spec/5-system/16-system-status-api.md §1`, `spec/data-flow/9-observability.md` ("12개 큐" 리터럴) | (1) `data-flow/0-overview.md §4` 표에 `execution-run` 행 추가, (2) `16-system-status-api.md §1` 표에 행 추가, (3) `9-observability.md` "12개 큐" → "13개 큐" |
| 2 | Cross-Spec | `spec/5-system/4-execution-engine.md §9.3` BullMQ 큐 목록에 `execution-run` intake 큐 미등재 + "별도 큐 없이 in-process dispatch" 주석이 현재 구현과 불일치 | `spec/5-system/4-execution-engine.md §9.3` | `execution-run.queue.ts`, `execution-run.processor.ts` | §9.3 표에 `execution-run` 행 추가, 주석을 실제 intake 큐 모델로 갱신 |
| 3 | Cross-Spec | `spec/0-overview.md §2.4` Execution Engine 설명에 PR2a active-running 누적 타임아웃 기능 언급 없음 | `spec/0-overview.md §2.4` | PR2a 구현 (`EXECUTION_MAX_ACTIVE_RUNNING_MS` env) | §2.4 항목에 "단일 Execution active-running 누적 타임아웃(기본 30분, waiting_for_input 제외)" 요약 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/conventions/chat-channel-adapter.md §3.1` 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 미기재 (CRITICAL #2 의 쌍) | `execution-failure-classifier.ts` TIMEOUT_CODES | CRITICAL #2 갱신 시 함께 처리 |
| 2 | Cross-Spec | `spec/1-data-model.md §2.13 error` 필드 어휘 열거는 이미 `EXECUTION_TIME_LIMIT_EXCEEDED` 포함; §8 "미구현" 표기와 괴리만 잔존 (CRITICAL #1 부산물) | `spec/1-data-model.md §2.13` | CRITICAL #1 §8 갱신 후 §2.13 `error` 필드 설명 `§8` 링크에 "(구현됨)" 수식 추가 |
| 3 | Rationale Continuity | 판정 조건 `>=` 사용 근거가 spec Rationale 에 미기록 (구현은 `>=`, spec 표현은 "초과(`>`") | `execution-engine.service.ts assertActiveTimeWithinLimit()` | spec Rationale "타임아웃을 active-running 누적 기준으로" 항에 "`>=` 선택 — 경계 포함이 안전" 한 줄 추가 또는 §8 본문 "초과" → "한도 이상(≥)" 정렬 |
| 4 | Rationale Continuity | Graceful Shutdown under-count 허용 결정 + PR3 flush 훅 예고가 코드 JSDoc(W4)에만 존재, spec Rationale 미반영 | `execution-engine.service.ts` 클래스 JSDoc | spec Rationale "Durable Continuation & Graceful Shutdown" 또는 "타임아웃" 항에 under-count 허용 트레이드오프 및 PR3 flush 훅 예정 명시 |
| 5 | Rationale Continuity | `segmentStartMs` 직렬화 불변식(단일 Execution 에 동시 active 세그먼트 없음) 이 코드 JSDoc(W5)에만 존재, spec Rationale 미기록 | `execution-engine.service.ts` 클래스 JSDoc | spec §4.2 또는 Rationale 에 동일 Execution 직렬화 invariant 명시 |
| 6 | Convention Compliance | 섹션 제목 `## 8. 동시 실행 제한 (부분 구현)` — frontmatter `status: partial` + blockquote 배너와 중복, 규약 선례 없음 | `spec/5-system/4-execution-engine.md` line 936 | 제목을 `## 8. 동시 실행 제한` 으로 정리하고 상태 표시는 blockquote 배너에만 두는 것 권장 (의무 아님) |
| 7 | Convention Compliance | `user_guide:` frontmatter 에 신규 MDX 파일 미참조 (선택 필드) | `spec/5-system/4-execution-engine.md` frontmatter | 원한다면 `user_guide: [codebase/frontend/src/content/docs/05-run-and-debug/error-handling.mdx]` 추가 가능 |
| 8 | Convention Compliance | `spec/5-system/4-execution-engine.md` 에 `## Overview` 섹션 없음 (기존 상태, 이번 PR 신규 문제 아님) | `spec/5-system/4-execution-engine.md` 전체 구조 | 후속 spec 정비 시 추가 고려 |
| 9 | Plan Coherence | Q1 결정(env 상수 1단계) 이 plan 인라인 `Q1=A` 로만 기록, 명시적 결정 섹션 없음 | `plan/in-progress/exec-intake-queue-impl.md` | `## 결정 기록` 섹션(Q1=A, Q2=A) 추가 권장 |
| 10 | Plan Coherence | `spec/data-flow/0-overview.md §4` 표 행 추가 + `spec/5-system/16-system-status-api.md §1` 가 plan 후속 항목으로 열려 있음(인라인 텍스트 갱신만 완료) | `plan/in-progress/exec-intake-queue-impl.md` lines 18–20 | PR 머지 후 후속 항목 open 상태임을 plan 에 명시, 또는 PR2b/project-planner PR 에서 처리 분류 |
| 11 | Naming Collision | `EXECUTION_TIME_LIMIT_EXCEEDED` vs `EXECUTION_TIMEOUT` 의미 유사성 — 여러 위치에서 명시적 구분 설명 추가됨, 실제 충돌 없음 | `error-codes.ts`, `execution-failure-classifier.ts`, `3-error-handling.md`, `chat-channel-adapter.md` | 없음 (현재 명시 수준 적절) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | HIGH | CRITICAL 3건 (spec 3개 파일이 완료된 구현과 직접 모순) + WARNING 3건 (execution-run 큐 카탈로그 누락) |
| Rationale Continuity | LOW | INFO 3건 — `>=` 판정 근거·under-count 허용·직렬화 불변식이 spec Rationale 에 미기록. 기각 재도입 없음 |
| Convention Compliance | NONE | INFO 7건 — 모두 형식 일관성 제안, 규약 위반 없음 |
| Plan Coherence | NONE | INFO 2건 — Q1 결정 명시화·후속 항목 open 추적. 워크트리 충돌 후보 5건 전부 MERGED stale |
| Naming Collision | NONE | INFO 8건 — 신규 식별자 전건 충돌 없음, `EXECUTION_TIMEOUT` 와의 의미 분리도 다수 위치에서 명시됨 |

## 권장 조치사항

1. **(BLOCK 해소 필수)** `spec/5-system/4-execution-engine.md §8` 갱신: 블록쿼트 "미구현 aspirational" → "구현 완료(PR2a)", 에러 코드 `EXECUTION_TIMEOUT` → `EXECUTION_TIME_LIMIT_EXCEEDED`, 한도 출처 `Workflow.settings` → `EXECUTION_MAX_ACTIVE_RUNNING_MS` env.
2. **(BLOCK 해소 필수)** `spec/5-system/3-error-handling.md §1.4` 표에 `EXECUTION_TIME_LIMIT_EXCEEDED` 행 추가; `spec/conventions/chat-channel-adapter.md §3.1` 에 `EXECUTION_TIME_LIMIT_EXCEEDED → executionFailedTimeout` 행 추가.
3. **(BLOCK 해소 필수)** `spec/1-data-model.md §2.13` Execution 표에 `active_running_ms` 필드 행 추가.
4. (WARNING 해소 권장) `spec/data-flow/0-overview.md §4`, `spec/5-system/16-system-status-api.md §1`, `spec/data-flow/9-observability.md` 에 `execution-run` 큐 등재 및 "12개" → "13개" 교정.
5. (WARNING 해소 권장) `spec/5-system/4-execution-engine.md §9.3` 에 `execution-run` 행 추가 및 "별도 큐 없이 in-process" 주석 현행화.
6. (WARNING 해소 권장) `spec/0-overview.md §2.4` Execution Engine 항목에 PR2a active-running 누적 타임아웃 요약 한 줄 추가.
7. (INFO 선택) spec Rationale 에 `>=` 판정 근거·under-count 허용·직렬화 불변식 명시.
8. (INFO 선택) 섹션 제목에서 "(부분 구현)" 제거, blockquote 배너로 일원화.