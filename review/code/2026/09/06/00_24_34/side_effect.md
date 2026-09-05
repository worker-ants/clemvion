# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `SchedulesController.toResponse` 가 `trigger` 관계 미로드 시 새로운 미처리
  예외(TypeError) 경로를 만든다 — 종전에는 필드가 조용히 빠지는 정도였는데 이제는 요청이
  통째로 500 이 된다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:67-85` (특히 `79|
    id: t.id,`)
  - 상세: `toResponse` 는 `schedule.trigger` 를 무조건 `t.id`/`t.name`/`t.workflowId` 로
    구조분해한다(69, 79-81행). 주석(70-72행) 자신이 "관계가 로드되지 않은 채 여기 오면
    `t.id` 에서 즉시 터진다" 고 인정하고 있다 — 즉 `trigger` 가 `undefined` 면
    `Cannot read properties of undefined` 가 던져진다. `findAll`/`findById`/`create`/
    `update` 네 경로가 전부 `leftJoinAndSelect`/`relations`/직접 대입으로 `trigger` 를
    채우고 `Schedule.trigger_id` 가 NOT NULL 1:1 이라(주석·`ScheduleTriggerRefDto` 근거)
    정상 데이터에서는 도달하지 않는다는 설계 의도는 이해하지만, 이전 코드는 컨트롤러가
    서비스 반환값을 그대로 넘겼을 뿐이라 이런 필드 접근 자체가 없었다 — 이번 PR 이 새로
    만든 실패 모드다. `GlobalExceptionFilter`(`common/filters/http-exception.filter.ts`)가
    스택트레이스 노출 없이 일반 500 으로 마스킹하므로 정보 유출·앱 크래시로는 이어지지
    않지만, 데이터 정합성이 깨진 한 행(예: 마이그레이션 갭·경합 상태로 `trigger` 관계가
    비는 경우) 때문에 그 워크스페이스의 스케줄 목록 조회 전체가 500 이 될 수 있다는 점은
    실제 가용성 영향이다.
  - 제안: 의도된 설계이면 그대로 두되, 이 fail-fast 가 실제로 관측되면(로그의
    `TypeError` 스택) 그 즉시 데이터 정합성 문제로 취급하도록 알람/런북에 남겨 둔다.
    최소한으로는 `if (!t) throw new InternalServerErrorException(...)` 처럼 의도를 코드로
    드러내 다음 사람이 "버그"로 오인해 방어 코드를 추가하지 않도록 하는 편이 낫다.

- **[INFO]** 응답 형태 좁히기(스케줄 `trigger`, 트리거 `workflow`, 감사로그 `user`)가
  실질적으로 wire 계약을 좁히는 인터페이스 변경이다 — 의도된 보안 수정이지만 "기존
  사용자에 미치는 영향" 관점에서 기록해 둔다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:76-84`
    (`ScheduleDto.trigger`), `codebase/backend/src/modules/triggers/triggers.service.ts:691`
    이하 `sanitizeForResponse`/`narrowWorkflowRef`(`TriggerDto.workflow`),
    `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` 의 `leftJoin` +
    `addSelect(['user.id','user.name','user.email'])` 치환부(`AuditLogDto.user`).
  - 상세: 종전에는 컨트롤러가 엔티티(또는 조인된 관계)를 그대로 직렬화해 `Trigger`/
    `User` 전체 컬럼이 응답에 실렸다(그 자체가 이번 PR 이 고치는 유출 결함). 수정 후에는
    각각 `{id,name,workflowId,workflow?}` / `{id,name}` / `{id,name,email}` 로 좁혀진다.
    이는 "선언되지 않은 필드를 노출하던 사고"를 "명시적으로 계약을 좁히는" 방향으로
    바꾼 것이라 옳은 방향이지만, 결과적으로 **직전까지 wire 에 실제로 존재했던 필드들이
    이번 커밋을 기점으로 사라진다** — 문서화되지 않았을 뿐 실제 응답 바디 계약이었다.
    PR 자신의 `scope.md`(파일 43)가 FE 소비처를 grep 으로 확인했다고 적어 두었고, 그
    확인 방식과 결론에는 동의한다. 다만 "선언되지 않은 필드라 계약이 아니다"라는 전제는
    문서 계약 관점일 뿐, wire 관점에서는 이번 커밋이 실제로 필드를 제거하는 breaking
    change 라는 사실 자체는 side-effect 관점에서 명시해 둔다.
  - 제안: 조치 불요 — CHANGELOG 에 breaking 항목으로 이미 남겨졌는지만 문서 리뷰어가
    확인하면 된다.

