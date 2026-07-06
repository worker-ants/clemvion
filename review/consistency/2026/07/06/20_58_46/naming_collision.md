# 신규 식별자 충돌 검토 — spec/data-flow/8-notifications.md (항목 1~3)

## 발견사항

- **[WARNING]** `notification.background_run_id` 신규 컬럼명이 기존 `node_execution` 테이블의 인덱스명과 표기 중복
  - target 신규 식별자: `notification.background_run_id UUID` (신규 nullable 컬럼, attribution 전용)
  - 기존 사용처: `codebase/backend/migrations/V047__node_execution_background_run_id_index.sql` — `node_execution` 테이블에 `idx_node_execution_background_run_id` 라는 **부분 expression 인덱스**(실컬럼 아님, `output_data #>> '{meta,backgroundRunId}'` JSONB 경로 인덱스)가 이미 존재
  - 상세: 테이블이 다르고(`node_execution` vs `notification`) V047 쪽은 실제 컬럼이 아니라 JSONB path 표현식 인덱스이므로 스키마 레벨 충돌은 아니다. 다만 "background_run_id" 라는 식별자가 코드베이스 안에서 이미 (a) `background.handler.ts`/`background.schema.ts`/`websocket.service.ts` 의 camelCase 런타임 변수 `backgroundRunId`(Background 노드가 발급하는 UUID), (b) V047 인덱스명의 두 가지 뉘앙스로 쓰이고 있어, 신규 `notification.background_run_id` 실컬럼이 세 번째 사용처로 추가된다. 값 자체(Background 노드가 발급한 동일 UUID)는 일관되게 참조하므로 의미 충돌은 아니나, 마이그레이션 작성자가 V047 커멘트만 보고 "이미 실컬럼이 있다"고 착각할 여지가 있다.
  - 제안: 신규 마이그레이션 파일 주석에 "V047 의 `idx_node_execution_background_run_id` 는 `node_execution.output_data` JSONB 경로 인덱스이며 본 컬럼과 무관(다른 테이블)" 이라고 명시해 향후 독자의 혼동을 예방. 컬럼명 자체는 변경 불필요(의미는 일관되게 Background 노드 발급 UUID).

