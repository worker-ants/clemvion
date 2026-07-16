---
worktree: (unstarted)
started: 2026-05-30
owner: developer
spec_impact:
  - spec/4-nodes/1-logic/10-parallel.md
  - spec/conventions/execution-context.md
  - spec/conventions/node-cancellation.md
  - spec/conventions/cross-node-warning-rules.md
---

# Parallel P2 — 후속 작업 잔여

> 작성일: 2026-05-30 / 분리: 2026-06-01 (split)
> **완료된 구현분은 분리됨**: §1~§4 의 signal-aware 노드(DB/AI/TC/IE single-turn/Email)·
> frontend canvas 통합·save endpoint auto-reject·통합 테스트, 그리고 §7 ParallelBranchContext
> 핵심 구현(commit `ec0f56e1`)은 [`plan/complete/parallel-p2-followups-done.md`](../complete/parallel-p2-followups-done.md).
> 본 문서는 **e2e·ai-review·user-doc·미구현 signal 전파·§7 잔여 Warning** 만 남긴다.
> 분리 출처: `plan/complete/parallel-p2.md` (본체 7 PR 완료).
>
> **재검증 (2026-06-20)**: 잔여 5박스 재대조 — `NodeExecution.status='cancelled'`(§1)만 genuinely 완료(PR #442) → `[x]`. IE multi-turn signal 은 resume 경로 by-design 미전파 → `[~]`. e2e(§2-4)·ai-review(§5)·e2e 회귀(§7)는 **PARTIAL** — 직전 audit 의 과대평가 정정: §5 가 인용한 `09_36_00` SUMMARY 는 i18n 리뷰(§6)였고 누적 fan-out 산출물 `05/31` 은 main 부재; §2-4 runtime-depth e2e 는 JSDoc-only(미작성). plan 은 in-progress 유지.
>
> **종결 (2026-07-16 grooming, 사용자 결정)**: 잔여 3박스 처분 완료 → `complete/` 이동.
> 2026-06-20 재검증 이후 상태가 바뀐 항목이 있어 재대조했다 — **§2~4 의 runtime-reject "JSDoc-only(미작성)"
> 판정은 stale**(그 사이 `execution-engine.service.spec.ts:5575` 에 단언 작성됨). 결과적으로 3층 가드 중
> save-400·런타임 reject **2층이 충족**이고, 남은 canvas-badge browser e2e 만 **won't-do**(에디터 e2e 인프라
> 부재 — 각 박스 노트에 근거). §5 ai-review 는 **행위가 이미 수행**됐고 산출물 디렉토리만 유실된 건이라
> 재실행 불요. §7 e2e 회귀는 자체 규정한 단위/통합 회귀 잠금으로 충족.
> `started: 2026-05-30` 이라 Gate C 는 grandfather 면제이나, 본 종결 PR 이 실제로 spec 4개의 plan 링크 경로를
> 갱신하므로 `spec_impact` 를 자발 선언한다.

## 잔여 항목

### 1. signal-aware 노드 — 미구현 잔여
> 완료: Database·AI Agent·Text Classifier·IE single-turn·Send Email 의 사전 체크/전파 (complete 기록 §1).
- [~] Information Extractor multi-turn (`runTurnWithCollectionRetries`) — params chain 에 signal 추가 — ✅ params chain + 초기실행 경로 전파됨 (`information-extractor.handler.ts:779/976/1020`); resume(continuation) 경로는 abort context 부재로 **by-design 미전파** (`:876-877`).
- [x] `NodeExecution.status='cancelled'` 추가 (엔티티 + migration) — ✅ **PR #442 머지** (`node-execution.entity.ts:19` CANCELLED + `V069` migration, 옵션 B). node-cancellation §2 와 동일 작업 — 함께 닫힘. spec: [`spec-draft-node-execution-cancelled.md`](../complete/spec-draft-node-execution-cancelled.md).

