# Cross-Spec 일관성 검토 — spec-draft-ws-types-canonical-location.md

## 검증 방법

target 이 인용한 "현재" 문장 7곳 전부를 실제 spec 파일과 diff-line 단위로 대조했고,
`grep -rln "websocket.service.ts\|websocket-events.types.ts\|WebsocketService\|KbEventType\|NodeEventType\|ExecutionChannelEvent" spec/`
로 target 목록(7곳) 밖에 같은 패턴이 남아있는 위치가 있는지 전수 확인했다(14개 파일 히트, 7개는
target 대상 외). 또한 `codebase/backend/src/modules/websocket/{websocket.service.ts,websocket-events.types.ts}`
를 직접 읽어 target 의 "정본이 옮겨졌다 / re-export 로 동작 불변" 전제를 코드 레벨로 검증했다.

## 발견사항

- **[INFO]** target 목록 밖 7개 파일은 전부 "메서드/facade" 참조라 대상에서 제외한 것이 맞다
  - target 위치: (해당 없음 — target 이 다루지 않는 파일들의 정합성 확인)
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md`(§R10, `emitToExecution`/`executionEvents$`), `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`, `spec/data-flow/{3-execution,8-notifications,14-chat-channel,15-external-interaction}.md`
  - 상세: 이 7개 파일은 모두 `WebsocketService.emit*`/`executionEvents$`(메서드·facade, **안 옮김**)를 인용하지, `KbEventType`/`NodeEventType`/`ExecutionChannelEvent` 선언 자체의 소재를 지목하지 않는다. `spec/data-flow/14-chat-channel.md:115` 의 mermaid 시퀀스 라벨 `ExecutionChannelEvent` 도 타입 페이로드 이름 언급일 뿐 "정본 위치" 주장이 아니다. 코드 확인 결과 `emitKbEvent`/`emitToExecution`/`executionEvents$` 는 실제로 `websocket.service.ts` 에 그대로 남아있어(안 옮김), target 의 분류(선언 12개만 이동 vs 메서드/facade 불변)가 코드와 정확히 일치한다.
  - 제안: 조치 불필요 — target 의 7곳 스코프가 정확하다는 근거로 기록.

- **[INFO]** `NodeEventType`/`ExecutionChannelEvent` 잔여 참조 스캔 결과 target 목록이 exhaustive
  - target 위치: ① `spec/3-workflow-editor/3-execution.md:657`, ⑦ `spec/data-flow/0-overview.md:110`
  - 충돌 대상: 없음 (전수 확인용 negative check)
  - 상세: `grep -rn "NodeEventType" spec/` 는 `3-execution.md:657` 1곳만, `grep -rn "ExecutionChannelEvent" spec/`는 `data-flow/14-chat-channel.md:115`(위 INFO 항목에서 이미 비대상으로 판정) 1곳만 나온다. `KbEventType` 은 target 이 다루는 ②③④⑤⑥ 5곳 + `8-embedding-pipeline.md:285,411`·`data-flow/6-knowledge-base.md:416`(둘 다 파일명 미지목, "backend" 로만 서술 — stale 아님) 로 전부 계산이 맞는다. 즉 target 의 "7곳" 은 실제로 spec 전체를 대상으로 한 grep 결과와 정확히 일치하는 exhaustive set 이다.
  - 제안: 조치 불필요.

- **[WARNING]** ⑧ 추가 문장이 같은 §4.4 안의 "두 기법으로 봉인한 상태를 유지한다" 서술과 정면으로 부딪히지는 않지만 경계가 흐려진다
  - target 위치: target 문서 `## ⑧ 별건 — spec/5-system/4-execution-engine.md §4.4 Rationale 보완` (추가 문장 전문)
  - 충돌 대상: `spec/5-system/4-execution-engine.md:478` — "위 순환 자체를 이벤트 기반 디커플링 등으로 근본 축소하는 것은 별도 대규모 리팩터링 backlog 다 — **현재는 두 기법으로 봉인한 상태를 유지한다.**"
  - 상세: 바로 그 문장 뒤에 target 이 추가하려는 새 문장은 "값·타입 선언을 의존성-프리 모듈로 분리하면 **순환 참여자 집합 자체가 줄어** 모듈 평가 순서 위험이 사라진다" 라고 쓴다. "순환 참여자 집합을 줄인다" 는 서술은 바로 위 문장이 "대규모 리팩터링 backlog(유예)" 로 지목한 "이벤트 기반 디커플링으로 순환을 **근본 축소**" 와 개념적으로 인접하다 — 하나는 "봉인(seal, 우회)", 새 항목은 "집합 축소(reduce)" 라는 다른 동사를 쓰는데 두 표현이 같은 문단에 나란히 있어 독자가 "그럼 근본 축소가 이미 일부 진행된 것 아닌가" 라고 오독할 여지가 있다. target 의 새 문장 자체가 "대체하지 않는 보완책" · "유예 상태" 를 명시해 저자가 이 긴장을 인지하고 완화했지만, "두 기법으로 봉인" 이라는 수량 표현은 세 번째 기법 추가 후에도 그대로 남아 문서 내부에서 "기법이 몇 개인가" 를 헷갈리게 만든다.
  - 제안: 새 문장 삽입 시 "두 기법으로 봉인한 상태를 유지한다" 문장에 각주성 단서(예: "이 두 기법은 **DI 주입 순환**용이고, 값·타입 분리는 **모듈 평가 순환**을 줄이는 별도 축 — 두 기법의 개수를 바꾸지 않는다")를 붙이거나, 새 문장 서두에서 "이는 위 두 기법과 다른 층위(DI 그래프가 아니라 모듈 그래프)" 임을 한 번 더 명시해 "두 기법" 수량 표현과 충돌하지 않게 한다. 이는 cross-file 충돌은 아니고 같은 파일 §4.4 내부 정합 이슈이므로 developer/consistency 재검토 시 structural_flow·rationale_continuity 관점과 함께 보되, planner turn 에서 문구만 한 줄 보강하면 해소된다.

