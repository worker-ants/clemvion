# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `SchedulesController.toResponse` 가 새로 던지는 `InternalServerErrorException` 의
  상세 메시지가 `GlobalExceptionFilter` 의 CWE-209 마스킹을 **우회**해 클라이언트에 그대로
  echo 된다 — 직전 라운드(`review/code/2026/09/06/00_24_34` W1)가 "마스킹되니 안전하다" 고
  판단한 근거가, 바로 그 라운드가 제안한 수정으로 인해 깨졌다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:81-86`
    (`if (!t) { throw new InternalServerErrorException(...) }`)
  - 상세: 종전(00_24_34 라운드 리뷰 시점) 구현은 `trigger` 가 로드되지 않으면
    `t.id` 접근에서 그대로 `TypeError` 가 던져졌다. `GlobalExceptionFilter`
    (`codebase/backend/src/common/filters/http-exception.filter.ts:84-96`)는
    `exception instanceof Error` 분기를 타는 임의 `Error`(→ `mapHttpErrorLike` 가
    `status`/`statusCode` 없어 `null`)를 **일반 문구**(`UNHANDLED_ERROR_MESSAGE =
    'An unexpected error occurred. Please try again later.'`)로 마스킹하고 원문은
    `logger.error` 로만 남긴다 — 그래서 00_24_34 라운드는 "정보 유출로 이어지지
    않는다" 고 결론 내렸다. 그 라운드가 제안한 수정("`if (!t) throw new
    InternalServerErrorException(...)`")이 그대로 반영됐는데, `InternalServerErrorException`
    은 `HttpException` 의 서브클래스라 필터의 **다른 분기**(`:52-77`)를 탄다 — 이 분기는
    `exceptionResponse` 가 객체면 `resp.message`(=생성자에 넘긴 문자열 그대로)를
    **마스킹 없이** `message` 필드에 싣는다. Nest 의 `HttpException.createBody()` 는 문자열
    인자를 `{ statusCode, error, message: <그 문자열> }` 로 감싸므로,
    `new InternalServerErrorException('Schedule <uuid> has no loaded trigger — ...')` 를
    던지면 그 문자열이 **응답 바디에 그대로** 실린다. 결과적으로 클라이언트는
    ```
    { "error": { "code": "INTERNAL_ERROR",
      "message": "Schedule <id> has no loaded trigger — schedule.trigger_id is NOT NULL,
                   so this means the query forgot the join/relation (or the row is orphaned).",
      "requestId": "..." } }
    ```
    를 그대로 받는다 — DB 컬럼명(`trigger_id`)·제약(NOT NULL)·ORM 개념(join/relation)·
    "orphaned" 라는 데이터 정합성 힌트가 인증된 요청자에게 노출된다. 이 파일 자신의
    주석(`http-exception.filter.ts:36-40`, `:124-126`)이 명시하는 CWE-209 방지 원칙과
    정면으로 어긋난다. 트리거 조건은 데이터 정합성 결함(마이그레이션 갭·경합 상태로
    `trigger_id` 가 가리키는 행이 실제로 없음)이 있어야만 도달하므로 발생 빈도는 낮고,
    노출되는 값도 비밀(secret/token)은 아니지만, "왜 500 인지" 를 로그에만 남기려던
    의도가 실제로는 응답 바디까지 새 나가는 코드로 구현됐다 — 이전 리뷰의 "마스킹되어
    안전" 판단이 이번 수정으로 무효화된 채 아무도 재확인하지 않은 지점이다.
    (참고로 `auth-oauth.service.ts:467`·`integration-oauth.service.ts:437,505` 등 기존
    `InternalServerErrorException` 커스텀 메시지 전례가 있지만, 그것들은 env 변수명만
    노출하고 DB 스키마·ORM 관계 정보는 노출하지 않는다 — 이번 메시지는 그보다 더 상세하다.)
  - 제안: 클라이언트에 나가는 메시지는 일반 문구로 유지하고, 상세 진단은 로그 전용으로
    분리한다. 예: `this.logger.error(\`Schedule ${schedule.id} has no loaded trigger — ...\`); throw new InternalServerErrorException('Schedule response could not be assembled.');`
    또는 `HttpExceptionOptions.cause` 로 원문을 옮기고 필터가 `cause` 는 로깅에만
    쓰도록 한다. 목적(불변식을 이름으로 던져 다음 사람이 방어 분기를 넣지 못하게 함)은
    로그 메시지만으로도 달성된다 — 응답 바디에까지 실릴 필요는 없다.

- **[INFO]** `response-contract.ts` 에 프로세스 수명 동안 유지되는 새 모듈 레벨 전역
  가변 상태(`contractCache`)가 도입됐다 — 검증 결과 프로덕션 경로에는 영향이 없다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:386`
    (`const contractCache = new Map<Type<unknown>, Promise<DtoContract>>();`),
    `:412-425` (`contractForDto`).
  - 상세: DTO 클래스 → 계약 promise 캐시. `tsconfig.build.json` 의
    `exclude: ["src/shared/testing/**"]` 로 프로덕션 `dist` 에서 제외되고, `src/modules/**`
    에서 이 모듈을 import 하는 곳이 없어(grep 확인) 런타임 경로와 무관하다. 실패한
    promise 는 `.catch` 에서 즉시 `contractCache.delete` 하므로 "한번 실패하면 영원히
    실패" 문제는 없다. 캐시 격리 단위는 "Jest 테스트 파일" 이라고 JSDoc 이 명시하며
    이는 Jest 의 파일별 모듈 레지스트리 리셋과 일치한다(과거 "worker 단위" 라는 잘못된
    서술을 이번 PR 계열에서 실측으로 정정한 이력도 확인됨). `DtoContract.schema` 가
    non-frozen 이라 이론상 소비자가 캐시된 스키마를 변형하면 같은 파일의 후속 호출이
    오염될 수 있으나, 현재 소비자는 전부 읽기 전용이고 이 트레이드오프는 이전 라운드
    (`review/code/2026/09/05/22_24_58` INFO#11)에서 이미 명시적으로 검토·수용됐다.
  - 제안: 조치 불요 — 기결정 사항 재확인.

- **[INFO]** `TriggersService.sanitizeForResponse` 가 조기 return 제거로 더 이상 참조
  동일성을 보장하지 않는다 — 현재 호출부 전부가 종단 반환이라 영향 없음을 확인.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:691-751`
    (`private sanitizeForResponse`), 특히 `:746` (`deleteSecretColumns(sanitized ...)`).
  - 상세: 종전엔 `config.chatChannel` 이 없으면 원본 `trigger` 참조를 그대로 반환했다.
    이번 diff 는 조기 return 을 없애고 매 호출마다 `Object.assign(Object.create(...),
    trigger, overrides)` 로 새 객체를 만든 뒤 `deleteSecretColumns` 로 그 **사본**의
    엔티티 컬럼을 지운다 — 원본 `trigger`(파라미터로 받은 엔티티)는 변형되지 않는다.
    `findAll`/`findOneDetail`/`create`/`update` 7개 호출부 전부 `return
    this.sanitizeForResponse(...)` 형태의 종단 반환이라 반환값과 원본을 `===` 비교하는
    코드는 없다. JSDoc 이 "호출부는 참조 동일성을 전제하지 말 것" 이라고 스스로 경고하고
    있어 다음 호출부 추가 시 안전장치가 된다.
  - 제안: 조치 불요.

- **[INFO]** `SchedulesService.create`/`update` 의 `saved.trigger = ...` 대입이 `if
  (isActive)` 조건 밖으로 나와 **항상** 실행되도록 바뀌었다 — DB 재기록 없는 in-memory
  전용 대입임을 재확인.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:206`
    (`saved.trigger = savedTrigger;`), `:266`
    (`saved.trigger = trigger ?? schedule.trigger;`).
  - 상세: 두 대입 모두 `this.scheduleRepository.save(...)` 완료 **이후** 실행된다.
    TypeORM 의 `save()` 는 그 시점 이후 속성 변경을 자동으로 write-back 하지 않으므로
    응답 조립용 장식일 뿐 DB 부작용이 없다. 두 서비스 메서드의 유일한 호출자가
    `SchedulesController` 뿐임을 grep 으로 재확인 — 다른 소비자에 대한 파급 없음.
  - 제안: 조치 불요.

- **[INFO]** 응답 형태 좁히기(`ScheduleDto.trigger`, `TriggerDto.workflow`)가 실질적으로
  wire 계약을 좁히는 breaking interface 변경이다 — 의도된 보안 수정이나 "기존 사용자에
  미치는 영향" 관점에서 재확인해 둔다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:68-90`
    (`toResponse`), `codebase/backend/src/modules/triggers/triggers.service.ts:685-690`
    (`narrowWorkflowRef`).
  - 상세: 종전엔 컨트롤러/서비스가 조인된 엔티티를 그대로 직렬화해 `Trigger`/`Workflow`
    전체 컬럼이 응답에 실렸다(이 PR 이 고치는 유출 결함 그 자체). 수정 후에는 각각
    `{id,name,workflowId,workflow?}` / `{id,name}` 로 좁혀진다 — 직전까지 wire 에 실제로
    존재했던 필드들이 이 커밋을 기점으로 사라지는 것은, 문서화되지 않았을 뿐 실제
    breaking change 였다는 사실은 side-effect 관점에서 남겨 둔다. CHANGELOG·plan
    트래커에 이미 서사·FE 소비처 grep 근거가 기록돼 있어 은닉된 확장은 아니다.
  - 제안: 조치 불요 — 문서화 확인 완료.

- **[INFO]** 환경 변수·파일시스템 쓰기·외부 네트워크 호출 축에서는 이번 diff 에 새로
  도입된 항목이 없다.
  - 위치: 전체 diff (`codebase/backend/**`).
  - 상세: `process.env`, `fs.write*`, `fetch`/`axios`/`http(s).request` 패턴을 diff
    전체에서 확인했다. 유일한 파일시스템 접근은
    `swagger-dto-contract-guard.ts` 의 `findOptionalNullableResponseFields` 가
    `fs.readFileSync` 로 `src/modules` 아래 소스를 정적 분석용으로 **읽는** 것뿐이며
    (쓰기 없음), `buildContractForDto` 는 격리된 Nest 테스트 모듈을 세워 OpenAPI 문서를
    생성한 뒤 `app.close()` 로 즉시 닫을 뿐 실제 네트워크 리스닝은 없다.
  - 제안: 조치 불요.

## 요약

이번 diff 의 핵심(§5.4 응답-계약 스윕)은 엔티티를 그대로 반환해 선언되지 않은 필드·비밀
컬럼이 새던 기존 결함을 응답 경계에서 좁히는 작업이고, 대부분의 부작용은 의도되고
문서화돼 있으며 이전 라운드들이 이미 검토·수용했다(전역 캐시 도입, 참조 동일성 상실,
in-memory 전용 대입 무조건화, wire 계약 breaking narrowing). 다만 한 가지는 이전 라운드
자신의 안전 판단을 스스로 무효화한 지점이다 — `SchedulesController.toResponse` 가 미로드
`trigger` 를 "불변식 위반" 으로 명명해 던지자는 직전 라운드의 제안을 그대로 구현했는데,
그 결과 `Error`(마스킹됨)에서 `HttpException`(마스킹 안 됨)으로 예외 종류가 바뀌면서
`GlobalExceptionFilter` 의 CWE-209 마스킹을 우회하게 됐다. DB 컬럼명·제약·ORM 관계 정보가
포함된 상세 메시지가 500 응답 바디에 그대로 실린다 — 이전 리뷰가 "마스킹되니 안전" 이라고
내린 결론이 그 리뷰 자신의 제안으로 깨진 사례다. 발생 조건이 데이터 정합성 결함으로
좁고 비밀 값 노출은 아니라 심각도는 WARNING 으로 판단한다. 그 외 환경 변수·파일시스템
쓰기·네트워크 호출 축에서는 새로 도입된 것이 없다.

## 위험도

MEDIUM
