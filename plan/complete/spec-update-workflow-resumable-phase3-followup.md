---
worktree: (project-planner 픽업 시 지정)
started: 2026-05-29
owner: project-planner
---

# Spec Update Proposal — workflow-resumable Phase 3 / 변경 2.3 후속

> developer 가 Phase 3.1 + 변경 2.3 구현(worktree `workflow-resumable-phase3-a4ea4a`) 중
> `/ai-review` + `/consistency-check` 에서 식별한 **spec 문서 정합화** 항목.
> developer 는 spec 본문 쓰기 권한이 없어 project-planner 위임을 위해 작성.
> 산출 review: `review/code/2026/05/29/09_07_18/SUMMARY.md`,
> `review/consistency/2026/05/29/09_23_46/SUMMARY.md` (둘 다 BLOCK: NO).

## 진행 상태 (2026-05-29 — PR #355 동반 처리)

변경 1·3·4·5·6 은 PR #355 에서 직접 반영 완료. 변경 2 는 이미 등재돼 있어 no-op. **변경 7** 은 project-planner 조사(2026-05-29) 결과 프로젝트 전반 마이그레이션 일부로 확정 → `spec-frontmatter-status-migration.md` (B0) + `execution-engine-residual-gaps.md` 로 처리 완료. 본 plan 의 모든 항목 종료 → `plan/complete/` 이동.

- [x] **변경 1** — `6-websocket-protocol.md §4.2` 실패 ack `errorCode?: string` 평면 필드 + retry_last_turn nested 와의 의도적 분리 명시.
- [x] **변경 2** — `3-error-handling.md §1.5` WS 카탈로그에 `INVALID_EXECUTION_STATE` 이미 등재됨 (consistency C-2 는 §1.5 미인지 — no-op 확인).
- [x] **변경 3** — `14-external-interaction-api.md §5.1` `STATE_MISMATCH` 행에 §7.5.1 역링크 추가.
- [x] **변경 4** — `4-execution-engine.md §7.5` 큐 옵션에 `removeOnFail: false` 명시.
- [x] **변경 5** — `4-execution-engine.md §Rationale` "DLQ 모니터링 — 로그 기반 알람 선택" 항목 추가, §9.3 인라인은 Rationale 참조로 정리.
- [x] **변경 6** — `3-workflow-editor/3-execution.md §8` REST 표에 `POST :id/continue` (422 `INVALID_STATE`) 등재.
- [x] **변경 7** — `4-execution-engine.md` frontmatter `spec-only` → `partial` + `code:` + `pending_plans: [execution-engine-residual-gaps.md]`. project-planner 조사로 (a) TTL 공통 deadline 2026-08-21·프로젝트 전반 96 spec-only 현상, (b) 엔진 미구현 3건(G1/G2/G3) owning plan 부재를 확인 → gap-closure plan 신설 후 전이. 본문 stale 2건(`_multiTurnState`·presentation status)도 정정. 상세: `spec-frontmatter-status-migration.md`.

## 동기

변경 2.3 (publisher 측 동기 `INVALID_EXECUTION_STATE`) + Phase 3.1 (DLQ 모니터링)
구현은 완료됐으나, 신규 에러 코드·ack 필드·환경변수가 일부 spec 문서에 미반영.
모두 비차단(Critical 0)이나 spec-impl drift 방지를 위해 정리.

## 변경 항목

### 변경 1 — WS ack `errorCode` 필드 등재 (review W-4 / W-11 / consistency C-1)
- `spec/5-system/6-websocket-protocol.md §4.2` — `execution.submit_form` / `click_button` / `submit_message` / `end_conversation` 의 실패 ack 에 `errorCode?: string` 필드 추가 명시.
- **구조 결정 필요**: 구현은 ack `data.errorCode` (flat) 인데 같은 spec 의 `execution.retry_last_turn` ack 은 nested `error: { code, message }`. 둘 중 하나로 통일 권장 — flat 유지 시 spec 에 그 사유 명시, nested 통일 시 구현 동반 수정(별도 developer 작업).

### 변경 2 — `INVALID_EXECUTION_STATE` 에러 카탈로그 등재 (review C-2)
- `spec/5-system/3-error-handling.md` — WS 전용 에러 코드 목록에 `INVALID_EXECUTION_STATE` 정식 행 추가 (현재 §1.3 `INVALID_STATE` 422 의 WS 대응 노트만 존재). §7.5.1 cross-link.

### 변경 3 — EIA 409 `STATE_MISMATCH` ↔ §7.5.1 역링크 (review I-3 / consistency)
- `spec/5-system/14-external-interaction-api.md §5.1` 의 `STATE_MISMATCH` 행에 "publisher 측 사전 검증(`실행 엔진 §7.5.1`) 의 EIA 진입점 매핑 포함" 노트 + 역방향 링크.

### 변경 4 — §7.5 큐 옵션 `removeOnFail: false` 명시 (review I-2 / consistency)
- `spec/5-system/4-execution-engine.md §7.5` (또는 §9.3 큐 표) 의 `execution-continuation` 큐 옵션 기술에 `removeOnFail: false` (+ `attempts: RESUME_BULLMQ_ATTEMPTS`) 보강 — 이미 신설된 §9.3 "Dead-letter 모니터링" 과 정합.

### 변경 5 — §9.3 DLQ 모니터 결정을 `## Rationale` 로 이전 (review convention I)
- 현재 §9.3 "Dead-letter 모니터링 (Phase 3.1)" 본문에 인라인 서술된 "로그 기반 알람 선택(OTel traces-only 현 구성)" 근거를 `## Rationale` 섹션 항목으로 이동/요약 (CLAUDE.md §정보 저장 위치 — 결정 근거는 Rationale).

### 변경 6 — REST `POST :id/continue` 422 endpoint 등재 (review I / consistency)
- `spec/3-workflow-editor/3-execution.md §8` (또는 `4-execution-engine.md §7.4`) REST endpoint 목록에 `POST :id/continue` 의 422 `INVALID_STATE` 응답 계약 등재. (선택) `executions.controller.ts` 의 Swagger DTO (`InvalidStateErrorResponseDto`) 정의 — 별도 developer 작업.

### 변경 7 — frontmatter status 전이 (review convention W-2)
- `spec/5-system/4-execution-engine.md` frontmatter `status: spec-only` / `code: []` → 실제 구현 반영. `spec/conventions/spec-impl-evidence.md §3` 전이 규칙에 따라 `status: partial` (또는 implemented) + `code: [codebase/backend/src/modules/execution-engine/**]`.

## 권고 후속 흐름
1. project-planner 가 본 plan 픽업 → `/consistency-check --spec` 로 cross-spec 영향 점검.
2. 위 7개 항목 spec 직접 갱신. 변경 1(구조 통일)·변경 6(Swagger DTO) 중 구현 동반분은 별도 developer 작업으로 분리.
3. 완료 시 `git mv` 로 `plan/complete/` 이동.
