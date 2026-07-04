# 보안(Security) Review

## 발견사항

- **[INFO]** admission gate raw SQL 은 파라미터 바인딩으로 인젝션 안전
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2646-2660` (`admitExecutionOrDefer` 내 `m.query(...)` UPDATE·`pg_advisory_xact_lock`)
  - 상세: `admitExecutionOrDefer`가 raw SQL(`UPDATE execution SET ... WHERE id = $1 AND ...`, `SELECT pg_advisory_xact_lock(hashtext($1))`)을 직접 실행하지만, 모든 가변 값(`executionId`, `workspaceId`, `wsCap`, `workflowId`, `wfCap`, `lockKey`)이 `$1..$n` 포지셔널 파라미터로 바인딩되어 문자열 concatenation 이 없다. `lockKey`(`exec-cap:${workspaceId ?? execution.workflowId}`)도 값 자체가 아니라 `hashtext()` 인자로 파라미터 전달되므로 SQL 인젝션 경로 없음. `markQueueWaitTimeout`(같은 파일 약 2550행)의 `createQueryBuilder().where('id = :id', ...)` 도 TypeORM 파라미터 바인딩 사용. 문제 없음, 참고 목적으로만 기록.

- **[INFO]** 신규 워크스페이스 설정 필드(`maxConcurrentExecutions`)의 입력 검증·인가 적절
  - 위치: `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts:44-59`, `codebase/backend/src/modules/workspaces/workspaces.service.ts:311-362` (`updateWorkspaceSettings` → `assertAdmin`), `codebase/backend/src/modules/workspaces/workspaces.controller.ts:144-175`(PATCH), `:177-199`(GET)
  - 상세: `UpdateWorkspaceSettingsDto.maxConcurrentExecutions`에 `@IsOptional() @IsInt() @Min(1)`이 적용되어 비정수·음수·문자열 등은 class-validator 단계에서 400 거부된다. 서비스단 `resolveConcurrencyCap`(execution-limits.ts:56-64)도 `typeof raw === 'number' && Number.isInteger(raw) && raw > 0` 방어를 이중으로 두어 legacy/손상 데이터에도 안전 fallback한다. 쓰기(PATCH)는 `assertAdmin`(Admin+ 역할 검증)을 거치고, 읽기(GET)는 `getMemberRole` 로 멤버 여부만 확인 — 최소권한 원칙에 부합하는 read/write 비대칭 인가로 문제 없음. 다른 워크스페이스의 cap 을 조회/변경할 수 없음(workspaceId 는 자신이 멤버인 워크스페이스로 스코프됨, `getMemberRole(workspaceId, userId)` 확인).

- **[INFO]** 큐 대기 타임아웃 취소 경로의 에러 메시지에 민감정보 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2545-2596` (`markQueueWaitTimeout`)
  - 상세: 클라이언트에 emit 되는 `error = { code: 'EXECUTION_QUEUE_WAIT_TIMEOUT', message: 'Execution cancelled: queue wait time exceeded' }`는 고정 문자열로 내부 스택트레이스·DB 세부사항·SQL 등을 노출하지 않는다. catch 블록의 `logger.error`/`logger.warn` 도 서버 로그에만 기록되고 클라이언트 응답에는 섞이지 않는다.

- **[INFO]** `.env.example` 신규 항목은 시크릿이 아닌 설정값
  - 위치: `codebase/backend/.env.example:204-208` (`EXECUTION_QUEUE_WAIT_TIMEOUT_MS=300000`)
  - 상세: 정수 타임아웃 설정값이며 API 키·비밀번호·커넥션스트링 등 secret-shape 값이 아니다. `docker-compose.e2e.yml`에 추가된 `EXECUTION_QUEUE_WAIT_TIMEOUT_MS: "8000"` 도 동일하게 비-시크릿 설정값.

- **[INFO]** 동시성 cap 자체가 일종의 DoS 방어 기능이며 이번 변경으로 강화됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-limits.ts:38-64`, `execution-engine.service.ts:2609-2665`
  - 상세: workspace/workflow 별 동시 `running` Execution 수를 상한(cap)으로 강제해 특정 테넌트가 실행 큐를 무제한 점유해 다른 테넌트에 영향을 주는 리소스 고갈(OWASP API4:2023 Unrestricted Resource Consumption 유사 패턴)을 완화한다. cap 은 양의 정수만 허용(0/무제한 옵션 없음)하고 큐 대기 5분 초과 시 자동 취소(`EXECUTION_QUEUE_WAIT_TIMEOUT`)해 무한 적체도 방지한다. 이전 라운드(review/code/.../16_58_32)에서 지적된 TOCTOU race(CRITICAL, cap 우회 가능)는 이번 diff 에서 `pg_advisory_xact_lock` 기반 워크스페이스 단위 직렬화로 해소되어 있음을 코드 확인(`admitExecutionOrDefer` 현재본, execution-engine.service.ts:2646). 보안적으로 이 fix 는 긍정적.

## 요약

이번 diff(PR2b 동시성 cap enforcement)는 신규 HTTP 표면(워크스페이스 설정 PATCH/GET 필드 1개 추가)과 내부 admission gate(raw SQL + advisory lock)로 구성되며, 인젝션·인증/인가·시크릿·에러노출·암호화 관점에서 문제되는 패턴을 발견하지 못했다. raw SQL 은 전 구간 파라미터 바인딩이고, 신규 DTO 필드는 class-validator + 서비스단 이중 방어와 기존 Admin+/멤버 인가 체계를 그대로 상속한다. 오히려 admission cap 자체가 테넌트 간 리소스 고갈(DoS 유사) 완화 기능이며, 이전 리뷰 라운드에서 지적된 TOCTOU CRITICAL(동시 admission 이 cap 을 우회할 수 있는 race)은 advisory lock 도입으로 코드상 해소된 것을 확인했다. 시크릿 하드코딩·평문전송·안전하지 않은 해시 등도 해당 없음.

## 위험도

NONE
