# 부작용(Side Effect) Review

## 발견사항

- **[WARNING]** `SchedulesController.toResponse` — trigger 관계 미로드 시 500, `findAll` 의 장애 반경이 "행 하나"에서 "목록 전체"로 확대됐다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:71`(`toResponse` 선언), `:96`(`throw new InternalServerErrorException`), `:131`(`findAll` 의 `data: page.data.map((s) => this.toResponse(s))`)
  - 상세: 종전 컨트롤러는 서비스 반환값을 그대로 직렬화했다 — `schedule.trigger` 가 어떤 이유로든 비어 있어도(조인 실패·고아 행) `trigger` 키가 생략된 채 200 이 나갔다. 이번 변경은 `toResponse` 안에서 `!t` 를 명시적으로 검사해 `InternalServerErrorException`(500, 진단은 로그로만 — CWE-209 대응은 `schedules.controller.spec.ts` 의 `trigger 미로드 행은 던지되 응답에 진단을 싣지 않는다` 로 회귀 방지됨)을 던진다. 단건 조회(`GET /:id`)에서는 그 한 건만 실패하지만, **목록(`GET /api/schedules`)은 `data.map(...)` 안에서 호출되므로 워크스페이스의 스케줄 중 단 한 행만 trigger 미로드여도 목록 전체 요청이 500 이 된다.** PR 자체 근거(`schedule.trigger_id` NOT NULL + FK `onDelete: 'CASCADE'` → "정상 데이터로는 도달 불가")는 타당하지만, 그 전제가 100% 보장되지 않는 경로(마이그레이션 실수·수동 DB 조작·향후 스키마 완화)가 생기면 단일 행 손상이 워크스페이스 전체 스케줄 목록 가용성을 앗아간다.
  - **후속 확인**: 이 우려는 직전 라운드(`review/code/2026/09/06/01_13_50`)에서 이미 WARNING 으로 제기됐고, 이번 diff 의 `CHANGELOG.md`("Unreleased — 트리거 회전 secret 이…" 절, "하나의 손상된 행이 목록 전체를 500 으로 만든다 — 의도된 트레이드오프다" 인용문)에 그 라운드를 명시 인용하며 트레이드오프가 문서화됐다. 즉 제안했던 두 선택지(문서화 / 행 단위 격리) 중 **문서화**가 채택됐다. 다만 문서화는 진단 가능성을 높일 뿐 장애 반경 자체를 줄이지는 않으므로, 그 위험이 실재한다는 사실 자체는 그대로 남아 있어 이번 라운드에서도 WARNING 으로 이월한다.
  - 제안: 조치 불요(이미 의도적으로 수용되고 문서화됨) — 다만 "고아 행이 생길 수 없다"는 전제가 깨지는 사고(스키마 마이그레이션, FK 제약 우회 등)가 생기면 이 결정을 재검토할 신호로 삼을 것.

- **[INFO]** 병렬 세션의 일시적 뮤테이션 관측 — `schedules.controller.ts` 의 `InternalServerErrorException` 메시지가 리뷰 도중 잠깐 진단 정보를 포함한 문자열로 바뀌었다가 원상 복구됨.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:96-99`
  - 상세: 이 리뷰를 진행하는 도중, harness 가 "파일이 디스크에서 바뀌었다" 는 알림과 함께 해당 파일의 스냅샷을 보여줬는데, 그 스냅샷에서는 `message` 가 `` `Schedule ${schedule.id} has no loaded trigger (join/relation missing)` `` 로 — 바로 위 자체 주석(`:85-89`)이 "CWE-209 로 지적돼 고쳤다" 고 서술하는 바로 그 결함(스케줄 ID·조인 구조가 500 응답 바디로 노출)을 재현하는 내용이었다. 즉시 `Read` 로 재확인한 결과 파일은 고정 문구(`'서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'`)로 돌아와 있었고, `git diff`/`git status --short` 모두 이 파일에 대해 변경 없음을 보였다 — 즉 **커밋된 상태와 현재 디스크 상태가 일치**하며 CWE-209 재발은 없다. 병렬로 도는 다른 리뷰어(뮤테이션 검증 목적으로 추정)가 이 자리를 잠깐 고쳤다가 되돌린 것으로 보인다. 나는 이 파일을 직접 쓰거나 고치지 않았다.
  - 제안: 조치 불요 — 현재 상태는 안전함을 재확인했다. 다만 이 관측 자체는 프로토콜(뮤테이션 규약 §4)에 따라 투명하게 남긴다. 최종 push 전에는 `schedules.controller.ts:96-99` 의 `message` 가 고정 문구인지, `schedules.controller.spec.ts` 의 `trigger 미로드 행은 던지되 응답에 진단을 싣지 않는다` 가 그린인지 한 번 더 확인할 것을 권한다.

