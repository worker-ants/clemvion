# Rationale 연속성 검토 — `spec-draft-eia-notification-payload-contract.md`

## 조사 방법 (요약)

target 이 인용하는 3개 핵심 선례(R16 "코드가 SoT", `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId`
의 PR #228·현행 WS §4.1 출처, `chat-channel-adapter.md` §3.1 의 `error.code` 기대 형태, `execution.completed`
emit 이 `durationMs` 를 누락한다는 실측)을 `git log -S`·`git show 9ed6e6305`·현재 소스(`execution-engine.service.ts`
L2360-2373, `websocket.service.ts`)·현재 spec(`spec/5-system/6-websocket-protocol.md` L177-178,
`spec/3-workflow-editor/3-execution.md` §8.1, `spec/conventions/chat-channel-adapter.md` §1.2/§3.1/R3)로
직접 대조했다. 전부 사실과 일치했고 지어낸 이력은 발견되지 않았다.

또한 이 draft 는 동일 세션에서 3회 연속 반려(`15_15_08`→`15_28_10`→`15_45_53`, 전부 `review/consistency/2026/08/13/`
에 실재)된 뒤 나온 4번째 라운드다. `15_45_53/SUMMARY.md` 의 "이 라운드 처분" 이 이미 "(B) SoT 단일화" 를
명시적으로 권고했고, 이번 target 은 정확히 그 권고를 실행한 것이다 — 즉 이번 설계 방향 자체가 이전 라운드의
consistency-check 산출물에서 유래한다.

## 발견사항

- **[WARNING]** EIA §6.3 를 "유일한 규범 필드 집합" 으로 승격하는 결정이, WS 자신의 직전 유사 사례(§4.4 "오너십 분리")
  선례를 인용·구분하지 않음
  - target 위치: target `## 결정 — 필드 집합은 1곳, 봉투는 채널별 1곳, 나머지는 포인터` (특히 (2)·(3)항, L91-101)
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` "§4.4 wire 필드 caveat — 직접 재작성
    대신 caveat + 오너십 분리 (2026-07-14, PR #945)" — "오너십 분리로 3중 복제·재-drift 회피" 문단이 명시적으로
    **"EIA §6.2 를 '전체 SoT' 로 격상하지 않은 이유는 그 blockquote 가 외부소비 필드만 다루는 의도적 스코프이기
    때문(WS 내부 관측 필드까지 외부 표면 문서에 싣지 않는다)"** 이라 적어, "한 문서를 전체 SoT 로 만드는 것" 을
    이 저장소가 같은 payload-중복 문제 유형에서 **한 번 검토하고 채택하지 않은** 이력이 있다.
  - 상세: 이번 target 은 정확히 그 "전체 SoT" 형태를 종결 이벤트(§6.3)에 적용한다 — WS §4.1·`chat-channel-adapter.md`
    §1.2·`3-execution.md` §8.1 모두 필드 열거를 버리고 EIA (1) 을 가리키는 포인터로 바꾼다. 이것이 §4.4 선례가
    회피한 패턴과 실질적으로 충돌하는지는 사실관계로 갈린다 — target 자신의 실측(L68-73, `emitExecutionEvent`
    L453-489)에 따르면 종결 이벤트의 WS 봉투는 `{ executionId, ...payload, seq, timestamp }` 이고 `payload`
    자체에는 WS 전용 부가 식별자가 없다(waiting_for_input 의 `waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`/
    `startedAt` 과 달리). 즉 WS 가 "내부 전용으로 소유할" 종결-이벤트 필드가 애초에 없으므로 이번 승격은 §4.4 가
    막으려던 것(WS 고유 필드까지 외부 문서로 흡수)과는 다르다 — 그러나 **이 구분을 target 의 Rationale 이 스스로
    설명하지 않는다.** target 의 `## Rationale` 은 "왜 spec 이 코드를 따르는가"(R16 인용)·"왜 caveat 이 아니라
    rewrite 인가"(§4.4 의 caveat-vs-rewrite 축만) 두 축은 다루지만, §4.4 의 **오너십-분리 vs 전체-SoT 축**은
    건드리지 않는다.
  - 왜 이게 이 문서에서 특히 위험한가: 이 target 은 정확히 "인접 선례를 다루지 않아 재반려" 패턴으로 3번 반려된
    이력이 있다(`15_45_53` SUMMARY 의 WARNING 3건이 전부 이 유형). §4.4 는 같은 파일·같은 payload-복제 문제
    class 를 다룬 가장 근접한 선례이므로, 침묵은 "왜 이번엔 §4.4 축을 안 따랐는가" 로 5번째 라운드에서 재질문될
    표면을 남긴다.
  - 제안: `## Rationale` 에 짧은 문단 추가 — "WS §4.4(오너십 분리) 선례와의 관계: 그 선례는 WS 가 waiting_for_input
    에서 자기 소유 부가 식별자(`waitingNodeType` 등)를 갖기 때문에 EIA 를 전체 SoT 로 격상하지 않았다. 종결
    이벤트는 WS 전용 부가 필드가 없음(실측: `{executionId, ...payload, seq, timestamp}` 뿐)을 확인했으므로,
    이 경우엔 오너십 분리 대신 EIA 단일 SoT + 포인터가 §4.4 원칙(N-place 복제 회피)의 다른 face 다."

