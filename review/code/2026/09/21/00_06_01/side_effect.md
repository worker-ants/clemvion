# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 동시 DELETE 두 건이 겹치면 BullMQ `removeJob`(외부 큐 조작)이 여전히 두 번 호출된다 — 이 PR 이 의도적으로 남겨 둔 잔여
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:303` (`await this.scheduleRunnerService.removeJob(schedule.id);`) — advisory lock 획득(318행)보다 앞이라 두 요청 모두 도달한다.
  - 상세: `findById`(301) 은 잠금 없는 선조회라 겹치는 두 요청 모두 `removeJob` 을 부른다. 이번 diff 는 그 아래 트랜잭션의 `m.delete(Trigger, …)` `affected` 로 감사 중복만 판별할 뿐, `removeJob` 이중 호출 자체는 고치지 않는다. `plan/in-progress/schedule-dup-delete.md` "이 PR 이 하지 않는 것" 절(76행 부근)이 이를 명시적으로 defer 했고, 형제 PR(#1369·#1370)도 같은 잔여를 남겼다고 적었으므로 **은닉된 결함이 아니라 알려진·문서화된 잔여 부작용**이다. BullMQ 측 `removeJob` 이 존재하지 않는 job 에 대해 안전한 no-op 인지까지는 이번 diff 범위에서 재검증되지 않았다.
  - 제안: 신규 조치 불요(이미 트래커에 defer 근거가 남아 있음). 다만 `IntegrationsService.remove()` 등 후속 자리를 처리할 때 이 잔여도 같은 이유로 남을지 재확인할 가치가 있다.

- **[INFO]** 동시 DELETE 의 "진 쪽" 응답이 204 → 404 로 바뀌는 의도된 API 동작 변화
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` `remove()` 330~335행(트리거 경로), 372~377행(트리거 없는 방어 분기)
  - 상세: 이번 diff 의 목적 자체가 이 동작 변화다 — 종전에는 겹치는 두 번째 요청도 조용히 204 를 반환하며 `schedule.deleted` 감사를 중복 기록했고, 이제는 `NotFoundException({code:'RESOURCE_NOT_FOUND'})` 를 던져 404 로 끝난다. 컨트롤러(`schedules.controller.ts:299`)는 별도 catch 없이 그대로 전파하므로 `GlobalExceptionFilter` 가 404 로 매핑한다. 순차 호출(겹치지 않는 재삭제)은 이미 `findById` 단계에서 404 였으므로 이 변화는 "advisory lock 대기 중이던 동시 요청"이라는 좁은 창에만 영향을 준다 — 클라이언트가 이 좁은 창에서 204 를 기대해 만든 로직이 있다면 영향을 받을 수 있으나, 이는 버그 수정의 목적이자 형제 PR(#1369·#1370)과 동일한 선례다.
  - 제안: 조치 불요. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:4795` 트래커가 스펙 문서(`3-schedule.md §4`)에 이 계약을 반영하는 후속 항목을 잡아 두었다.

- **[INFO]** `scheduleRepository.remove(schedule)` 가 트리거 경로에서 사실상 0행 no-op 으로 남는다(의도됨)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:364`
  - 상세: `schedule.trigger_id → trigger` FK 가 `onDelete: 'CASCADE'` 라(`codebase/backend/src/modules/schedules/entities/schedule.entity.ts` `trigger` 컬럼) 트리거 삭제 시점에 스케줄 행은 이미 DB 가 지운다. `Schedule` 엔티티에 `@BeforeRemove`/`@AfterRemove` 등 라이프사이클 훅이 없음을 확인했으므로(엔티티 전문 확인), 이 no-op 호출이 존재하지 않는 도메인 이벤트를 추가로 발생시키는 부작용은 없다. 주석이 그 의도(CASCADE 제거 시 유일한 삭제 경로가 되도록 방어적으로 유지)를 정확히 서술한다.
  - 제안: 조치 불요.

## 확인한 항목 (부작용 없음)

- 전역 변수·모듈 스코프 상태 도입 없음 — `SchedulesService` 는 기존 생성자 주입 필드만 사용.
- `remove()` 시그니처(`(id, workspaceId, userId) => Promise<void>`) 변경 없음 — 내부 판정 로직만 교체.
- 환경 변수 신규 읽기/쓰기 없음(e2e 의 `E2E_BASE_URL` 은 형제 e2e 스펙과 동일한 기존 패턴).
- `.catch()` 핸들러가 `NotFoundException` 을 조용히 삼키지 않고 그대로 rethrow — 로거 호출(`this.logger.error`)은 "진짜" 실패 케이스에만 발생하도록 분기되어 있어(341행 조기 rethrow), 동시 삭제로 인한 정상 404 를 반쯤-삭제 오류로 오탐 로깅하지 않는다. 단위 테스트(`schedules.service.spec.ts` 772~804행)가 `expect(error).not.toHaveBeenCalled()` 로 이를 직접 고정한다.
- `manager.transaction()` 콜백 안에서 던진 `NotFoundException` 은 표준 TypeORM 동작대로 트랜잭션을 롤백시키고 advisory lock(트랜잭션 범위)도 함께 해제된다 — 락 누수 없음.
- 테스트 파일의 `jest.spyOn(Logger.prototype, 'error')` 는 `try/finally` 로 `mockRestore()` 하여 다른 테스트로의 스파이 누출이 없다. `beforeEach` 가 매 테스트마다 `Test.createTestingModule` 을 새로 빌드하므로 `mockResolvedValueOnce` 잔여 큐가 테스트 간 공유되지 않는다.
- `git diff --stat` 로 변경 파일 13개 전부를 프롬프트 목록과 대조 — 의도치 않은 부수 파일(포맷터 drive-by, 무관 코드 변경) 없음. 코드 변경은 `schedules.service.ts`/`schedules.service.spec.ts`/신규 e2e 스펙 3개 파일에 정확히 국한되고 나머지는 plan/review 문서다.
- 리뷰 중 저장소 파일에 뮤테이션을 가하지 않았다(읽기 전용 조사만 수행) — `git status --short` 상 이 리뷰 산출물 디렉터리 외 변경 없음.

## 요약

이번 diff 는 `SchedulesService.remove()` 의 동시 DELETE 중복 감사 결함을 형제 PR(#1369 워크플로/워크스페이스, #1370 트리거)과 같은 형태(락 보호 쓰기의 `affected` 를 판별자로 삼고, CASCADE 로 사라지는 하위 행 자체는 판별자가 될 수 없다는 원칙)로 닫는다. 함수 시그니처·공개 인터페이스·전역 상태·환경 변수 변경은 없고, 유일한 관측 가능한 동작 변화(겹치는 두 번째 DELETE 가 204 대신 404 를 반환)는 이 PR 의 목적 자체이며 테스트·e2e·plan 문서 세 층위에서 일관되게 고정되어 있다. 유일한 미해결 부작용은 BullMQ `removeJob` 이 advisory lock 이전에 위치해 동시 요청 둘 다 호출한다는 것인데, 이는 이번 PR 이 명시적으로 defer 한 기존 잔여이지 이 diff 가 새로 만든 결함이 아니다. Critical/Warning 급 신규 부작용은 발견되지 않았다.

## 위험도

LOW
