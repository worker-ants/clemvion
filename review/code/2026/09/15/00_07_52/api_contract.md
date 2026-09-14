# API 계약(API Contract) 리뷰

## 검토 범위

`git diff origin/main...HEAD --stat -- codebase/backend/src/modules/triggers/dto codebase/backend/src/modules/triggers/triggers.controller.ts codebase/backend/src/modules/schedules/schedules.controller.ts codebase/backend/src/modules/schedules/dto` 로 재확인 — **컨트롤러·DTO·라우트 정의 변경은 이번 diff 에도 0건**이다. 실제로 바뀐 런타임 코드는 이전 10개 라운드(`18_17_44`~`23_38_09`)가 이미 검토한 것과 동일한 파일 집합이고, 이번 라운드가 추가한 마지막 커밋(`91b816498`)은 `review/code/2026/09/14/23_38_09` 가 지적한 **Critical**(`rotateBotToken` 의 `mergeIntoFreshSubKey` 호출에서 `patch` 자리에 스냅샷 전체(`mergedChannel`)를 넘겨 재읽은 `rateLimitPerMinute`/`uiMapping`/`languageLocale` 을 무조건 되돌리던 결함)을 델타로 좁힌 수정이다 — 서비스 내부 병합 로직 정정이며 컨트롤러·DTO·라우트·응답 스키마는 건드리지 않는다.

전체 diff(`git diff origin/main...HEAD`)를 직접 대조한 결과:

