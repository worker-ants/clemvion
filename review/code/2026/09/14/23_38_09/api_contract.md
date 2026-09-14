# API 계약(API Contract) 리뷰

## 검토 범위

`git diff origin/main -- codebase/backend/src '**/*.controller.ts' '**/*.dto.ts'` 로 전수 확인 — **컨트롤러·DTO·라우트 정의 변경은 이번 diff 에 0건**이다 (`triggers.controller.ts`/`hooks.controller.ts`/`schedules.controller.ts` 모두 미변경, `git diff --stat` 상으로도 대상 밖). 실제로 바뀐 런타임 코드는:

- `codebase/backend/src/modules/hooks/hooks.service.ts` — `touchLastTriggeredAt()` 추출, 컬럼 한정 `update`
- `codebase/backend/src/modules/schedules/schedules.service.ts` — trigger 동기화를 컬럼 한정 `update` 로
- `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 창 1 락 재작성, `remove()` 락+5초 타임아웃, `rotateBotToken()`/`revokePerTriggerToken()`/cron 승격·정리 경로의 하위 키 재읽기 병합
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` — `setupChatChannel` 성공/실패 경로
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — 신규 유틸(`rewriteTriggerConfigLocked`/`acquireTriggerConfigLock`)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `extractInboundSigningRef` 추출
- 나머지(`*.spec.ts`, `*.e2e-spec.ts`, `repo-guards/**`, `CHANGELOG.md`, `plan/**`, 그리고 이번 changeset 안에 동봉된 과거 라운드 `review/**` 산출물)는 테스트·정적 가드·문서로 API 표면과 무관.

이 changeset 은 `trigger.config` lost-update — 동시 PATCH/rotate/cron 경로가 `chatChannel.inboundSigningRef`(및 그 형제 하위 키)를 요청 시작 시점 스냅샷으로 되돌려 인입 웹훅 서명 검증이 fail-open 되던 결함 — 을 서비스/영속성 계층에서 advisory lock + 락 안 재읽기로 닫는 동시성 버그 수정이다. 이미 9개 선행 라운드(`18_17_44`~`23_01_18`)의 `api_contract.md` 가 같은 표면을 반복 검토해 NONE/LOW 로 수렴시켰고, 이번 라운드가 추가한 커밋(`bcba1dc5d`, `833bb745a`)도 컨트롤러·DTO·라우트를 건드리지 않고 같은 락-재읽기 규율을 나머지 하위 키(`rotateBotToken` 의 `chatChannel`, `cleanupRotatedChatChannelTokens` 의 컬럼 한정 `update`)에 마저 적용한 것이다. 아래는 최신 diff 로 그 판정을 재검증한 결과다.

## 발견사항

- **[INFO]** (선행 라운드 확인 사항, 재확인 — 미변경) `PATCH /api/triggers/:id`(`chatChannel` 포함)가 극히 좁은 삭제-경합에 걸리면 여전히 200 + 이미 삭제된 리소스 바디를 반환할 수 있다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` `setupChatChannel()` 성공 경로(`rewriteTriggerConfigLocked` 반환값 `wrote` 를 `channelListenerRegistry.register` 게이팅에만 쓰고 호출자에 전파하지 않음) 및 실패 경로(반환값을 아예 받지 않음); 호출부 `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 함수 내 `setupChatChannel` 호출 뒤 `const refreshed = await this.triggerRepository.findOne(...); if (refreshed) result = refreshed;` 블록(`refreshed` 가 `null` 이면 `result` 는 락-재작성 커밋 직후의 `saved` 스냅샷 그대로 응답으로 나간다)
  - 상세: `update()` 창 1(`assertTriggerFound(fresh)`)과 `rotateBotToken()`(`if (!wrote) this.throwTriggerNotFound();`)은 삭제-경합 시 404 로 통일돼 있지만, `setupChatChannel()` 의 두 경로는 여전히 `wrote`/반환값을 관측하지 않는다. `chatChannel` 을 포함한 PATCH 가 창 1 커밋 이후 `setupChatChannel()` 을 재호출하는데, 그 좁은 창에 `DELETE /api/triggers/:id` 가 끼어들면 내부 재작성이 조용히 `false` 를 반환하고도 예외 없이 정상 반환하며, 뒤이은 재조회는 `null` 을 받아 스냅샷 폴백으로 200 이 나간다(뒤이은 `GET` 은 정확히 404).
  - 이 항목은 이번 라운드가 새로 만든 것이 아니다 — `review/code/2026/09/14/20_17_16/api_contract.md` WARNING 과 `review/code/2026/09/14/23_01_18/api_contract.md` INFO#1 이 이미 지적했고, `plan/in-progress/trigger-config-lost-update.md` 에 "수용·부분 수정(`rotateBotToken` 만 404 로, binder 두 경로는 저장 뒤 best-effort 라 `false` 로 감추는 것이 설계)"으로 명시적으로 기록돼 있다. 이번 두 커밋(`bcba1dc5d`, `833bb745a`)은 이 잔여를 건드리지 않았다 — 그대로 이월.
  - 제안: 이번 배치를 막을 사유는 아니다(경합 창이 매우 좁고 데이터 손상 없음, GET 재조회로 진실 확인 가능). 다음에 이 표면을 다시 손댈 때 `update()` 경로에 한해 binder 반환값을 관측해 `refreshed` 폴백 대신 404/409 로 드러낼지 재검토 권고(위 이월 근거 그대로).