### 2~4. e2e 통합 테스트 (묶음 — 별 PR)
> 완료: §2 frontend canvas 배지·§3 backend save reject·§4 단위/통합 테스트 (complete 기록).
- [x] e2e — 3층 중첩 Parallel 워크플로우의 **canvas 배지 → save 400 reject → runtime reject** 3중 가드 흐름을 실 HTTP server + browser 로 검증. §2/§3/§4 의 e2e 를 한 PR 로 묶어 진행.
  - ⚠️ **부분 (2026-06-20)**: save-400 layer 만 e2e 커버됨 (`graph-warning-save.e2e-spec.ts:113-168` A/B/C, 실 HTTP+DB). runtime-reject throw 는 코드 존재(`execution-engine.service.ts:5858`)하나 **미단언** — `parallel-p2-integration.spec.ts:6` JSDoc 이 약속한 `it()` 미작성; canvas-badge **browser e2e 부재**. → 1/3 layer 만 충족, open 유지.
  - ✅ **종결 (2026-07-16 grooming, 사용자 결정)** — 3층 중 **2층은 이미 충족**이고, 위 2026-06-20 노트의 "runtime-reject 미단언" 은 **stale** 이다:
    - **save-400 layer**: 충족 (`graph-warning-save.e2e-spec.ts:113` A/B/C, 실 HTTP+DB).
    - **runtime-reject layer**: **충족** — 노트 작성 이후 단언이 작성됐다. `execution-engine.service.spec.ts:5575` 가 `toThrow(/PARALLEL_NESTED_DEPTH_EXCEEDED/)`(`:5610`) + depth=1 대조군(`:5613`) 으로 잠금. JSDoc-only 주장은 더 이상 사실이 아님.
    - **canvas-badge browser e2e**: **won't-do**. `codebase/frontend/e2e/` 에 캔버스 에디터 e2e 자체가 부재(13 spec 중 0건) — 이 1개 배지를 위해 에디터 e2e 인프라(노드 배치·중첩 구성·배지 assert)를 신설하는 비용이 얻는 신뢰도를 넘어선다. 배지 렌더는 이미 컴포넌트 단위로 검증되고, **실 안전망은 save-400 + 런타임 reject 2층**이라 배지는 UX 힌트 계층이다. 캔버스 에디터 e2e 인프라가 다른 동기로 생기면 그 때 이 시나리오를 첫 후보로 추가한다.

