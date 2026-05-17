# 데이터베이스(Database) 코드 리뷰

## 발견사항

- **[CRITICAL]** `integration_action_required` 알림 타입이 DB CHECK constraint에 없음
  - 위치: `codebase/backend/migrations/V001__initial_schema.sql:338`, `codebase/backend/src/modules/integrations/integration-action-required-notifier.service.ts:76`
  - 상세: V001에서 notification 테이블의 `type` 컬럼 CHECK constraint는 `('execution_failed', 'background_failed', 'schedule_failed', 'integration_expired', 'marketplace_update', 'team_invite')` 만 허용한다. A-1 작업(2026-05-16)으로 `integration_action_required` 타입이 코드에서 INSERT 되고 있지만, 이 값을 허용하도록 constraint를 확장하는 마이그레이션이 존재하지 않는다. 현 상태에서 해당 알림이 INSERT 시도 시 PostgreSQL이 `check_violation` (23514) 오류를 반환해 알림 발사 전체가 실패한다. spec/1-data-model.md §2.19에는 `integration_action_required`가 명시돼 있으나 DB 스키마가 미반영 상태다.
  - 제안: `ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_type_check; ALTER TABLE notification ADD CONSTRAINT notification_type_check CHECK (type IN ('execution_failed', 'background_failed', 'schedule_failed', 'integration_expired', 'integration_action_required', 'marketplace_update', 'team_invite'));` 를 수행하는 `V052__notification_type_integration_action_required.sql` 마이그레이션을 즉시 추가해야 한다.

- **[CRITICAL]** `AuthConfig.config` JSONB 컬럼이 암호화되지 않은 채 저장됨
  - 위치: `codebase/backend/src/modules/auth-configs/entities/auth-config.entity.ts:31`, `codebase/backend/src/modules/auth-configs/auth-configs.service.ts`
  - 상세: spec/1-data-model.md §2.17은 `AuthConfig.config`를 `JSONB (encrypted)`로 명시하지만, entity에는 `encryptedJsonTransformer`가 적용되어 있지 않고 서비스도 별도 암호화 없이 JSONB를 평문 저장한다. Webhook Bearer Token, API Key 등 민감 인증 정보가 평문으로 DB에 보관된다. DB 접근 권한이 있는 공격자가 모든 webhook 인증 정보를 즉시 노출할 수 있다.
  - 제안: `auth_config.config` 컬럼에 `Integration.credentials`와 동일한 `encryptedJsonTransformer`를 적용한다. 기존 평문 행에 대한 마이그레이션 스크립트(읽어서 암호화 후 재기록)도 작성해야 한다. ENCRYPTION_KEY는 Integration과 별도 키(`AUTH_CONFIG_ENCRYPTION_KEY`)를 사용하거나 동일 키를 공유할지 의사결정이 필요하다.

- **[WARNING]** V049 마이그레이션이 파일과 디렉토리가 동일 이름으로 공존
  - 위치: `codebase/backend/migrations/V049__integration_consecutive_network_failures.sql` (파일), `codebase/backend/migrations/V049__integration_consecutive_network_failures.sql/` (디렉토리)
  - 상세: `ls -la` 결과 동일 이름으로 `.sql` 파일과 디렉토리가 공존하고 있다. Flyway는 파일시스템에서 마이그레이션을 스캔하는데, OS에 따라 디렉토리를 스크립트로 오인하거나 체크섬 계산이 달라져 마이그레이션이 실패하거나 재적용될 수 있다. Linux 배포 환경(Docker)에서의 동작이 macOS와 다를 수 있다.
  - 제안: 빈 디렉토리 `V049__integration_consecutive_network_failures.sql/`를 `git rm -r`로 제거한다. CI 파이프라인에서 `migrations/` 디렉토리 내 `.sql` 이름과 같은 디렉토리 존재 여부를 점검하는 lint 규칙을 추가한다.

