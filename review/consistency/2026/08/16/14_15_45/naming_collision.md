# 신규 식별자 충돌 검토 — spec-draft-eia-error-masking-catalog

## 검토 범위 요약

target 은 `spec/5-system/14-external-interaction-api.md` 에 **새 파일도, 새 요구사항 ID 도, 새
엔티티·DTO·endpoint·이벤트명·ENV 도 도입하지 않는다.** §R17 에 라벨 없는 5번째 불릿(자유
텍스트 설명)을 신설하고 §6.4 에 캐비엇 단락을 추가할 뿐이며, 등장하는 모든 식별자
(`execution.failed`, `Execution.error`, `toTerminalErrorPayload`, `deepRedactSecrets`,
`sanitizePayloadForWs`, `stripExternalOnlyFields`, `SECRET_LEAK_PATTERNS`)는 이미 코드베이스·
spec 본문에 존재하는 것을 그대로 참조한다. 따라서 좁은 의미의 "신규 식별자 vs 기존 사용처"
충돌은 거의 발생하지 않는다. 아래는 그럼에도 실측으로 확인된, 필드명 재사용에서 오는
의미 충돌 위험이다.

## 발견사항

- **[WARNING]** `error`/`error.message` 필드명이 `execution.failed` 와 `execution.cancelled`
  양쪽에 재사용되는데, target 이 추가하는 마스킹 서술은 `failed` 에만 명시적으로 스코프되고
  그 비대칭이 필드-집합 표에는 반영되지 않는다
  - target 신규 식별자: §R17 5번째 불릿의 "종결 이벤트 `execution.failed` payload 의
    `error.message`/`error.details`" (마스킹 대상 서술) + §6.4 캐비엇 "`message`·`details` 는
    egress 마스킹을 거친다"
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:573-579` "종결 이벤트의 필드
    집합 (normative)" 표 — `error` 행이 `failed` **그리고** `cancelled`(시스템 취소 한정) 둘을
    한 행에 묶어 `{code, message, nodeId, details?}` 로 규정한다("이 표가 전부다" 라고 스스로
    선언). 실제 코드(`execution-engine.service.ts` `emitCancellationEvent`,
    예: `markWebChatIdleTimeout` L1145-1208, `RESUME_*` 계열)도 `cancelled` 의 `error` 는
    `toTerminalErrorPayload`/`deepRedactSecrets` 를 **거치지 않는** 별도 hand-built 경로다
    (`error: { code, message }` 를 직접 구성, DB `Execution.error` 원문 read 경로가 아님)
  - 상세: 두 이벤트가 같은 필드명 `error.message` 를 쓰지만 (a) `failed` 는 이번 target 이
    선언하는 egress 마스킹을 받고 (b) `cancelled` 의 시스템-취소 `error.message` 는 받지
    않는다(설계상 별도 경로이므로 타당한 스코프 선택으로 보이나, **문서 어디에도 그 비대칭이
    명시되지 않는다**). §6 도입부 표는 두 이벤트의 `error` 를 한 행에서 다루며 이미
    `cancelled` 의 shape 차이("아직 `{code, message}` 를 손으로 만들어 `nodeId`/`details` 가
    없다")는 캐비엇을 달아 두었으므로, 같은 패턴으로 마스킹 여부 차이도 캐비엇이 있어야
    자연스럽다. 지금처럼 R17/§6.4 에만 `execution.failed` 한정으로 적어 두면, 필드-집합 표만
    보고 "`error` 는 마스킹된다" 는 인식이 `cancelled` 에도 암묵적으로 번질 수 있다 — 바로 이
    문서 자신이 Overview 에서 자인한 함정("이름이 같은 두 `error` 를 spec 이 구분해 주지
    않으면 다음 사람도 같은 자리에서 미끄러진다")과 같은 형태가 세 번째로 반복될 위험
  - 제안: §R17 5번째 불릿 또는 §6.4 캐비엇 어느 한쪽에 "**`execution.cancelled` 의 시스템-취소
    `error.message` 는 이 마스킹의 대상이 아니다**(별도 hand-built 경로, `toTerminalErrorPayload`
    미경유)" 한 줄을 명시하거나, §6 도입부 필드-집합 표의 `error` 행에 짧은 각주를 추가해
    "마스킹은 `failed` 에만 적용, `cancelled` 는 미적용(정적 코드 메시지)" 를 남길 것

- **[INFO]** §R17 3번째 불릿("`nodeOutput.conversationConfig` + terminal `result`/`error`")에는
  새 5번째 불릿을 가리키는 정방향 참조가 없다 — 역방향(5번째→3번째)만 있다
  - target 신규 식별자: 없음(교차 참조 누락 지적)
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:698` — §6.2 는 이미 3번째
    불릿의 앵커(`#r17-getstatus-...`)를 직접 가리키는 링크를 갖고 있어, 그 앵커를 통해 3번째
    불릿에 먼저 도달하는 독자가 있다
  - 상세: target 의 새 5번째 불릿 본문은 "위 3번째 불릿의 `error` 와 다른 컬럼이다" 라고
    스스로 명시해 단방향 disambiguation 은 되어 있으나, 3번째 불릿 쪽에는 "아래 5번째 불릿도
    참조" 식의 역참조가 없다. 3번째 불릿에 먼저 도달하는 독자(위 앵커 경유)는 새로 추가되는
    egress 마스킹 사실을 우연히만 발견한다
  - 제안: 필수는 아니나, 3번째 불릿 끝에 "관련: 아래 5번째 불릿(종결 `execution.failed`
    payload 의 `error` 마스킹)" 한 줄을 덧붙이면 두 `error` 의 재발 혼동을 더 줄일 수 있다