- **[INFO]** `DELETE /api/triggers/:id` 에 새 실패 모드(advisory lock 5초 타임아웃, Postgres `55P03`)가 추가됐고, 클라이언트 관점에서 기존 500 과 구분 불가능한 형태로 마스킹된다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(5_000) 상수와 `acquireTriggerConfigLock()` 의 `SET LOCAL lock_timeout` 분기; 호출부 `codebase/backend/src/modules/triggers/triggers.service.ts` — `remove()` 의 `manager.transaction(...).catch((err) => { this.logger.error(...); throw err; })`
  - 상세: 종전엔 `remove()` 가 락 없이 즉시 `triggerRepository.remove(trigger)` 를 실행했다. 이번 변경으로 삭제는 advisory lock 을 잡아야 하고(같은 트리거에 대한 동시 PATCH/rotate 가 그 락을 보유 중이면 최대 5초 대기), 5초를 넘기면 Postgres 가 `lock_timeout` 오류를 던진다. 이 오류는 `HttpException` 도 `isPostgresUniqueViolation` 도 아니므로 `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`)의 `mapHttpErrorLike` 가 `null` 을 반환해 일반 500 `INTERNAL_ERROR`("An unexpected error occurred. Please try again later.")로 마스킹된다 — 이는 이 필터가 매핑되지 않은 내부 오류 전반에 적용하는 기존 관례(CWE-209 방지)이므로 이번 diff 가 새로 위반한 형식은 없다. 다만 "정상적인 동시 쓰기 경합으로 인한 재시도 가능 실패"와 "진짜 서버 버그"가 클라이언트 입장에서 동일한 500/`INTERNAL_ERROR` 로 보이므로, 클라이언트가 이 경합을 자동 재시도할 근거(예: 409/503 + 특정 코드)를 얻지 못한다. 이 트레이드오프는 CHANGELOG·`trigger-config-lock.ts` JSDoc 에 "조용한 지연보다 드러나는 오류가 낫다"는 근거로 의도적으로 문서화돼 있다.
  - 제안: 이번 배치를 막을 사유는 아니다(경합 자체가 드물고 5초는 짧다). 다만 향후 이 실패가 실제로 관측되면, `55P03` 을 `GlobalExceptionFilter` 또는 `remove()` 호출부에서 409(`RESOURCE_CONFLICT`, "재시도 가능")로 명시 매핑해 클라이언트가 구분 가능하게 하는 것을 백로그에 등재할 만하다.

