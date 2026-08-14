# 문서화(Documentation) 리뷰 — eia-terminal-payload (`terminal-error-payload` 도입 + `execution.failed` error 객체화)

## 발견사항

- **[WARNING]** 종결 이벤트(`execution.failed`)의 외부(wire) 형태를 바꾸는 PR인데 `CHANGELOG.md` 가 갱신되지 않았다
  - 위치: 저장소 루트 `CHANGELOG.md` (이번 diff 에 없음 — 파일 목록에 `CHANGELOG.md` 부재)
  - 상세: 이 저장소는 관측 가능한 동작/외부 계약을 바꾸는 fix 커밋마다 `CHANGELOG.md` 상단에
    `## Unreleased — <제목>` 절을 추가하는 확립된 관례를 따른다. 직전 5개 유사 커밋 중
    다수가 이 관례를 지켰다 — 특히 이번 PR 의 직접 선행 작업인 `589914d6d`(`llmCalls` 유출
    수정, 34줄 추가)와 `f9d31041d`(`RETURNING` 튜플 오인, 62줄 추가)가 그렇다(단, 순수
    내부 하드닝인 `598dca9ab` 는 CHANGELOG 없이 넘어간 전례도 있어 100% 기계적 규칙은
    아니다). 이번 커밋(`6aa0699b8`)은 그 경계 안쪽이다 — 4개 emit 지점 중 3곳이 문자열을
    보내던 것을 객체로 바꾸고, `stalled` 경로는 DB 와 wire 의 메시지 문구가 실제로
    어긋나 있던 것(`attempts` 누락)을 고쳤으며, chat-channel 소비자가 보는 `error.code`
    가 존재한 적 없는 `'INTERNAL_ERROR'` 에서 `null` 로 바뀐다 — 전부 **외부 수신자가
    관측하는 payload 형태 변경**이다. 커밋 메시지 자체도 "## 손으로 다시 적던 자리가 이미
    어긋나 있었다" 절로 이 성격을 스스로 서술하고 있어, 기존 CHANGELOG 항목들과 같은
    급의 서술 대상이다.
  - 제안: `CHANGELOG.md` 에 `## Unreleased — <제목>` 절 추가. 최소한 (1) 4개 지점 중 3곳이
    string 을 보내고 있었다는 사실, (2) stalled 경로의 DB/wire 문구 불일치가 있었다는 사실,
    (3) `error.code` 가 `'INTERNAL_ERROR'`(허구 코드) → `null` 로 바뀐다는 수신자측 관측
    변화를 포함할 것.

