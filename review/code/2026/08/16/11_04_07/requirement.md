# 요구사항(Requirement) Review

## 리뷰 범위 및 방법

핵심 변경은 `execution.failed` 종결 이벤트의 `error.message`/`error.details`가 WS/SSE/EIA outbound
webhook으로 외부 제3자에게 나가기 전 `deepRedactSecrets`로 값-패턴 secret(마스킹)을 적용하는
`redactTerminalError` 헬퍼를 `toTerminalErrorPayload` 안에 신설한 것이다. 이 diff는 이미 3라운드의
`/ai-review`(`09_51_00`→`10_19_30`→`10_41_55`, 전부 Critical 0으로 수렴)와 2라운드의 consistency-check
(`09_25_29`, `10_19_31`)를 거쳤고, 각 라운드의 RESOLUTION.md에 반영 이력이 기록돼 있다. 본 라운드에서는
다음을 직접 재검증했다: (1) 실제 소스(`terminal-error-payload.ts`, `sanitize-error-message.ts` 양쪽,
`terminal-error-payload.spec.ts`)를 Read로 열어 diff가 아니라 최종 코드 상태를 확인, (2)
`toTerminalErrorPayload`/`sanitizeErrorMessage`의 전체 호출부를 grep으로 재실측(각각 5곳/3곳, 문서
주장과 일치), (3) `execution.cancelled`의 5개 `emitCancellationEvent` 호출부가 실제로 고정 문자열만
쓰는지 소스로 직접 확인, (4) REST `getStatus`가 `Execution.error`가 아니라
`stripAndRedact(execution.outputData)`를 싣는다는 plan의 정정 주장을 `interaction.service.ts:454`에서
직접 확인, (5) CHANGELOG/plan이 인용하는 `spec/5-system/14-external-interaction-api.md` §3.1(Outbound
Notification, EIA-NX-02)·§5.2·§6.4·R17을 직접 열어 절 번호·문언과 대조, (6) 관련 spec/unit 테스트를 실행
(`terminal-error-payload.spec.ts` 26/26, `chat-channel.dispatcher.spec.ts`+`retry-turn.service.spec.ts`
87/87, 전부 PASS).

## 발견사항