- **[INFO]** 삭제-경합 시 형제 엔드포인트 간 응답 비대칭이 이번 라운드에서 추가로 좁혀짐 (개선, 위험 아님)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `rotateBotToken()` 의 `chatChannel` 병합이 `mergeIntoFreshSubKey(freshConfig, 'chatChannel', ...)` 로, `cleanupRotatedChatChannelTokens()`/`promoteRotatedNotificationSecrets()` 의 카운터 증가가 `if (wrote) ...` 게이트로 바뀜(커밋 `833bb745a`)
  - 상세: 이 변경은 응답 바디의 정확성을 개선한다 — 종전엔 `rotateBotToken` 응답의 `chatChannel` 이 요청 시작 시점 스냅샷이라 동시 PATCH 가 바꾼 `rateLimitPerMinute`/`uiMapping`/`languageLocale` 등을 되돌려 응답에 실었고, cron 승격/정리 카운터는 쓰기가 skip 돼도 증가해 운영 로그가 거짓 성공을 말했다. 둘 다 API 계약을 깨는 방향이 아니라 기존 계약(응답이 실제 저장 상태를 반영해야 한다)에 더 가깝게 좁힌 것이다.
  - 제안: 없음.

## 관점별 요약

| 관점 | 판정 |
|---|---|
| 하위 호환성 | 컨트롤러·DTO·라우트 미변경. `DELETE` 가 동시 쓰기 경합 시 최대 5초 대기 + 드물게 500 이 될 수 있는 새 지연/실패 모드를 얻음(위 INFO#2, 의도된 트레이드오프) |
| 버전 관리 | 신규 버전 분기 없음 — 해당 없음 |
| 응답 형식 | `create()`/`update()` 는 재조회 기반 응답 구성 패턴 유지. `rotateBotToken`/cron 카운터의 응답·로그 정합성이 이번 라운드에서 오히려 개선(위 INFO#3). `update()` 극히 좁은 삭제 경합에서 200+구 바디 가능성은 기존 이월 항목(위 INFO#1) |
| 에러 응답 | 신규 404(`rotateBotToken`)는 기존 `RESOURCE_NOT_FOUND` 봉투와 동일. `DELETE` 의 lock-timeout 은 기존 `GlobalExceptionFilter` 관례대로 일반 500 으로 마스킹(신규 위반 아님, 다만 재시도 가능성 구분 불가 — 위 INFO#2) |
| 요청 검증 | DTO·validation pipe 변경 없음 |
| URL/경로 설계 | 라우트 변경 없음 |
| 페이지네이션 | 목록 API 미변경 — 해당 없음 |
| 인증/인가 | 미들웨어·`@Roles` 변경 없음. 수정의 목적 자체가 인입 웹훅 서명 검증(인가 인접 보증)의 fail-open 을 막는 것이며, 락 안 재계산(`survivesWithFresh`, `mergeIntoFreshSubKey`)으로 그 보증이 실제로 복원됨을 코드로 확인 |

## 요약

이번 changeset 은 컨트롤러·DTO·라우트·인증 미들웨어·페이지네이션 등 API 계약의 외부 표면을 전혀 건드리지 않는 서비스/영속성 계층 동시성 버그 수정이며, 9개 선행 리뷰 라운드가 이미 이 표면을 반복 검증했다. 이번 라운드가 추가한 두 커밋은 같은 락-재읽기 규율을 `rotateBotToken`/`cleanupRotatedChatChannelTokens`/`promoteRotatedNotificationSecrets` 의 남은 자리에 적용한 것으로, 응답·로그 정합성을 오히려 개선했다(INFO#3). 잔여 항목은 두 가지뿐이다 — (1) `chatChannel` 을 포함한 PATCH 가 극히 좁은 삭제-경합 창에서 여전히 200+구 바디를 반환할 수 있는 이월된 저위험 항목(팀이 이미 의도적으로 수용), (2) `DELETE` 에 새로 생긴 5초 lock-timeout 실패가 기존 관례대로 일반 500 으로 마스킹돼 클라이언트가 재시도 가능 경합과 진짜 오류를 구분할 수 없는 점(문서화된 트레이드오프). 둘 다 이번 배치를 막을 사유가 아니며, 새 에러 코드·상태 코드 형식 위반, 요청 검증 누락, 하위 호환성 파괴는 발견되지 않았다.

## 위험도

LOW
