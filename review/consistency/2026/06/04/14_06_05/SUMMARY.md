# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 차단 사유 없음.

## 전체 위험도
**MEDIUM** — WARNING 3건(cross-spec 동기화 누락 2건, convention_compliance 2건, naming_collision 1건)이 있으나 모두 계획된 후속 PR2 범위 항목이거나 구현 시 주의 사항이며, 즉각적 시스템 동작 불가나 데이터 계약 파괴 수준은 아님.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `data-flow/0-overview.md §4` BullMQ 큐 카탈로그에 `execution-run` 미등재 | `spec/5-system/4-execution-engine.md §9.3` | `spec/data-flow/0-overview.md §4` (큐 목록에 `execution-run` 없음) + `spec/data-flow/3-execution.md §1.1` 시퀀스 다이어그램 | `spec/data-flow/0-overview.md §4`에 `execution-run` 행 추가; `spec/data-flow/3-execution.md §1.1` 시퀀스 다이어그램을 `execute() → execution-run → Worker → runExecution` 흐름으로 갱신 (plan `exec-intake-queue-impl.md §SPEC-DRIFT W1/#2` 와 동일, PR2 범위 내) |
| W2 | Cross-Spec | `external-interaction-api.md §5.2` 에러코드 예시에 `EXECUTION_TIME_LIMIT_EXCEEDED` 미포함 | `spec/5-system/4-execution-engine.md §8` | `spec/5-system/14-external-interaction-api.md §5.2` notification payload `code` 예시 | `§5.2` 에러코드 예시에 `EXECUTION_TIME_LIMIT_EXCEEDED` 추가 (plan `exec-intake-queue-impl.md §consistency-check PR2 범위`에 이미 계획됨) |
| W3 | Convention-Compliance | `## Overview` 섹션 부재 (3섹션 권장 구성 미충족) | `spec/5-system/4-execution-engine.md` 전체 구조 | `CLAUDE.md` + skill 문서 "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" | 제목 하단에 `## Overview` 추가하거나, 기술 명세 문서의 Overview 를 선택 사항으로 CLAUDE.md 에 명시 |
| W4 | Convention-Compliance | 엔진 전용 에러 코드(`WORKER_HEARTBEAT_TIMEOUT`, `RESUME_CHECKPOINT_MISSING`, `RESUME_FAILED`, `RESUME_INCOMPATIBLE_STATE`, `SERVER_INTERRUPTED`, `SERVER_SHUTTING_DOWN`, `INVALID_EXECUTION_STATE`, `CONTAINER_MISSING_EMIT`, `CONTAINER_MULTIPLE_EMIT`, `INVALID_NODE_CONFIG`, `UNKNOWN_NODE_TYPE`, `MAX_ITERATIONS_EXCEEDED`) 다수가 중앙 `ErrorCode` enum 미등재 | `spec/5-system/4-execution-engine.md §3.0, §3.1, §5.4, §5.6, §7.1, §7.4, §7.5, §7.5.1, §8, §11` | `spec/conventions/error-codes.md §2` + `codebase/backend/src/nodes/core/error-codes.ts` | 위 목록을 `error-codes.ts` 의 `// Execution Engine / Infrastructure` 섹션으로 등재하거나, 엔진 전용 enum 파일 신설 후 conventions canonical surface 목록에 추가 |
| W5 | Naming-Collision | `EXECUTION_TIME_LIMIT_EXCEEDED` 와 `EXECUTION_TIMEOUT` 이 `EXECUTION_T*` 접두어 공유로 혼동 위험 | `spec/5-system/4-execution-engine.md §8` (신규) | `spec/4-nodes/5-data/2-code.md`, `spec/5-system/3-error-handling.md`, `execution-failure-classifier.ts` 등 기존 `EXECUTION_TIMEOUT` 사용처 전반 | `spec/5-system/3-error-handling.md` 에 이미 구분 설명 있음. 구현 시 `execution-failure-classifier.ts` 등에서 양 코드 명시적 분기 처리 필수. 더 강한 분리 원하면 `EXECUTION_WALL_TIME_LIMIT_EXCEEDED` 또는 `EXEC_ACTIVE_TIME_EXCEEDED` 로 rename 고려 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `data-flow/0-overview.md §4` `execution-continuation` 설명이 PR1 이후 intake 큐 대칭 구조를 반영하지 않음 | `spec/data-flow/0-overview.md §4` (line 93), `spec/data-flow/3-execution.md §Rationale` | `execution-continuation` 행 설명에 "재개 active 세그먼트 운반 (`execution-run` 이 첫 세그먼트를 담당하는 대칭 구조)" 추가 (W1 과 함께 처리 가능) |
| I2 | Cross-Spec | `spec/5-system/16-system-status-api.md` MONITORED_QUEUES 에 `execution-run` 미등록 (plan이 PR2 범위로 defer) | `spec/5-system/16-system-status-api.md` | PR2 시 `execution-run` 모니터링 대상 큐 추가 + intake burst 오탐 note 기재 |
| I3 | Convention-Compliance | §9.1 Redis 키 패턴 예외(`exec:recover:lock`, `exec:cont:seq:<executionId>`) 문서화는 충분하나, 규약 독립 문서 부재 | `spec/5-system/4-execution-engine.md §9.1~9.2` | 향후 `spec/conventions/redis-key-naming.md` 분리 고려 (INFO 수준) |
| I4 | Convention-Compliance | §3.3 섹션이 §3.4 뒤에 배치되어 목차 순서 비연속 | `spec/5-system/4-execution-engine.md` line 289~343 | §3.3 ↔ §3.4 순서 교정, 또는 현 배치가 의도적이라면 주석으로 이유 명시 |
| I5 | Convention-Compliance | `pending_plans` 파일 실존 확인 — 정합 (차단 없음) | `spec/5-system/4-execution-engine.md` frontmatter | 없음 |
| I6 | Plan-Coherence | `exec-intake-queue-impl.md` frontmatter `worktree` 필드가 PR1 stale worktree(`impl-exec-intake-queue`) 로 유지 | `plan/in-progress/exec-intake-queue-impl.md` frontmatter | `worktree` 를 `impl-exec-concurrency-cap` 으로 갱신하거나 PR2 전용 plan 항목에 올바른 worktree 등재 |
| I7 | Plan-Coherence | `spec-sync-execution-engine-gaps.md` §8 항목이 착수 중(`exec-intake-queue-impl.md PR2`)임을 cross-ref 없이 `[ ]` 미착수로 표기 | `plan/in-progress/spec-sync-execution-engine-gaps.md` §8 | §8 항목에 "착수 중 — `exec-intake-queue-impl.md PR2a/PR2b`" 주석 추가 |
| I8 | Plan-Coherence | `channel-web-chat-followups.md §2` 비용 가드 설계가 PR2의 active-running 추적 인프라 재사용 후보임을 plan 이 미참조 | `plan/in-progress/channel-web-chat-followups.md §2` | PR2 완료 후 해당 plan 에 "execution-engine active-running 추적 인프라(PR2a) 재사용 후보" 메모 추가 |
| I9 | Plan-Coherence | PR3 시 `node-cancellation-infrastructure.md §2` 와 코드 영역 겹침 — PR2 단계에서는 차단 없음 | `plan/in-progress/exec-intake-queue-impl.md PR3` | PR3 착수 전 `node-cancellation-infrastructure.md §2` 완료 여부 재검토 |
| I10 | Naming-Collision | 섹션 번호 `§4.x` (문자 x) 가 기존 정수 번호 체계(`§4.1`~`§4.4`)와 불일치 | `spec/5-system/4-execution-engine.md §4.x` | `§4.x` → `§4.5` 로 정정 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `data-flow/0-overview.md §4` 큐 카탈로그 및 `external-interaction-api.md §5.2` 에러코드 예시 미갱신(WARNING 2건). 모두 plan에 PR2 범위로 인지·등재됨 |
| Rationale-Continuity | NONE | 기각 대안 재도입 없음, 합의 원칙 위반 없음, 무근거 번복 없음, 암묵적 가정 충돌 없음 |
| Convention-Compliance | MEDIUM | `## Overview` 섹션 부재(WARNING) + 엔진 에러코드 12종 중앙 enum 미등재(WARNING). 섹션 순서·Redis 규약 문서화는 INFO |
| Plan-Coherence | NONE | 활성 worktree 간 파일 충돌 없음. frontmatter stale worktree·cross-ref 누락은 INFO 위생 항목 |
| Naming-Collision | LOW | `EXECUTION_TIME_LIMIT_EXCEEDED` ↔ `EXECUTION_TIMEOUT` 접두어 공유로 혼동 가능성(WARNING). 기타 신규 식별자 7종 충돌 없음 |

