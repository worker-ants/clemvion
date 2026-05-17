# 의존성(Dependency) 리뷰 결과

## 발견사항

### 1. 새 의존성 / 내부 의존성 변경

- **[INFO]** `notifications.service.ts`: `typeorm`에서 `IsNull` 추가 임포트
  - 위치: `backend/src/modules/notifications/notifications.service.ts` 변경 코드 diff 라인
  - 상세: `MoreThanOrEqual, Repository` → `IsNull, MoreThanOrEqual, Repository`로 변경. `typeorm` 은 기존 의존성이며, `IsNull`은 TypeORM 내장 helper 이므로 새 외부 의존성 추가는 없다.
  - 제안: 없음 (적절한 사용).

- **[INFO]** `notifications.service.spec.ts`: `NotFoundException`, `IsNull`, `NotificationsService` 임포트 추가
  - 위치: `backend/src/modules/notifications/notifications.service.spec.ts`
  - 상세: `@nestjs/common`에서 `NotFoundException`, `typeorm`에서 `IsNull` 추가. 모두 기존 프레임워크 의존성 내 기능 확장이다.
  - 제안: 없음.

- **[INFO]** `frontend/src/components/layout/sidebar.tsx`: `@tanstack/react-query`에서 `useMutation`, `useQueryClient` 추가
  - 위치: `frontend/src/components/layout/sidebar.tsx` diff 라인 2
  - 상세: 기존에 `useQuery`만 사용하다가 `useMutation`과 `useQueryClient`를 추가했다. `@tanstack/react-query`는 기존 의존성이며 동일 패키지 내 훅 확장이다. 새 외부 패키지는 도입되지 않았다.
  - 제안: 없음.

- **[INFO]** `backend/test/notifications-dismiss.e2e-spec.ts`: `@jest/globals`, `pg`, `supertest` 임포트 사용
  - 위치: 파일 29, 라인 1~3
  - 상세: 이 e2e 스펙 파일은 신규 추가 파일이다. 임포트한 `@jest/globals`, `pg`(`Client`), `supertest` 모두 기존 e2e 테스트 패턴(예: `background-monitoring.e2e-spec.ts`)과 동일하게 사용된 패키지로, 새 외부 의존성 추가는 없다.
  - 제안: 없음.

- **[INFO]** `notifications.controller.ts`: `DismissNotificationResponseDto`, `DismissAllNotificationsResponseDto` 내부 모듈 임포트 추가
  - 위치: `backend/src/modules/notifications/notifications.controller.ts` diff
  - 상세: 동일 프로젝트 내 새로 생성된 DTO 클래스를 import하는 내부 의존성 추가다. 파일 12, 13의 신규 DTO를 참조하는 정상적인 구조다.
  - 제안: 없음.

### 2. 내부 의존성 제거 / 구조 변경

- **[WARNING]** `workflow-errors.ts` 삭제 및 typed error 계층 제거
  - 위치: 파일 7 (`backend/src/modules/execution-engine/workflow-errors.ts`) — 전체 삭제. 파일 6, 19, 20에서 관련 import 제거.
  - 상세: `WorkflowNotFoundError`, `SubWorkflowTimeoutError` 두 typed error 클래스를 삭제하고 `execution-engine.service.ts`에서 `new Error(...)` plain throw 로, `workflow.handler.ts`에서 메시지 문자열 패턴매칭으로 대체했다. 이 변경으로 `workflow.handler.ts`의 `mapSubWorkflowError` 함수 시그니처가 `err: unknown` → `message: string` 으로 바뀌어 `instanceof` 분기 대신 문자열 매칭에만 의존하게 된다. 코드 내 TODO 주석으로 "WorkflowExecutor가 typed error hierarchy를 제공하면 교체"라고 명시되어 있으나, 기존에 이미 typed error가 도입되어 있던 상황에서 오히려 후퇴하는 방향이다.
  - 제안: typed error(`WorkflowNotFoundError`, `SubWorkflowTimeoutError`) 삭제는 에러 분류의 타입 안전성을 낮춘다. 삭제 이유가 명확하지 않으면 재검토를 권장한다. 최소한 `plan/in-progress/spec-4-nodes-unimplemented-cleanup.md`에 연결된 TODO가 실제로 추적되고 있는지 확인이 필요하다.

