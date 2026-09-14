# API 계약(API Contract) 리뷰

## 검토 범위

이번 라운드(`00_38_16`)는 직전 라운드(`00_07_52`, LOW 로 종결)가 검토한 커밋 `91b816498`
이후 새로 쌓인 커밋 `3641ead21`(`docs(triggers): 목록은 낡고 규칙은 안 낡는다 + fallback
분기를 행사하는 fixture`) 하나를 추가로 포함한다. `git show --stat 3641ead21` 로 확인한
결과 이 커밋의 실제 코드 변경은 다음으로 국한된다.

- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — JSDoc 정정만
  (`git show 3641ead21 -- trigger-config-lock.ts` 로 직접 대조, 호출부 열거를 규칙 서술로
  바꾸고 부재-처리 표에 `revokePerTriggerToken`/`normalizeNotificationSecretRef`/cron 두
  곳을 채운 것 — 코드 로직 변경 0줄)
- `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — `mergeIntoFreshSubKey`
  의 `fallback` 분기(재읽은 행에 하위 키가 없을 때)를 실제로 행사하는 테스트 케이스 추가
- `plan/in-progress/trigger-config-lost-update.md`, `review/code/2026/09/15/00_07_52/**`
  — 트래커·직전 라운드 리뷰 산출물

`git show 3641ead21 -- codebase/backend/src/modules/triggers/triggers.service.ts` 는 **빈
diff** — 이 커밋은 서비스 런타임 코드를 전혀 건드리지 않았다. 따라서 이번 라운드가 API
표면에 새로 추가하는 변경은 없다.

이번 기회에 `triggers.service.ts`/`trigger-config-lock.ts`/`schedules.service.ts`/
`hooks.service.ts` 전체 diff(`git diff origin/main...HEAD`)를 처음부터 직접 재대조했고,
`git diff origin/main...HEAD --stat -- '**/*.controller.ts' '**/*.dto.ts'` 로 컨트롤러·DTO
변경 0건을 재확인했다. 확인한 핵심 지점:

- `TriggersService.update()`(창 1) — 병합·저장이 advisory lock 트랜잭션 안으로 들어갔지만
  `save(Trigger, target)` 반환 엔티티에 `relations: ['workflow']` 가 그대로 실려 있어
  `PATCH` 응답 스키마(`TriggerDto.workflow`)는 변함없다.
- `rotateBotToken()`/`revokePerTriggerToken()` — 삭제-경합 시 `rewriteTriggerConfigLocked`
  반환값(`wrote`)을 확인해 `this.throwTriggerNotFound()`(기존 `findById()` 와 동일한
  `code: 'RESOURCE_NOT_FOUND'` 봉투)를 던지도록 되어 있다 — 이전 라운드(`20_17_16`)가
  WARNING 으로 지적한 "형제 경로 간 200 vs 404 비대칭"이 두 경로 모두 해소된 상태를
  유지한다.
- `TriggersService.remove()` — 락을 삭제 전 정리(teardown/secret 삭제/BullMQ 해제) *뒤*,
  실제 행 삭제 *전*에 잡고 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(5s)로 상한을 둔다. 타임아웃 시
  에러가 위로 던져지며 컨트롤러 레벨 변환이 없어 `GlobalExceptionFilter` 의 일반 500
  경로로 떨어진다(기존 미매핑 에러 처리 관례와 동일 — 신규 위반 아님).
- `SchedulesService.update()` — `trigger.name`/`trigger.isActive` 는 여전히 in-memory
  엔티티에 먼저 대입된 뒤 컬럼 한정 `update()` 로 영속화하고, 응답은 그 in-memory
  엔티티(`saved.trigger = trigger`)를 그대로 쓴다 — 응답-DB 불일치 없음.
- `hooks.service.ts` `touchLastTriggeredAt()` — 웹훅 인입 두 hot path 공용 private 헬퍼로,
  `lastTriggeredAt` 컬럼만 갱신한다. 인입 웹훅의 응답 스키마·상태 코드에 영향 없음.
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` — `PATCH` 동시 요청 후
  `bRes.status` 는 여전히 `200`(`expect(bRes.status).toBe(200)`)으로 응답 계약 불변을
  실측으로 고정한다.

## 발견사항

10개 선행 라운드(`18_17_44`~`00_07_52`)가 이 changeset 의 API 표면(컨트롤러·DTO·라우트·
인증·페이지네이션)을 반복 검증해 NONE/LOW 로 수렴시켰고, 이번 라운드가 추가한 유일한
커밋(`3641ead21`)은 서비스 런타임 코드를 건드리지 않는 JSDoc 정정 + 테스트 추가다. 새로
발견한 CRITICAL/WARNING 은 없다. 직전 라운드(`00_07_52`)가 이월한 두 INFO 는 코드 상태가
바뀌지 않아 그대로 유지한다.

- **[INFO]** (이월, 미변경) `chatChannel` 을 포함한 `PATCH /api/triggers/:id` 가 극히 좁은
  삭제-경합 창에서 200 + 이미 삭제된 리소스의 스냅샷 바디를 반환할 수 있다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
    `setupChatChannel()` 성공/실패 경로(`rewriteTriggerConfigLocked` 반환값을 등록 게이팅
    에만 쓰거나 아예 받지 않음) → 호출부 `triggers.service.ts` `update()` 의 `refreshed`
    재조회가 `null` 이면 락-재작성 커밋 직후의 `saved` 스냅샷을 그대로 반환
  - 상세: 창 1·`rotateBotToken`·`revokePerTriggerToken` 세 동기 경로는 삭제-경합 시 404 로
    통일돼 있지만, `setupChatChannel()` 의 두 후속 경로는 여전히 그 결과를 호출자에
    전파하지 않는다(설계상 "저장 뒤 best-effort" 로 `trigger-config-lock.ts` JSDoc 표에
    명시·수용됨). 뒤이은 `GET` 은 정확히 404 이므로 최종 일관성은 유지되고 데이터 손상은
    없다.
  - 제안: 이번 배치를 막을 사유는 아니다(이월). 다음에 이 표면을 다시 손댈 때 재검토 권고.

- **[INFO]** (이월, 미변경) `DELETE /api/triggers/:id` 의 5초 lock-timeout 실패가 기존
  500 `INTERNAL_ERROR` 와 클라이언트 관점에서 구분 불가능하게 마스킹된다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts`
    `TRIGGER_DELETE_LOCK_TIMEOUT_MS`/`acquireTriggerConfigLock()` 의 `SET LOCAL
    lock_timeout`; 호출부 `triggers.service.ts` `remove()`
  - 상세: Postgres `55P03` 은 `GlobalExceptionFilter` 가 매핑되지 않은 내부 오류 전반에
    적용하는 기존 관례대로 일반 500 으로 떨어진다 — 이번 diff 가 새로 위반한 응답 형식은
    없다. "정상적인 동시 쓰기 경합"과 "서버 버그"가 클라이언트 관점에서 구분되지 않아
    자동 재시도 근거를 얻지 못하는 정도의 트레이드오프이며, CHANGELOG·JSDoc 에 의도적
    선택으로 문서화돼 있다.
  - 제안: 이번 배치를 막을 사유는 아니다(이월). 향후 이 실패가 실제 관측되면 `55P03` 을
    409(`RESOURCE_CONFLICT`)로 명시 매핑하는 백로그 항목으로 남겨 둘 만하다.

## 관점별 요약

| 관점 | 판정 |
|---|---|
| 하위 호환성 | 컨트롤러·DTO·라우트 미변경. 기존 클라이언트 영향 없음 |
| 버전 관리 | 신규 버전 분기 없음 — 해당 없음 |
| 응답 형식 | `PATCH`/`POST`/`rotateBotToken`/schedule `update` 모두 응답 스키마 불변. `PATCH` 응답이 "요청 시작 스냅샷" 대신 "커밋된 최신 상태"를 반영하도록 개선(REST 일반 기대에 부합), CHANGELOG 에 Behavior change 로 명시 |
| 에러 응답 | 신규 404(`rotateBotToken`/`revokePerTriggerToken`)는 기존 `RESOURCE_NOT_FOUND` 봉투와 동일. `DELETE` lock-timeout 은 기존 500 마스킹 관례 유지(이월 INFO) |
| 요청 검증 | DTO·validation pipe 변경 없음 |
| URL/경로 설계 | 라우트 변경 없음 |
| 페이지네이션 | 목록 API 미변경 — 해당 없음 |
| 인증/인가 | 미들웨어·`@Roles` 변경 없음. 인입 웹훅 서명 검증(인가 인접 보증)의 fail-open 을 락 안 재계산으로 복원 |

## 요약

이번 라운드가 추가한 유일한 커밋(`3641ead21`)은 JSDoc 정정 + 테스트 fallback 분기
커버리지 추가로, `triggers.service.ts` 는 diff 가 비어 있고 `trigger-config-lock.ts` 도
로직 변경이 0줄이다 — 이번 라운드는 API 표면에 새로운 영향을 주지 않는다. 전체
changeset 은 여전히 컨트롤러·DTO·라우트·인증 미들웨어·페이지네이션 등 API 계약의 외부
표면을 건드리지 않는 서비스/영속성 계층 동시성 버그 수정이며, 10개 선행 라운드가 이미
이 표면을 반복 검증해 NONE/LOW 로 수렴시켰다. 잔여 항목은 이전 라운드부터 이월된 두
INFO(binder 의 극히 좁은 삭제-경합 창에서의 200+구 바디 가능성, `DELETE` lock-timeout 의
일반 500 마스킹)뿐이며 둘 다 데이터 손상이 없고 팀이 이미 트레이드오프로 문서화·수용한
상태다. 새 에러 코드·상태 코드 형식 위반, 요청 검증 누락, 하위 호환성 파괴는 이번
라운드에서도 발견되지 않았다.

## 위험도

LOW
