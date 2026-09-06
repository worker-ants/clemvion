# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `SchedulesController.toResponse` 가 던지는 `InternalServerErrorException` 이
  §5.3 의 5xx 마스킹 규약을 어기고 내부 구현 원문을 클라이언트에 그대로 echo 한다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:81-87`
    (`if (!t) { throw new InternalServerErrorException(...) }` 블록)
  - 상세: `spec/5-system/2-api-convention.md §5.3` 은 명시적으로 요구한다 — *"내부 구현
    원문(라이브러리 예외 메시지·스택·파일 경로 등)을 echo 하지 않는다 — 정보 노출(CWE-209)
    방지"*, *"5xx 는 generic 500 으로 마스킹하며 원문은 서버 로그에만 남긴다"*. 그런데 이
    블록은 `Schedule ${schedule.id} has no loaded trigger — schedule.trigger_id is NOT
    NULL, so this means the query forgot the join/relation (or the row is orphaned).` 라는
    구체적 내부 원문을 메시지로 실어 던진다.

    `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`)를
    직접 열어 실제 처리 경로를 확인했다: `InternalServerErrorException` 은 `HttpException`
    이므로 `catch()` 의 **첫 분기**(`exception instanceof HttpException`, 42-77행)를 탄다.
    이 분기는 `exception.getResponse()` 의 `message` 를 **그대로** 클라이언트 응답의
    `error.message` 에 옮긴다(70-72행) — CWE-209 마스킹은 **`else if (exception instanceof
    Error)` 분기**(84-97행)에만 있고, 그 분기는 `HttpException` 이 아닌 순수 `Error`
    (예: 방어 분기 없이 `t.id` 접근 시 나는 `TypeError`)에만 적용된다. 즉 이 새 코드는
    마스킹을 **우회**한다. 부수로, `HttpException` 분기는 `this.logger.error(...)` 호출이
    전혀 없다 — 이 예외는 **서버 로그에도 남지 않는다**. §5.3 이 요구하는 "원문은 서버
    로그에만" 을 오히려 거꾸로 만든 셈이다(클라이언트엔 노출, 서버 로그엔 미기록).

    이 자리는 원래 방어 분기가 없어 `t.id` 접근이 순수 `TypeError`(→ `Error` 분기 →
    올바르게 마스킹+ 로깅됨)를 던지던 곳이었는데, 직전 라운드
    (`review/code/2026/09/06/00_24_34` side_effect W1)가 "의도를 코드로 드러내라" 며
    명시적 예외로 바꿀 것을 권했고, 같은 라운드의 api_contract 리뷰(`api_contract.md:27`)는
    *"`GlobalExceptionFilter` 가... 클라이언트는 형식이 일관된 500 을 받는다"* 라고
    **안전하다고 판단**했다. 그 판단이 `TypeError`(masked) 기준이었는데, 실제 수정은
    `InternalServerErrorException`(unmasked)으로 이루어져 그 전제가 깨졌다 — 즉 **직전
    리뷰가 승인한 "안전하다" 는 근거 자체가 이번 코드에는 더 이상 성립하지 않는다.**

    도달 조건은 `Schedule.trigger_id` NOT NULL + FK `onDelete: 'CASCADE'` 덕분에 정상
    데이터로는 낮다는 코드 주석의 주장은 타당하나, 주석 자신이 적은 또 다른 도달 경로 —
    *"쿼리가 join/relation 을 빠뜨렸다"*(향후 새 호출 경로 추가 시 실수로 relation 로드를
    빠뜨리는 프로그래머 실수) — 는 오히려 이 방어 코드가 정확히 노리는 시나리오이고,
    이런 이상 상황일수록 §5.3 마스킹이 더 중요하다.
  - 제안: `throw new InternalServerErrorException()`(인자 없이, 또는 `{ code:
    'SCHEDULE_TRIGGER_NOT_LOADED' }` 처럼 세부 원문 없는 객체)로 바꾸고, 구체적 진단
    정보(`schedule.id` 등)는 별도로 `this.logger.error(...)` 호출로 서버 로그에만 남긴다.
    이 저장소의 다른 `InternalServerErrorException` 호출부(`auth-oauth.service.ts`,
    `integration-oauth.service.ts`)도 `{code, message}` 형태로 상세 원문을 그대로 echo 하는
    같은 패턴을 이미 쓰고 있다 — 이번 PR 범위는 아니지만, `GlobalExceptionFilter` 자체를
    "상태코드 5xx 인 `HttpException` 도 마스킹한다" 로 넓히는 편이 매 호출부에서 개별적으로
    지키는 것보다 근본적이다(후속 검토 가치가 있다는 관찰로만 남긴다 — 이 PR 의 diff
    범위 밖).

- **[INFO]** 같은 "워크플로우 참조" 개념이 두 신설 DTO 에서 비대칭 필드셋으로 노출된다.
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`
    의 `TriggerWorkflowRefDto`(`id`+`name`) vs
    `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` 의
    `ScheduleTriggerWorkflowRefDto`(`name` 만).
  - 상세: 둘 다 "조인된 Workflow 엔티티를 참조 수준으로 좁힌다" 는 같은 처방에서 나온
    자매 DTO 인데, 하나는 `id`+`name`, 다른 하나는 `name` 만 노출한다. 각각 실제
    프런트엔드 소비처(`triggers/page.tsx` 의 `t.workflow?.id`/`name` vs
    `schedules/page.tsx` 의 `s.trigger?.workflow?.name` 단독 사용)에 정확히 맞춘
    최소 노출이라는 점에서 개별로는 타당하지만, 같은 개념을 표현하는 두 응답 형태가
    필드 구성부터 다르면 다음에 이 참조 형태를 세 번째 자리에 재사용할 때 어느 쪽을
    본떠야 할지 기준이 없다. `consistency` 검토(`21_40_38` INFO#4)가 이미 "narrowed
    reference DTO 패턴이 이번이 두 번째 — 세 번째면 명명 규칙 문서화" 로 관찰해 뒀다.
  - 제안: 조치 불요 — 관찰만. 세 번째 유사 DTO 가 생기면 그때 공통 필드셋(최소
    `id`+`name`) 또는 네이밍 규칙을 정한다.

## 요약

이 PR 은 §5.4 응답-계약 스윕의 연장으로, 18개 DTO 에 `assertMatchesContract` 를 배선하고
그 과정에서 발견한 트리거 회전 secret 2차 유출(스케줄 조인 경유)·`config.interaction.
triggerToken` 유출·5개 DTO 24개 필드 미선언을 고쳤다. 이미 10라운드에 걸친 code review 와
8라운드의 consistency review 를 거치며 Critical 급 계약 위반(비밀 유출·필드 소실·§5.4 금지
조합)은 전부 조치됐고, 그 이력이 diff 자체(주석·CHANGELOG·plan 트래커)에 촘촘히 남아 있다.
이번 라운드에서 새로 발견한 것은 하나다 — 직전 라운드가 "안전한 500 마스킹" 이라고 판단한
`SchedulesController.toResponse` 의 방어 예외가, 그 판단의 근거였던 `TypeError`(masked) 대신
실제로는 `InternalServerErrorException`(unmasked, 서버 로그도 없음)으로 구현되어
`spec/5-system/2-api-convention.md §5.3` 의 5xx 마스킹 규약을 문언 그대로 어긴다. 도달
조건이 낮아(정상 FK 로는 불가, 향후 코드 실수로만 도달) 긴급도는 낮지만, 실제로 `GlobalExceptionFilter`
소스를 열어 분기까지 추적해 확인한 재현 가능한 계약 위반이라 고치는 편이 맞다. 그 외
하위 호환성(narrowing 은 3라운드에 걸쳐 breaking change 로 명시 검토·승인됨)·버전
관리(변경 없음)·요청 검증(요청 DTO 변경 없음)·URL/경로 설계(신규 엔드포인트 없음)·
페이지네이션(`PaginatedResponseDto` 래핑 유지 확인)·인증/인가(가드 변경 없음) 축에서는
추가로 지적할 계약 위반을 찾지 못했다.

## 위험도

MEDIUM
