# Cross-Spec 일관성 검토 — spec/5-system/ (--impl-done)

## 컨텍스트 메모 (판정 신뢰도에 영향)

조립된 prompt 는 예산 초과로 이번 작업과 가장 관련 깊은 `spec/5-system/14-external-interaction-api.md`(107,799자)·
`4-execution-engine.md`(222,996자)·`10-graph-rag.md`(30,077자) 및 **실제 `<git diff origin/main...HEAD -- code_areas>` 자체**(50,363자)가
전부 스텁 처리됐다 (기존에 알려진 `feedback_consistency_spec_mode_budget` 패턴의 재발, 이번엔 diff 본문까지 잘렸다).
이를 메우기 위해 워크트리(HEAD)에서 다음을 직접 확인했다: `git diff origin/main...HEAD --stat`, 실제 변경 파일 diff
(`websocket.service.ts`·`websocket-events.types.ts`·`websocket.gateway.ts`), `plan/in-progress/ws-event-types-extract.md`,
`spec/5-system/6-websocket-protocol.md`(유일한 spec/ 변경분, 1줄), 그리고 `spec/**` 전수 `grep -rn "websocket.service.ts"`
로 이번 리팩터가 건드릴 수 있는 cross-spec 참조 지점을 찾았다.

**실제 spec/ 변경은 1줄**이다 — `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 목록에
`websocket-events.types.ts` 추가. 나머지는 전부 `codebase/backend/src/modules/websocket/` 내부 순수 리팩터
(enum/interface 선언을 의존성-프리 모듈로 이동, wire 이벤트명·payload shape·emit 호출 경로는 불변) +
`plan/**` 문서 갱신이다. 이미 `18_53_27`(impl-prep) 이 R10 "단일 sink" 불변식 대조를 마쳤고 이번 impl-done 은
**착지한 코드**가 그 판단과 실제로 일치하는지 + 리팩터가 부수적으로 다른 spec 문서의 코드-위치 인용을 stale 하게
만들지 않았는지에 집중했다.

## 발견사항

### [INFO] `spec/data-flow/0-overview.md` 의 "websocket.service.ts 헤더 주석" 인용이 이번 리팩터로 위치 이동됨

- target 위치: `spec/5-system/6-websocket-protocol.md`(diff) 가 유발한 코드 이동 — `codebase/backend/src/modules/websocket/websocket-events.types.ts` 신설
- 충돌 대상: `spec/data-flow/0-overview.md:110`
  `"단일 sink (\`WebsocketService\`) — ... (\`websocket.service.ts\` 헤더 주석, EIA §R10)."`
- 상세: 리팩터 전(`origin/main`) `websocket.service.ts` 의 첫 선언(`ExecutionChannelEvent` interface) 바로 위 JSDoc 이
  `"[Spec EIA §R10] — ExecutionEngine 단일 sink 정책 유지. ..."` 문구를 담고 있어 `0-overview.md:110` 이 이를
  "websocket.service.ts 헤더 주석" 으로 인용했다. 이번 PR 이 이 JSDoc 을 (딸린 interface 와 함께) 그대로
  `websocket-events.types.ts:24-28` 로 옮겼고 `websocket.service.ts` 의 새 파일-상단 주석(7-13행)은 "왜 타입을
  분리했나" 로 내용이 바뀌었다 — R10 단일 sink 문구는 더 이상 `websocket.service.ts` 어디에도(헤더든 본문이든)
  없다. 인용이 가리키는 물리적 위치가 실재하지 않게 됐다. 서술하는 **사실 자체**(단일 sink 정책)는 여전히
  참이고 `websocket-events.types.ts` 에 이관되어 있어 오도(misleading)는 아니나, "어디서 확인할 수 있는가"
  포인터가 stale 하다.
- 제안: `0-overview.md:110` 의 괄호를 `(\`websocket-events.types.ts\` 의 \`ExecutionChannelEvent\` JSDoc, EIA §R10)`
  로 갱신하거나, 파일-불변적으로 `("websocket 모듈 소스 주석", EIA §R10)` 처럼 표현을 느슨화. `spec/data-flow/`
  는 developer 쓰기 범위 밖(spec/ read-only)이라 별도 planner 턴 필요.

### [INFO] `spec/3-workflow-editor/3-execution.md` 의 `code:` 목록이 같은 리팩터의 자매 spec 과 비대칭

- target 위치: `spec/5-system/6-websocket-protocol.md` frontmatter (이번 PR 이 `code:` 에 `websocket-events.types.ts` 추가)
- 충돌 대상: `spec/3-workflow-editor/3-execution.md` frontmatter `code:` (4-13행) — `websocket.gateway.ts`/`websocket.service.ts` 는 있으나 `websocket-events.types.ts` 없음
- 상세: `3-execution.md:657` 본문이 `` `NodeEventType` 의 `execution.node.*` prefix — `websocket.service.ts` `` 를 직접
  인용한다. `NodeEventType` 의 canonical 선언은 이번 PR 로 `websocket-events.types.ts` 로 이동했다(`websocket.service.ts`
  는 re-export 만). 같은 리팩터가 건드리는 두 spec 문서 중 `6-websocket-protocol.md` 는 plan 조치 항목(`INFO4` 대응)으로
  `code:` 를 갱신했지만, 동일 심볼(`NodeEventType`)을 인용하는 `3-execution.md` 는 갱신되지 않아 두 문서의
  spec-impl-evidence 등재 상태가 갈렸다. `spec-code-paths.test.ts` 가드는 glob 이 ≥1 파일에 매치하면 통과이므로
  (기존 `websocket.gateway.ts`/`websocket.service.ts` 가 여전히 매치) 이 갭이 CI 를 깨지는 않는다 — 등재 완결성
  문제일 뿐 build-blocking 은 아니다.
- 제안: `3-execution.md` frontmatter `code:` 에도 `codebase/backend/src/modules/websocket/websocket-events.types.ts`
  추가 (`6-websocket-protocol.md` 와 동일 패턴). `spec/` 쓰기는 project-planner 권한.

### [INFO] `spec/5-system/10-graph-rag.md:552` — 이미 등재된 후속 항목, 착지 후에도 여전히 open (확인만)

- target 위치: 이번 리팩터로 `KbEventType` canonical 선언 위치가 `websocket.service.ts` → `websocket-events.types.ts` 로 이동
- 충돌 대상: `spec/5-system/10-graph-rag.md:552` — `` `document:graph_error` ... `websocket.service.ts` 의 `KbEventType` union 에서 #443 에서 제거됐다 ``
- 상세: 이 항목은 이미 `18_53_27`(impl-prep) cross_spec 리뷰가 식별했고, `plan/in-progress/ws-event-types-extract.md`
  §후속 에 "spec 본문은 developer 권한 밖 — planner 턴" 으로 명시 등재돼 있으며 `19_27_37`(code review)
  RESOLUTION.md 도 동일 항목을 "후속 등재" 로 처리했다. 새로 발견한 문제는 아니고, 착지된 코드 기준으로도
  여전히 유효한(=아직 안 고쳐진) open item 임을 확인했다 — SUMMARY 가 이 항목을 "이미 처리됨" 으로 잘못
  닫지 않도록 재확인 차원에서 기록한다. 서술 자체는 여전히 "참"이다(re-export 로 `websocket.service.ts` 에서도
  import 가능) — canonical 위치만 이관됐을 뿐.
- 제안: 기존 계획대로 별도 planner 턴에서 처리. 이번 PR 범위에 포함시킬 필요 없음.

## 확인 완료 — 충돌 없음

- **R10 "WebsocketService 단일 sink" 불변식**: `execution-event-emitter.service.ts`·`sse-adapter.service.ts`·
  `notification-fanout.service.ts`·`chat-channel.dispatcher.ts`·`websocket.gateway.ts` 의 diff 를 직접 대조한 결과
  emit 호출 경로·구독 구조는 **1글자도 바뀌지 않았다** — 바뀐 건 import 출처(`./websocket-events.types` 직접 vs
  `./websocket.service` 경유)뿐이다. `spec/5-system/4-execution-engine.md §4.4`·`14-external-interaction-api.md §R10`·
  `15-chat-channel.md CCH-AD-05/CCH-AD-07` 이 규정하는 "엔진은 `WebsocketService.emit*` 한 곳만 호출" 불변식과
  착지된 코드가 일치한다.
- **새 타입 모듈의 spec 인용 정확성**: `websocket-events.types.ts` 신설 JSDoc 이 인용하는
  `[Spec Chat Channel §3.1 CCH-AD-05 / §4.3]`(ChatChannelRoutingInfo)·`EIA §6`(ExecutionRoutingContext) 를
  각각 `spec/5-system/15-chat-channel.md:58,291-307`·`14-external-interaction-api.md:561` 과 대조 — 절 번호·
  내용(provider/conversationKey 매핑 키, outbound §6 페이로드) 모두 일치.
- **wire 이벤트명·payload shape**: `ExecutionEventType`/`NodeEventType`/`BackgroundRunEventType`/
  `NotificationEventType`/`KbEventType` 의 문자열 값과 payload interface 필드는 이동 전후 診断(diff)상
  완전히 동일 — `6-websocket-protocol.md` §4 가 규정하는 이벤트 카탈로그·payload shape 와의 정합은 영향 없음.
- **다른 in-progress plan 3건의 line-citation staleness**: `node-output-redesign/background.md`·
  `spec-draft-eia-62-waiting-payload.md`·`spec-draft-eia-notification-payload-contract.md` 가 이번 PR 자체에서
  심볼 기준으로 갱신됨을 diff 로 확인 (plan/** 문서라 cross-spec 등급 밖이지만 회귀 여부 확인 차원에서 대조).

## 요약

이번 PR 은 `spec/5-system/6-websocket-protocol.md` frontmatter 1줄 변경을 제외하면 순수 코드 리팩터(WS 이벤트
enum/interface 를 의존성-프리 모듈로 추출, ES-module 순환 완화)이며, 이벤트명·payload shape·emit 호출 경로·R10
단일 sink 정책 등 cross-spec 계약에 영향을 주는 요소는 전혀 바뀌지 않았다 — CRITICAL/WARNING 급 데이터 모델·
API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌은 없다. 다만 코드가 물리적으로 이동하면서 그 위치를 인용하던
spec 문서 2곳(`spec/data-flow/0-overview.md:110` 의 "헤더 주석" 포인터, `spec/3-workflow-editor/3-execution.md`
의 `code:` 등재 누락)이 새로 stale/비대칭해졌고, 기존에 알려진 `spec/5-system/10-graph-rag.md:552` 건은 여전히
open 상태로 확인됐다 — 셋 다 INFO 급 동기화 권장 사항이며 이 PR 을 막을 사유는 아니다.

## 위험도

LOW
