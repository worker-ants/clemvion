# 보안(Security) 리뷰 — PR3 크래시/재시작 RUNNING 세그먼트 제어된 re-drive

대상 커밋: `11c7b2ff5 feat(execution-engine): PR3 크래시/재시작 RUNNING 세그먼트 제어된 re-drive (§7.5 case B)`

## 발견사항

- **[WARNING]** `_test/recover-stuck-executions` 엔드포인트가 workspace 범위를 갖지 않고 전역(全 workspace) 복구 스캔을 트리거하며, `@Roles()` 없이 인증만 요구한다
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:198-213` (`triggerStuckRecoveryForTest`)
  - 상세: 새 엔드포인트는 `NODE_ENV !== 'test'` 이면 404 를 던져 프로덕션 이미지(Dockerfile `ENV NODE_ENV=production`)에서는 사실상 비활성이다. 그러나 게이팅이 뚫리는 경우(예: 운영자가 실수로 `NODE_ENV=test` 를 프로덕션/스테이징에 설정하는 배포 오구성, 혹은 향후 이 컨트롤러가 다른 env 값 조건으로 재작성될 때) 이 라우트는 JWT 인증만 요구하고 `@Roles(...)` 데코레이터가 없어 **임의의 인증된 사용자**(워크스페이스 멤버십·역할 무관)가 시스템 전역의 `recoverStuckExecutions()`를 트리거할 수 있다. 이 함수는 `WorkspaceId` 필터가 전혀 없이 전 워크스페이스의 stale RUNNING Execution 을 re-claim/재구동한다 — 다른 조직의 실행에 대해 강제 재구동(부작용 노드의 at-least-once 재실행 포함, §7.3 Rationale 이 명시)을 유발할 수 있는 잠재적 조작 표면이다. 같은 파일의 다른 라우트들은 `@Roles('editor')` 등으로 최소 권한을 명시하는 관례(예: 인접 `re-run` 라우트)가 있는데 반해 이 라우트만 예외.
  - 제안: (1) 이 라우트가 정말 test 환경 전용이라면 `NODE_ENV` 게이트에 더해 `@Roles('admin')` 등 최소한의 권한 상수도 함께 걸어 두어 "게이팅 실패 시에도 인가가 이중으로 보호"되게 하는 defense-in-depth 를 권장. (2) e2e 환경이 컨테이너 네트워크 내부(`backend-e2e`)에서만 접근 가능함을 인프라 수준(네트워크 격리)에서도 재확인해 둘 것. (3) 코드 주석에 이미 "PR4 관측성으로 별도 검토" 라 명시돼 있으므로, 운영용 on-demand 트리거를 도입할 PR4 시점에는 반드시 role/scope 검증을 추가할 것을 이번 리뷰에서 명시적으로 남겨 둔다.

- **[INFO]** 신규 `_test/*` 엔드포인트 네이밍 컨벤션 최초 도입 — 향후 유사 test-only 백도어 라우트 증식 시 감사 필요
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:205`
  - 상세: 코드베이스 전체에 `_test/` prefix 라우트가 이번이 최초(`grep` 결과 다른 선례 없음). `NODE_ENV==='test'` 자체는 `throttler-skip.ts` 등에서 이미 쓰이는 패턴이라 신규 위험 패턴은 아니나, 이런 라우트가 늘어날 경우 프로덕션 라우트 테이블에 dead code 형태로 계속 등록되므로(단지 핸들러 진입 시 404) 라우트 목록/Swagger 노출 여부를 주기적으로 점검할 필요가 있다. `@ApiExcludeEndpoint()` 로 Swagger 문서에서는 제외되어 있어 API 문서를 통한 발견 표면은 차단됨 — 이 부분은 적절히 처리됨.
  - 제안: 특별한 조치 불요. 향후 PR4(운영용 on-demand recovery trigger) 도입 시 이 raw 패턴을 그대로 프로덕션 라우트로 승격하지 않도록 주의(반드시 role/scope 재설계).

- **[INFO]** 원자 재구동(re-claim) SQL 은 파라미터 바인딩·raw 함수 리터럴만 사용 — 인젝션 위험 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `reclaimStuckRunningExecution` (`.set({ startedAt: () => 'NOW()' })`, `.where('status = :status', ...)`, `.andWhere('started_at < :threshold', ...)`)
  - 상세: `() => 'NOW()'` 는 TypeORM 의 raw SQL 함수 리터럴 문법으로 사용자 입력이 섞이지 않는 고정 문자열이며, 나머지 조건절은 모두 named parameter 바인딩. e2e 테스트(`execution-crash-redrive.e2e-spec.ts`)의 `pg` 직접 쿼리들도 전부 `$1,$2` 파라미터 바인딩을 사용해 SQL 인젝션 표면이 없다.
  - 제안: 조치 불요 (양호).

- **[INFO]** 에러 메시지/스택 미노출 — HTTP 응답 경로에 내부 예외 텍스트가 새지 않음
  - 위치: `execution-engine.service.ts` `redriveStuckExecution` catch 블록, `markExecutionCancelled`, `executions.controller.ts` `triggerStuckRecoveryForTest`
  - 상세: 신규 컨트롤러 메서드는 내부 예외와 무관하게 항상 `{ success: true }` 를 반환(202 Accepted, fire-and-forget)하고, 재구동 실패는 `this.logger.error`/`this.logger.warn` 으로만 서버 로그에 남는다. `markExecutionCancelled` 가 DB 에 기록하는 `error.message` 도 원본 exception message 가 아니라 사전 정의된 `resumeErrorMessage(code)` 상수를 사용해 내부 구현 세부(스택트레이스, DB 컬럼명 등)가 클라이언트로 노출되지 않는다.
  - 제안: 조치 불요 (양호).

- **[INFO]** 크래시 재구동의 at-least-once 재실행 semantics 는 스펙에 명시적으로 기록된 의도된 트레이드오프
  - 위치: `plan/in-progress/spec-draft-crash-running-redrive.md` Δ3/Δ5, `execution-engine.service.ts` `driveStuckRedrive` 주석
  - 상세: 크래시 시점에 RUNNING 이던(미완료) 노드는 재구동 시 재실행되며, Integration 노드의 외부 side-effect(예: 이메일 발송, 외부 HTTP POST) 가 중복 발생할 수 있음을 스펙이 명시적으로 인정하고 "멱등성은 노드 설정 책임"으로 위임한다. 이는 보안 취약점이라기보다 설계상 트레이드오프이나, 만약 그러한 side-effect 가 결제·인증 상태 변경 등 민감한 작업이라면 별도 idempotency-key 강제가 필요하다는 점을 인지하고 있어야 한다.
  - 제안: 현재 범위에서는 조치 불요. 향후 결제/보안 민감 Integration 노드 도입 시 idempotency 강제를 별도 검토할 것.

## 요약

이번 변경은 실행 엔진의 크래시/재시작 복구 로직을 "일괄 FAILED 마킹"에서 "원자 re-claim 후 rehydration 기반 재구동"으로 전환하는 내부 로직 리팩터링이며, SQL 인젝션·하드코딩 시크릿·안전하지 않은 암호화·에러 메시지 정보 노출 등 전통적 OWASP Top 10 카테고리에서는 특별한 문제가 발견되지 않았다(파라미터 바인딩 일관 사용, 사전 정의 에러 메시지만 노출). 가장 주목할 지점은 e2e 검증을 위해 신설된 `_test/recover-stuck-executions` 엔드포인트로, `NODE_ENV==='test'` 게이팅에 의해 프로덕션 이미지에서는 비활성이지만 `@Roles()` 권한 검증이 전혀 없고 workspace 범위도 없는 전역 트리거라는 점에서 게이팅 실패/배포 오구성 시나리오에 대한 방어가 얕다 — 다만 실제 위험은 "정상 프로덕션 배포에서는 도달 불가"라는 전제에 크게 의존하므로 심각도는 낮게 평가한다. 전반적으로 이 PR 자체가 신규 인증/인가 우회나 데이터 노출 경로를 도입하지는 않았다고 판단한다.

## 위험도

LOW
