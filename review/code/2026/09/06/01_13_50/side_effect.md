# 부작용(Side Effect) Review

## 발견사항

- **[WARNING]** `SchedulesController.toResponse` — trigger 관계 미로드 시 500, `findAll` 의 blast radius 가 개별 필드에서 엔드포인트 전체로 확대됐다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:71` (`toResponse`), `:91`(`logger.error`), `:96`(`throw new InternalServerErrorException`), `:131`(`findAll` 의 `data.map((s) => this.toResponse(s))`)
  - 상세: 종전 컨트롤러는 `schedulesService.findAll/findById/create/update` 의 반환값을 그대로 JSON 직렬화했다 — `schedule.trigger` 가 어떤 이유로든 로드되지 않은 행이 있어도(예: 조인 실패·고아 행) `trigger` 키가 `undefined`(직렬화 시 생략)로 응답 자체는 200 이었다. 이번 변경은 `toResponse` 에서 `!t` 를 명시적으로 검사해 `InternalServerErrorException`(500, 진단 메시지는 로그로만)을 던진다. 단건 조회(`GET /:id`)에서는 그 한 건만 실패하지만, **목록(`GET /api/schedules`)은 `data.map(...)` 안에서 호출되므로 워크스페이스의 스케줄 중 단 한 행이라도 trigger 가 안 실려 있으면 목록 전체 요청이 500 으로 실패한다** — 이전에는 그 한 행만 `trigger` 필드가 비어 보이고 나머지 행·전체 목록은 정상 응답이었다. PR 자체 주석은 "정상 데이터로는 도달 불가"(`schedule.trigger_id` NOT NULL + FK CASCADE)라고 근거를 대고, CWE-209(진단 정보가 응답 바디로 새는 문제)는 이미 여러 라운드에 걸쳐 고쳐지고 유닛 테스트(`schedules.controller.spec.ts` `trigger 미로드 행은 던지되 응답에 진단을 싣지 않는다`)로 회귀 방지돼 있다. 다만 "고아 행이 생길 수 없다"는 전제가 100% 보장되지 않는 한(예: 마이그레이션 실수, 수동 DB 조작, 미래의 스키마 완화) **가용성 영향의 blast radius 확대**(개별 필드 결손 → 목록 전체 500) 자체는 이 리뷰 이력에서 별도로 언급된 적이 없어 보인다.
  - 제안: 의도된 설계라면 이 blast-radius 트레이드오프(1개 행 손상 → 전체 목록 500)를 CHANGELOG/스펙에 한 줄로 명시해 다음 사람이 "왜 목록 전체가 죽었는지"를 바로 찾게 해두는 것을 권한다. 원치 않으면 `findAll` 경로에서만 개별 행 단위로 격리(예: 문제 행을 스킵하고 로그만 남기거나, 부분 실패를 별도 필드로 표시)하는 방안도 검토할 수 있다.

- **[INFO]** 신규 module-level 캐시(`contractCache`) — 테스트 유틸리티에 새 공유 가변 상태 도입.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:386` (`const contractCache = new Map<Type<unknown>, Promise<DtoContract>>();`), `:412-425` (`contractForDto`)
  - 상세: `contractForDto` 가 DTO 클래스를 키로 하는 module-level `Map` 에 "진행 중이거나 완료된 Promise" 를 캐시한다. 실패한 Promise 는 캐시에서 지우고 재던지도록 처리해 "한 번 실패하면 영원히 실패" 문제는 피했다(`:420`). 격리 단위가 "Jest worker" 가 아니라 "테스트 파일"(Jest 모듈 레지스트리 파일 단위)이라는 점을 코드 자신이 실측으로 정정해 뒀다(이전 리뷰에서 반증됨). 프로덕션 코드에는 영향이 없고(`src/shared/testing/` 는 테스트 전용), 오히려 종전에 각 `it()` 마다 반복 부트스트랩하던 것을 파일 단위로 줄여 리소스 사용을 낮추는 방향이라 실질적 위험은 낮다. 다만 "새 전역(모듈 레벨) 가변 상태 도입"이라는 점 자체는 점검 관점 2에 해당해 기록해 둔다.
  - 제안: 조치 불요 — 테스트 전용 스코프이고 실패-캐시 방지 로직도 있어 안전하다. 관찰만 남긴다.

