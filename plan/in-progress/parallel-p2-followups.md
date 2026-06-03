# Parallel P2 — 후속 작업 잔여

> 작성일: 2026-05-30 / 분리: 2026-06-01 (split)
> **완료된 구현분은 분리됨**: §1~§4 의 signal-aware 노드(DB/AI/TC/IE single-turn/Email)·
> frontend canvas 통합·save endpoint auto-reject·통합 테스트, 그리고 §7 ParallelBranchContext
> 핵심 구현(commit `ec0f56e1`)은 [`plan/complete/parallel-p2-followups-done.md`](../complete/parallel-p2-followups-done.md).
> 본 문서는 **e2e·ai-review·user-doc·미구현 signal 전파·§7 잔여 Warning** 만 남긴다.
> 분리 출처: `plan/complete/parallel-p2.md` (본체 7 PR 완료).

## 잔여 항목

### 1. signal-aware 노드 — 미구현 잔여
> 완료: Database·AI Agent·Text Classifier·IE single-turn·Send Email 의 사전 체크/전파 (complete 기록 §1).
- [ ] Information Extractor multi-turn (`runTurnWithCollectionRetries`) — params chain 에 signal 추가 (→ cancel-status 작업에서 함께 처리, `spec-draft-node-execution-cancelled.md`).
- [ ] `NodeExecution.status='cancelled'` 추가 (엔티티 + migration) — **별 plan 구체화됨**: [`spec-draft-node-execution-cancelled.md`](./spec-draft-node-execution-cancelled.md) (옵션 B 확정, V069 migration), `node-cancellation-engine` worktree 구현 중.

### 2~4. e2e 통합 테스트 (묶음 — 별 PR)
> 완료: §2 frontend canvas 배지·§3 backend save reject·§4 단위/통합 테스트 (complete 기록).
- [ ] e2e — 3층 중첩 Parallel 워크플로우의 **canvas 배지 → save 400 reject → runtime reject** 3중 가드 흐름을 실 HTTP server + browser 로 검증. §2/§3/§4 의 e2e 를 한 PR 로 묶어 진행.

### 5. ai-review
- [ ] parallel-p2 + followups 누적 변경(#363~#377)에 대한 `ai-review` — Concurrency / Performance / Security 중심. Critical/Warning 해소 + RESOLUTION.md.

### 6. GRAPH_VALIDATION_FAILED i18n + 사용자 문서 갱신 (ai-review SUMMARY#20)
> **2026-06-02 재범위**: 메시지가 동적 템플릿(`${node.label}` 등)이라 정적 매핑 불가 + `ERROR_KO` 인프라를 spec 이 미정의 상태였음이 드러나, i18n 아키텍처를 선행 spec 으로 분리 정의했다. 구현은 별 plan [`backend-msg-i18n-impl.md`](./backend-msg-i18n-impl.md) 로 이관 — 본 §6 은 그 plan 으로 대체된다.
- [x] (선행 spec) 동적·코드 기반 backend 메시지 localization 정책 — `i18n-userguide.md` Principle 3-C (`ERROR_KO`·`GRAPH_WARNING_KO`·`translateBackendError`/`translateGraphWarning`) + `cross-node-warning-rules.md §3` rule 계약(`params`) 확정.
- [x] (→ `backend-msg-i18n-impl.md`, 완료 `60c01585`) `GRAPH_VALIDATION_FAILED` 한국어 매핑 — i18n 아키텍처가 frontend 로 안착해 `backend-labels.ts:526` `translateBackendError` 매핑으로 구현 (plan 의 backend `ERROR_KO` 신설 위치 문구는 stale, 결과 동등).
- [x] (→ `backend-msg-i18n-impl.md`, 완료 `60c01585`) user-guide MDX(`05-run-and-debug/validation-errors.mdx` + `.en`) graph validation 에러 안내 추가됨.
- [x] (→ `backend-msg-i18n-impl.md`, 완료 `60c01585`) `GET /workflows/:id/graph-warnings` 엔드포인트 존재 확인 (`workflows.controller.ts:111-126`).

### 7. ExecutionContext God Object — ParallelBranchContext 분리: 잔여 Warning
> **핵심 구현 완료** (commit `ec0f56e1`, complete 기록 §7). spec body(`10-parallel.md §Rationale 결정 G`,
> `execution-context.md`)가 본 §7 을 구현 책임 plan 으로 참조 — 아래 잔여가 닫힐 때까지 본 plan 유지.
- [ ] e2e 통합 테스트 회귀 확인 — §2~4 e2e 와 함께 별 PR (본 변경은 런타임 동작 불변·타입 리팩토링이라 단위/통합 그린으로 회귀 잠금됨).

#### ai-review 잔여 Warning (2건, LOW — 별 PR)
> 2026-05-31 ai-review 5-reviewer fan-out 결과 Critical 0. 둘 다 즉각 버그 아님(프로덕션 호출처 1곳이 이미 올바르게 전달). 본 작업 worktree 의 환경 제약으로 검증된 적용이 미뤄짐.
> **2026-06-02 별 PR 로 W-1·W-2 적용 완료.** tsc+jest 검증: lint·unit(5400)·build·e2e(140) 그린. execute() 3-인자 호출처 16곳에 명시 `undefined` 추가(tsc `TS2554` ground-truth 로 전수 확인).
- [x] **W-1**: `ParallelExecutor.execute()` 4번째 인자 `parentParallelConcurrency?: number` 를 `number | undefined`(required)로 강제 → 미래 호출처 누락 시 nested concurrency silent clamp 누락을 컴파일 타임 차단. 단위/통합 테스트 3-인자 호출 16곳에 명시 `undefined` 추가. **검증(tsc+jest) 완료.**
- [x] **W-2**: `execution-engine.service.ts` `branchParentContext: ExecutionContext` 명시 타입 제거(추론 위임) → `ParallelBranchContext` ghost field 은닉 해소.

## 수용 기준 (잔여)
- e2e 통합 테스트로 cancel-others-on-fail + 3층 중첩 reject 잠금
- ai-review Critical/Warning 0

## 의존성·리스크
- DB driver / SDK 의 signal 지원 부재 가능성 — best-effort 컨벤션(`spec/conventions/node-cancellation.md`).
- 멀티턴 AI Agent 의 conversation state 보존과 abort 정합 — 진행 중 turn 만 abort, state 손상 없음 보장.
