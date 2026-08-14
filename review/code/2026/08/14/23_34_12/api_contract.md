# API 계약(API Contract) 리뷰 — `23_34_12`

## 리뷰 범위에 대한 메모

이번 diff 는 이전 두 ai-review 라운드(`22_55_51` CRITICAL 1/WARNING 10 → RESOLUTION,
`23_17_57` CRITICAL 0/WARNING 6 → RESOLUTION)의 fix 가 누적 반영된 상태다. 실행 코드
변경은 파일 1~12(`execution.failed` wire `error` string → EIA §6.4 object 통일 + 프런트
소비자 동반 수정)뿐이고, 나머지(13~61)는 그 두 라운드의 리뷰/consistency 세션 산출물과
plan 문서 갱신이다. API 계약 관점에서 실질적으로 새로 봐야 하는 것은 (a) 코드 9개 파일과
(b) `spec/5-system/14-external-interaction-api.md` / `spec/conventions/chat-channel-adapter.md`
의 spec 변경(파일 62~63)이다.

## 발견사항

- **[INFO]** (긍정 확인) 직전 라운드(`23_17_57`) 문서화 리뷰가 지적한 spec 자기모순이
  이번 diff 로 해소됐다.
  - 위치: `spec/5-system/14-external-interaction-api.md:572`(§6 필드 집합 표 `error` 행),
    같은 파일 `:792-797`(§6.4 blockquote)
  - 상세: 직전 라운드에서 §6 필드 표는 "failed 는 전 경로 object" 로 갱신됐지만, 8줄
    아래 §6.4 예시 직후 blockquote 는 "현행 일부 경로에서 string" 이라는 정반대 문구를
    그대로 남겨 같은 문서 안에서 모순이었다. 이번 diff 는 그 blockquote 를
    "`failed` 의 `error` 는 이제 전 경로 object 다 … 종전의 '일부 경로는 string' 캐비엇은
    해소됐다" 로 정정하고, "배포 경계에서 재생되는 레거시 이벤트는 여전히 string 을 실을
    수 있어 dispatcher/프런트 흡수 분기를 의도적으로 유지한다" 는 설명을 덧붙였다 — 코드
    실태(레거시 흡수 분기 존치, hot path 는 object)와 정확히 일치한다. `grep -rn
    "현행 일부 경로에서 string\|현행 일부 경로는 string"` 로 저장소 전수 확인한 결과 활성
    본문에는 더 이상 이 문구가 남아 있지 않다(과거형 인용 2곳만 존재, 둘 다 "해소됨" 이라
    명시). `spec/conventions/chat-channel-adapter.md:158-163` 도 같은 방향으로 갱신돼
    "`| string` 을 안고 있는 이유가 (구현 지연이 아니라) 레거시 흡수 목적으로 바뀌었다"
    를 명시한다. `plan/in-progress/node-output-redesign/README.md:372`,
    `spec-draft-eia-notification-payload-contract.md:105`,
    `spec-sync-external-interaction-api-gaps.md:20-27` 세 plan 문서도 동일 사실로
    동기화됐다. 5곳 전수 정합.