## 권장 조치사항

1. **[PR2 필수 동반] spec/data-flow/0-overview.md §4 큐 카탈로그 갱신** — `execution-run` 행 추가 및 `execution-continuation` 설명에 대칭 구조 기술 (W1·I1 해소). plan `exec-intake-queue-impl.md §SPEC-DRIFT W1/#2` 와 동일 항목이므로 PR2 spec 갱신 시 함께 처리.
2. **[PR2 필수 동반] spec/5-system/14-external-interaction-api.md §5.2 에러코드 예시 갱신** — `EXECUTION_TIME_LIMIT_EXCEEDED` 추가 (W2 해소). 이미 plan에 계획됨.
3. **[구현 시 주의] EXECUTION_TIME_LIMIT_EXCEEDED vs EXECUTION_TIMEOUT 명시적 분기** — `execution-failure-classifier.ts` 등 분류 로직에서 두 코드를 명시적으로 구분 처리 (W5 해소). 차단 수준은 아니나 혼동 방지 주석 필수.
4. **[선택적 — 단기] 엔진 에러코드 중앙 enum 등재** — `WORKER_HEARTBEAT_TIMEOUT`, `RESUME_CHECKPOINT_MISSING`, `SERVER_INTERRUPTED` 등 12종을 `error-codes.ts` 에 `// Execution Engine / Infrastructure` 섹션으로 추가 (W4 해소). PR2 구현 완료 후 함께 처리 권장.
5. **[선택적 — 단기] plan frontmatter 정비** — `exec-intake-queue-impl.md` `worktree` 를 `impl-exec-concurrency-cap` 으로 갱신 + `spec-sync-execution-engine-gaps.md §8` 에 착수 중 주석 추가 (I6·I7 해소).
6. **[선택적 — 장기] spec/5-system/4-execution-engine.md 섹션 정비** — `## Overview` 추가 또는 CLAUDE.md 에 기술 명세 문서 Overview 선택 사항 명시 (W3 해소). 섹션 `§4.x` → `§4.5` 번호 정정 (I10 해소).