- **[WARNING]** `NotificationsService.findByResource`가 workspaceId 격리 없이 `resourceId`만으로 조회
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:22-30`
  - 상세: `findByResource(resourceType, resourceId)`는 workspaceId 필터 없이 `resourceType + resourceId` 조합만으로 알림을 조회한다. 현재 호출자(`BackgroundRunsService`)는 이미 해당 background run의 소유권을 검증한 뒤 호출하므로 현재 IDOR 위험은 낮다. 그러나 이 메서드가 향후 workspaceId 검증이 빠진 경로에서 재사용될 경우 타 워크스페이스의 알림 내용이 노출될 수 있다. resourceId가 UUID이므로 추측 공격 가능성은 낮지만 격리 계층이 없다.
  - 제안: `findByResource(resourceType, resourceId, workspaceId?: string)` 형태로 선택적 workspaceId 파라미터를 추가해 기본적으로 격리를 강제하거나, 호출자에서 소유권 검증이 완료됐음을 명시적으로 보장하는 단언 코드를 추가한다.

- **[WARNING]** `install_token` 컬럼 길이가 스펙과 일치하지 않음
  - 위치: `codebase/backend/src/modules/integrations/entities/integration.entity.ts:62`, `codebase/backend/migrations/V042__cafe24_private_app_pending_install.sql:13`
  - 상세: spec/1-data-model.md Rationale "install_token 형식"은 16바이트 base64url 인코딩 22자로 형식이 변경됐다고 명시한다. 그러나 DB 스키마(`V042`)와 엔티티 모두 `VARCHAR(64)`로 선언되어 있다. 스펙에서는 형식 변경 시 "DB 컬럼 길이 제약이 없어 schema 변경 불필요"라고 명시하지만, 실제로 `VARCHAR(64)` 제약이 존재하며, 옛 32바이트 hex(64자) 값과 신규 22자 값 모두 수용하므로 현재는 오동작이 없다. 그러나 컬럼 정의(64)와 스펙 서술 "길이 제약 없음"이 불일치하여 혼란을 초래한다.
  - 제안: 스펙 Rationale의 "DB 컬럼 `String?`으로 길이 제약 없음" 서술을 `VARCHAR(64)` 실제 정의와 일치하도록 수정하거나, 마이그레이션으로 컬럼을 `TEXT`로 변경해 서술과 구현을 일치시킨다.

- **[WARNING]** 인덱스 누락: `hasRecentByResource`의 복합 조건 쿼리
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:125-134`
  - 상세: `hasRecentByResource`는 `(workspaceId, type, resourceId, title, createdAt)`으로 COUNT 쿼리를 실행한다. spec/1-data-model.md §3 인덱스 전략에는 `(user_id, is_read, created_at DESC)`와 `(workspace_id, created_at DESC)` 인덱스만 있다. `(workspace_id, type, resource_id)` 복합 조건에 대한 인덱스가 없어 notification 테이블이 성장하면 seq scan 또는 `workspace_id` 인덱스의 부분 스캔 후 필터링이 발생한다. 알림 발사 시마다 이 쿼리가 실행되므로 고빈도 경로다.
  - 제안: `CREATE INDEX CONCURRENTLY idx_notification_workspace_type_resource ON notification (workspace_id, type, resource_id, created_at DESC);` 인덱스를 추가한다. 마이그레이션 버전은 V052 또는 V053으로 추가한다.