- `codebase/backend/src/modules/triggers/triggers.service.ts` — `findByIdForUpdate`/`assertTriggerFound`/`throwTriggerNotFound` 추출, `update()` 창 1 을 advisory lock 안으로, `remove()` 락+5초 타임아웃, `rotateBotToken()`/`revokePerTriggerToken()`/`normalizeNotificationSecretRef`/`rotateNotificationSecret`/cron 승격·정리 경로 전부를 락 안 재읽기(`rewriteTriggerConfigLocked`/`mergeIntoFreshSubKey`) 또는 컬럼 한정 `update` 로 전환
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — 신규 유틸(`acquireTriggerConfigLock`/`rewriteTriggerConfigLocked`/`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` — `setupChatChannel` 성공/실패 경로를 `rewriteTriggerConfigLocked` + `buildChannel`/`survivesWithFresh` 로 통합
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `extractInboundSigningRef` 추출(순수 함수, API 표면 아님)
- `codebase/backend/src/modules/hooks/hooks.service.ts` — `touchLastTriggeredAt()` 추출(private, 컬럼 한정 `update`) — 두 웹훅 인입 hot path(`handleWebhook`)가 공유
- `codebase/backend/src/modules/schedules/schedules.service.ts` — `SchedulesService.update()` 의 연동 trigger 컬럼(`name`/`isActive`) 동기화를 `save(entity)` 에서 컬럼 한정 `update` 로
- 나머지(`*.spec.ts`, `*.e2e-spec.ts`, `repo-guards/**`, `CHANGELOG.md`, `plan/**`, 과거 라운드 `review/**` 산출물)는 테스트·정적 가드·문서로 API 표면과 무관

`codebase/backend/src/modules/triggers/triggers.controller.ts` 를 직접 열어 `rotateBotToken`(`:id/chat-channel/rotate-bot-token`)·`revokePerTriggerToken`(`:id/interaction/revoke-token`) 두 엔드포인트의 `@ApiNotFoundResponse` 데코레이터가 이미 `RESOURCE_NOT_FOUND`/`Trigger 없음` 을 문서화하고 있음을 확인했다 — 이번 라운드까지 축적된 락-재읽기 수정으로 두 엔드포인트가 삭제-경합 시 새로 던지게 된 404(`throwTriggerNotFound()`)는 **기존에 문서화된 응답 코드 그대로**이고 신규 미문서 에러 형태가 아니다.

## 발견사항

10개 선행 라운드가 이미 이 changeset 의 API 표면(컨트롤러·DTO·라우트·인증·페이지네이션)을 반복 검증해 NONE/LOW 로 수렴시켰다. 이번 라운드가 추가한 유일한 코드 변경(`91b816498`)은 서비스 내부 병합 정확성 버그 수정으로 API 계약에 새로운 영향을 주지 않는다. 아래 두 항목은 이전 라운드(`20_17_16`, `23_01_18`, `23_38_09`)부터 이월된 것으로, 이번 라운드에서도 코드 상태가 바뀌지 않아 그대로 유지한다.

- **[INFO]** (이월, 미변경) `chatChannel` 을 포함한 `PATCH /api/triggers/:id` 가 극히 좁은 삭제-경합 창에서 여전히 200 + 이미 삭제된 리소스의 스냅샷 바디를 반환할 수 있다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` `setupChatChannel()` — 성공 경로는 `rewriteTriggerConfigLocked` 의 반환값(`wrote`)을 `channelListenerRegistry.register` 게이팅에만 쓰고 호출자에 전파하지 않으며, 실패 경로는 반환값을 아예 받지 않는다. 호출부 `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` — `setupChatChannel` 호출 뒤 `refreshed` 재조회가 `null` 이면 락-재작성 커밋 직후의 `saved` 스냅샷을 그대로 응답으로 반환한다.
  - 상세: `update()` 창 1(`assertTriggerFound(fresh)`)과 `rotateBotToken()`(`if (!wrote) this.throwTriggerNotFound();`)은 삭제-경합 시 404 로 통일돼 있지만, `setupChatChannel()` 의 두 경로는 여전히 그 결과를 호출자에 전파하지 않는다. `chatChannel` 을 포함한 PATCH 가 창 1 커밋 뒤 `setupChatChannel()` 을 재호출하는 좁은 창에 `DELETE /api/triggers/:id` 가 끼어들면, 내부 재작성은 조용히 skip 되고도 예외 없이 반환하며 뒤이은 재조회가 `null` 을 받아 스냅샷 폴백 200 이 나간다(뒤이은 `GET` 은 정확히 404 라 최종 일관성은 유지된다).
  - `plan/in-progress/trigger-config-lost-update.md` 에 "binder 두 경로는 저장 뒤 best-effort 후속 작업이라 `false` 로 감추는 것이 설계"로 명시적으로 수용·기록돼 있고, 데이터 손상은 없다.
  - 제안: 이번 배치를 막을 사유는 아니다. 다음에 이 표면을 다시 손댈 때 `update()` 경로에 한해 binder 반환값을 관측해 폴백 대신 404/409 로 드러낼지 재검토 권고(이월).

- **[INFO]** (이월, 미변경) `DELETE /api/triggers/:id` 의 5초 lock-timeout 실패가 기존 500 `INTERNAL_ERROR` 와 클라이언트 관점에서 구분 불가능하게 마스킹된다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(5,000ms)/`acquireTriggerConfigLock()` 의 `SET LOCAL lock_timeout`; 호출부 `triggers.service.ts` `remove()`. Postgres `55P03` 오류는 `HttpException` 도 `isPostgresUniqueViolation` 도 아니므로 `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`)가 일반 500 `INTERNAL_ERROR` 로 마스킹한다 — 이는 이 필터가 매핑되지 않은 내부 오류 전반에 적용하는 기존 관례(CWE-209 방지)이므로 이번 diff 가 새로 위반한 응답 형식은 없다.
  - 상세: "정상적인 동시 쓰기 경합(재시도 가능)"과 "진짜 서버 버그"가 클라이언트 입장에서 동일한 500/`INTERNAL_ERROR` 로 보여, 클라이언트가 이 경합을 구분해 자동 재시도할 근거를 얻지 못한다. 이 트레이드오프는 CHANGELOG·`trigger-config-lock.ts` JSDoc 에 "조용한 지연보다 드러나는 오류가 낫다"는 근거로 의도적으로 문서화돼 있다.
  - 제안: 이번 배치를 막을 사유는 아니다(경합 자체가 드물고 5초는 짧다). 향후 이 실패가 실제 관측되면 `55P03` 을 409(`RESOURCE_CONFLICT`)로 명시 매핑해 재시도 가능성을 클라이언트가 구분할 수 있게 하는 백로그 항목으로 남겨 둘 만하다.

## 관점별 요약

| 관점 | 판정 |
|---|---|
| 하위 호환성 | 컨트롤러·DTO·라우트 미변경. `DELETE` 가 동시 쓰기 경합 시 최대 5초 대기 + 드물게 500 이 될 수 있는 지연/실패 모드를 여전히 가짐(이월, 의도된 트레이드오프) |
| 버전 관리 | 신규 버전 분기 없음 — 해당 없음 |
| 응답 형식 | `create()`/`update()` 는 재조회 기반 응답 구성 패턴 유지. 락 안 재읽기로 응답이 "요청 시작 시점 스냅샷" 대신 "커밋된 최신 상태"를 반영하도록 개선됨(REST PATCH 의 일반 기대에 부합). 이번 라운드의 `patch` 델타화 수정도 `rotateBotToken` 응답의 `chatChannel` 정확성을 개선하는 방향이며 응답 스키마 자체는 불변 |
| 에러 응답 | 신규 404(`rotateBotToken`/`revokePerTriggerToken`)는 컨트롤러에 **이미 문서화된** `RESOURCE_NOT_FOUND`/`Trigger 없음` 봉투와 동일 — 신규 미문서 에러 형태 없음. `DELETE` 의 lock-timeout 은 기존 `GlobalExceptionFilter` 관례대로 일반 500 마스킹(이월 INFO) |
| 요청 검증 | DTO·validation pipe 변경 없음 |
| URL/경로 설계 | 라우트 변경 없음 |
| 페이지네이션 | 목록 API 미변경 — 해당 없음 |
| 인증/인가 | 미들웨어·`@Roles` 변경 없음. 수정의 목적 자체가 인입 웹훅 서명 검증(인가 인접 보증)의 fail-open 을 막는 것이며, 락 안 재계산(`survivesWithFresh`, `extractInboundSigningRef`)으로 그 보증이 실제로 복원됨을 코드로 확인 |

## 요약

이번 changeset(및 이번 라운드가 추가한 마지막 커밋)은 컨트롤러·DTO·라우트·인증 미들웨어·페이지네이션 등 API 계약의 외부 표면을 전혀 건드리지 않는 서비스/영속성 계층 동시성 버그 수정이다. 10개 선행 리뷰 라운드가 이미 이 표면을 반복 검증해 NONE/LOW 로 수렴시켰고, 이번 라운드의 유일한 코드 변경(`91b816498`)은 `rotateBotToken` 병합에서 `patch` 를 스냅샷 전체가 아닌 델타로 좁힌 내부 정확성 수정으로 API 표면에 영향이 없다. `rotateBotToken`/`revokePerTriggerToken` 이 삭제-경합 시 새로 던지는 404 는 컨트롤러에 이미 문서화된 `RESOURCE_NOT_FOUND` 응답 그대로다. 잔여 항목은 이전 라운드부터 이월된 두 가지 INFO(binder 의 극히 좁은 삭제-경합 창에서의 200+구 바디 가능성, `DELETE` lock-timeout 의 일반 500 마스킹)뿐이며 둘 다 데이터 손상이 없고 팀이 이미 트레이드오프로 문서화·수용했다. 새 에러 코드·상태 코드 형식 위반, 요청 검증 누락, 하위 호환성 파괴는 발견되지 않았다.

## 위험도

LOW
