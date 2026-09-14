# API 계약(API Contract) 리뷰

## 검토 범위

이번 diff(`origin/main...HEAD`)의 실제 런타임 코드는 아래로 국한된다 — `git diff origin/main...HEAD --name-only` 로 전수 확인.

- `codebase/backend/src/modules/hooks/hooks.service.ts` (`touchLastTriggeredAt` 추출)
- `codebase/backend/src/modules/schedules/schedules.service.ts` (trigger 동기화 컬럼 한정 `update`)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`update()` 창 1 락 재작성, `remove()` 락+5s 타임아웃, `rotateBotToken()`)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (`setupChatChannel` 성공/실패 경로)
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규 유틸)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (`extractInboundSigningRef` 추출)
- 나머지는 테스트(`*.spec.ts`, `*.e2e-spec.ts`), 리포 가드(`repo-guards/**`), 문서(`CHANGELOG.md`, `plan/**`, `review/**`) — API 표면과 무관.

**컨트롤러·DTO·라우트 정의는 이번 diff 에 전혀 없다** — `git diff origin/main...HEAD --stat -- '**/*.controller.ts' '**/*.dto.ts'` 결과 0건(`triggers.controller.ts`/`hooks.controller.ts`/`schedules.controller.ts` 모두 미변경). 실제 `triggers.controller.ts` 를 열어 라우트·`@Roles`·`@Api*Response` 데코레이터가 그대로임을 확인했다.

이 변경은 `trigger.config` lost-update(동시 PATCH 가 `chatChannel.inboundSigningRef` 를 되돌려 인입 웹훅 서명 검증이 fail-open 되는 결함)를 서비스/영속성 계층에서 advisory lock + 락 안 재읽기로 막는 동시성 버그 수정이며, 이전 8개 라운드(`18_17_44`~`22_24_35`)의 `api_contract.md` 가 이미 이 표면을 반복 검토해 대부분 NONE/LOW 로 수렴시켰다. 아래는 그 축적된 판정을 실제 소스로 재검증한 결과다.

## 발견사항

