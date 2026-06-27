# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 발견사항 1

- **[WARNING]** `endpointPath` 유효성 검증 변경으로 인한 의도적 파괴적 API 변경
  - 위치: `codebase/backend/src/modules/triggers/dto/create-trigger.dto.ts` line 52, `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` line 58
  - 상세: `@IsString() @MaxLength(255)` 에서 `@IsUUID('4')` 로 교체. `/hooks/my-integration` 처럼 기존에 허용되던 비-UUID `endpointPath` 값을 보내는 기존 API 클라이언트는 이제 400 VALIDATION_ERROR 를 받게 된다. 변경 의도(W1 보안)는 문서화되었으나 인터페이스 계약이 파괴적으로 변경된다.
  - 제안: 배포 전 기존 DB 레코드의 `endpoint_path` 가 전부 UUID 형식인지 확인할 것(레거시 `/hooks/*` 형식 row 가 있으면 조회·업데이트 필요). 클라이언트 사이드(프론트엔드)가 이미 `crypto.randomUUID()` 를 사용하는지 확인.

### 발견사항 2

- **[WARNING]** `WorkspaceInvitationsPrunerService.onModuleInit` 이 매 앱 기동 시마다 Redis 에 외부 상태를 기록
  - 위치: `codebase/backend/src/modules/workspaces/jobs/workspace-invitations-pruner.service.ts` line 26 (`onModuleInit`)
  - 상세: `upsertJobScheduler` 는 idempotent 하지만, Redis 가 기동 시점에 unavailable 하면 `onModuleInit` 이 throw 되어 앱 전체 부팅이 차단된다(fail-fast). `WorkspacesModule` 이 `@Global()` 이므로 Redis 장애가 워크스페이스와 무관한 모든 모듈의 초기화를 막는다.
  - 제안: Redis 가 별도 가용성 계층으로 관리되는 인프라라면 허용 가능. 그러나 Redis 장애 내성이 필요한 환경에서는 `onModuleInit` 내부에서 예외를 catch 하고 경고만 로그하는 soft-fail 방식을 고려할 것. 현재 설계는 "Redis 필수 의존" 을 의도적으로 선택했으므로, 운영팀에 Redis 재시작 선행 요건을 전달해야 한다.

### 발견사항 3

- **[INFO]** 새로운 주기적 DB 삭제 부작용 도입
  - 위치: `codebase/backend/src/modules/workspaces/jobs/workspace-invitations-pruner.service.ts` line 33 (`prune`)
  - 상세: 매일 04:00 Asia/Seoul 에 `workspace_invitation` 테이블의 만료 row 를 `pruneExpired` 헬퍼로 삭제한다. 이전에는 해당 헬퍼가 프로덕션 호출자 없이 존재만 했으므로 만료 row 가 영구 잔존했다. 이제 실제 삭제가 발생한다.
  - 제안: 만료 초대 row 를 별도 감사(audit) 목적으로 보존해야 하는 요구사항이 없는지 확인. `AuditLogsModule` 이 이미 import 되어 있으나 `pruneExpired` 가 삭제 전 audit 로그를 남기는지 검토.

### 발견사항 4

- **[INFO]** `WorkspacesModule` 에 BullMQ 큐 등록으로 Redis 신규 의존성 추가
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.module.ts` line 16
  - 상세: `BullModule.registerQueue` 추가로 `WorkspacesModule` 이 Redis 에 신규 의존. `WorkspacesModule` 은 `@Global()` 이므로 Redis 없이 구동하는 테스트 환경(예: unit test with partial module)에서 예외가 발생할 수 있다.
  - 제안: 신규 `workspace-invitations-pruner` 큐의 unit test(`workspace-invitations-pruner.service.spec.ts`)는 `getQueueToken` mock 을 올바르게 사용하므로 문제없다. 다른 테스트에서 `WorkspacesModule` 을 직접 import 하는 경우 BullMQ mock 추가 필요 여부를 점검.

### 발견사항 5

- **[INFO]** e2e 헬퍼 `uniqueEndpoint` 의 `_label` 파라미터 미사용
  - 위치: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` line 1499
  - 상세: `_label` 파라미터가 완전히 무시된다. call-site 호환을 위해 인자 자체는 유지했다고 명시되어 있어 의도적 변경이다. 기능적 부작용은 없다.
  - 제안: 추후 `uniqueEndpoint()` 를 호출 시 label 없이 인자 제거를 고려(선택적 cleanup).

### 발견사항 6

- **[INFO]** `webhook-trigger.e2e-spec.ts` 테스트 B 에서 비-UUID path 를 URL 경로로 직접 사용
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` line 2109
  - 상세: `POST /api/hooks/no-such-path-xyz` 는 URL path parameter 로서 DTO 유효성 검증을 거치지 않고 서비스 레이어에서 lookup 실패 → 404 를 반환한다. DTO 의 `@IsUUID` 는 request body 필드에만 적용되므로 라우트 파라미터에는 영향 없다. 테스트 의도와 실제 동작이 일치한다.
  - 제안: 문제없음. 확인 목적으로 기록.

---

## 요약

이번 변경의 핵심 부작용은 두 가지다. 첫째, `CreateTriggerDto` / `UpdateTriggerDto` 의 `endpointPath` 유효성 검증이 `@IsString()+@MaxLength(255)` 에서 `@IsUUID('4')` 로 강화되어, 비-UUID 형식 경로를 전송하던 기존 클라이언트 코드가 즉시 400 오류를 받게 된다(의도적 파괴적 변경). 둘째, `WorkspaceInvitationsPrunerService` 의 신규 도입으로 매일 `workspace_invitation` 테이블에서 만료 row 를 실제 삭제하고, 앱 기동 시 Redis 에 scheduler entry 를 등록하는 외부 상태 변경이 추가된다. Redis 장애 시 `@Global()` 모듈의 부팅 실패로 이어지는 점이 운영상 주의가 필요하다. 전역 변수·환경 변수·파일시스템·의도치 않은 네트워크 호출은 없으며, 나머지 변경(e2e 경로 형식 통일, spec 문서 갱신)은 의도된 범위 내의 수정이다.

## 위험도

LOW
