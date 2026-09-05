# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `ScheduleDto.trigger` 를 전체 `Trigger` 엔티티에서 4필드 참조(`id`·`name`·`workflowId`·`workflow?`)로 좁힌 것은 wire 형태를 줄이는 하위 호환성 변경이다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` (`toResponse` 메서드), `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:52-111` (`ScheduleTriggerRefDto`/`ScheduleTriggerWorkflowRefDto` 신설)
  - 상세: 종전에는 컨트롤러가 서비스가 반환한 `Trigger` 엔티티를 그대로 실어 보내 `notificationSecretV2`(평문 서명 secret)·`chatChannelTokenV2`(secret store ref) 를 포함한 임의 컬럼이 전부 wire 에 노출됐다. 이번 변경은 응답 경계에서 참조 4필드만 남기도록 좁혔으므로, 그 외 필드(예: `cronExpression`, `config` 등 `Trigger` 의 다른 컬럼)를 실제로 소비하는 외부 클라이언트가 있었다면 breaking change 다. PR 은 저장소 전수 검색으로 프런트엔드 `lib/api/schedules.ts` 의 `RawSchedule` 타입 하나만 소비자이고 정확히 이 4필드를 쓴다는 것, 배포되는 `@workflow/sdk` 는 스케줄 API 를 다루지 않는다는 것을 CHANGELOG 에 근거와 함께 남겼다. 보안 결함(secret 유출) 수정을 위한 불가피한 축소이고 문서화도 충실하므로 위험도는 낮게 평가한다.
  - 제안: 조치 불요(이미 CHANGELOG·PR 자체 서술로 breaking change 를 명시하고 영향 범위를 실측했음). 외부에 공개된 파트너 API 라면 별도 사전 공지가 필요하나, 이 저장소 구조상 사내/1st-party 소비자만 확인됨.

- **[INFO]** 5개 DTO(`AlertRuleDto`, `IntegrationDto`, `KnowledgeBaseDto`, `TriggerDto`, `ScheduleDto`)에 걸쳐 총 24개 필드를 신규 선언했으나 wire 형태 자체는 바뀌지 않는다 — "이미 나가고 있던 값의 선언을 실제에 맞추는" 문서화 성격의 변경이다.
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:54-69`, `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:117-167`, `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts:92-130`, `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:88-132`
  - 상세: Swagger 스키마가 이제 실제 응답과 일치하게 되어 API 계약 관점에서는 개선이다. `nullable` 지정과 필드 상시 존재 여부(`@ApiProperty` vs `@ApiPropertyOptional`)를 각 필드 발생 조건에 맞춰 정확히 구분했고, e2e (`assertMatchesContract`)로 각 DTO 를 실 HTTP 응답과 대조해 고정했다.
  - 제안: 조치 불요.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 는 프런트엔드 소비가 0곳인 내부 카운터 필드인데도 (제거 대신) 선언을 추가하는 쪽으로 남겼다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:159-167`
  - 상세: 필드 자체는 기존에도 실려 있었으므로 새로 노출을 만든 것은 아니다. PR 은 "제거는 wire 변경이라 별도 항목"이라고 CHANGELOG·PR 코멘트에 명시하고 있어, 스코프 판단이 은닉되어 있지 않다. 다만 API 계약 관점에서는 내부 전용 필드를 공개 계약(OpenAPI)에 정식으로 실어 광고하는 셈이라, 후속 PR 에서 제거하려면 다시 breaking change 가 된다.
  - 제안: 조치 불요, 다만 후속 제거 PR 착수 시 CHANGELOG 로 breaking change 공지가 필요함을 상기.

- **[INFO]** `assertMatchesContract` 의 `allowMissing: ['formatVersion']` 사용은 `ExportWorkflowDto.formatVersion` 이 required 로 선언돼 있음에도 구현이 emit 하지 않는 기존 갭을 우회 검증한다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:432-441` (`allowMissing: ['formatVersion']`), `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:138` (`formatVersion: number` — `@ApiProperty`)
  - 상세: `spec/2-navigation/1-workflow-list.md:153` 가 "포맷 버전 협상은 미구현 (Planned)" 이라고 이미 문서화한 기존 갭이며 이 PR 이 새로 만든 것이 아니다. 다만 required 로 선언된 필드가 실제로는 응답에 없는 상태가 그대로 남아 있다는 사실 자체는 여전히 API 계약 위반(문서가 실제보다 넓음)이고, 이번 PR 은 새 검증자가 이 기존 갭을 정확히 검출하는 것을 확인했을 뿐 닫지는 않았다. 코드 주석과 spec 양쪽에 출처가 남아 있어 은닉된 우회는 아니다.
  - 제안: 조치 불요(이 PR 범위 밖). 후속 트래커 항목으로 `formatVersion` DTO 선언을 실제 구현에 맞추거나(옵셔널화) export 구현을 완성하는 작업이 필요.

- **[INFO]** `SchedulesController.toResponse` 가 `schedule.trigger.id` 등에 방어 없이 접근해, 관계가 로드되지 않은 상태로 호출되면 컨트롤러 레벨에서 예외가 던져진다(주석상 의도적 fail-fast).
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` (`toResponse` 메서드 — `const t = schedule.trigger;` 이후 `t.id`/`t.name` 접근)
  - 상세: `trigger` 는 `Schedule.trigger_id` NOT NULL 1:1 이고 응답을 만드는 네 경로가 전부 `relations`/`join` 으로 채운다는 전제에 기반한 설계이며 unit/e2e 로 커버돼 있다. 저장소에 `GlobalExceptionFilter`(`@Catch()`)가 존재해 미처리 예외를 표준 에러 봉투로 정규화하므로, 만에 하나 전제가 깨지더라도(예: 향후 새 조회 경로가 relation 을 안 채우고 이 메서드를 재사용) 클라이언트는 형식이 일관된 500 을 받는다 — 별도 조치는 불요하나 향후 새 호출 경로 추가 시 이 전제가 유지되는지 확인이 필요하다.
  - 제안: 조치 불요. 참고용 관찰.

## 요약

이 PR 은 응답-계약 런타임 검증자(§5.4, `assertMatchesContract`/`contractForDto`)의 배선을 4개에서 18개 엔드포인트/DTO 로 넓히는 스윕이며, 그 과정에서 발견된 두 건의 실질적 secret 유출(트리거 `notificationSecretV2`/`chatChannelTokenV2`가 `GET/POST/PATCH /api/triggers` 와 `GET/POST/PATCH /api/schedules`(조인 경유)로 노출, `config.interaction.triggerToken` 유출)과 24개 필드의 Swagger 선언-실제 불일치를 함께 고쳤다. API 계약 관점에서는 전반적으로 개선 방향의 변경이다 — 선언과 실제 wire 형태를 정합시키고, `required:false`+`nullable:true` 금지 조합에 대한 정적 래칫과 값 대 선언을 대조하는 런타임 검증을 이중으로 세워 향후 재발을 구조적으로 방지했다. 유일하게 계약 관점에서 주목할 부분은 `ScheduleDto.trigger` 를 전체 엔티티에서 4필드 참조로 좁힌 것인데, 이는 보안 수정의 불가피한 부산물이며 영향 범위(유일 소비자 및 그 소비 필드)를 저장소 전수 검색으로 실측해 CHANGELOG 에 남겼으므로 breaking change 로서의 리스크 관리가 적절히 이루어졌다. 새 엔드포인트·URL 설계·페이지네이션·인증/인가 로직 변경은 없으며(순수 응답 바디 재구성), 요청 검증(request DTO) 변경도 없다.

## 위험도
LOW
