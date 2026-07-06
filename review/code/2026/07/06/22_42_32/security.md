# 보안(Security) Review

## 리뷰 대상
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (ModuleRef 지연 해석, 재개 세그먼트 dispatch 추가)
- `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts` (docstring만)
- `codebase/backend/src/modules/notifications/entities/notification.entity.ts` (`background_run_id` → `select: false`)
- `codebase/backend/src/modules/notifications/notifications.service.spec.ts` (신규 unit 3건)
- `codebase/backend/src/modules/notifications/notifications.service.ts` (JSDoc만)
- `plan/in-progress/*.md`, `review/code/2026/07/06/21_23_13/*` (문서/이전 리뷰 산출물, 코드 아님)

## 발견사항

- **[INFO]** `select: false` 적용으로 `background_run_id` REST 미노출 의도가 실제로 강제됨 (이전 리뷰 WARNING #1 해소 확인)
  - 위치: `codebase/backend/src/modules/notifications/entities/notification.entity.ts:330-335`
  - 상세: 이전 세션(21_23_13) 리뷰의 requirement WARNING #1 — "REST 미노출 의도가 주석에만 있고 실제 직렬화 방어가 없다" — 를 `@Column({ ..., select: false })` 로 코드 레벨에서 강제했다. 검증한 결과: (1) `findAll`(`createQueryBuilder('n')`), `markAsRead`(`repository.findOne`), `getUnreadCount`(`repository.count`) 등 표준 조회 경로는 모두 `addSelect`/`select` 오버라이드 없이 기본 컬럼셋을 사용하므로 `select:false` 가 정상 적용되어 SELECT 결과에서 배제된다. (2) `findByBackgroundRun` 자체는 WHERE 절만 사용하므로 `select:false` 와 무관하게 동작(주석대로). (3) `emitNew()`(WS emit)는 필드를 명시적으로 화이트리스트(`id/type/title/message/resourceType/resourceId`)해 전송하므로 `save()` 반환 객체에 메모리상 남아있는 `backgroundRunId` 값이 WS 페이로드로 흘러가지 않음. (4) `NotificationDto`(REST 응답 DTO)에도 애초에 `backgroundRunId` 필드가 없어 이중 방어. 결과적으로 컬럼 레벨 차단 + DTO 화이트리스트 + WS 화이트리스트 3중 방어로 최소노출 원칙이 실질적으로 강제됨.
  - 제안: 없음 — 조치 적절.

- **[WARNING]** `execution_failed` 알림 메시지에 원본 예외 메시지가 새니타이징 없이 그대로 인앱/이메일로 노출되며, 본 커밋으로 실제 발사 경로가 새로 열림
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2473`(`errMessage = error instanceof Error ? error.message : String(error)`), `:2507`(`dispatchExecutionFailedNotification(savedExecution, errMessage)`), `:4491`(`message: \`워크플로우 "${workflow.name}" 실행이 실패했어요: ${message}\``, channel: `'both'` — 인앱+이메일)
  - 상세: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts`의 `sanitizeErrorMessage()`(스택트레이스 제거, connection-string 정규식 redact, 500자 truncate)와 대비된다 — background 경로는 이미 원본 에러 메시지를 신뢰할 수 없는 값으로 간주해 방어 처리를 하지만, `execution-engine.service.ts`의 top-level `execution_failed` 경로(`runExecution` catch 및 신규 `finalizeResumedExecutionOutcome` 분기)는 동일한 새니타이징이 없다. 이번 커밋의 버그 B 수정(ModuleRef 지연 해석)과 버그 A 수정(재개 세그먼트 dispatch 추가) 이전에는 `notificationsService` 가 항상 undefined 라 dispatch 자체가 no-op 이었으므로 이 노출 경로는 사실상 죽어 있었다 — 본 커밋이 그 경로를 실제로 "살리는" 첫 커밋이다. 워크플로우 노드(HTTP 요청, DB 커넥터, 스크립트 실행 등)의 예외 메시지에 내부 호스트명·연결 문자열·파일 경로·타 사용자 데이터 일부가 우발적으로 담길 수 있는 노드 타입이 존재한다면, 이 값이 이메일(SMTP 로 외부 발송, best-effort)과 인앱 알림에 그대로 실려 워크스페이스 소유자·실행자에게 노출된다. 수신자가 `workflow.createdBy`/`execution.executedBy` 로 제한되어 권한 없는 제3자 노출은 아니지만(인가 문제는 아님), 정보 노출 최소화(민감 정보의 에러 메시지 노출) 관점의 방어 심도 결여.
  - 제안: `background-execution.processor.ts` 의 `sanitizeErrorMessage()` 를 공용 유틸로 추출해 `execution-engine.service.ts` 의 `dispatchExecutionFailedNotification` 호출 전에도 동일하게 적용 권장. 최소한 connection-string 패턴 redact 와 길이 캡만이라도 통일하면 방어 심도가 개선됨.

- **[INFO]** `findByBackgroundRun` 은 workspace 스코프 없는 쿼리이나, 현재 유일한 호출 경로에서 상위 인가 검증이 유지됨 (IDOR 아님, 회귀 없음)
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:53-58`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:93`(`verifyExecutionAccess`)→`:396-404`(`findByBackgroundRun` 호출)
  - 상세: `findByBackgroundRun(backgroundRunId)` 자체는 `WHERE background_run_id = ?` 만으로 조회하며 workspace/user 소유권 필터가 없다. 그러나 이번 diff 는 이 메서드의 신규 코드가 아니라 unit 테스트 3건만 추가한 것이며, 실제 호출부(`background-runs.service.ts`)는 `verifyExecutionAccess(executionId, userWorkspaceId)` 를 먼저 통과해야만 `backgroundRunId` 에 도달하는 구조를 그대로 유지한다(변경 없음). 이전 리뷰(21_23_13/SUMMARY.md)에서도 이미 "IDOR 아님"으로 결론난 사안이며 본 diff 로 인한 변화 없음 — 확인 차 재기재.
  - 제안: 없음 (참고). 향후 `findByBackgroundRun` 이 다른 컨텍스트에서 재사용될 경우, 메서드 자체에 workspace 스코프가 없다는 점을 호출자가 반드시 인지해야 함 — JSDoc 에 "호출자가 인가 검증 책임" 명시를 권장(현재도 일부 서술 있음).

- **[INFO]** `getNotificationsService()` 의 `ModuleRef.get(..., { strict: false })` 지연 해석과 `try/catch` 무시(swallow)는 보안 결함이 아니며 fail-safe(no-op) 로 적절히 설계됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:97-110`
  - 상세: `ModuleRef.get` 실패 시 `catch { svc = undefined; }` 로 조용히 삼키고 캐시(`resolvedNotificationsService`)에 `null` 을 저장해 이후 호출은 항상 `undefined` 를 반환한다. 알림 발사는 "best-effort" 로 명시된 기능이며(주석·spec §1.1), 이 경로의 실패가 실행 성공/실패 판정이나 인가 로직에 영향을 주지 않으므로 예외를 삼켜도 보안·무결성 리스크는 없다. 다만 `catch` 블록에서 에러를 로깅하지 않아 운영 시 "왜 알림이 안 나가는지" 진단이 어려울 수 있다(가용성/운영 관점, 보안 등급 아님).
  - 제안: 없음(보안 관점). 참고로 `catch` 블록에 `this.logger.debug` 정도의 로그를 남기면 향후 유사한 "미발사 버그"(버그 B와 같은 패턴) 재발 시 조기 발견에 도움이 될 수 있음(side_effect/observability 리뷰어 영역에 더 적합).

