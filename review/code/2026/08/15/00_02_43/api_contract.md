# API 계약(API Contract) 리뷰

## 리뷰 범위에 대한 메모

이 changeset(`git diff origin/main` 기준 codebase/spec 실 코드 14개 파일, 431(+)/65(-))의 핵심은
`execution.failed` 종결 이벤트의 `error` payload 를 문자열에서 EIA §6.4 object(`{code, message,
nodeId, details?}`)로 통일하는 것이다. 신설 헬퍼 `toTerminalErrorPayload`
(`codebase/backend/src/modules/execution-engine`가 아니라 `codebase/backend/src/shared/utils/terminal-error-payload.ts`)를
producer 4곳(`execution-engine.service.ts` 2곳, `finalizeStalledExhausted`, `retry-turn.service.ts`)과
consumer 1곳(`chat-channel.dispatcher.ts`)이 공유한다. 이 변경분 자체는 동일 changeset 안에서
이미 4라운드(`22_55_51`, `23_17_57`, `23_34_12`, `23_49_41`)에 걸쳐 ai-review·consistency-check 를
거쳤으므로, 이번 라운드는 그 결과를 코드를 직접 열어 독립 재검증하는 데 집중했다.

## 발견사항

- **[WARNING]** `execution.failed` 의 `error` wire 형태가 string → object 로 바뀌는 것은 실질
  breaking change이며, 이 저장소는 URL 버전 세그먼트를 쓰지 않아 기계적 버전 신호가 없다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts`(신규 헬퍼, `toTerminalErrorPayload`),
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:660-665`·`:3311-3315`·`:4869-4873`,
    `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:963-967`,
    대조: `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts:134`
    (`payload: event.payload` — 직접 Read 로 확인, 가공 없이 webhook enqueue body 에 그대로 실음)
  - 상세: `notification-fanout.service.ts:134` 를 직접 열어 확인한 결과, `execution.failed` 를
    구독하는 외부 webhook 수신자는 이 PR 로 `error` 필드의 런타임 타입이 조용히 바뀐다(문자열을
    전제한 파서는 깨진다). `spec/5-system/2-api-convention.md` 정책상 이 저장소는 URL 경로
    버전 세그먼트를 쓰지 않으므로 이런 shape 변경을 걸러낼 기계적 게이트가 원천적으로 없고,
    `CHANGELOG.md` 문서화가 유일한 통지 경로다. 이번 diff 는 `CHANGELOG.md` 에 "Unreleased —
    종결 `error` 를 문자열로 보내던 4곳" 절을 신설해 "수신자 영향 (breaking)"을 명시적으로
    기재했으므로 통지 자체는 이뤄졌다 — 이는 이 저장소 전역 정책의 한계이지 이 PR 만의 결함은
    아니며, spec §6.4 가 이미 이 object 형태를 목표 계약으로 선언해 둔 상태(#1169)를 완성하는
    성격이다. WARNING 으로 남기는 이유는 "문서로만 통지되고 강제할 수단이 없다"는 계약적
    취약점 자체가 이번 PR 로 실제로 트리거됐기 때문이지, 조치가 누락됐기 때문은 아니다.
  - 제안: 조치 완료로 판단(CHANGELOG 명시 확인). PR 본문/릴리스 노트에도 같은 문구를 반영해
    실제 외부 통합자에게 전달되도록 할 것.

- **[INFO]** `execution.cancelled` 의 `error`(`EiaCancelledEvent.error`)는 이번 정규화 대상에서
  제외돼 같은 이벤트 패밀리 내에서 `failed`/`cancelled` 의 `error` shape 이 여전히 다르다
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:413-424`(`EiaCancelledEvent.error?:
    { code: string; message?: string }` — non-nullable `code`, `nodeId`/`details` 부재. 이번 diff
    밖, 직접 Read 로 확인), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1079`
    (`emitCancellationEvent`, 호출 5곳 — 이번 diff 밖, 직접 grep 으로 확인), 대조:
    `spec/5-system/14-external-interaction-api.md:572`(§6 필드 표 `error` 행)
  - 상세: `emitCancellationEvent` 는 여전히 `{code, message}` 를 손으로 만들어 emit 하며
    `toTerminalErrorPayload` 를 거치지 않는다. 다만 이번 diff 는 spec §6 필드 표(`:572`)와
    `terminal-error-payload.ts` JSDoc(`:4-9`) 양쪽에서 "`cancelled` 는 아직 손으로 만든다"를
    명시해, 더 이상 은폐된 갭이 아니라 code·spec·plan(`durationMs`와 같은 비용 그룹으로 후속)
    3곳에서 일관되게 추적된다. 같은 이벤트 패밀리를 하나의 공용 파서로 소비하려는 외부
    클라이언트 입장에서는 여전히 실질적 불편(두 가지 `error` shape 를 분기해야 함)이다.
  - 제안: 현 상태 유지 가능. 후속 PR 로 `emitCancellationEvent` 를 같은 헬퍼로 통일할 때
    `EiaCancelledEvent.error` 도 `EiaFailedEvent['error']` 와 동일 타입으로 좁힐 것.

- **[INFO]** (긍정 확인) 신규 헬퍼가 DB(키 생략) ↔ wire(명시적 `null`) 부재 표현 불일치를
  4개 emit 지점에서 일관되게 해소했고, `details` optional 규약도 §6.4 와 정합한다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:73-80`(`out.details =
    src.details` — `undefined` 일 때만 키 생략), `EiaFailedEvent.error`(`types.ts:399-409`)
  - 상세: `toTerminalErrorPayload` 반환 객체는 `code: null`/`nodeId: null` 을 항상 명시적으로
    채우고(JSON 직렬화 시 `null` 키는 보존됨, `undefined` 키만 사라짐), `details` 는 소스에
    존재할 때만 키를 추가한다. §6.4 wire 스키마(`code: … | null`, `nodeId: "uuid" | null`,
    `details?`)와 정확히 대응하는 것을 직접 코드로 확인했다. DB 저장값(`row.error`,
    `stalledError`, `savedExecution.error`, `execution.error`)과 emit 값이 같은 객체를 거치므로
    이전에 실재했던 drift(`finalizeStalledExhausted` 의 `attempts` 누락 등)의 재발 여지가
    구조적으로 줄었다.
  - 제안: 없음(정보성, 참고용).

- **[INFO]** 요청 검증·URL/경로 설계·페이지네이션·인증/인가는 이번 diff 범위 밖
  - 위치: 해당 없음(신규/변경 REST 엔드포인트 없음, 이번 changeset 은 WS/webhook/SSE 이벤트
    payload 의 내부 필드 shape 변경에 한정)
  - 상세: 변경된 4개 emit 지점·1개 consumer·1개 신규 헬퍼 모두 기존 이벤트 타입
    (`ExecutionEventType.EXECUTION_FAILED`)의 필드 내용만 바꾸며, 엔드포인트 자체의 라우팅·
    인증 미들웨어·쿼리 파라미터 검증에는 손대지 않는다.
  - 제안: 조치 불요.

## 요약

핵심 변경은 `execution.failed` 이벤트 `error` 필드를 string 에서 EIA §6.4 object 로 통일하는
내부 wire 계약 정합화이며, DB(키 생략)와 wire(명시적 `null`)의 부재 표현 불일치를 신규 헬퍼
`toTerminalErrorPayload` 로 4개 producer + 1개 consumer 가 공유하도록 구조적으로 해소했다.
직접 코드를 열어 확인한 결과 이 변경은 실제 외부 webhook 구독자(`notification-fanout.service.ts`
가 가공 없이 payload 를 그대로 실어 보냄)에게 영향을 미치는 진짜 breaking change 이지만,
버전 세그먼트가 없는 이 저장소 정책상 CHANGELOG 문서화가 유일하고 이미 실행된 통지 수단이라
결함으로 보지 않는다. `execution.cancelled` 의 `error` shape 이 여전히 `failed` 와 달라 같은
이벤트 패밀리 안에서 일관성이 완전하지 않지만, 이는 code·spec·plan 3계층에서 의도적으로
비용을 분리해 추적 중인 상태(은폐 아님)다. 이전 4라운드의 리뷰가 찾은 CRITICAL(프런트엔드
소비자 미갱신)과 WARNING(컨슈머 쪽 손수 재정규화·무검증 캐스팅, breaking change 미문서화,
spec 문서 내부 자기모순)은 이번 라운드에서 직접 대조한 결과 전부 해소됐음을 재확인했다.
요청 검증·URL 설계·페이지네이션·인증/인가 관점은 이번 diff 범위 밖이라 해당 없음.

## 위험도

LOW