- **[INFO]** `response-contract.ts` 가 프로세스 수명 동안 유지되는 새 모듈 레벨 전역
  가변 상태(`contractCache`)를 도입한다 — 프로덕션 번들에는 포함되지 않음을 확인했다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:386`
    (`const contractCache = new Map<Type<unknown>, Promise<DtoContract>>();`),
    소비부 `:412` 이하 `contractForDto`.
  - 상세: DTO 클래스를 키로, 생성된 OpenAPI 계약(Promise)을 값으로 캐시하는 `Map`이다.
    JSDoc 이 스스로 "격리 단위는 테스트 파일"이라고 명시하고, `tsconfig.build.json`
    (`exclude: ["src/repo-guards/**", "src/shared/testing/**"]`)로 이 디렉터리 전체가
    프로덕션 `dist` 에서 빠지는 것을 확인했다. `grep` 으로 `src/modules/**` 에서 이
    모듈을 import 하는 곳이 없음도 확인했다 — 런타임(프로덕션) 경로에 영향 없음.
    다만 캐시된 `DtoContract.schema`/`schemas` 는 얼리지 않은(non-frozen) 객체라, 어떤
    소비 코드가 실수로 그 스키마를 변형하면 같은 Jest 파일 안의 이후 호출이 오염된 값을
    받는다 — 이는 이전 라운드(`review/code/2026/09/05/22_24_58` INFO#11)가 이미 검토하고
    "현재 소비자는 전부 읽기 전용이므로 `Object.freeze` 는 지금 도입하지 않는다"고
    명시적으로 결정한 사안이라 재차 차단 사유로 올리지 않는다.
  - 제안: 조치 불요 (기결정 사항, 재확인 완료).

- **[INFO]** `SchedulesService.create`/`update` 의 `saved.trigger = ...` 대입이 `if
  (isActive)` 조건 밖으로 나와 **항상** 실행되도록 바뀌었다 — DB 에는 반영되지 않는
  in-memory 전용 대입임을 재확인했다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:203`
    (`saved.trigger = savedTrigger;`), `:263` (`saved.trigger = trigger ?? schedule.trigger;`)
  - 상세: 두 대입 모두 `this.scheduleRepository.save(...)` 호출이 **끝난 뒤**에 실행된다
    (188행 `const saved = await this.scheduleRepository.save(schedule);` / 250행 동일
    패턴). TypeORM 의 `save()` 는 그 시점 이후의 속성 변경을 자동으로 다시 write-back
    하지 않으므로, 이 대입은 응답 조립용 in-memory 장식이며 DB write 를 유발하지 않는다.
    이 서비스 메서드들(`create`/`update`)의 유일한 호출자가 `SchedulesController`
    뿐임(`grep` 으로 확인, 다른 모듈에서 호출 없음)도 확인했다 — 이 대입이 무조건 실행되게
    바뀌어도 컨트롤러 외 다른 소비자에 미치는 부작용은 없다. 이 항목은
    `review/code/2026/09/05/21_40_37` RESOLUTION 이 "side_effect 가 안전을 확인했다"고
    적은 것과 같은 결론이며, 이번 회차 diff 에도 동일 코드가 포함돼 있어 재확인 차원에서
    기록한다.
  - 제안: 조치 불요.

- **[INFO]** `TriggersService.sanitizeForResponse` 가 조기 return 제거로 인해 더 이상
  참조 동일성을 보장하지 않는다 — 호출부는 항상 새 객체를 받는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:691` 이하
    (`sanitizeForResponse`).
  - 상세: 종전 구현은 `config.chatChannel` 이 없으면 `return trigger;`(원본 참조 그대로)
    였다. 이번 diff 는 조기 return 을 없애고 매 호출마다
    `Object.assign(Object.create(...), trigger, overrides)` 로 **항상 새 객체**를
    만든다. JSDoc(“조기 return 을 없앤 뒤로는 정화할 것이 없는 트리거도 새 참조를
    받는다, 그러니 호출부는 참조 동일성을 전제하지 말 것”)이 이 변화를 스스로 경고하고
    있다. 현재 호출부 7곳(`findAll`/`findOneDetail`/`create`/`update` 내부)은 전부
    `return this.sanitizeForResponse(...)` 형태의 종단 반환이라 참조 동일성에 의존하는
    코드가 없음을 확인했다 — 지금은 문제가 없지만, 다음에 이 메서드를 호출하며 반환값과
    원본을 `===` 비교하거나 WeakMap 키로 쓰는 코드가 추가되면 조용히 깨질 수 있는
    자리다.
  - 제안: 조치 불요 — 문서화가 이미 충분하다. 향후 호출부 추가 시 이 JSDoc 을 참고하도록
    남겨 둠.

- **[INFO]** 환경 변수·파일시스템 쓰기·외부 네트워크 호출 관점에서는 이번 diff 에 새로
  도입된 항목이 없음을 확인했다.
  - 위치: 전체 `codebase/` diff.
  - 상세: `process.env`, `fs.writeFileSync`/`fs.write`, `fetch`/`axios`/`http(s).request`
    패턴을 diff 전체에서 grep 했고, 유일하게 발견된 `fs.readFileSync` 는
    `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` 의
    `findOptionalNullableResponseFields` 가 호출부(`swagger-dto-contract.spec.ts`)로부터
    받은 파일 목록을 정적 분석(TS AST 파싱)하기 위해 읽는 것뿐이다 — 쓰기가 아니고,
    스캔 범위도 `src/modules` 로 한정되어 있어(테스트로 고정) 저장소 밖이나 프로덕션
    베이스라인에 영향이 없다. `buildSwaggerDocument`(response-contract.ts 가 의존)도
    격리된 NestJS 테스트 모듈을 세워 OpenAPI 문서를 생성한 뒤 `app.close()` 로 즉시
    닫을 뿐, 실제 네트워크 리스닝이나 외부 서비스 호출은 없다.
  - 제안: 조치 불요.

## 요약

이번 diff 의 핵심(§5.4 응답-계약 스윕)은 "엔티티를 그대로 반환해 선언되지 않은 필드·
비밀 컬럼이 새고 있던" 기존 결함들을 응답 경계에서 좁히는 작업이라, 부작용 관점에서
가장 중요한 변화는 전부 **의도된 것**이다 — 스케줄/트리거 응답의 `trigger`/`workflow`
필드가 참조 수준으로 좁혀지고, 감사 로그의 `user` 가 3필드로 제한되고, 트리거 응답에서
`notificationSecretV2`/`chatChannelTokenV2`/`triggerToken`/`notification.signing.secret`
이 새로 스트립된다. 가장 눈에 띄는 실질적 신규 리스크는 `SchedulesController.toResponse`
가 `trigger` 관계 미로드 시 조용한 필드 누락 대신 미처리 TypeError(→ masked 500)를
내도록 바뀐 것인데, 이는 코드 자신이 인지하고 문서화한 fail-fast 트레이드오프이고
`GlobalExceptionFilter` 가 정보 유출 없이 마스킹하므로 심각도는 낮다. `SchedulesService`
의 `saved.trigger = ...` in-memory 대입은 DB 미반영임을 재확인했고, 새로 도입된
`contractCache` 전역 가변 상태는 프로덕션 빌드에서 배제됨을 `tsconfig.build.json` 과
import 그래프로 직접 확인했다. 환경 변수·파일시스템 쓰기·네트워크 호출 축에서는 새로
도입된 것이 없다. 시그니처가 바뀐 자리(`AuditLogsService.findAll` 반환 타입,
`SchedulesService.create/update` 의 `trigger` 항상-포함)는 호출자가 컨트롤러 1곳뿐임을
확인해 다른 소비자에 대한 파급이 없다.

## 위험도

LOW
