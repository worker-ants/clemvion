# 보안(Security) 리뷰 — orphan pending backstop (fresh re-review, doc/comment fixes)

## 리뷰 범위

- `CHANGELOG.md` — Unreleased 항목 추가 (문서)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — JSDoc/인라인 주석 보강만 (`recoverStuckExecutions` 헤더, `runStuckRecoveryScan` 헤더, `recoverOrphanPendingExecutions` 인덱스 정당화 주석). **로직/쿼리/제어흐름 변경 없음**.
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 신규 유닛 3건(이전 세션에서 이미 반영, 이번 diff 에 재확인 대상으로 포함)
- `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` — 헤더 주석 2줄 추가((3)(4) 시나리오 목록) + 신규 e2e 2건
- `plan/in-progress/exec-intake-followups.md`, `plan/in-progress/orphan-pending-backstop.md`, `review/code/2026/07/04/22_12_26/*` — 계획/리뷰 산출물(문서, 코드 아님)

이전 세션(`review/code/2026/07/04/22_12_26/security.md`, 대상 커밋 `2014421e5`)에서 이미 동일 기능(`recoverOrphanPendingExecutions`, `markQueueWaitTimeout` 재사용, test-hook 엔드포인트 인가)을 전수 검토해 위험도 NONE 으로 종결했다. 이번 diff(`2014421e5` → `d55d3f59d`, 커밋 `refactor(06-concurrency): orphan pending ai-review 조치`)를 코드 레벨로 대조한 결과 실제 변경은 다음으로 한정된다:

1. `recoverStuckExecutions` JSDoc 헤더에 orphan pending 회수 책임 문구 추가.
2. `runStuckRecoveryScan` JSDoc 헤더에 §8 orphan pending cancel 트리거 명시 추가.
3. `recoverOrphanPendingExecutions` 내부 `find()` 호출 위에 `(status, queued_at)` 복합 인덱스 미추가에 대한 정당화 인라인 주석 추가(database WARNING 조치).
4. `CHANGELOG.md` Unreleased 섹션 항목 추가.
5. e2e 스펙 파일 헤더 주석에 시나리오 (3)(4) 목록 추가.

쿼리 조건, 파라미터 바인딩, 인가 게이팅, 에러 처리, 로깅 대상 등 보안에 영향을 주는 어떤 실행 경로도 변경되지 않았다.

## 발견사항

- **[INFO]** 순수 문서/주석 변경 — 신규 보안 표면 없음
  - 위치: `execution-engine.service.ts` (`recoverStuckExecutions`/`runStuckRecoveryScan` JSDoc, `recoverOrphanPendingExecutions` 인라인 주석), `CHANGELOG.md`, `execution-concurrency-cap.e2e-spec.ts` 헤더 주석
  - 상세: 위 5개 변경 모두 JSDoc/inline comment/Markdown 텍스트이며 컴파일된 실행 코드(쿼리 조건, WHERE 절, 파라미터, 인가 데코레이터, 에러 처리)에 어떤 영향도 주지 않는다. `git diff 2014421e5 HEAD -- execution-engine.service.ts`로 직접 대조해 로직 라인 변경이 없음을 확인했다.
  - 제안: 없음.

- **[INFO]** 이전 세션 검토 결론 유효성 재확인
  - 위치: `execution-engine.service.ts:2916-2930`(`recoverOrphanPendingExecutions`, `find()` where 절), `markQueueWaitTimeout`(변경 없음)
  - 상세: `status: ExecutionStatus.PENDING`, `queuedAt: LessThan(staleThreshold)` 는 TypeORM 이 파라미터 바인딩하는 typed 조건이며 사용자 입력을 받지 않는다(`staleThreshold` 는 서버 `Date.now()` 기반 계산값). `markQueueWaitTimeout` 의 named-parameter UPDATE(`WHERE id=:id AND status=:pending`)도 변경 없음. 이 diff 로 인해 새로 검토가 필요한 실행 경로는 없다.
  - 제안: 없음.

- **[INFO]** test-hook 엔드포인트 인가 게이팅 — 본 diff 범위 밖, 무변경 재확인
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:212-222` (`POST /_test/recover-stuck-executions`) — 이번 diff 의 변경 대상 아님
  - 상세: `NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` 이중 게이팅 + `@Roles('owner')` 는 이전 세션에서 확인한 그대로 무변경. e2e 헬퍼(`recoverStuck`)도 동일 엔드포인트를 재사용할 뿐 신규 라우트를 추가하지 않는다.
  - 제안: 없음.

## 요약

이번 재검토 대상 diff 는 직전 ai-review 에서 지적된 database/documentation WARNING 을 해소하기 위한 JSDoc·인라인 주석·CHANGELOG 보강뿐이며, `recoverOrphanPendingExecutions`/`markQueueWaitTimeout`/test-hook 인가 로직 등 실제 실행 코드는 이전 세션(`22_12_26`, 위험도 NONE 종결) 대비 변경이 없다. 쿼리는 여전히 TypeORM 파라미터 바인딩(`LessThan`, named parameter UPDATE)만 사용해 SQL 인젝션 여지가 없고, 신규 HTTP 표면·하드코딩 시크릿·인가 우회·민감정보 노출 경로가 발견되지 않았다.

## 위험도

NONE

STATUS: SUCCESS
