STATUS: OK

### 발견사항

- **[INFO]** target §1.1 `background_failed` 행에 resource_type/resource_id 계약 명시 누락 (target 문서 자체 갭)
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 표, `background_failed` 행
  - 충돌 대상: 같은 표의 `execution_failed`/`schedule_failed` 행 (각각 "**resource_type='workflow' / resource_id=workflow.id**" 를 명시), `spec/2-navigation/_layout.md` §3.1 딥링크 표
  - 상세: 계획서(payload)는 항목 1에서 "코드가 §3.1 과 drift" 라고 정확히 진단했다 (실측 확인 완료 — `background-execution.processor.ts:169-185` 는 `resourceType = hasRunId ? 'background_run' : 'execution'`, `href.ts` 는 `background_failed` 를 `/workflows/<resource_id>` 로 라우팅해 `resource_id=backgroundRunId` 를 workflow id 로 오인). 그런데 이 drift 의 근본 원인 중 하나는 target 문서 §1.1 자체가 `background_failed` 행에 계약을 명시하지 않아 코드가 참조할 SoT 문장이 없었다는 점이다. 항목 1 구현 후 §1.1 행도 `execution_failed`/`schedule_failed` 와 동일 패턴으로 "resource_type='workflow' / resource_id=workflow.id (딥링크), background_run_id=<컬럼> (attribution)" 형태로 명시해야 동일 표 안에서 3개 type 의 계약이 대칭을 이룬다.
  - 제안: 항목 1 구현 시 §1.1 `background_failed` 행도 함께 갱신 (계획서에 이미 "§2.1(Schema 매핑) 과 §2.19(데이터 모델)" 갱신은 언급했으나 §1.1 표 자체 갱신은 명시 안 됨 — 누락 방지용으로 planner 위임 범위에 추가 권고).

- **[WARNING]** `spec/4-nodes/1-logic/12-background.md` §8 (모니터링 API) 가 attribution 방식 변경의 갱신 대상에서 누락
  - target 위치: target payload 항목 1 (라인 30-34), "notification.entity.ts / notification-response.dto.ts 갱신… 별도 spec-update 로 planner 위임 예정" 서술
  - 충돌 대상: `spec/4-nodes/1-logic/12-background.md` §8.2 응답 스키마의 `notifications` 필드 설명 (line 248: "본 backgroundRun 와 연관된 알림… `type: background_failed`"), 그리고 `background-runs.service.ts` 의 `findByResource('background_run', backgroundRunId)` 호출부 주석(line 398-402: "resourceType='background_run' 으로 정확 attribution")
  - 상세: 항목 1 계획대로 `resource_type` 을 `'workflow'` 로, attribution 을 신규 `background_run_id` 컬럼으로 옮기면 `background-runs.service.ts` 의 조회 메서드(`findByResource`)가 신규 메서드로 교체돼야 하고, 이 API 의 응답 계약을 정의한 `12-background.md` §8.2 는 이 변경을 반영하지 않으면 "resourceType='background_run'" 이라는 옛 attribution 방식이 실질적 SoT 로 남아 코드와 다시 어긋난다. target payload 는 spec-update 위임 범위로 `1-data-model.md §2.19` 와 (본문 §2.1) 만 언급하고 `12-background.md §8` 은 포함하지 않았다.
  - 제안: planner 위임 시 갱신 대상에 `spec/4-nodes/1-logic/12-background.md` §8.2 (notifications 필드 설명) 를 명시적으로 추가. "attribution 은 `background_run_id` 컬럼 기준" 이라는 문장으로 교체.

- **[WARNING]** `notification-response.dto.ts` 의 `resourceType` 문서화된 허용값 목록 갱신 누락 가능성
  - target 위치: target payload 항목 1 (라인 33 "`notification.entity.ts` / `notification-response.dto.ts` 갱신")
  - 충돌 대상: `codebase/backend/src/modules/notifications/dto/responses/notification-response.dto.ts` 의 `resourceType` `@ApiPropertyOptional` 설명 — "현재 발행되는 값: `execution`, `background_run`" 이 하드코딩되어 있다.
  - 상세: 항목 1이 완료되면 `background_run` 은 더 이상 `resource_type` 값으로 발행되지 않고(`workflow` 로 통일), attribution 은 별도 `background_run_id` 필드로 분리된다. DTO 는 이미 갱신 대상으로 명시돼 실행 계획엔 포함되나, Swagger 문서 예시(`example: 'execution'`) 와 설명 문구("현재 발행되는 값…")를 새 계약에 맞게 고치지 않으면 API 문서가 실제 동작과 다시 어긋난다.
  - 제안: DTO 갱신 시 `resourceType` 설명에서 `background_run` 언급 제거하고 `background_run_id` 신규 필드에 대한 별도 `@ApiPropertyOptional` 설명 추가 — target 계획이 이미 인지하고 있는 작업이므로 실행 시 놓치지 않도록 체크리스트화 권고.