- **[INFO]** (긍정 확인) breaking change 통지가 문서화돼 있다 — 이 저장소는 URL 버전
  세그먼트를 쓰지 않는 단일 버전 정책이라 CHANGELOG 가 유일한 기계 외 통지 경로다.
  - 위치: `CHANGELOG.md`(`## Unreleased — 종결 error 를 문자열로 보내던 4곳` 절, "수신자
    영향 (breaking)" 문단)
  - 상세: `execution.failed` 를 구독하는 webhook/SSE/chat-channel 수신자가 `error` 를
    이제 항상 object 로 받는다는 사실, 부재 표현이 `null`(명시)이라는 점, 영향받는 4개
    emit 지점을 열거한다. 두 라운드 전(`22_55_51`)에는 이 문서화가 없어 WARNING 이었고
    그 이후 계속 유지·검증돼 왔다.

- **[INFO]** `EiaFailedEvent.error.code` 타입이 `string` → `string | null` 로 바뀌었지만
  producer(4개 emit 지점)·consumer(dispatcher, 프런트) 양쪽이 실측상 정합한다.
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:395-408`,
    `codebase/backend/src/shared/utils/terminal-error-payload.ts`(4개 producer 공용
    헬퍼), `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:552-558`
    (레거시 string 흡수 시에도 `code: null` — 지어낸 코드 없음)
  - 상세: 분류기(`execution-failure-classifier.ts`)는 `code ?? ''` 로 읽어 `null` 을
    빈 문자열과 동일하게 unknown-fallback 처리하므로 classifier 쪽 breaking 은 없다.
    `nodeId` 는 여전히 optional 로 유지됐는데, 이는 producer 계약이 아니라
    consumer(레거시 이벤트를 포함하는) 계약이라는 근거가 타입 옆 주석에 남아 있어
    "문서한 보장이 구현보다 넓다" 류의 문제는 없다.

- **[INFO]** `execution.cancelled` 의 `error`(`{code, message}`, `nodeId`/`details` 없음)는
  이번 통일 대상에서 계속 제외돼 있으나, 코드·spec·plan 세 층위(§6 필드 표 `:572`,
  `terminal-error-payload.ts` JSDoc, `eia-terminal-payload.md` 재판정 ③-c)에서 일관되게
  "다음 PR 비용 그룹" 으로 문서화돼 스코프 이탈로 오독될 위험이 낮다. 두 이벤트 타입이
  같은 필드 표 행을 공유하면서 실제 shape 가 갈리는 상태이므로, 공용 파서를 작성하려는
  후속 소비자는 여전히 `failed`/`cancelled` 를 분기해야 한다 — 신규 결함은 아니고 기존
  라운드에서 이미 등재·수용된 갭이다.

- **[INFO]** 요청 검증·URL/경로 설계·페이지네이션·인증/인가 — 이번 diff 는 신규/변경
  HTTP 엔드포인트가 없다(내부 이벤트 emit payload shape 변경만). 해당 관점은 이번
  변경 범위 밖이다.

## 요약

핵심 변경은 `execution.failed` 종결 이벤트의 `error` wire 형태를 string 에서 EIA §6.4
object(`{code, message, nodeId, details?}`)로 통일하는 실질적 breaking change 이며, 이
저장소가 URL 버전 세그먼트를 쓰지 않아 CHANGELOG 문서화가 유일한 통지 경로다. 직전 두
라운드(`22_55_51`, `23_17_57`)가 각각 프런트엔드 미갱신 CRITICAL 과 spec 문서 내부
자기모순 WARNING 을 찾았고, 이번 diff 는 그 두 가지를 모두 실측상 해소한 상태다 — 특히
§6 필드 집합 표와 §6.4 blockquote 가 이번 diff 로 같은 방향(전 경로 object, 레거시 흡수는
의도적)을 말하도록 정정됐고, 연관 문서(`chat-channel-adapter.md`, plan 3건) 전수가 동기화돼
있음을 grep 으로 직접 확인했다. producer(`toTerminalErrorPayload` 단일 헬퍼 4곳 호출) ·
consumer(dispatcher 레거시 흡수, 프런트 타입 내로잉) 간 계약이 일치하고, `code`/`nodeId`
nullable 전환도 classifier 분류 결과에 영향을 주지 않는다. `execution.cancelled` 의 `error`
가 아직 통일 대상 밖인 것은 남은 갭이지만 세 층위 모두 일관되게 문서화돼 있어 은폐된
드리프트가 아니다. 신규/변경 HTTP 엔드포인트가 없어 URL 설계·페이지네이션·인증/인가·
요청 검증 관점은 해당 사항 없음. API 계약 관점에서 신규 CRITICAL/WARNING 은 없다.

## 위험도

LOW