- **[INFO]** 신규 module-level 캐시(`contractCache`) — 테스트 유틸리티에 새 공유 가변 상태 도입.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:386`(`const contractCache = new Map<Type<unknown>, Promise<DtoContract>>();`), `:412-425`(`contractForDto`)
  - 상세: `contractForDto` 가 DTO 클래스를 키로 module-level `Map` 에 "진행 중이거나 완료된 Promise" 를 캐시한다. 실패한 Promise 는 캐시에서 지우고 재던지도록 처리해 있다(`:420` `contractCache.delete(Dto)` — `response-contract.spec.ts` 의 `실패한 promise 는 캐시에 남지 않는다` 테스트로 고정됨). 격리 단위는 "Jest worker" 가 아니라 "테스트 파일"(Jest 모듈 레지스트리가 파일마다 새로 생성)이라 파일 간 오염은 없다. `src/shared/testing/` 는 테스트 전용이라 프로덕션 런타임에는 영향이 없다.
  - 제안: 조치 불요 — 테스트 스코프에 한정되고 실패-캐시 방지 로직도 검증돼 있다.

- **[INFO]** 응답 인터페이스 narrowing — `GET/POST/PATCH /api/schedules`, `GET/POST/PATCH /api/triggers` 의 `trigger`/`workflow` 중첩 객체가 엔티티 전체에서 참조 필드로 좁혀졌다(breaking change).
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:71-118`(`toResponse`), `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:1-31`(`ScheduleTriggerRefDto`/`ScheduleTriggerWorkflowRefDto` 신설), `:115-116`(`ScheduleDto.trigger: ScheduleTriggerRefDto`), `codebase/backend/src/modules/triggers/triggers.service.ts:698`(`sanitizeForResponse`), `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:1-34`(`TriggerWorkflowRefDto` 신설)
  - 상세: 종전에는 조인된 `Trigger`/`Workflow` 엔티티 전체가 응답 바디에 실렸다(그 안에 `notificationSecretV2`·`chatChannelTokenV2` 등 비밀이 포함 — 본 PR 이 고치는 결함 그 자체). 이번 변경으로 두 필드는 참조 서브셋으로만 나간다. `CHANGELOG.md` 에 "밖에서 이 축소를 맞는 소비자는 없다" 는 근거(프런트엔드 `lib/api/schedules.ts` `RawSchedule` 타입 대조, `@workflow/sdk` 는 schedule API 미사용)와 함께 투명하게 공지돼 있다.
  - 제안: 조치 불요 — 영향 범위(외부 소비자 0)가 근거와 함께 이미 확인·문서화됨. 향후 서드파티 API 소비자가 생기면 그 시점에 API 버전 정책을 재검토.

