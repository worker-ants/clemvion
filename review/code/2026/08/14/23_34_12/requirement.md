# 요구사항(Requirement) 리뷰 — `execution.failed` error 객체화 (3라운드 종합, `23_34_12`)

## 리뷰 방법

이 diff 는 두 차례 ai-review(`22_55_51` CRITICAL 1/WARNING 10 → fix, `23_17_57` WARNING 6 → fix)를
거친 **누적 changeset**이다. 이전 두 라운드가 이미 CRITICAL 을 전부 닫았다고 보고하므로,
그 주장을 신뢰하지 않고 핵심 파일을 전부 `Read`/`Grep` 으로 직접 열어 재확인했다 —
`terminal-error-payload.ts`(신규 헬퍼), 4개 emit 호출부(`execution-engine.service.ts` 3곳·
`retry-turn.service.ts` 1곳), `chat-channel.dispatcher.ts`/`types.ts`, 프런트 `use-execution-events.ts`
+ 렌더 지점(`conversation-inspector.tsx`), 분류기(`execution-failure-classifier.ts`), spec
`14-external-interaction-api.md` §6/§6.4 전문.

## 발견사항

- **[WARNING]** `chat-channel.dispatcher.spec.ts` 최상단 JSDoc 이 이 PR 이 직접 걷어낸 것과 **같은 클래스의 죽은 줄-번호 참조**를 그대로 안고 있다 — 전제 자체도 이제 stale 하다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:270-271` (describe 블록 상단 JSDoc, `describe(...)` 선언은 `:276`)
  - 상세: 이 PR 은 `chat-channel.dispatcher.ts` 의 `execution.failed` 분기 주석에서 정확히 이 문구를 걷어냈다 — "종전 주석은 후속 작업으로 `spec-update-execution-failed-payload-shape` 라는 plan 을 가리켰는데 **그 이름의 plan 은 존재한 적이 없다**… **인용한 라인 번호 두 개도 지금은 전혀 다른 코드를 가리킨다**. 없는 문서를 가리키는 포인터는 다음 사람의 조사를 낭비시킨다"(`chat-channel.dispatcher.ts:542-545`). 그런데 **그 걷어낸 문구와 글자 그대로 동일한 줄 번호 인용**(`execution-engine.service.ts line 1339-1346 / 2526-2533`)이 같은 diff 로 편집 중인 테스트 파일의 describe 블록 JSDoc(`:271`)에 그대로 남아 있다. 직접 대조 확인: `execution-engine.service.ts:1335-1350` 은 routing context 재등록 로그, `:2520-2535` 는 `driveResumeAwaited` COMPLETED 마킹 — 둘 다 `error` emit 과 무관하다(이 PR 이 자신의 형제 주석에서 이미 검증한 것과 동일한 사실). 게다가 JSDoc 의 전제("execution-engine 이 emit 하는 payload.error 가 … 아닌 string 인 경우")도 더 이상 기본 경로가 아니다 — 이 PR 로 엔진은 전 경로에서 object 를 emit 하고, string 은 이제 "배포 경계에서 재생되는 레거시 이벤트" 전용 경로다(같은 파일의 갱신된 `it` 제목들이 정확히 이렇게 표현을 바꿨다 — `:311` "레거시 흡수"). 이 PR 이 이번 diff 안에서 개별 `it` 제목 3곳(`:311`·`:329`·`:353` 부근)은 갱신했으면서, 그 블록을 감싸는 상위 JSDoc(`:267-275`)은 손대지 않았다. 이 저장소가 이번 세션에서 반복 등재한 "고쳤다 쓰는 시점에 자매를 전수로 세지 않았다" 패턴의 재발이며, 이번엔 **PR 이 스스로 지목한 결함 클래스가 같은 PR 의 다른 파일에서 재현**된 경우라 특히 눈에 띈다.
  - 제안: JSDoc 을 "이제 레거시/배포-경계 재생 이벤트 전용 경로"로 정정하고 죽은 줄-번호 인용을 제거(또는 심볼 참조로 교체) — `chat-channel.dispatcher.ts:538-545` 가 이미 채택한 문구·근거를 그대로 재사용하면 된다.

- **[INFO]** dispatcher 의 object 정규화가 스칼라(`number`/`boolean`/`bigint`) 입력에서 이전과 다른 `message` 값을 만든다 — 테스트가 그 값을 단언하지 않아 의도된 변경인지 우연한 부작용인지 판별 불가.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:552-558` (`toTerminalErrorPayload(errorRaw) ?? {...}`), 대응 테스트 `chat-channel.dispatcher.spec.ts:347-362`(`error: 42` 케이스, `code` 만 단언·`message` 미단언)
  - 상세: 리팩터 전 코드는 `errorRaw` 가 문자열도 object 도 아니면(예: 숫자 `42`) 항상 `{code:'INTERNAL_ERROR', message:'unknown error'}` 로 떨어졌다. 리팩터 후 `toTerminalErrorPayload(42)` 는 number 분기를 타 `{code:null, message:'42', nodeId:null}` 를 반환한다 — `message` 가 `'unknown error'` 대신 스칼라를 문자열화한 값으로 바뀌었다(`terminal-error-payload.ts:58-65`). `?? {...}` fallback(메시지 `'unknown error'`)은 이제 `errorRaw` 가 `null`/`undefined` 일 때만 발동한다. 기능적으로 더 정보성 있는 값이라 결함이라 보기는 어렵고, 실제 emit 경로(DB `Execution.error` 컬럼)는 스칼라를 넣지 않으므로 실무 영향도 낮다 — 다만 이 동작 변화가 어느 리뷰 라운드의 RESOLUTION 에도 명시적으로 언급되지 않았고, 대응 테스트도 `code` 만 단언해 이 값 변화를 판별하지 못한다.
  - 제안: 조치 불요(원한다면 `message` 단언을 테스트에 추가해 의도된 동작임을 고정).