- **[WARNING]** `toTerminalErrorPayload` JSDoc 이 실제 커버리지보다 넓게 주장한다 — "시스템 `execution.cancelled`" 는 이 함수를 한 번도 거치지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts:2` (새 파일,
    JSDoc 헤더 "종결 이벤트(`execution.failed` / 시스템 `execution.cancelled`)의 `error` 를
    **EIA §6.4 wire 형태**로 정규화한다.")
  - 상세: 실측 — `toTerminalErrorPayload` 호출부는 정확히 4곳이다
    (`execution-engine.service.ts:664`·`:3312`·`:4870`, `retry-turn.service.ts:966`) — **전부
    `EXECUTION_FAILED` emit 경로**다. `EXECUTION_CANCELLED` 를 실제로 내보내는
    `emitCancellationEvent`(`execution-engine.service.ts:1079`, `markWebChatIdleTimeout`·
    `markQueueWaitTimeout`·rehydration 실패 `RESUME_*` 등 "취소 계열" 코드의 실제 emit 지점)
    는 `opts.error: { code: string; message: string }` 를 호출자가 손으로 만든 그대로 emit
    하며 이 헬퍼를 거치지 않는다. 그 결과 소비 측 타입 `EiaCancelledEvent.error`
    (`chat-channel/types.ts:417`, `{ code: string; message?: string }`)도 이번 diff 에서
    손대지 않은 채 남아 있다 — `nodeId` 필드 자체가 없고 `code` 가 non-nullable 이라, 이번
    PR 이 `EiaFailedEvent.error` 에 적용한 §6.4 "명시적 `null`" 계약과 형태가 다르다.
    추가로 JSDoc 이 인용하는 SoT 도 `§6.4` 뿐인데, spec 상 `execution.cancelled` 의 페이로드
    절은 `§6.5`(`spec/5-system/14-external-interaction-api.md:795`)다 — `§6.4`
    (`:761`)는 `execution.failed` 전용 절이다. 요컨대 이 JSDoc 은 "cancelled 도 이미 이
    헬퍼로 정규화된다"로 읽히지만 실제로는 `execution.failed` 4곳에만 적용됐고, cancelled
    쪽은 이번 PR 의 스코프 밖으로 남아 있다(plan 문서 `eia-terminal-payload.md` 자신도
    "4곳"을 전부 `EXECUTION_FAILED` 지점으로만 열거해 cancelled 는 애초에 스코프에
    없었다). 다음 사람이 이 JSDoc 만 읽고 cancelled 경로가 이미 §6.4/§6.5 형태로
    정규화됐다고 오판할 수 있다.
  - 제안: JSDoc 헤더에서 "시스템 `execution.cancelled`" 언급을 제거하거나, "현재는
    `execution.failed` 4개 지점에서만 사용되며 `execution.cancelled`(`emitCancellationEvent`)
    경로는 아직 이 헬퍼를 거치지 않는다 — `EiaCancelledEvent.error` 는 별도 스코프"라는
    caveat 을 추가할 것.

- **[INFO]** `chat-channel.dispatcher.ts` 신규 주석이 실제로 대입하는 값(`null`)과 설명 문구(`code: ""`)를 혼용해 순간적으로 오독될 수 있다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:566` (게이트
    번호 기준, "`code: "INTERNAL_ERROR"` 는 … 그 코드의 출처를 찾아 헤매게 만든다(존재하지
    않으므로 찾지 못한다). `code: ""` 는 "코드가 없었다" 를 정직하게 말한다." 부분)
  - 상세: 실제 코드(`:556`·`:558`)는 `code: null` 을 대입한다. 주석은 바로 위(`:564`)에서
    "`null`(→ `code ?? ''`)" 이라고 다운스트림(classifier 의 `event.error?.code ?? ''`,
    `execution-failure-classifier.ts:105`) 변환을 정확히 짚어 두긴 했지만, 그 다음 줄에서
    다시 `code: ""` 라는 표현으로 되돌아가면서 "이 함수가 대입하는 값"과 "classifier 가
    최종적으로 보는 값"을 같은 표기로 섞어 쓴다. 내용은 틀리지 않지만 처음 읽을 때 "왜
    코드가 `null` 이 아니라 `""` 를 대입한다는 거지?"로 오독될 여지가 있다.
  - 제안: 마지막 문장을 "`code: null`(→ classifier 가 `code ?? ''` 로 읽어 빈 문자열과
    동일하게 처리)은 …" 처럼 대입값과 다운스트림 값을 명시적으로 구분해 표기.

## 요약

이번 PR 의 문서화 수준은 전반적으로 높다 — 신설 헬퍼 `terminal-error-payload.ts`/`.spec.ts` 는
"왜 필요한가"(DB vs wire 의 부재 표현 불일치), SoT 링크, 각 emit 지점별 실측 표, 뮤테이션 테스트
근거까지 갖춘 모범적인 JSDoc·테스트이고, `chat-channel.dispatcher.ts` 는 존재한 적 없는 plan
이름을 가리키던 stale 주석과 존재한 적 없는 에러 코드(`INTERNAL_ERROR`)를 실측으로 걷어내
정확도를 높였다. plan 문서(`eia-terminal-payload.md`)도 착수 전 재판정에서 스스로의 오류를
반증하고 companion 타입 drift(`types.ts`)를 체크리스트에 실제로 등재하는 등 자기 정정이
잘 이뤄져 있다(같은 diff 안에서 `22_29_16` consistency 라운드의 plan_coherence WARNING 3건이
모두 반영됨). 다만 두 가지는 남는다 — (1) 외부 wire 형태를 바꾸는 fix 인데도 이 저장소의
확립된 관례인 `CHANGELOG.md` Unreleased 항목이 빠졌고, (2) 신설 헬퍼의 JSDoc 이 실제로는
`execution.failed` 4곳에만 적용된 것을 "시스템 `execution.cancelled`"까지 커버하는 것처럼
서술해 스코프를 실측보다 넓게 주장한다. 둘 다 기능 결함은 아니지만 다음 사람의 판단을
오도할 수 있어 WARNING 으로 등재한다.

## 위험도
LOW