- **[INFO]** `TriggersService.sanitizeForResponse` — 조기 return 제거로 반환 객체의 참조 동일성 보장이 사라졌다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:698`(`sanitizeForResponse` 선언), `:748`(`Object.assign(Object.create(...), trigger, overrides)` — 조기 return 없이 매번 새 객체 생성), `:753`(`deleteSecretColumns(sanitized...)`)
  - 상세: 종전 `sanitizeChatChannelForResponse` 는 `if (!cfg?.chatChannel) return trigger;` 로 정화할 것이 없으면 **원본 참조를 그대로** 돌려줬다. 이번 변경은 그 조기 return 을 없애 모든 트리거가 `Object.assign` 을 거친 **새 객체**를 받는다 — 함수 JSDoc 이 "호출부는 참조 동일성을 전제하지 말 것" 이라고 명시적으로 경고해 뒀다. `deleteSecretColumns` 는 이 새 객체(`sanitized`)에만 `delete` 를 적용하므로 원본 `trigger` 엔티티(공유 상태)는 변경되지 않는다 — 확인됨, 문제 없음. 다만 이 함수의 유일한 내부 호출부들(`findAll`/`findOneDetail`/`create`/`update`) 는 모두 반환값을 즉시 바깥으로 내보내며 참조 비교를 하지 않아, 현재 코드에서는 실질적 영향이 없다.
  - 제안: 조치 불요 — 관찰만 기록. 향후 이 메서드 반환값을 캐싱하거나 `===` 로 비교하는 코드가 추가되면 이 변경을 기억할 것.

- **[INFO]** `TriggersService.update()` — `setupChatChannel` 후 재조회 쿼리에 `relations: ['workflow']` 추가로 DB JOIN 이 하나 늘었다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `update()` 메서드, `refreshed = await this.triggerRepository.findOne({ where: { id: saved.id, workspaceId }, relations: ['workflow'] })` 자리 (diff 상 `@@ -363,12 +503,19 @@` 인근, `chatChannel` 설정 경로에서만 실행).
  - 상세: `chatChannel` 설정이 있는 PATCH 요청에서만 타는 재조회 경로에 관계 하나가 추가됐다 — PATCH 응답에서 `workflow` 가 사라지는 버그(§5.4 계약 위반)를 고치기 위한 의도된 변경이며 부수적 쿼리 비용 외에 다른 부작용은 없다.
  - 제안: 조치 불요.

## 요약

이번 diff 의 핵심 부작용은 트리거 회전 secret 유출을 막는 보안 수정에서 파생한다. (1) 응답 스키마를 엔티티 전체에서 참조 서브셋으로 의도적으로 좁혔고 영향 범위(외부 소비자 0)가 CHANGELOG 에 근거와 함께 공지돼 있다. (2) `SchedulesController.toResponse` 가 trigger 관계 미로드를 500 으로 승격시키며 `findAll` 경로에서 단일 행 손상이 워크스페이스 전체 목록 요청을 실패시키는 장애 반경 확대를 낳는다 — 직전 라운드 WARNING 이 이번 diff 의 CHANGELOG 문서화로 대응됐으나, 위험 자체(가용성 blast radius)는 줄지 않았으므로 WARNING 으로 이월했다. (3) 테스트 유틸리티에 module-level 캐시(`contractCache`)가 새로 생겼으나 프로덕션과 무관하고 실패-캐시 방지도 검증돼 있다. `sanitizeForResponse` 의 참조 동일성 상실은 현재 호출부에 영향이 없음을 확인했다. `deleteSecretColumns` 는 새로 생성된 사본에만 적용되어 공유 엔티티를 오염시키지 않는다. 리뷰 도중 `schedules.controller.ts` 가 일시적으로 CWE-209 스타일 진단 유출 메시지로 바뀌었다가 원복된 것을 관측했는데, `git diff`/`git status` 로 현재 상태가 커밋 상태와 일치함(안전)을 재확인했다 — 병렬로 도는 다른 리뷰어의 뮤테이션 검증 잔상으로 추정되며 내가 이 파일을 쓴 적은 없다. 그 외 전역 변수 신설(테스트 스코프 제외), 예기치 못한 파일시스템 쓰기, 의도치 않은 네트워크 호출, 환경변수 오남용, 콜백/이벤트 계약 변경은 관측되지 않았다. `git diff origin/main...HEAD` 정적 대조와 소스 직접 열람만으로 결론을 냈고(뮤테이션 실행 없음), 저장소에는 어떤 파일도 쓰거나 수정하지 않았다(`git status --short` 로 확인 — 세션이 생성한 `review/**` 산출물 외 변경 없음).

## 위험도
LOW