- **[INFO]** (긍정 확인) 핵심 요구사항이 4개 emit 지점·소비 타입·프런트엔드·spec 4계층에서 실측상 정확히 일치한다.
  - `terminal-error-payload.ts`(`toTerminalErrorPayload`) 를 부르는 emit 지점은 정확히 4곳 — `execution-engine.service.ts:664`(`failFirstSegmentSetup`, `row.error` 재사용)·`:3314`(`finalizeStalledExhausted`, `stalledError` 재사용 — DB write 의 자식 cascade `code` 참조(`:3299`)까지 같은 상수를 재사용해 "손으로 반복하면 갈린다" 문제를 실제로 해소)·`:4872`(`finalizeFailedExecution`, `savedExecution.error` 재사용)·`retry-turn.service.ts:966`(`execution.error` 재사용, `isCancelled` 가드로 취소 시 emit 자체를 skip). grep 으로 이 4곳 외 `ExecutionEventType.EXECUTION_FAILED` emit 호출부가 없음을 확인(`background-execution.processor.ts` 등 나머지는 주석/참조뿐).
  - `EiaFailedEvent.error`(`chat-channel/types.ts:399-409`, `code: string|null` non-optional·`message: string`·`nodeId?: string|null`·`details?: unknown`) 가 헬퍼 반환 타입(`TerminalErrorPayload`)과 필드별로 일치하고, dispatcher 는 캐스팅 없이 같은 헬퍼(`toTerminalErrorPayload`)를 소비해 3라운드 전 CRITICAL(캐스팅으로 타입가드 우회)이 실제로 해소됐다.
  - `execution-failure-classifier.ts:105` 에서 `code: null` → `event.error?.code ?? ''` → 어느 `*_CODES` Set 에도 `''` 없어 unknown-fallback(`executionFailedInternal` + warn)으로 떨어지는 것을 직접 확인 — dispatcher 주석의 분류 결과 불변 주장과 일치.
  - 프런트 `use-execution-events.ts:264-276` 은 `payload.error` 를 `string | {message?} | null` 로 좁혀 항상 `string|undefined` 만 `failExecution`/`flushPendingToolItemsAsError` 에 전달하고, `execution-store.ts` 의 `failExecution` 시그니처(`error?: string`)·렌더 지점(`conversation-inspector.tsx:475,1203` `{item.error}`)이 전부 문자열만 받는 것을 확인 — 이전 라운드 CRITICAL(React "Objects are not valid as a React child")이 실제로 닫혔다.
  - spec `14-external-interaction-api.md` §6 필드표(`:572`)와 §6.4 blockquote(`:790-797`) 를 직접 읽어 대조한 결과, 이전 라운드가 지적한 "표는 고쳤는데 인접 blockquote 는 반대 내용" 자기모순이 이번 최종 diff 에는 **더 이상 없다** — 두 곳 모두 "failed 는 전 경로 object, 레거시 재생 이벤트만 string 허용"으로 일치.
  - `EiaCompletedEvent.result` 의 유령 필드(`finalNodeId`/`finalPort`) 제거는 저장소 전체(`dist/` 제외)에 소비처 0건을 grep 으로 재확인 — 안전한 제거.

- **[INFO]** `execution.cancelled` 의 `error` 는 이번 정규화 범위에서 여전히 제외돼 있으나(spec §6 표 `:572`, `EiaCancelledEvent.error?: {code: string; message?}` — `chat-channel/types.ts:422`, 미변경), code·타입·spec·plan(`eia-terminal-payload.md` 재판정 ③-c, `durationMs` 와 같은 비용 그룹) 4곳이 일관되게 "다음 PR" 로 명시한다 — 은폐된 스코프 축소가 아니다. TODO/FIXME/HACK 마커는 diff 전체에 0건(grep 확인).

## 요약

핵심 요구사항(`execution.failed` 종결 이벤트의 `error` 를 EIA §6.4 object 계약(`{code, message, nodeId, details?}`, `code`/`nodeId` nullable)으로 통일)은 4개 emit 지점·소비 타입·프런트엔드·spec 문서 4계층에서 실측 재확인 결과 정확히 구현돼 있고, 이전 두 라운드가 찾은 CRITICAL(프런트 렌더 크래시)·WARNING(spec 자기모순·dispatcher 캐스팅 우회·값 미단언 emit 등)도 코드 레벨에서 실제로 해소됐음을 직접 대조로 확인했다. 새로 발견한 것은 이 PR 이 스스로 표방한 원칙("죽은 줄-번호 참조·낡은 전제를 남기지 않는다")의 재발 사례 하나뿐이다 — `chat-channel.dispatcher.spec.ts` describe 블록 JSDoc 이, 같은 PR 이 형제 파일(`chat-channel.dispatcher.ts`)에서 정확히 걷어낸 것과 동일한 죽은 줄-번호 인용과 낡은 "string 이 기본 경로" 전제를 그대로 안고 있다. 기능적 결함은 아니고(테스트 통과에 영향 없음) 조사 낭비를 유발하는 문서 성격 결함이라 WARNING 으로 분류한다. 그 외 반환값 누락, null/undefined 처리 미비, 미완성 TODO 는 발견되지 않았다.

## 위험도

LOW