- **[WARNING]** `sanitize-error-message.ts`(execution-engine)의 새 docstring이 "호출부 3곳 전부
  알림 조립 지점"이라고 적는데, 그중 한 곳(`background-execution.processor.ts`)의 sanitize 결과는
  알림뿐 아니라 **WS emit**에도 무조건 쓰인다 — 범위 서술이 이번에도 구현보다 근소하게 넓다
  - 위치: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts:1-6`
    (docstring, "호출부는 실측 **3곳뿐이고 전부 알림 조립 지점이다**"); 실제 호출 지점은
    `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:70-77`
  - 상세: `background-execution.processor.ts`의 `catch` 블록은 `const message =
    sanitizeErrorMessage(err);` 다음, **무조건** `this.safeEmitRunCompleted(data, 'failed',
    runStartedAt, message)`를 호출해 `BACKGROUND_RUN_COMPLETED` WS 이벤트(`background:run:<id>`
    채널, `websocket.service.ts:emitBackgroundRunEvent`)의 `errorMessage` 필드에 그 sanitize 결과를
    싣는다. `dispatchFailureNotification(data, message)`(진짜 알림)는 `data.config.notifyOnFailure`
    조건부다. 즉 이 호출부의 sanitize 결과는 "알림 조립"보다 먼저, 그리고 조건과 무관하게 **WS
    emit에도** 쓰인다. `background:run:<id>`는 `execution:<id>`와 격리된 내부 채널이라 SSE/webhook
    으로는 안 나가므로(코드 자체 주석: "메인 흐름 구독자에게 본문 이벤트가 전파되지 않는다") docstring
    핵심 주장("WS/SSE/webhook **종결** 이벤트는 이 함수를 거치지 않았다")은 EIA 종결 3종(`execution.
    completed/failed/cancelled`) 기준으로는 여전히 참이라 안전성 결함은 아니다. 다만 "호출부 3곳
    **전부** 알림 조립 지점"이라는 문구 자체는 이 한 곳에 한해 부정확하고, 이 PR의 두 docstring
    수정 모두가 정확히 이런 "문서한 보장이 구현보다 넓다" 패턴을 스스로 겨냥해 시정한 것이라(예:
    같은 파일 18-19행이 "webhook 알림" 문구를 이미 한 번 제거) 같은 성격의 잔여 부정확이 하나 더
    남아 있다는 점이 눈에 띈다. `09_51_00`/`10_19_30` requirement 라운드도 이 호출부의 `channel`
    타입(`in_app|email|both`)까지는 grep으로 확인했지만 같은 `catch` 블록 안의 WS emit 병용은
    포착하지 못했다.
  - 제안: docstring에 "background-execution.processor는 sanitize 결과를 알림뿐 아니라 격리된
    `background:run:<id>` WS 채널(`errorMessage`)에도 싣는다 — 종결 3종 이벤트가 아니라 내부 전용
    채널이라 EIA 외부 표면과 무관" 한 줄을 추가하거나, "알림 조립 지점"을 "알림/내부 WS 조립
    지점"으로 정정. 차단 사유 아님(정보 유출 방향이 아니라 오히려 더 넓게 마스킹되는 방향).

- **[SPEC-DRIFT][WARNING]** `spec/5-system/14-external-interaction-api.md` §6.4 필드 표와 R17 마스킹
  카탈로그가 이번 PR이 도입한 `toTerminalErrorPayload` egress 값-패턴 마스킹을 아직 문서화하지 않는다
  - 위치: `spec/5-system/14-external-interaction-api.md:770-802`(§6.4 `execution.failed` 필드 표 +
    안내문, `error.message`/`details`에 마스킹이 적용된다는 언급 없음), `spec/5-system/
    14-external-interaction-api.md:1414-1430`(R17 "표면 제약(보안)" 카탈로그 — `conversationThread`·
    `execution.ai_message`·`nodeOutput.conversationConfig`·terminal `result`/`error`(getStatus 경유)
    4개 불릿만 있고, 이번에 신설된 WS/SSE/webhook 종결 `error.message`/`details` egress 마스킹은
    5번째 항목으로 없다)
  - 상세: 코드(`terminal-error-payload.ts:5-16`)는 "SoT: spec §6.4"라고 명시하지만, §6.4 원문은
    `error`를 `{code, message, nodeId, details?}`로만 규정하고 새니타이즈를 언급하지 않는다 — line-level
    로는 spec 본문과 구현이 어긋난다. 다만 이는 **코드가 틀린 것이 아니라 spec이 낡은 경우**다: 이
    변경은 §R17이 이미 다른 필드들(`conversationThread`, `ai_message`, `nodeOutput`)에 확립해 둔
    "egress-only masking" 원칙을 `execution.failed`의 `error`에도 동형 적용한 의도적·합리적 확장이고,
    개발자 스스로 3라운드에 걸쳐 이를 인지해 `plan/in-progress/eia-terminal-error-sanitize.md` "후속"
    절(:151-159)에 "planner 턴 — R17 카탈로그 5번째 항목 등재 + §6.4 캐비엇 필요"로 명시 등재했고
    `spec/`은 developer 쓰기 권한 밖이라 여기서 직접 고치지 않은 것이 올바른 처리다. 즉 이 항목은
    새로 발견된 미추적 갭이 아니라, spec fidelity 점검을 독립적으로 수행한 결과 **이미 tracked**된
    SPEC-DRIFT를 재확인한 것이다.
  - 제안: 코드 변경 불필요. `project-planner`가 다음 spec 턴에서 §6.4 안내문에 "`message`/`details`는
    egress 시 `deepRedactSecrets`로 값-패턴 마스킹된다(자격증명 없는 연결 문자열/호스트명은 잔여
    갭)"는 캐비엇을, R17 "표면 제약(보안)" 카탈로그에 5번째 불릿("terminal `execution.failed`
    `error.message`/`details` — WS/SSE/webhook 종결 emit, `toTerminalErrorPayload`가 강제")을 추가할
    것을 권고. 이미 plan에 등재돼 있으므로 신규 액션 아이템이 아니라 확인 차원의 재기록.

## 정상 확인된 사항 (line-level 대조 결과 일치)

- `toTerminalErrorPayload` 호출부는 정확히 5곳(`chat-channel.dispatcher.ts:551`,
  `execution-engine.service.ts:668/3400/5030`, `retry-turn.service.ts:1001`) — DB write 0, 전부 emit
  쪽이라는 문서 주장과 grep 결과 일치.
- `sanitizeErrorMessage` 호출부는 정확히 3곳(`execution-engine.service.ts:5090`,
  `background-execution.processor.ts:70`, `schedule-runner.service.ts:243`) — 전부
  `NotificationsService.notify`/`createMany`(`channel: 'in_app'|'email'|'both'`)로 흘러간다는
  주장도 정확(webhook 채널 0건).
- `execution.cancelled`의 `emitCancellationEvent` 5개 호출부(`execution-engine.service.ts:1073,1203,
  2845,2894,4944`)는 전부 고정 문자열/코드-파생 메시지(`'Execution cancelled: queue wait time
  exceeded'` 등)만 쓴다 — raw 예외 메시지가 없어 "현재는 안전"이라는 plan/JSDoc 주장이 실측과
  일치.