- **[INFO]** `PATCH /api/triggers/:id`(`chatChannel` 포함) 가 삭제-경합에 걸리면 여전히 200 + 이미 삭제된 리소스의 바디를 반환할 수 있다 — 단, **이미 식별·триаж·수용된 트레이드오프**이고 신규 결함이 아니다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:266-291`(성공 경로 — `wrote` 를 `channelListenerRegistry.register` 게이팅에만 쓰고 호출자에 전파하지 않음), `:310-321`(실패 경로 — 반환값을 아예 받지 않음); 호출부 `triggers.service.ts:700-717`(`update()` — `refreshed` 가 `null` 이면 `result = saved`(pre-race 스냅샷)로 폴백해 200 반환)
  - 상세: `TriggersService.update()` 의 "창 1"(자체 인라인 락 재작성, `triggers.service.ts:620-668`)은 트리거가 그 사이 삭제됐으면 `assertTriggerFound` 로 404(`RESOURCE_NOT_FOUND`)를 던지도록 이미 수정됐고, `rotateBotToken()` 도 `rewriteTriggerConfigLocked` 의 반환값(`wrote`)이 `false` 면 `this.throwTriggerNotFound()` 로 같은 404 를 던지도록 수정됐다(`triggers.service.ts:1318`). 그러나 `ChatChannelBinderService.setupChatChannel()` 의 두 경로(성공/실패)는 여전히 `wrote`/반환값을 관측하지 않는다. `update()`가 PATCH 바디에 `chatChannel` 을 포함하면 창 1 커밋 이후 `setupChatChannel()` 을 다시 호출하는데(`triggers.service.ts:700`), 이 호출과 창 1 커밋 사이의 좁은 창에 다른 요청의 `DELETE /api/triggers/:id` 가 끼어들면 `setupChatChannel` 내부의 `rewriteTriggerConfigLocked` 가 `false` 를 반환하고도 예외 없이 정상 반환하며, 뒤이은 재조회(`triggerRepository.findOne`)는 `null` 을 받아 `if (refreshed) result = refreshed;` 를 건너뛰고 `saved`(창 1 커밋 직후의 in-memory 스냅샷)를 그대로 응답으로 돌려준다 — 결과적으로 **그 순간 DB 에 존재하지 않는 트리거에 대해 HTTP 200 + 전체 리소스 바디**가 나간다(뒤이은 `GET /api/triggers/:id` 는 정확히 404 를 낸다).
  - 이 항목은 이번 라운드가 새로 찾은 것이 아니다 — `review/code/2026/09/14/20_17_16/api_contract.md` WARNING 이 정확히 이 비대칭(창 1 은 404, 형제 3경로는 200+거짓 성공)을 지적했고, `plan/in-progress/trigger-config-lost-update.md:391` 이 "**수용·수정(부분)** — `rotateBotToken` 을 404 로, binder 의 두 경로는 «저장 뒤의 best-effort» 라 `false` 로 감추는 것이 맞다"는 의식적 결정을 이미 기록해 뒀다. 즉 팀은 이 잔여 비대칭을 인지하고 `rotateBotToken` 만 고치기로 명시적으로 결정했다.
  - 다만 그 수용 근거(`trigger-config-lock.ts` JSDoc: "이미 응답이 나갔고, 실패를 던지면 성공한 저장을 되돌리는 것처럼 보인다")는 `create()`(신규 UUID 라 경합 대상 자체가 실질적으로 없음)에는 정확하지만, `update()`(PATCH 대상 id 를 이미 다른 클라이언트도 알고 있어 진짜 `DELETE` 경합이 가능)에는 문언 그대로는 부정확하다 — `setupChatChannel` 호출 시점에 HTTP 응답은 아직 나가지 않았고(같은 요청 핸들러 안에서 동기 `await` 중), 실제로 감춰지는 것은 "창 1(주 자원 존재 판정)의 성공을 되돌리는 모습으로 보인다"는 것과는 다른, "그 시점 이후의 DB 상태를 응답이 반영하지 못한다"는 문제다. 근거 문구의 부정확함이지 동작 자체의 새 결함은 아니다.
  - 제안: 지금 배치를 막을 사유는 아니다(경합 창이 매우 좁고 — 창 1 커밋~binder 락 획득 사이 — 데이터 손상도 없다, GET 재조회로 진실이 드러난다). 다만 plan 트래커의 해당 서술("binder 의 두 경로는 `false` 로 감추는 것이 맞다")에 "단, `update()` 경로는 create() 와 달리 대상 id 가 이미 공개돼 있어 이 근거가 문언 그대로 성립하지 않는다"는 한 줄을 보강해 두면, 다음 사람이 이 트레이드오프를 create()/update() 구분 없이 일반화하는 오해를 막을 수 있다.

- **[INFO]** 신규 404 트리거(창 1 재확인)는 기존 `findById()` 404 계약과 동일한 에러 봉투 — 확인 완료
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:400-405`(`throwTriggerNotFound`) vs `:356-359`(`assertTriggerFound`), 호출부 `:666`(창 1)
  - 상세: 두 경로 모두 `NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Trigger not found' })` 로 동일한 형태다. `rethrowEndpointPathConflict` 는 `endpointPath` UNIQUE 충돌만 `ConflictException` 으로 변환하고 그 외는 그대로 전파하므로, 신규 404 경로는 왜곡 없이 §5.3/5.4 에러 봉투 그대로 나간다. `DELETE /api/triggers/:id` 의 5초 lock-timeout 초과(`Postgres 57014`)는 `TriggersService.remove()` 에서 로그만 남기고 그대로 재던져(`triggers.service.ts:1031-1038`) 기존 `GlobalExceptionFilter`(`@Catch()`, 이번 diff 미변경)를 그대로 거치므로 에러 응답 형식은 이 경로에서도 신규 위반 없이 기존 500 처리와 동일하다 — 다만 이 신규 실패 모드(락 경합 5초 초과)는 `@ApiNotFoundResponse` 등 기존 Swagger 데코레이터에 별도로 문서화돼 있지 않다(관례상 5xx 는 이 API 전반에서 문서화 대상이 아니므로 이번 PR 이 그 관례를 깬 것은 아니다).
  - 제안: 없음(현행 관례 범위 안).

- **[INFO]** 응답 재구성 경로(재조회 후 응답)는 이번 변경으로 오히려 정합성이 개선됐다
  - 위치: `triggers.service.ts:490-519`(`create()`), `:620-719`(`update()`), `:1300-1332`(`rotateBotToken()`), `schedules.service.ts:216-265`(`SchedulesService.update()`)
  - 상세: `create()`/`update()` 는 여전히 쓰기 완료 **후** 재조회로 응답을 구성하는 기존 패턴을 유지한다. `rotateBotToken()` 의 반환값(`rotatedAt`/`chatChannelHealth`/`botIdentity`)은 `rewriteTriggerConfigLocked` 에 넘긴 `columns`/`mergedChannel` 과 동일한 로컬 값이라 응답-영속 상태 불일치가 없다. `SchedulesService.update()` 는 `trigger.name`/`trigger.isActive` 를 컬럼 한정 `update()` 로 쓰면서도 같은 in-memory `trigger` 참조(`schedule.trigger`)를 직접 mutate 해 두므로, DB 쓰기 방식이 바뀌었어도 응답 DTO 에 실리는 `schedule.trigger.name`/`isActive` 값은 여전히 정확하다 — 별도 재조회 없이도 응답 정합성이 유지된다.
  - 제안: 없음.

