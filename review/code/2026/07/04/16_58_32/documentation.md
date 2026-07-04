# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** spec §8 본문 요약 라인이 "enforcement 구현 후속"이라고 stale 표기 — 실제로는 본 PR이 그 enforcement
  - 위치: `spec/5-system/4-execution-engine.md` L379, L1071, L1075-L1076, L1085, L1087 (예: "— **PR2b(정책 정의 완료, enforcement 구현 후속)**")
  - 상세: 본 diff 는 `admitExecutionOrDefer`/`markQueueWaitTimeout`(execution-engine.service.ts), `resolveConcurrencyCap`/`resolveQueueWaitTimeoutMs`(execution-limits.ts), `V104` 마이그레이션, `.env.example` 항목, DTO 필드, unit/e2e 테스트까지 포함한 **enforcement 코드 자체**다. 그런데 spec 본문 상단 "구현 상태" 콜아웃(L379)과 §8 표(L1071, L1075-76)·불릿(L1085, L1087)은 여전히 "PR2b 는 정책 정의만 완료, enforcement 는 후속 developer PR" 이라고 적혀 있다. 반면 같은 파일의 새 Rationale 섹션(L1528 "### 동시성 cap admission gate — consumer-side + cancelled(timeout) (PR2b, 2026-07-04)")은 이미 구현 세부(TOCTOU 원자화, `queued_at` 컬럼 등)를 기정사실처럼 서술해 본문과 Rationale 간 시제가 어긋난다.
  - 제안: PR 머지 시점에 본문 콜아웃/표/불릿의 "PR2b(정책 정의 완료, enforcement 구현 후속)" 문구를 "PR2b 구현 완료"로 갱신해 §4.1 콜아웃(PR2a/PR4 선례와 동일 패턴)과 정합시킨다. 이 갱신을 놓치면 후속 독자가 "cap 이 아직 미시행"으로 오인해 회귀 조사에 혼선을 준다.

- **[WARNING]** `GET /workspaces/:id/settings` 응답에 `maxConcurrentExecutions` 미노출 — write-only 설정 필드, Swagger 설명도 stale
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `getWorkspaceSettings()` (반환 타입 `{ interactionAllowedOrigins: string[]; timezone?: string }`), `codebase/backend/src/modules/workspaces/workspaces.controller.ts` `getSettings()` 의 `@ApiOperation({ description: '... interactionAllowedOrigins)만 반환합니다 ...' })`
  - 상세: `updateWorkspaceSettings()`(PATCH)는 `dto.maxConcurrentExecutions` 를 `workspace.settings` 에 병합해 저장하지만, `getWorkspaceSettings()`(GET)의 리턴 객체·타입 시그니처는 여전히 `interactionAllowedOrigins`/`timezone` 만 선언한다. 즉 admin 이 cap 을 설정해도 설정 조회 API/문서로는 값을 되읽을 수 없다. 컨트롤러의 `ApiOperation.description` 도 "현재는 ... interactionAllowedOrigins 목록만 반환합니다" 라고 적혀 있어 이미 `timezone` 반환과도 어긋나 있었고, 이번 `maxConcurrentExecutions` 추가로 stale 도가 더 커졌다.
  - 제안: 문서화 관점 최소 조치로 (a) `getWorkspaceSettings` 의 JSDoc/리턴 타입 주석에 "`maxConcurrentExecutions` 는 read 미노출(write-only, 후속)"임을 명시하거나, (b) 코드 리뷰어(로직 담당)에게 GET 응답에도 필드를 포함할지 확인 요청. 어느 쪽이든 컨트롤러의 `ApiOperation.description` 문구를 현재 반환 필드 목록과 일치시켜야 한다.

- **[INFO]** `runExecution` 의 `alreadyRunning` 3번째 파라미터 — JSDoc 주석은 있으나 파라미터 자체엔 `@param` 부재
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `private async runExecution(savedExecution, input, alreadyRunning = false)`
  - 상세: 인라인 주석("PR2b — 큐 경로의 admission gate 가 이미 pending→running 전이 ...")은 정확하고 충분하지만, 메서드 앞에 정식 JSDoc 블록이 없어 `@param alreadyRunning` 설명이 IDE hover 등에서 바로 노출되지 않는다. `admitExecutionOrDefer`/`markQueueWaitTimeout` 은 이미 정식 JSDoc 블록을 갖췄다.
  - 제안: 사소한 사항이라 필수는 아니나, 일관성을 위해 `runExecution` 에도 최소 한 줄 JSDoc 블록으로 승격 고려. 차단 사유 아님.

- **[INFO]** `execution.entity.ts` 의 `queuedAt` 컬럼 주석 vs migration 코멘트 — 내용은 정확히 일치, 이중 서술
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts` L1778-1786 vs `codebase/backend/migrations/V104__execution_queued_at.sql`
  - 상세: 두 곳의 주석이 "queued_at 은 started_at 과 별개 — recoverStuckExecutions stale 판정과 충돌 방지" 라는 동일 근거를 각각 서술한다. 정확성 문제는 없으며 오히려 각 파일 단독 열람 시에도 맥락이 파악되는 장점이 있다 — 수정 불요, 참고용으로만 기록.

## 요약

이번 PR은 신규 env 변수(`EXECUTION_QUEUE_WAIT_TIMEOUT_MS`)·DB 컬럼(`queued_at`)·DTO 필드(`maxConcurrentExecutions`)·핵심 admission-gate 로직에 대해 코드 인접 주석(JSDoc, 마이그레이션 헤더, `.env.example`)을 상당히 꼼꼼하게 갖췄고 spec Rationale 섹션도 신설했다. 다만 두 가지 실질적 갭이 있다: (1) spec 본문의 "구현 상태" 요약 라인들이 여전히 "enforcement 후속"으로 남아 있어 이번 PR이 그 enforcement 자체라는 사실과 어긋나며 코드-스펙 정합성 관점에서 갱신이 필요하고, (2) 신규 write-only `maxConcurrentExecutions` 설정이 GET 설정-조회 API의 반환 타입·Swagger 설명에는 반영되지 않아 API 문서가 실제 쓰기/읽기 비대칭을 감추고 있다. 둘 다 차단 수준은 아니지만 다음 PR 또는 동일 PR 내 후속 커밋에서 정리하는 것을 권장한다.

## 위험도
LOW