- REST `getStatus`의 `error` 필드는 `Execution.error`가 아니라
  `stripAndRedact(execution.outputData)`(`interaction.service.ts:454`)를 싣는다 — plan이 "REST와
  대칭" 서술을 스스로 정정한 근거가 코드와 일치, 이번 PR의 실제 효과는 "새 컬럼에 값-패턴 마스킹이
  최초로 생긴다"이지 "REST와 같아진다"가 아니라는 결론도 정확.
- CHANGELOG.md:6·45와 plan:27의 "EIA outbound webhook(§3.1 EIA-NX-02)" 인용은
  `spec/5-system/14-external-interaction-api.md:54-59`(§3.1 Outbound Notification, EIA-NX-02
  화이트리스트)와 정확히 일치 — 이전 라운드가 지적한 §3.3(인증) 오표기가 이번 diff에서 올바르게
  §3.1로 정정돼 있음을 직접 확인.
- `redactTerminalError`의 `code`/`nodeId` 비변형 설계: `SECRET_LEAK_PATTERNS`에 실제로 매칭되는
  adversarial 값(`'Bearer sk-live-should-not-be-masked'`, `'api-key=must-stay-verbatim'`)을 넣어도
  출력이 그대로임을 테스트(`terminal-error-payload.spec.ts:165-170`)와 코드 구조(spread 후
  `message`/`details`만 덮어씀, `code`/`nodeId`는 건드리지 않음)로 확인 — 판별력 있는 테스트다.
- `details`의 세 가지 부재 표현(부재/undefined → 키 생략, 명시적 `null` → `null` 키 보존, 값 존재 →
  마스킹된 값)이 구현(`:111-113`)과 테스트(`:200-204`, `:222-225`) 양쪽에서 일치 — §6.4 optional
  선언과 [API 규약 §5.4](spec/5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략)(부재
  표현 규약)에 부합.
- `err instanceof Error ? err.message : String(err)` 원문을 그대로 쓰는 DB write 3곳(①
  `execution-engine.service.ts:636` `failFirstSegmentSetup`, ② `execution-engine.service.ts:4991`
  `finalizeFailedExecution`, ③ `retry-turn.service.ts:958` `failRetryExecution`, `!isCancelled` 가드)을
  직접 확인 — plan의 "3곳 전수, DB는 원문 보존" 주장과 일치. 이 셋을 손대지 않고 egress
  (`toTerminalErrorPayload`)에서만 마스킹하는 설계는 EIA §R17 egress-only 원칙과 일관된다.
- TODO/FIXME/HACK/XXX 주석 없음(변경 파일 3개 전수 grep).
- jest 직접 실행: `terminal-error-payload.spec.ts` 26/26 PASS,
  `chat-channel.dispatcher.spec.ts`+`retry-turn.service.spec.ts` 87/87 PASS(기존 회귀 없음).

## 요약

핵심 로직(`redactTerminalError` egress 마스킹)은 5개 반환 경로 전부를 통과하도록 구조적으로
배선돼 있고, 사전 뮤테이션(마스킹 제거 5/5 RED, `code`/`nodeId` 마스킹 2/2 RED)으로 판별력까지
검증된 상태다. 이번 라운드에서 소스·spec·plan을 직접 열어 line-level로 대조한 결과 호출부 개수(5곳/
3곳/5곳)·부재 표현 3분기·§3.1 인용·REST 컬럼 비대칭 등 문서화된 핵심 주장은 전부 실측과 일치했다.
새로 발견한 것은 두 가지뿐이며 둘 다 낮은 severity다 — (1) `sanitize-error-message.ts`
docstring이 "호출부 3곳 전부 알림 조립 지점"이라 적지만 그중 한 곳은 격리된 내부 WS 채널에도
sanitize 결과를 싣는다는, 이 PR 자신이 반복 시정해 온 것과 같은 성격의 근소한 범위 서술 오차(보안
영향 없음), (2) §6.4/R17이 이번 마스킹을 아직 반영하지 않은 SPEC-DRIFT — 다만 이미 developer가
독립적으로 인지해 planner 후속으로 정확히 등재해 둔 상태라 실질적으로는 확인일 뿐 신규 조치
항목은 아니다. 기능 완전성·엣지 케이스·에러 시나리오·반환값·비즈니스 로직 전 관점에서 차단급
결함은 없다.

## 위험도

LOW
