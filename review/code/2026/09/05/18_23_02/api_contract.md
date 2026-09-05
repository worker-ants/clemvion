# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `GET/POST/PATCH /api/schedules` 응답의 `trigger` 필드가 (버그로 새어나가던) **Trigger 엔티티 전체**에서 4개 참조 필드로 **좁혀지는 breaking change**다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` — `private toResponse<T extends Schedule>(...)` (신설, `findAll`/`findOne`/`create`/`update` 4곳에 적용); `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:90-91` (`trigger?: ScheduleTriggerRefDto | null;`)
  - 상세: 종전에는 `leftJoinAndSelect('s.trigger', 't')`(서비스는 `relations: ['trigger', 'trigger.workflow']`)로 Trigger 엔티티 전체가 응답에 실렸다 — `type`·`config`·`endpointPath`·`authConfigId`·`cronExpression` 등 `ScheduleDto`가 전혀 선언하지 않던 필드까지 wire 에 나갔다는 뜻이다. 이번 PR 은 이를 `{ id, name, workflowId, workflow?.name }` 4필드로 좁힌다. 보안상 필요한 수정(같은 컬럼에 담긴 `notificationSecretV2`/`chatChannelTokenV2` 회전 secret 을 함께 걷어내야 하므로)이지만, **선언되지 않았을 뿐 실제로 존재하던 필드를 소비하는 곳이 있었다면 이 PR 로 조용히 깨진다.** 프런트엔드 소비처는 실측(`grep 'schedule.trigger' codebase/frontend`)으로 `name`·`id`·`workflowId`·`workflow.name` 4곳뿐임을 확인했고 CHANGELOG 에도 명시했다 — 내부 FE 는 영향 없음을 확인. 다만 이 API 를 직접 소비하는 **외부/서드파티 클라이언트**(예: 응답 body 를 그대로 로깅·캐시·재전송하는 통합)가 있다면 그쪽은 검증 대상에서 빠져 있다.
  - 제안: API 버전 관리 체계가 없는 저장소이므로 버전 negotiation 은 기대하기 어렵지만, 최소한 CHANGELOG(이미 기재됨)에 더해 이 엔드포인트에 알려진 외부 소비자가 없는지 한 번 더 확인하고, 있다면 별도 공지·마이그레이션 기간을 고려할 것.

- **[INFO]** `ExportWorkflowDto.formatVersion` 은 여전히 `required` 로 선언되어 있는데 실제 export 구현은 이 필드를 emit 하지 않는다 — OpenAPI 문서가 실제 동작보다 넓은 상태가 이 PR 이후에도 남는다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:432-442` (`allowMissing: ['formatVersion']` 신설 지점). DTO 원본은 `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` (본 diff 에는 포함되지 않음, 프롬프트에 전체 파일 미첨부).
  - 상세: 이 갭은 이 PR 이 만든 것이 아니라 이미 `spec/2-navigation/1-workflow-list.md` 에 "Planned" 로 문서화된 기존 결함이며, PR 은 `allowMissing` 옵션으로 계약-검증 e2e 를 통과시키되 갭 자체는 닫지 않는 것으로 명시적으로 스코핑했다(주석·plan 양쪽에 출처 인용). API 계약 관점에서는 **현재 공개 OpenAPI 스키마가 `formatVersion` 을 항상 존재하는 것으로 선언하지만 실제로는 그렇지 않다**는 사실 자체는 여전히 유효하므로, strict 코드젠 클라이언트가 이 필드에 의존하면 런타임 오류가 날 수 있다는 점을 재확인차 기록한다. 이 PR 의 처리(추적된 갭으로 `allowMissing` + 출처 주석)는 적절하다.
  - 제안: 별도 조치 불요(이미 plan 에 추적됨) — 참고용 기록.

- **[INFO]** 응답 정화(secret strip)가 각 서비스 메서드의 수기 allow/deny-list 에 의존하는 구조라, 이번에 고친 것과 같은 리크가 **구조적으로 재발 가능**하다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `TRIGGER_RESPONSE_STRIP_COLUMNS` (신설) / `sanitizeForResponse` (개명, 舊 `sanitizeChatChannelForResponse`)
  - 상세: 이번 수정 자체는 정확하다 — 조기 return 제거로 모든 트리거 타입이 정화를 거치고, `config` JSONB 키와 엔티티 컬럼 두 계층을 모두 덮는다(뮤테이션 회귀 테스트로 확인됨, `TriggerDto` 2건/`ScheduleDto` 18건 RED). 다만 이 방어는 **`Trigger` 엔티티를 조인·반환하는 새 코드가 생길 때마다 개발자가 다시 `sanitizeForResponse`(또는 동등 좁히기)를 기억해서 호출**해야 하는 구조다 — 이번에 `ScheduleDto` 가 그 예외였다. `@Exclude()` + `ClassSerializerInterceptor` 같은 선언적/전역 강제가 아니라 §5.4 응답-계약 테스트(실행 시점, e2e 커버리지에 의존)가 유일한 안전망이다. plan(`spec-draft-nullable-notation-followups.md`)이 "2차 스윕(e2e 미도달 엔드포인트)"을 이미 후속 항목으로 추적하고 있어 별도 조치 요구는 아니다.
  - 제안: 조치 불요(설계 결정 기존 유지, 후속 스윕 추적 중) — 참고용 기록.

- **[정보/양호]** 페이지네이션·엔티티 스프레드 안전성 확인: `SchedulesController.findAll` 이 `{ ...page, data: page.data.map(this.toResponse) }` 로 응답을 재구성하지만, `PaginatedResponseDto` 는 `data`/`pagination` 두 own-property 만 갖는 단순 클래스라 spread 로 인한 메타데이터 유실이 없음을 확인했다(`codebase/backend/src/common/dto/paginated-response.dto.ts`). `page`/`limit`/`totalItems`/`totalPages` 는 그대로 보존된다.

## 요약

이번 변경은 새 breaking API 를 도입하는 기능 추가가 아니라, `TriggerDto`/`ScheduleDto` 등 5개 응답 DTO 의 **선언-실제 불일치**(§5.4 응답-계약 스윕)를 바로잡는 교정 PR 이다. 핵심 조치 둘 다 타당하다 — (1) `sanitizeChatChannelForResponse`→`sanitizeForResponse` 로 넓혀 트리거 응답에서 회전 secret 두 컬럼(`notificationSecretV2`/`chatChannelTokenV2`)을 모든 트리거 타입에서 제거(종전엔 chat-channel 조기 return 으로 일부 누락), (2) `GET /api/schedules` 의 조인이 같은 secret 을 새어 나가게 하던 것을 컨트롤러 응답 경계에서 참조 4필드로 좁혀 차단. 후자는 형식상 breaking change이나, 실제 프런트엔드 소비 필드(`name`/`id`/`workflowId`/`workflow.name`)와 정확히 일치함을 실측 확인했고 CHANGELOG 에도 영향 범위가 명시되어 있다. 그 외 5개 DTO 에 추가된 24개 신규 필드는 전부 `@ApiPropertyOptional` 이라 하위 호환을 깨지 않는 선언 보정이며, nullable 여부도 대응 엔티티 컬럼과 일치한다. 페이지네이션 구조·인증/인가·URL 설계는 이 변경으로 영향받지 않는다. 유일하게 남는 항목은 `ExportWorkflowDto.formatVersion` 처럼 이미 추적된 문서-구현 갭이며, 이 PR 은 이를 악화시키지 않고 명시적으로 스코프 밖에 둔다.

## 위험도

LOW