- **[WARNING]** `duplicate` (Workflow 복사) 시 Nodes/Edges가 트랜잭션 없이 누락됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:171-188`
  - 상세: `duplicate` 메서드는 Workflow row만 복사하고 Node와 Edge를 복사하지 않는다. 이는 의도적 설계일 수 있으나(빈 워크플로우 복사), 동시에 트랜잭션 없이 단순 `save`만 사용한다. 메서드 이름 `duplicate`가 전체 복사를 암시하므로 spec 검토가 필요하다.
  - 제안: spec을 확인해 `duplicate`의 의도가 빈 복사인지 전체 복사인지 명확히 하고, 전체 복사라면 `dataSource.transaction`으로 감싸고 Node/Edge도 복사한다.

- **[INFO]** `AuthConfig.config` CHECK constraint 누락 — `basic_auth` 타입 추가됨에도 V001의 CHECK는 `basic_auth`를 포함
  - 위치: `codebase/backend/migrations/V001__initial_schema.sql:199`
  - 상세: V001의 `auth_config.type` CHECK에는 이미 `basic_auth`가 포함되어 있어 이 부분은 정합성이 있다. 단, entity(`auth-config.entity.ts`)에는 `@Column({ length: 20 })`으로 CHECK constraint가 ORM 레이어에 반영되어 있지 않다. TypeORM은 `check` 옵션 없이 컬럼을 선언해 DB 제약과 ORM 제약이 분리되어 있다. 이는 코드만으로 타입 검증이 불가함을 의미한다.
  - 제안: 애플리케이션 레이어에서 enum 검증을 추가하거나 TypeORM의 `@Column({ type: 'varchar', length: 20, enum: ['api_key', 'bearer_token', 'basic_auth'] })`를 사용해 ORM 레벨에서도 타입을 강제한다.

- **[INFO]** `LlmConfig.apiKey` 컬럼 길이(500)가 암호화 후 실제 저장 길이를 초과할 수 있음
  - 위치: `codebase/backend/src/modules/llm-config/entities/llm-config.entity.ts:38`, `codebase/backend/migrations/V001__initial_schema.sql:306`
  - 상세: `api_key VARCHAR(500)`으로 선언됐으나 AES-256-GCM + base64 envelope 후 실제 저장 바이트는 원문 길이 + 약 60바이트(IV+Tag+Version+prefix)다. 짧은 API key는 문제없으나, 향후 긴 credential이 저장될 경우 500자 한도에 근접할 수 있다. 단, 현행 OpenAI/Anthropic key 길이(~50자)에서는 실질 위험 없음.
  - 제안: `TEXT` 타입으로 변경해 길이 한도를 제거한다. 마이그레이션은 단순 `ALTER TABLE llm_config ALTER COLUMN api_key TYPE TEXT`로 무중단 처리 가능.

- **[INFO]** `findByResource` N+1 잠재 위험: background_run 알림 조회 후 매핑
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:402`
  - 상세: 현재는 단일 `findByResource` 호출로 N+1이 아니지만, `notifications` 테이블에서 `(resource_type, resource_id)` 조합의 인덱스가 없어 full scan 또는 `workspace_id` 인덱스 우회 스캔이 발생한다. background run 완료 조회 API가 호출될 때마다 실행된다.
  - 제안: `CREATE INDEX idx_notification_resource ON notification (resource_type, resource_id);` 인덱스를 추가한다.

---

## 요약

전체적으로 워크스페이스 격리(`workspaceId` 필터)는 대부분의 서비스에서 일관되게 적용되고 있으며, 트랜잭션 경계도 복합 write 연산(`saveCanvas`, `importWorkflow`, `create`) 에서 `dataSource.transaction`을 올바르게 사용한다. Integration 암호화(`encryptedJsonTransformer`)와 LLM API Key 암호화도 정상적으로 구현되어 있다. 마이그레이션들은 대부분 `CONCURRENTLY`, `NOT NULL DEFAULT`, 배치 bulk UPDATE 등 무중단 배포를 고려한 패턴을 따른다. 그러나 A-1 작업(integration_action_required 알림 타입 신설)에 대응하는 DB CHECK constraint 마이그레이션이 누락된 **CRITICAL** 결함이 있어 현재 해당 알림 INSERT가 DB 레벨에서 거부될 것이다. 또한 spec이 `JSONB (encrypted)`로 명시한 `AuthConfig.config` 컬럼이 실제로는 평문 저장되어 webhook 인증 토큰이 노출 위험에 놓인 **CRITICAL** 보안 결함이 존재한다. V049 마이그레이션 파일-디렉토리 명충돌은 Flyway 운영 환경에서 예측 불가 동작을 유발할 수 있는 배포 위험이다.

---

## 위험도

HIGH
