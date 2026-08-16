# 신규 식별자 충돌 검토 — spec-draft-eia-error-masking-catalog

## 검토 방법

target 문서(`plan/in-progress/spec-draft-eia-error-masking-catalog.md`)가 도입하려는 텍스트를
실제 대상 spec(`spec/5-system/14-external-interaction-api.md`) §R17(1371~1457행)·§6.4(770~806행)의
현재 내용과 대조했다. target 은 코드 식별자를 새로 만드는 것이 아니라(#1177 로 이미 구현된
`toTerminalErrorPayload`/`redactTerminalError`/`deepRedactSecrets` 를 spec 카탈로그에 사후 등재하는
문서 전용 변경) spec 산문 안에 새 **불릿 표제**·**캐비엇 문단**을 신설한다. 아래는 그 신설 표제/참조가
기존 사용처와 부딪히는지의 검토 결과다.

## 발견사항

- **[WARNING]** §R17 신설 불릿 표제가 기존 3번째 불릿과 같은 단어(`error`)로 헤드라인을 공유한다
  - target 신규 식별자: 5번째(실제 삽입 위치는 4번째) 불릿 표제 `` **종결 이벤트 `error` (강제됨 — 2026-08-16)** ``
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:1441` 3번째 불릿 표제
    `` **`nodeOutput.conversationConfig` + terminal `result`/`error` (강제됨 — bypass 차단)** `` —
    본문(1445행)이 가리키는 `error` 는 `getStatus` 가 `Execution.outputData` 로 조립하는 값이며,
    target 이 등재하려는 `error`(`execution.failed` 의 `error.message`/`details`, DB `Execution.error`
    원문 출처)와는 **다른 컬럼**이다.
  - 상세: 두 불릿 모두 표제에 백틱 `` `error` `` 하나만 노출한다. target 본문(83~84행)이
    "위 3번째 불릿의 `error` 와 다른 컬럼이다" 라고 명시적으로 캐비엇을 달아 두었고, target 의
    Overview("핵심 — R17 3번째 불릿에 속으면 안 된다") 도 같은 함정을 선제적으로 경고한다 — 즉
    저자가 이미 이 충돌 가능성을 인지하고 본문 차원에서 방어했다. 다만 그 방어는 **본문을 읽어야만**
    작동한다. 실제로 자매 트래커 `spec-sync-external-interaction-api-gaps.md` 의 "REST 와 대칭"
    문구가 바로 이 두 `error` 를 혼동해 한 번 틀린 전례가 있다(target 60~63행이 인용). 표제만 훑는
    독자(예: R17 불릿 목록을 다른 문서에서 요약 인용할 때)는 다시 같은 자리에서 미끄러질 수 있다.
  - 제안: 신설 불릿 표제 자체에 구분자를 넣어 표제 레벨에서도 명확히 갈리게 한다. 예:
    `` **종결 이벤트 `execution.failed` payload 의 `error.message`/`error.details` (DB `Execution.error`
    원문, 강제됨 — 2026-08-16)** `` 처럼 표제에 이벤트명·DB 컬럼명을 직접 박아 3번째 불릿의
    `outputData` 기반 `error` 와 문자열 레벨에서부터 겹치지 않게 한다. (본문 캐비엇은 유지해도 무방 —
    표제와 본문 이중 방어.)

- **[INFO]** §6.4 캐비엇의 §R17 앵커 참조가 축약형이라 그대로 적용 시 깨진 링크가 될 수 있다
  - target 신규 식별자: §6.4 캐비엇 블록의 `` [§R17](#r17-…) `` (target 99~102행)
  - 기존 사용처: 같은 spec 파일 698행이 이미 완전한 앵커 슬러그를 쓴다 —
    `#r17-getstatus-의-currentnodecontext-실값-노출-null-placeholder-부분-번복--sse-역할-분담--outputdata-표면-제약-결정-2026-06-25-conversationthread-reload-노출-재조정-2026-07-09`.
  - 상세: target 의 `#r17-…` 는 plan 문서 특유의 생략 표기로 보이며 실제 파괴적 충돌은 아니지만,
    이 문구를 그대로 복사-적용하면 죽은 링크가 생긴다. 새 식별자 자체의 "충돌"은 아니고 기존
    앵커와의 **불일치(누락)** 이므로 참고용으로만 남긴다.
  - 제안: spec 반영 시 698행과 동일한 전체 슬러그로 치환할 것.