- **[INFO]** `execution-engine.service.ts`: `workflow-errors.ts` import 제거 (4줄 삭제)
  - 위치: 파일 6, diff 라인 `-import { WorkflowNotFoundError, SubWorkflowTimeoutError } from './workflow-errors'`
  - 상세: 위 WARNING과 연계된 변경. 내부 의존성 감소이므로 의존성 순환 리스크는 없다.
  - 제안: 없음 (WARNING 항목 참고).

- **[INFO]** `workflow.handler.spec.ts` / `workflow.handler.ts`: `workflow-errors.ts` import 제거
  - 위치: 파일 19, 20
  - 상세: 스펙 파일과 핸들러 모두에서 typed error import 제거. 테스트에서도 `WorkflowNotFoundError`·`SubWorkflowTimeoutError` instance 분기 테스트 케이스가 삭제됐다.
  - 제안: 삭제된 테스트 케이스(`maps WorkflowNotFoundError instance → SUB_WORKFLOW_NOT_FOUND`, `maps SubWorkflowTimeoutError instance → SUB_WORKFLOW_TIMEOUT`, `typed branch wins over misleading message text`)는 회귀 방지 역할을 하고 있었다. 메시지 패턴매칭 방식으로의 전환 후 동등한 커버리지가 현재 스펙에 존재하는지 확인이 필요하다.

### 3. 새 내부 DTO 파일 추가

- **[INFO]** `dismiss-notification-response.dto.ts`, `dismiss-all-notifications-response.dto.ts` 신규 추가
  - 위치: 파일 12, 13
  - 상세: `@nestjs/swagger`의 `ApiProperty`만 임포트하여 사용. 기존 의존성 범위 내 단순 DTO 생성이다. 기존 `MarkAllReadResultDto`와 유사한 패턴으로 일관성이 있다.
  - 제안: 없음.

### 4. DB 마이그레이션 의존성 (내부 스키마)

- **[INFO]** V055 (dismissed_at 컬럼 추가) / V056 (partial index 전환) 마이그레이션
  - 위치: 파일 1~3
  - 상세: SQL 마이그레이션이므로 외부 패키지 의존성은 없다. V056은 Flyway의 `executeInTransaction=false` 설정을 `.conf` 파일로 지정하여 `CREATE/DROP INDEX CONCURRENTLY`의 트랜잭션 제약을 처리한다. `IF NOT EXISTS` / `IF EXISTS` 로 재실행 안전성을 확보한 점은 적절하다.
  - 제안: 없음. 다만 V056이 적용되는 환경에서 V055가 먼저 적용되었음이 보장되어야 한다 (Flyway 버전 순서로 자동 보장됨).

### 5. 불필요한 의존성 / 대체 가능성 검토

- **[INFO]** 이번 변경 세트 전반에서 새 외부 패키지는 전혀 추가되지 않았다. 모든 신규 import는 기존 의존성(`@nestjs/common`, `@nestjs/swagger`, `typeorm`, `@tanstack/react-query`, `@jest/globals`, `pg`, `supertest`) 범위 내에서 이루어졌다.
  - 제안: 없음.

### 6. `integration-action-required-notifier.service.ts` 채널 타입 완화

- **[INFO]** `channel` 타입 캐스트에 `'email'` 유니온 추가
  - 위치: 파일 8, diff 라인
  - 상세: `(wantsEmail ? 'both' : 'in_app') as 'both' | 'in_app'` → `as | 'both' | 'in_app' | 'email'`로 타입 범위 확대. 내부 타입 시스템 변경으로 외부 패키지와 무관하다.
  - 제안: 단순 타입 캐스팅 확장이므로 의존성 관점 이슈 없음. 다만 실제 값이 `'email'`이 되는 경로가 없다면 불필요한 유니온 확장이다.

## 요약

이번 PR(notification dismiss 기능 도입)은 외부 패키지를 단 하나도 추가하지 않았다. 모든 변경은 기존 의존성(`@nestjs/common`, `@nestjs/swagger`, `typeorm`, `@tanstack/react-query`, `pg`, `supertest`, `@jest/globals`) 범위 내의 기능 확장이다. 내부 의존성 관점에서 주목할 사항은 `workflow-errors.ts` 전체 삭제와 typed error 계층의 plain `Error` + 메시지 패턴매칭으로의 후퇴인데, 이는 타입 안전성을 낮추는 방향이며 삭제 근거가 명확히 제시되지 않았다. 관련 TODO가 추적되고 있는지, 회귀 방지 테스트가 충분한지 확인이 필요하다. 나머지 변경은 기존 의존성 구조를 준수하며 적절한 내부 모듈 분리를 유지하고 있다.

## 위험도

LOW