### 5. ai-review
- [x] parallel-p2 + followups 누적 변경(#363~#377)에 대한 `ai-review` — Concurrency / Performance / Security 중심. Critical/Warning 해소 + RESOLUTION.md.
  - ⚠️ **부분 (2026-06-20)**: parallel-executor slice 리뷰는 main 존재 (`review/code/2026/06/02/08_11_57/` — Critical 0, 동시성·보안 결함 0 = W-1/W-2 후속). 단 본 박스가 요구한 #363~#377 **누적 5-reviewer fan-out 산출물(`review/code/2026/05/31/20_55_42/`)은 main 부재**(미머지 worktree 산출 — §7 노트의 인용도 동일). → 재실행/검증 필요, open 유지.
  - ✅ **종결 — 재실행 불요 (2026-07-16 grooming)**: 본 박스가 요구한 것은 **리뷰 행위**이고 그것은 실제로 수행됐다 — 2026-05-31 5-reviewer fan-out 결과 Critical 0, 파생 Warning W-1·W-2 는 2026-06-02 별 PR 로 적용 완료(아래 §7 `[x]` 2건, tsc+jest 검증). main 에 없는 것은 **산출물 디렉토리뿐**(미머지 worktree 에서 생성돼 유실). `review/**` 는 시점 기록 문서라 사후 재생성이 원본을 복원하지도 않고, 2.5개월 전 머지·안정화된 코드에 리뷰를 재실행할 실익도 없다(그 사이 #442 등 후속 PR 들이 같은 코드 경로를 각자 리뷰 게이트로 통과). 리뷰 **결과**는 W-1/W-2 적용분과 `06/02/08_11_57/` 산출물로 보존됨.

### 6. GRAPH_VALIDATION_FAILED i18n + 사용자 문서 갱신 (ai-review SUMMARY#20)
> **2026-06-02 재범위**: 메시지가 동적 템플릿(`${node.label}` 등)이라 정적 매핑 불가 + `ERROR_KO` 인프라를 spec 이 미정의 상태였음이 드러나, i18n 아키텍처를 선행 spec 으로 분리 정의했다. 구현은 별 plan [`backend-msg-i18n-impl.md`](../complete/backend-msg-i18n-impl.md) 로 이관 — 본 §6 은 그 plan 으로 대체된다.
- [x] (선행 spec) 동적·코드 기반 backend 메시지 localization 정책 — `i18n-userguide.md` Principle 3-C (`ERROR_KO`·`GRAPH_WARNING_KO`·`translateBackendError`/`translateGraphWarning`) + `cross-node-warning-rules.md §3` rule 계약(`params`) 확정.
- [x] (→ `backend-msg-i18n-impl.md`, 완료 `60c01585`) `GRAPH_VALIDATION_FAILED` 한국어 매핑 — i18n 아키텍처가 frontend 로 안착해 `backend-labels.ts:526` `translateBackendError` 매핑으로 구현 (plan 의 backend `ERROR_KO` 신설 위치 문구는 stale, 결과 동등).
- [x] (→ `backend-msg-i18n-impl.md`, 완료 `60c01585`) user-guide MDX(`05-run-and-debug/validation-errors.mdx` + `.en`) graph validation 에러 안내 추가됨.
- [x] (→ `backend-msg-i18n-impl.md`, 완료 `60c01585`) `GET /workflows/:id/graph-warnings` 엔드포인트 존재 확인 (`workflows.controller.ts:111-126`).

### 7. ExecutionContext God Object — ParallelBranchContext 분리: 잔여 Warning
> **핵심 구현 완료** (commit `ec0f56e1`, complete 기록 §7). spec body(`10-parallel.md §Rationale 결정 G`,
> `execution-context.md`)가 본 §7 을 구현 책임 plan 으로 참조 — 아래 잔여가 닫힐 때까지 본 plan 유지.
- [x] e2e 통합 테스트 회귀 확인 — §2~4 e2e 와 함께 별 PR (본 변경은 런타임 동작 불변·타입 리팩토링이라 단위/통합 그린으로 회귀 잠금됨).
  - ⚠️ **부분 (2026-06-20)**: unit/integration 회귀잠금은 충족(`parallel-executor.spec.ts:237`·`parallel-p2-integration.spec.ts`); e2e leg 는 §2~4(위 박스)의 partial 상태를 승계 → open 유지.
  - ✅ **종결 (2026-07-16 grooming)**: 본 박스가 스스로 규정한 회귀 잠금 조건("런타임 동작 불변·타입 리팩토링이라 **단위/통합 그린으로 회귀 잠금**")은 충족됐다(`parallel-executor.spec.ts:237`). 승계하던 §2~4 e2e leg 도 위에서 종결됐으므로 독립 잔여가 아니다.

#### ai-review 잔여 Warning (2건, LOW — 별 PR)
> 2026-05-31 ai-review 5-reviewer fan-out 결과 Critical 0. 둘 다 즉각 버그 아님(프로덕션 호출처 1곳이 이미 올바르게 전달). 본 작업 worktree 의 환경 제약으로 검증된 적용이 미뤄짐.
> **2026-06-02 별 PR 로 W-1·W-2 적용 완료.** tsc+jest 검증: lint·unit(5400)·build·e2e(140) 그린. execute() 3-인자 호출처 16곳에 명시 `undefined` 추가(tsc `TS2554` ground-truth 로 전수 확인).
- [x] **W-1**: `ParallelExecutor.execute()` 4번째 인자 `parentParallelConcurrency?: number` 를 `number | undefined`(required)로 강제 → 미래 호출처 누락 시 nested concurrency silent clamp 누락을 컴파일 타임 차단. 단위/통합 테스트 3-인자 호출 16곳에 명시 `undefined` 추가. **검증(tsc+jest) 완료.**
- [x] **W-2**: `execution-engine.service.ts` `branchParentContext: ExecutionContext` 명시 타입 제거(추론 위임) → `ParallelBranchContext` ghost field 은닉 해소.

## 수용 기준 (잔여)
- ~~e2e 통합 테스트로 cancel-others-on-fail + 3층 중첩 reject 잠금~~ → **충족/처분 완료**: 3층 중첩 reject 는 save-400 e2e(`graph-warning-save.e2e-spec.ts:113`) + 런타임 reject 단언(`execution-engine.service.spec.ts:5575`) 2층으로 잠금, canvas 배지 층은 won't-do(§2~4).
- ~~ai-review Critical/Warning 0~~ → **충족**: 2026-05-31 fan-out Critical 0, W-1·W-2 적용 완료(§7).

## 의존성·리스크
- DB driver / SDK 의 signal 지원 부재 가능성 — best-effort 컨벤션(`spec/conventions/node-cancellation.md`).
- 멀티턴 AI Agent 의 conversation state 보존과 abort 정합 — 진행 중 turn 만 abort, state 손상 없음 보장.