- **[INFO]** `notification` 테이블(in-app 알림)과 `notification-webhook`/`NotificationDispatcher` 계열(EIA outbound notification) 간 명명 유사성으로 인한 혼동 소지 (기존 상태, target 과 직접 충돌 아님)
  - target 위치: target 문서 전반 (`NotificationsService`, `notification` 테이블)
  - 충돌 대상: `spec/data-flow/0-overview.md` §4 BullMQ 카탈로그의 `notification-webhook` 큐 / `NotificationDispatcher` / `NotificationWebhookProcessor` (Trigger.notification_health, External Interaction API 의 outbound webhook 알림 도메인), `spec/1-data-model.md §2.8` Trigger 의 `notification_health`/`notification_secret_v2`/`notification_rotated_at` 컬럼
  - 상세: 두 "notification" 은 완전히 다른 도메인 — 하나는 in-app 사용자 알림(본 target), 다른 하나는 Trigger 가 외부 시스템에 발송하는 outbound webhook 알림이다. 기존 spec 들이 이미 이 명명 중복을 각자 문서 안에서 구분하고 있어 즉각적 충돌은 없으나, target 이 신규 컬럼(`notification.background_run_id`)을 추가하면서 이름 공간이 한 번 더 늘어난다. 직접 모순은 없음.
  - 제안: 조치 불필요 (기존 spec 이 이미 문맥으로 구분). 향후 이 두 "notification" 도메인이 한 문서에서 동시에 언급될 경우 "in-app notification (`notification` table)" vs "outbound notification (webhook)" 식 명시적 구분 문구 사용 권고.

- **[INFO]** 마이그레이션 번호 placeholder `V0xx` — 실제 최신 버전과 불일치
  - target 위치: target payload 항목 1 (라인 33, "마이그레이션 V0xx 신설")
  - 충돌 대상: `codebase/backend/migrations/` 최신 파일 `V106__schedule_trigger_id_index.sql`
  - 상세: `V0xx` 는 문맥상 placeholder 로 보이나, 실제 신설 시 번호는 `V107` 이상이어야 한다 (자릿수도 2자리 아닌 3자리). 실질적 충돌 위험은 낮음(개발자가 착수 시 최신 번호로 채번) — 다만 병렬 작업 중인 다른 PR 이 있다면 번호 경합 가능.
  - 제안: 구현 착수 직전 `ls codebase/backend/migrations/ | tail` 로 최신 번호 재확인 후 채번 (통상 절차이므로 별도 조치 불요, 확인 차 기록).

### 요약

target 계획의 항목 1(딥링크/attribution 컬럼 분리)은 실측 코드(`background-execution.processor.ts`, `background-runs.service.ts`, `href.ts`)와 정확히 일치하는 drift 진단에 기반하며, `_layout.md §3.1`·`execution_failed`/`schedule_failed` 의 기존 계약과 방향이 일치한다 — CRITICAL 급 모순은 발견되지 않았다. 다만 계획서가 명시한 spec-update 위임 범위(`1-data-model.md §2.19`, target 본문 §2.1)가 실제로 갱신이 필요한 다른 두 지점 — `spec/4-nodes/1-logic/12-background.md` §8.2 (모니터링 API 응답의 attribution 서술) 과 target 자신의 §1.1 `background_failed` 행 — 을 누락하고 있어, 이 상태로 착수하면 항목 1 완료 후에도 국지적 spec drift 가 새로 남을 위험이 있다(WARNING 2건). 항목 2(e2e 추가)·항목 3(보류 결정 문서화)은 다른 영역과의 충돌 소지가 없다.

### 위험도
LOW
