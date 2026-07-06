### 발견사항

- **[INFO]** `resourceType`(DTO) 의 "딥링크 라우팅 키" 서술과 프런트 실제 라우팅 로직의 불일치
  - target 신규 식별자: `notification-response.dto.ts` 의 `resourceType` 필드 주석 — "팝오버 딥링크 계약(`_layout.md §3.1`)의 **라우팅 키**" 라고 새로 서술
  - 기존 사용처: `codebase/frontend`(채널 web-chat 제외) 의 `href.ts` — `notificationHref()` 는 `type`(예: `execution_failed`/`background_failed`/`team_invite`) 을 기준으로 switch 하며, `resourceType` 값 자체는 라우팅 분기에 전혀 쓰이지 않는다(`resourceId` 만 사용). `team_invite` 는 `resourceType='workspace_invitation'` 을 채우지만 `href.ts` 는 이를 무시하고 무조건 `/profile` 로 라우팅한다.
  - 상세: 신규 식별자 충돌은 아니지만("workflow"/"integration"/"workspace_invitation" 값 자체는 실제로 각 서비스가 채우는 값과 일치함), DTO 주석이 "resourceType 가 라우팅 키" 라고 명명하는 것은 실제로는 **"type(알림 타입) + resourceId" 조합이 라우팅 키**인 구현과 명명상 오해를 유발할 소지가 있다. 다른 개발자가 이 주석만 보고 `resourceType` 을 라우팅 분기 근거로 오인해 프런트 코드를 작성할 위험.
  - 제안: DTO 주석을 "라우팅 키는 `type`, `resourceType`/`resourceId` 는 라우팅 **대상**(payload) 메타데이터" 로 정정하거나, 최소한 "실제 분기는 `type` 필드 기준" 이라는 단서를 추가. (신규 식별자 충돌이 아니므로 코드 동작에는 영향 없음 — 문서 정확성 이슈로 별도 관점(convention/rationale) 리뷰에서도 이미 다뤄졌을 수 있음.)

- **[INFO]** `background_run_id` 컬럼명과 V047 `idx_node_execution_background_run_id` 인덱스명 유사성 — 이미 자체 방어됨
  - target 신규 식별자: `notification.background_run_id` (migration V107)
  - 기존 사용처: `codebase/backend/migrations/V047__node_execution_background_run_id_index.sql` 의 인덱스 `idx_node_execution_background_run_id` (테이블: `node_execution`, JSONB path `meta.backgroundRunId`)
  - 상세: 두 식별자는 표기가 유사(`background_run_id` 부분 문자열 공유)하나 소속 테이블·목적이 다르다(V047: node_execution 조회 성능 인덱스 / V107: notification attribution 컬럼). 실제 DB 객체명은 `idx_notification_background_run_id` vs `idx_node_execution_background_run_id` 로 완전히 다르며 충돌 없음. target 코드·spec(migration 주석, `spec/data-flow/8-notifications.md` Rationale, `spec/4-nodes/1-logic/12-background.md`)이 이미 명시적으로 "표기가 유사하나 무관" 주석을 3곳에 심어 향후 혼동을 사전 차단했다.
  - 제안: 없음(이미 처리됨). 참고용으로만 기록.

- **[INFO]** `resource_type='workflow'` 값 재사용 — 기존 값과 일관된 확장
  - target 신규 식별자: `background_failed` 알림의 `resourceType: 'workflow'` (기존은 `'background_run'`/`'execution'` 이었음)
  - 기존 사용처: `execution_failed`(`execution-engine.service.ts`), `schedule_failed`(`schedule-runner.service.ts`) 가 이미 동일 값 `'workflow'` 를 사용 중.
  - 상세: 신규 도입이 아니라 기존 값과의 **의도적 통일**(3개 실패 type 이 모두 workflow 딥링크로 일관)이며 다른 의미로 쓰이는 충돌이 아니다. 오히려 이전(옛 `'background_run'`/`'execution'`)이 이형적이었던 것을 정합시킨 개선.
  - 제안: 없음. 정상적인 일관화.

## 검증한 항목 (충돌 없음 확인)
- 마이그레이션 파일 `V107__notification_background_run_id.sql` — 기존 `V107` 파일 없음(고유). `V105`/`V106` 은 `.conf`+`.sql` 짝 파일이라 `ls` 상 2줄로 보이는 것일 뿐 실제 버전 중복 아님.
- 인덱스명 `idx_notification_background_run_id` — 코드베이스 전역 유일, `idx_node_execution_background_run_id`(V047) 와 문자열은 유사하나 별개 객체.
- 서비스 메서드 `NotificationsService.findByBackgroundRun` — 유일 정의, 구 `findByResource` 를 대체(호출부 전부 갱신 확인: `background-runs.service.ts`, `executions.module.ts` 주석, spec 3곳).
- 엔티티 컬럼 `Notification.backgroundRunId`(`background_run_id`) — 다른 엔티티에 동명 컬럼 없음. `AuditLog.resource_type`/`resource_id` 는 기존부터 있던 별개 테이블의 공통 관례 필드명이며 이번 신규 식별자와 무관.
- `getNotificationsService()`(execution-engine.service.ts, ModuleRef 지연 해석) — 코드베이스 유일 정의, 다른 서비스의 동명 메서드 없음.
- WS 이벤트 `notification.new`, 알림 `type` 값 `background_failed`/`execution_failed` 등 — 이번 PR 신규 도입 아님(기존 식별자를 attribution 방식만 변경).
- `spec/1-data-model.md §2.19`, `spec/4-nodes/1-logic/12-background.md §8.2`, `spec/data-flow/8-notifications.md §2.1/§1.1/Rationale` 3개 spec 파일 모두 `background_run_id`/`findByBackgroundRun` 서술이 상호 일관되게 flip 되었고, 다른 spec 파일에서 이질적 재사용 없음.

### 요약
target PR 이 도입하는 핵심 신규 식별자(`notification.background_run_id` 컬럼, 인덱스 `idx_notification_background_run_id`, 마이그레이션 `V107`, 서비스 메서드 `findByBackgroundRun`, `resourceType='workflow'` 값 재사용, `ExecutionEngineService.getNotificationsService()`)는 모두 코드베이스·spec 전역에서 유일하며 기존에 다른 의미로 사용되던 식별자와 충돌하지 않는다. `background_run_id` 컬럼명과 V047 의 `idx_node_execution_background_run_id` 인덱스명이 표기상 유사해 보일 수 있으나 target 이 스스로 마이그레이션 주석·spec Rationale 3곳에서 명시적으로 구분해 사전에 혼동을 차단했다. 유일하게 짚을 만한 것은 CRITICAL/WARNING 급이 아닌 문서 정확성 성격의 INFO 1건(`NotificationDto.resourceType` 을 "라우팅 키" 라고 서술한 것이 실제로는 `type` 필드가 라우팅 분기 기준인 `href.ts` 구현과 미묘하게 어긋남)이다.

### 위험도
NONE