- **[INFO]** 형제 endpoint(`update()` 창1 vs `rotateBotToken()`)의 삭제-경합 404 형태는 이제 완전히 통일 — 이전 라운드 WARNING 이 지적한 비대칭 절반이 해소됨
  - 위치: `triggers.service.ts:666`(창 1, `assertTriggerFound(fresh)`), `:1318`(`rotateBotToken`, `if (!wrote) this.throwTriggerNotFound();`)
  - 상세: `review/code/2026/09/14/20_17_16/api_contract.md` WARNING 이 "`rotateBotToken` 은 삭제된 트리거에도 200 + 조작된 audit 로그를 낸다"고 지적한 부분은 이번 diff 에서 실제로 고쳐졌다 — `rotateBotToken` 은 이제 감사 로그 기록(`recordAudit`) **이전에** `wrote` 를 확인해 404 를 던지므로, "삭제됐는데 감사 로그엔 성공으로 남는다"는 감사 정합성 문제도 함께 닫혔다.
  - 제안: 없음(위 첫 항목의 binder 두 경로만 잔여).

## 관점별 요약

| 관점 | 판정 |
|---|---|
| 하위 호환성 | 컨트롤러·DTO·라우트 미변경 — 영향 없음 |
| 버전 관리 | 신규 버전 분기 없음 — 해당 없음 |
| 응답 형식 | 재조회 기반 응답 구성 패턴 유지, `rotateBotToken`/`schedules.update` 응답 정합성 확인 완료. 단 `update()`+`chatChannel`+극히 좁은 삭제 경합에서 이미 삭제된 리소스에 200 반환 가능(위 INFO#1, 기수용) |
| 에러 응답 | 신규 404 는 기존 `RESOURCE_NOT_FOUND` 봉투와 동일. `rotateBotToken`/창1 형제 비대칭은 이번 PR 로 해소, binder 두 경로만 의도적 잔여 |
| 요청 검증 | DTO·validation pipe 변경 없음 |
| URL/경로 설계 | 라우트 변경 없음 |
| 페이지네이션 | 목록 API 미변경 — 해당 없음 |
| 인증/인가 | 미들웨어·`@Roles` 변경 없음. 본 수정의 목적 자체가 인입 웹훅 서명 검증(인가 인접 보증)의 fail-open 을 막는 것이며, 그 보증이 실제로 복원됐음을 락 안 재계산(`survivesWithFresh`) 코드로 확인 |

## 요약

이번 변경은 컨트롤러·DTO·라우트·인증 미들웨어·페이지네이션 등 API 계약의 외부 표면을 전혀 건드리지 않는 서비스/영속성 계층 동시성 버그 수정이며, 8개 선행 리뷰 라운드가 이미 이 표면을 반복 검증해 왔다. 이번 라운드에서 실제 소스를 재확인한 결과, 이전 라운드가 지적한 "삭제-경합 시 형제 엔드포인트 간 에러 응답 비대칭" WARNING 은 `rotateBotToken()` 쪽이 실제로 수정되어 창 1 과 동일한 404 로 통일됐음을 확인했다. 다만 `ChatChannelBinderService.setupChatChannel()` 의 성공/실패 두 경로는 여전히 같은 삭제-경합 신호(`false`)를 관측하지 않으며, 이로 인해 `chatChannel` 을 포함한 `PATCH /api/triggers/:id` 가 극히 좁은 경합 창에서 이미 삭제된 리소스에 대해 200 + 전체 바디를 반환할 수 있는 경로가 남아 있다 — 이는 이번 라운드가 새로 발견한 결함이 아니라, plan 트래커(`trigger-config-lost-update.md:391`)에 이미 "수용·부분 수정"으로 명시적으로 기록된 팀의 의도적 판단이다. 근거 문구("이미 응답이 나갔다")가 `create()`에는 맞지만 `update()`에는 문언 그대로 성립하지 않는다는 뉘앙스만 남기는 것을 권고하며, 데이터 손상이 없고 GET 재조회로 진실이 드러나는 낮은 위험도의 잔여 항목이라 이번 배치를 막을 사유는 아니다. 새 에러 코드·상태 코드 형식 위반, 요청 검증 누락, 하위 호환성 파괴는 발견되지 않았다.

## 위험도

LOW