- **[WARNING]** `notification.resource_id` semantic 전환 시 `background-runs.service.findByResource('background_run', backgroundRunId)` 호출부가 target 계획에서 언급되지 않음
  - target 신규 식별자: `notification.resource_type='workflow'`/`resource_id=workflow.id` 로 전환 (기존 `resource_type='background_run'`/`resource_id=backgroundRunId` 폐기)
  - 기존 사용처: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:398-403` — `this.notificationsService.findByResource('background_run', backgroundRunId)` 로 **현재도 `resource_type='background_run'` 값을 그대로 조회 키로 사용** 중 (Background 모니터링 API 가 연관 알림을 자기 응답에 동봉하는 경로, `spec/data-flow/8-notifications.md §2.1` 행에도 명시)
  - 상세: target 항목 1은 "딥링크 요구(workflow id)와 attribution 요구(backgroundRunId)를 별도 컬럼으로 분리"하며 `resource_type='workflow'`로 바꾸고 legacy `execution` fallback 은 제거한다고 했으나, **`resource_type='background_run'` 값 자체를 없앤다는 언급은 없다**. 즉 `background-execution.processor.ts` 가 INSERT 시 `resource_type` 컬럼에 무엇을 넣을지(`'workflow'` 로 통일할지, 아니면 `background_run` 을 유지한 채 신규 `background_run_id` 컬럼만 추가할지) 가 target 서술만으로는 이분됨 — `background-runs.service.findByResource('background_run', ...)` 호출부를 신규 `background_run_id` 컬럼 기반 새 메서드로 반드시 같이 바꿔야 하는데, target §항목1 은 "NotificationsService 에 background_run_id 조회 메서드 추가" 로만 적고 기존 `findByResource('background_run', ...)` 호출부 교체를 명시적 작업 항목으로 나열하지 않았다. 누락 시 dual write(같은 정보를 `resource_type='background_run'` 문자열과 신규 컬럼 두 곳에 중복 유지)로 인한 향후 drift 위험.
  - 제안: 개발 착수 시 target 작업 항목에 "`background-execution.processor.ts` 의 INSERT 에서 `resource_type` 값 통일(모든 background_failed 알림이 `resource_type='workflow'` 로 적재됨) + `background-runs.service.ts` 의 `findByResource('background_run', ...)` 호출을 신규 `background_run_id` 컬럼 기반 조회로 치환" 을 명시적으로 추가할 것을 권고. (신규 식별자 자체의 명명 충돌은 아니고, 신규 식별자 도입 시 기존 식별자 사용처 갱신 누락 위험이라 WARNING.)

- **[INFO]** 마이그레이션 버전 플레이스홀더 `V0xx` 는 실제 파일명이 아니므로 충돌 없음
  - target 신규 식별자: `마이그레이션 V0xx 신설`
  - 기존 사용처: `codebase/backend/migrations/` 최신 파일은 `V106__schedule_trigger_id_index.sql`
  - 상세: target 문서의 `V0xx` 는 명백한 플레이스홀더 표기이며 실제 구현 시 `V107__...` 로 채번될 것이 자연스럽다. 충돌 위험 없음 — 단, 구현 착수 시점에 main 대비 다른 PR 이 먼저 `V107` 을 점유했을 수 있으니 최신 번호 재확인만 필요(정례 절차, 이 checker 의 신규 식별자 충돌 범주는 아님).
  - 제안: 별도 조치 불요. developer 착수 직전 `ls codebase/backend/migrations/` 로 최신 번호 재확인 관례를 따르면 충분.

- **[INFO]** `notification.entity.ts` / `notification-response.dto.ts` 갱신 범위에 `background_run_id` 필드 노출 여부 미정
  - target 신규 식별자: `NotificationsService 에 background_run_id 조회 메서드 추가`
  - 기존 사용처: `codebase/backend/src/modules/notifications/dto/responses/notification-response.dto.ts` (현재 `resourceType`/`resourceId` 필드만 노출, `spec/data-flow/8-notifications.md` 어디에도 `background_run_id` 를 API 응답 DTO 에 얹는다는 서술 없음)
  - 상세: 신규 컬럼이 "attribution 전용" 내부 조회용인지, 프론트엔드 응답 DTO 에도 노출되는 필드인지 target 서술이 명확하지 않다. `NotificationResponseDto` 에 새 필드가 추가되면 프론트엔드 `NotificationLite` 타입(`href.ts` 가 참조하는)과의 계약 갱신도 필요하다.
  - 제안: spec-update 위임 시 "`background_run_id` 는 내부 전용 컬럼으로 REST 응답 DTO 에는 노출하지 않는다(Background 모니터링 API 는 `background-runs.service` 내부에서 직접 조회)" 여부를 §2.1/§2.19 개정 문서에 명시적으로 못 박을 것을 권고.

## 요약

target 이 도입하는 신규 식별자(`notification.background_run_id` 컬럼, 신규 마이그레이션 `V0xx`, `NotificationsService` 신규 조회 메서드) 는 기존 spec/코드의 다른 의미와 정면 충돌하는 CRITICAL 사례는 없다. 다만 (1) V047 의 `idx_node_execution_background_run_id` 인덱스명과의 표기 유사성으로 인한 혼동 여지, (2) `resource_type='background_run'` 문자열 값을 실제 조회 키로 쓰는 기존 호출부(`background-runs.service.ts`)를 신규 컬럼 도입 계획이 명시적으로 언급하지 않아 값 일관성이 깨질 위험이 WARNING 수준으로 존재한다. spec-update 위임 시 이 두 지점을 문서에 명시하면 충돌 위험은 해소된다.

## 위험도
LOW