- **[INFO]** 하드코딩된 시크릿·인젝션 취약점·안전하지 않은 암호화·인증 우회 없음
  - 위치: 전체 diff
  - 상세: 이번 diff 는 (1) DI 해석 패턴 변경(ModuleRef), (2) 알림 dispatch 호출 배선 추가, (3) 컬럼 메타데이터(`select:false`) 추가, (4) JSDoc/테스트/plan 문서 갱신으로 구성되며, 사용자 입력을 직접 SQL/커맨드/경로에 조립하는 신규 코드가 없다. 모든 TypeORM 호출은 파라미터 바인딩(`where: {...}`, `:paramName`)을 사용하며 문자열 결합 기반 쿼리 없음. API 키/토큰/비밀번호 등 시크릿 리터럴 없음.
  - 제안: 없음.

## 요약
이번 커밋은 알림 파이프라인 PR3 의 선존 결함 2건(재개 세그먼트 dispatch 누락, ModuleRef 순환 인스턴스화로 인한 notificationsService undefined)을 수정하고, 직전 리뷰 세션(21_23_13)의 WARNING #1(`select:false` 미노출 강제)을 코드 레벨로 반영한 변경이다. 신규 인젝션·인가 우회·하드코딩 시크릿은 없으며, `background_run_id` 미노출은 컬럼 차단 + DTO 화이트리스트 + WS 화이트리스트 3중 방어로 실질적으로 강제됨을 확인했다. 다만 이번 커밋이 처음으로 `execution_failed` top-level 알림의 재개 세그먼트 발사 경로를 실제로 "살리면서", background 경로에는 있는 에러 메시지 새니타이징(`sanitizeErrorMessage` — 스택트레이스/연결 문자열 redact·길이 캡)이 top-level 경로에는 없다는 방어 심도 격차가 새로 실질적 의미를 갖게 되었다 — 이는 이번 diff 가 유발한 신규 결함이 아니라 기존에 죽어있던 코드 경로가 살아나며 노출된 pre-existing 격차이므로 WARNING 으로 분류한다.

## 위험도
LOW