- **[INFO]** `## Rationale` 섹션 위치와 target 의 "§4.4 Rationale 말미" 표현의 미묘한 불일치
  - target 위치: target 문서 `## ⑧` 절 지시문 "§4.4 Rationale 말미에 한 문장 추가"
  - 충돌 대상: `spec/5-system/4-execution-engine.md:1328` (`## Rationale` 문서-레벨 섹션, 같은 문서 안에 별도로 존재 — "engine→Retry 순환 DI 제거"·"C-1 god-class strangler-fig 분할" 등 유사한 ES-module/DI 순환 결정들이 여기 모여 있음)
  - 상세: `spec/0-overview.md §8` 문서 컨벤션은 "`N-name.md` — 본문 끝에 `## Rationale` 섹션으로 결정 근거 inline" 이라고 규정한다. `4-execution-engine.md` 는 이 문서-레벨 `## Rationale`(줄 1328부터) 을 이미 갖고 있고, 실제로 §4.4 와 관련된 유사 순환-의존 결정들("ws.service↔gateway↔retry↔event-emitter ES-module 순환은 forwardRef 로 봉인" 등, 줄 1756)이 그 문서-레벨 섹션에 모여 있다. target 이 말하는 "§4.4 Rationale" 은 §4.4 본문 중간의 "근거:" 불릿 리스트(줄 467~483)를 가리키는 것으로 읽히는데, 이 두 위치("§4.4 인라인 근거:" vs "문서 끝 `## Rationale`")가 이름이 비슷해 실제 patch 적용 시 착지점이 모호할 수 있다.
  - 제안: developer 가 실제 patch 를 적용할 때 "§4.4 절 안의 `근거:` 불릿 리스트 말미(481행 근처, `> 향후 외부 sink...` 문장 앞 또는 483행 뒤)" 처럼 줄 번호 anchor 를 명시하거나, 유사 순환-의존 결정들이 모여 있는 문서-레벨 `## Rationale`(1756행 근처) 에 붙이는 대안도 함께 고려하도록 target 문서에 한 줄 명확화를 권장. 차단 사유는 아님.

## 요약

target 이 제안하는 7곳 치환 + ⑧ Rationale 보완은 코드(`websocket.service.ts`/`websocket-events.types.ts`)를 직접 읽어 검증한 결과 전제(정본 12개 선언 이동, `emitKbEvent`/`executionEvents$` facade 불변, re-export 로 동작 불변)가 모두 사실과 일치했고, `spec/` 전체를 대상으로 한 grep 전수 조사에서도 target 이 놓친 8번째 위치는 발견되지 않았다 — 7곳 스코프는 exhaustive 하다. 유일한 실질적 우려는 ⑧ 이 삽입될 §4.4 안에서 새 문장의 "순환 참여자 집합을 줄인다" 는 표현이 바로 위 문장의 "현재는 두 기법으로 봉인한 상태(근본 축소는 유예)" 라는 수량·상태 서술과 나란히 놓이며 독자에게 미묘한 오독 여지를 남긴다는 점이며, 이는 cross-file 충돌이 아니라 동일 파일 내부 정합 이슈로 WARNING 등급이 적절하다. 나머지는 전부 INFO 수준의 확인 사항이거나 patch 적용 시 앵커 명확화 권장에 그친다.

## 위험도

LOW