## 그 외 점검 관점 — 충돌 없음

- **요구사항 ID**: target 은 새 `EIA-XX-NN` 류 formal ID 를 발급하지 않는다(§R17 산문 불릿·§6.4 캐비엇
  문단만 추가). 충돌 대상 자체가 없다.
- **엔티티/타입명**: `toTerminalErrorPayload`(`codebase/backend/src/shared/utils/terminal-error-payload.ts`)·
  `deepRedactSecrets`·`Execution.error`(`spec/1-data-model.md:473,556-562`, `{nodeId, code, message,
  details?}`)는 모두 **기존에 이미 존재하는** 이름이며 target 은 그 실제 정의와 일치하게 인용한다.
  `NodeExecution.error`(별개 컬럼)와도 target 이 스스로 "범위 밖"에서 구분해 혼동 여지가 없다.
- **API endpoint**: target 이 인용하는 `GET /api/executions/:id`(`executions.controller.ts:63`,
  `@Controller('executions')` + `@Get(':id')`)는 실제 라우트와 일치하고, EIA 외부 표면
  `GET /api/external/executions/:executionId`(§5.3, 이미 존재)와도 의도적으로 구분해 서술한다.
  새 endpoint 도입 없음.
- **이벤트/메시지명**: `execution.failed` 는 이미 §6.4 표제 이벤트다. target 은 새 이벤트명을
  만들지 않고 기존 이벤트의 필드 의미를 보강할 뿐이다.
- **환경변수·설정키**: 신설 없음.
- **파일 경로**: plan 파일 `plan/in-progress/spec-draft-eia-error-masking-catalog.md` 는 동일
  디렉터리의 `spec-draft-eia-62-waiting-payload.md`·`spec-draft-eia-notification-payload-contract.md`·
  `spec-draft-eia-r8-alignment.md` 와 같은 `spec-draft-eia-*` 명명 컨벤션을 따르고 기존 파일과
  겹치지 않는다. 자매 developer plan `eia-terminal-error-sanitize.md` 의 "후속" 항목(153~165행)이
  정확히 이 target 을 예고해 뒀고(`10_19_31`/`11_36_45` 근거 라운드 인용도 일치), 내용도 그 항목의
  요구사항과 부합한다 — 중복 작업이 아니라 예정된 후속.

## 요약

target 이 새로 짓는 산문 표제·참조는 실질적으로 코드/API/설정 식별자를 새로 발급하지 않고,
기존에 이미 구현·명명된 `Execution.error`·`toTerminalErrorPayload`·`execution.failed`·
`GET /api/executions/:id` 등을 정확히 인용한다. 유일하게 주목할 지점은 §R17 안에서 신설 불릿
표제가 기존 3번째 불릿과 표제 레벨에서 `` `error` `` 라는 같은 토큰을 공유한다는 것인데, target
저자가 이미 이 함정(과거 "REST 와 대칭" 오기 전례)을 본문 캐비엇으로 명시 방어해 두었다 — 다만
표제만 보는 향후 독자를 위해 표제 자체에도 구분자를 넣는 편이 더 견고하다. §6.4 캐비엇의 축약
앵커는 실제 적용 시 완전한 슬러그로 치환이 필요한 사소한 참조 정합성 이슈다. 두 건 모두 spec
반영을 막을 수준이 아니다.

## 위험도
LOW