- **[INFO]** §R17 불릿 삽입 시 target 문서 스스로가 이를 "5번째 불릿 신설" 이라 부르는데,
  현재 §R17 은 (표면 제약 절 기준) 불릿 4개뿐이라 3번째 뒤·4번째("`nodeOutput` 일반 키
  allowlist") 앞에 삽입하면 신설되는 불릿은 실제로는 **4번째**이고 기존 4번째가 5번째로
  밀린다
  - target 신규 식별자: "5번째 불릿" (서수 라벨)
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:1418,1431,1441,1455` — 현재
    R17 "표면 제약(보안)" 절의 불릿은 `conversationThread`(1) · `execution.ai_message`(2) ·
    `nodeOutput.conversationConfig`+terminal(3) · `nodeOutput` allowlist(4) 로 정확히 4개
  - 상세: 식별자 충돌은 아니지만, "5번째 불릿 신설" 이라는 서수 표현이 실제 삽입 결과(새
    불릿=4번째, 기존 allowlist 불릿=5번째로 밀림)와 어긋난다. 이 자체는 naming collision
    범주 밖이라 이 리포트의 등급에는 반영하지 않되, 반영 작업자가 서수를 그대로 옮기면 사후
    "R17 5번째 불릿" 이라는 self-reference 문구가 실제 위치와 안 맞을 수 있어 참고로 남긴다
  - 제안: 반영 시 서수 표현을 실제 삽입 위치 기준으로 정정(또는 서수 대신 불릿 텍스트로
    지칭)

## 검토하지 않은 것(범위 밖 확인)

- 요구사항 ID(`EIA-*`, `R숫자`) — target 은 새 ID 를 부여하지 않음(라벨 없는 불릿)
- 엔티티/DTO/인터페이스명 — 새로 도입되는 타입 없음, 전부 기존 `Execution.error` /
  `toTerminalErrorPayload` 등 참조
- API endpoint — 신설 없음
- 이벤트명 — `execution.failed` 기존 이벤트 재사용, 신설 없음
- 환경변수·설정키 — 없음
- 파일 경로 — 기존 `spec/5-system/14-external-interaction-api.md` 수정만, plan 파일명
  `spec-draft-eia-error-masking-catalog.md` 도 `plan/in-progress/`·`plan/complete/` 어디에도
  중복 없음(확인함)

## 요약

target 은 이미 구현된 egress 마스킹(`toTerminalErrorPayload`→`deepRedactSecrets`)을 spec 에
사후 등재하는 순수 문서 변경으로, 신규 요구사항 ID·엔티티·endpoint·이벤트·ENV·파일 경로를
전혀 도입하지 않아 좁은 의미의 "새 식별자 충돌"은 발생하지 않는다. 다만 재사용되는 필드명
`error`/`error.message` 가 `execution.failed`(이번에 마스킹 대상으로 명시)와
`execution.cancelled`(마스킹 미적용, hand-built 경로)에 걸쳐 있는데 이 비대칭이 §6 필드-집합
표에는 반영되지 않아, "같은 이름의 다른 것" 이라는 이 문서가 스스로 경계한 함정이 R17 3번째
불릿(`outputData` 기반 `error`)에 이어 세 번째 지점(`cancelled` 의 `error`)에서 다시 열릴
소지가 있다. Critical 은 없다.

## 위험도

LOW