- **[INFO]** 응답 인터페이스 변경(narrowing) — `GET/POST/PATCH /api/schedules`, `GET/POST/PATCH /api/triggers` 의 `trigger`/`workflow` 중첩 객체 형태가 좁혀졌다. 기존 소비자 영향.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:71-118`(`toResponse`), `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:20-56`(`ScheduleTriggerRefDto`/`ScheduleTriggerWorkflowRefDto` 신설 + `ScheduleDto.trigger` 타입 변경), `codebase/backend/src/modules/triggers/triggers.service.ts:691-748`(`sanitizeForResponse`, `narrowWorkflowRef`), `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:10-34`(`TriggerWorkflowRefDto` 신설 + `TriggerDto.workflow` 타입 변경)
  - 상세: 종전에는 컨트롤러/서비스가 조인된 `Trigger`/`Workflow` **엔티티 전체**를 응답 바디에 실었다(그 안에 `notificationSecretV2` 평문 서명 secret, `chatChannelTokenV2` secret store ref 가 포함돼 있었다 — 이 PR 이 고치는 보안 결함 자체). 이번 변경으로 `trigger`/`workflow` 는 각각 참조 필드(`id`/`name`/`workflowId`(+`workflow`), `id`/`name`)로만 응답에 실린다. 이는 명백한 wire 계약 축소(breaking change)이며, `CHANGELOG.md`("Unreleased — 트리거 회전 secret 이 두 엔드포인트로 나갔다")에 상세히 문서화돼 있고, 저장소 전수 검색으로 "`/api/schedules` 를 부르는 소비자는 프런트엔드 `lib/api/schedules.ts` 의 `RawSchedule` 타입 하나뿐이며 그 타입이 선언한 필드가 정확히 이번에 남긴 4개"라는 근거, 그리고 배포되는 `@workflow/sdk` 는 schedule API 를 다루지 않는다는 근거까지 CHANGELOG 에 제시돼 있다. 즉 인터페이스 축소는 실재하지만 영향 범위 확인·문서화가 이미 이뤄진 상태다.
  - 제안: 조치 불요 — 이미 CHANGELOG 로 투명하게 공지되고 영향 범위(외부 소비자 0)가 근거와 함께 제시돼 있다. 향후 외부 파트너/서드파티 API 소비자가 생기면 그 시점에 API 버전 정책을 재검토할 필요가 있다는 점만 참고.

## 요약

이번 diff 의 핵심 부작용은 크게 세 갈래다. (1) 보안 결함 수정(트리거 회전 secret 이 스케줄/트리거 조인을 타고 유출되던 문제)을 고치며 응답 스키마를 의도적으로 좁혔고, 이는 CHANGELOG 로 투명하게 공지되고 영향 범위(외부 소비자 없음)가 근거와 함께 확인됐다. (2) `SchedulesController.toResponse` 가 trigger 관계 미로드를 500 으로 승격시키며, `findAll` 경로에서는 단일 행 이상 문제가 워크스페이스 전체 목록 요청을 실패시키는 새로운 가용성 blast-radius 를 만든다 — CWE-209(진단 정보 유출) 측면은 이미 여러 라운드에 걸쳐 검증됐으나 "한 행이 전체 목록을 죽인다"는 측면은 별도로 다뤄진 적이 없어 WARNING 으로 남긴다. (3) 테스트 유틸리티(`response-contract.ts`)에 module-level 캐시가 새로 생겼지만 프로덕션 코드와 무관하고 실패-캐시 방지 로직까지 갖춰 위험은 낮다. 그 외 전역 변수 신설, 예기치 못한 파일시스템 쓰기, 의도치 않은 네트워크 호출, 환경변수 오남용, 콜백/이벤트 계약 변경은 관측되지 않았다. 뮤테이션 검증은 수행하지 않았고(정적 diff 리딩과 git diff 대조만으로 결론 도출), 저장소에 어떤 파일도 쓰거나 수정하지 않았다(`git status --short` 로 확인할 변경 없음).

## 위험도
MEDIUM
