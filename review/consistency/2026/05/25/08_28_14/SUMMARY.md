# Consistency Check 통합 보고서 (spec-update Phase 2.8/2.9)

**BLOCK: NO** — Critical 없음. WARNING 10건은 모두 spec 적용 시 동반 갱신·문구 보강으로 해소 가능.

## 전체 위험도
**MEDIUM** — spec/data-flow 동기화 누락 2건, retry-handler-followup 과의 편집 조율 3건, frontmatter 비표준 필드 1건.

## Critical
없음.

## WARNING

| # | Checker | 요약 |
|---|---------|------|
| W1 | cross_spec | `spec/data-flow/0-overview.md §4` 큐 카탈로그에 `execution-continuation` 행 추가 필요 |
| W2 | cross_spec | `spec/data-flow/0-overview.md §5` Continuation bus 설명이 stale (Redis pub/sub) — BullMQ 로 갱신 |
| W3 | cross_spec | `spec/data-flow/3-execution.md` 시퀀스 다이어그램 정합 확인 |
| W4 | rationale_continuity | `INVALID_EXECUTION_STATE` WS 전용 결정의 Rationale 공식 등재 부재 |
| W5 | convention_compliance | plan frontmatter 의 비표준 `status: pending` 필드 제거 |
| W6 | convention_compliance | spec 반영 시 `## Rationale` 섹션 추가 누락 위험 |
| W7 | plan_coherence | `retry-handler-followup.md` WARNING #3 와 `INVALID_EXECUTION_STATE` 의미 범위 미조율 |
| W8 | plan_coherence | `retry-handler-followup.md` WARNING #1/#2 의 동일 spec 파일 미결 편집 |
| W9 | plan_coherence | `workflow-resumable-execution.md §"다음 단계" 3번` 동반 plan 갱신 누락 |
| W10 | naming_collision | `INVALID_EXECUTION_STATE` vs `INVALID_STATE` 유사 이름 — `3-error-handling.md` 에 역방향 cross-link 권장 |

## 권장 처리 (planner 작업 분기)

본 worktree 에서 즉시 처리할 항목:
- **변경 1** (§9.3 `task-queue` 삭제 + §11 토큰 제거) — 그대로 진행. + I4 (Rationale 한 줄 추가).
- **변경 2.1** (§7.5.1 신설) — W4/W6 적용: 본문 + spec Rationale 한 단락 동반.
- **변경 2.2** (§4.2 행 주석) — W10 적용: `3-error-handling.md` 의 `INVALID_STATE` 행에 역방향 주석.
- **동반 갱신 (W1/W2/W3)** — `spec/data-flow/0-overview.md` §4 / §5 갱신 + `spec/data-flow/3-execution.md` 시퀀스 검토.
- **plan 정리 (W5/W8/W9)** — frontmatter `status: pending` 제거 + retry-handler-followup 조율 항목 추가.

W7 분석:
- `retry-handler-followup.md` WARNING #3 가 `INVALID_EXECUTION_STATE` 를 `retry_last_turn` 컨텍스트에서도 사용할 가능성을 언급.
- **본 spec 의 결정**: `INVALID_EXECUTION_STATE` 는 "WS 명령 진입 시 Execution 이 기대 상태가 아님" 의 범용 코드로 정의 — retry_last_turn 도 (`waiting_for_input` 이 아닌 `failed` 가 기대 상태) 같은 코드 재사용 가능.
- 따라서 본 PR 에서 §7.5.1 을 일반화 (publisher 측 상태 검증) 로 작성하면 retry-handler-followup 도 같은 코드 재사용 가능 — 별 개 정의 필요 없음.

## INFO
I1-I14 — spec 반영 시 동반 보강 (선택). 본 SUMMARY 에서는 굵직한 7건만 반영 (I2 역방향 cross-link, I4 Rationale 한 줄, I5 historical artifact 표현 보완, I6 spec-impl 갭 인라인 노트, I7 background-execution attempts 표현, I8 plan 링크 경로, I12 task-queue 잔여 grep).

**BLOCK: NO** — planner spec 적용 진행.