- **[INFO]** `chat-channel-adapter.md` §1.2 를 (1)-참조로 축약하는 결정이, 해당 문서 자신의 R3 를 명시 인용하지 않음
  - target 위치: target `### (3) 나머지는 포인터로` 첫 항목 (L99)
  - 과거 결정 출처: `spec/conventions/chat-channel-adapter.md` `## Rationale` R3 "EiaEvent 를 별 타입으로 정의하지
    않고 EIA spec 위임" — "EIA spec §6 의 payload 가 SoT — 본 컨벤션은 union 만 정의... 구체 필드의 spec 갱신은
    항상 EIA spec 우선."
  - 상세: 이 R3 는 target 의 (3)항 결정과 **완전히 정합**하며(직접 확인: `chat-channel-adapter.md` L527-529),
    오히려 target 을 뒷받침하는 가장 강한 기존 근거다. 다만 이 R3 는 이번 bundle 입력에서 컨텍스트 예산으로
    누락돼 있어(`conventions/chat-channel-adapter.md` 는 헤더 목록에 Rationale 섹션이 잡히지 않음) target 이
    이를 인지하고 썼는지 본 검토만으로는 확인할 수 없었다 — 직접 파일을 열어 확인한 결과 실재하고 target 의 결정과
    충돌하지 않는다.
  - 제안: `## Rationale` 에 "chat-channel-adapter.md R3('구체 필드의 spec 갱신은 항상 EIA spec 우선')가 이미
    이 방향을 명시했다" 한 줄을 추가하면 (3)항의 근거가 target 자신의 서술만으로 완결된다(현재는 독자가 R3 를
    직접 찾아야 확인 가능).

- **[없음 — 검증됨]** `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId` 삭제, `durationMs`/`result.outputs`
  Planned 유지, `error` 형태 통일 목표는 모두 실제 코드·spec 이력과 일치한다.
  - `finalNodeId`/`finalPort`: PR #228 원 커밋(`9ed6e6305`)의 §6.3 초안 JSON 에 실재(L518-519) — target 의
    "같은 PR·같은 초안" 주장 정확.
  - `nodeCount`/`failedNodeId`(WS 측): 현재 `spec/5-system/6-websocket-protocol.md` L177-178 에 실재(target
    이 지우려는 자리와 정확히 일치).
  - `durationMs` Planned: `execution-engine.service.ts` L2360-2373 확인 결과, `savedExecution.durationMs` 는
    emit 직전 계산되지만 `emitExecution(... EXECUTION_COMPLETED, { status })` payload 에는 포함되지 않음 —
    target 의 "데이터는 emit 직전 존재하나 emit 안 됨" 주장과 정확히 일치.
  - `error` 형태: `chat-channel-adapter.md` §3.1 classifyExecutionFailure 는 이미 `event.error.code` (객체)를
    입력으로 가정하고 있어(L380), target 이 목표로 잡은 `{code,message,...}` 방향과 기존 컨벤션의 기대가 이미
    일치한다 — target 의 "형태 불일치" 진단(일부 경로 string)은 이 기존 문서 기대와의 실제 drift 를 정확히
    가리킨 것이다.
  - `## 체크리스트` 의 3회 반려 이력(`15_15_08`/`15_28_10`/`15_45_53`)도 대응 세션 디렉터리가 실재해 지어낸
    이력이 아니다.

## 요약

target 은 자신이 인용하는 모든 핵심 선례(R16 코드-우선, PR #228 기원, `chat-channel-adapter.md` §3.1 의 기존
`error.code` 기대, `durationMs` 미-emit 실측)를 사실과 정확히 일치시켰고, 명시적으로 기각된 대안을 이유 없이
되살리거나 합의된 invariant 를 직접 위반하는 지점은 발견되지 않았다. 오히려 이 target 자체가 3회 연속 반려를
거쳐 이전 라운드의 consistency-check 산출물(`15_45_53` 처분)이 권고한 "SoT 단일화" 방향을 그대로 집행한 것이라,
이 문서의 반려 이력에 대한 연속성은 이례적으로 높다. 유일한 실질 리스크는 WS §4.4(2026-07-14) "오너십 분리"
선례 — 같은 payload 중복 문제를 다룬 가장 근접한 선례 — 를 target 의 `## Rationale` 이 스스로 인용·구분하지
않는다는 점이다. 사실관계상 종결 이벤트는 WS 전용 부가 필드가 없어(실측 확인) 이번 승격이 §4.4 가 피한 패턴과
실질적으로 충돌하지 않는 것으로 보이나, 이 구분이 문서화되지 않은 채 남아 있으면 이 target 이 이미 세 번 겪은
"인접 선례 미반영" 재반려 패턴이 다섯 번째 라운드에서 재발할 절차적 위험이 있다. `chat-channel-adapter.md` R3
인용 누락은 순수 보강 성격의 INFO다.

## 위험도

LOW
