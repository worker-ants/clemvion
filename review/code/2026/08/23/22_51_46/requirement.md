# 요구사항(Requirement) 충족 리뷰

## 검토 범위
- `codebase/backend/src/modules/websocket/websocket.service.ts` — `toFanoutEnvelope` 에 `nodeOutput`/`buttonConfig.nodeOutput` fail-closed allowlist 배선
- `codebase/backend/src/shared/utils/node-output-allowlist.ts` — allowlist 4키(`payload`·`title`·`rendered`·`nodeType`) 추가
- 대응 spec.ts 2건, spec 문서 2건(`14-external-interaction-api.md`, `6-websocket-protocol.md`), plan 문서 2건, consistency-check 산출물 6건

## 실측 검증
- `codebase/backend` 에서 대상 spec 2파일 단독 실행: `Test Suites: 2 passed, Tests: 81 passed`.
- 영향권 확장 실행(`websocket`·`external-interaction`·`chat-channel` 모듈 + allowlist spec): `Test Suites: 50 passed, Tests: 1031 passed` — 회귀 없음.
- `tsc --noEmit` 로 변경 파일 자체(`node-output-allowlist.ts`/`.spec.ts`, `websocket.service.ts`)는 오류 0건. (`websocket.service.spec.ts:578` 의 `ChatChannelRoutingInfo` 타입 오류는 이번 diff 밖 영역 — `89a816ab9`/`89c3f3c53` 커밋에도 동일 패턴이 이미 존재하는 pre-existing 이슈로, 이번 변경이 만든 결함 아님.)
- `WebsocketService.executionEvents$` 구독자 3곳(`sse-adapter.service.ts`, `notification-fanout.service.ts`(webhook), `chat-channel.dispatcher.ts`) 을 grep 으로 확인 — plan 이 주장하는 "단일 chokepoint(`toFanoutEnvelope`)가 SSE/webhook/chat-channel 전부를 커버한다" 는 실측과 일치.
- `NodeHandlerOutput` 인터페이스(`node-handler.interface.ts:304-336`)를 직접 열어 공개 5키(`config`/`output`/`meta`/`port`/`status`) + 비공개 2키(`_resumeState`/`_retryState`) 정확히 일치 확인 — 컴파일타임 assertion 의 전제와 부합.
- chat-channel 렌더러(discord/telegram/slack) 3파일에서 `nodeOutput.rendered`/`.payload`/`.title`/`.nodeType` 를 top-level flat 로 읽는 코드를 grep 으로 직접 확인 — JSDoc·spec·테스트 주석의 근거 주장이 지어낸 것이 아니라 실코드에 부합.
- `spec/5-system/15-chat-channel.md` §(c) `renderPresentationByType shape 처리 우선순위` — JSDoc 이 인용한 SoT 가 실재하고 내용도 일치(`payload → output → config → flat` 우선순위, flat 티어가 이번에 추가된 4키에 해당).
- `buttonConfig.nodeOutput?.nodeType` 을 `chart`/`table`/`carousel` 3값과만 비교하는 discord renderer 로직(`discord-message.renderer.ts:322-329`)을 직접 확인 — 새로 추가된 spec 각주("카드 렌더 서브타입: chart/table/carousel")가 R18 의 4종(`carousel/table/chart/template`)과 겉보기엔 달라 보이지만, 실제로 버튼 waiting 컨텍스트에서 `template` 은 애초에 이 3값 비교에 들어가지 않으므로 각주가 정확함(오탐 아님).

## 발견사항

- **[INFO]** `plan/in-progress/sse-nodeoutput-allowlist.md` frontmatter `spec_impact` 가 `spec/5-system/14-external-interaction-api.md` 한 건만 나열하지만, 실제 diff 는 `spec/5-system/6-websocket-protocol.md` 도 함께 수정했다.
  - 위치: `plan/in-progress/sse-nodeoutput-allowlist.md:7-8` (frontmatter `spec_impact` 리스트)
  - 상세: Gate C 는 `spec_impact` 가 리스트 형식이면 통과하지만, 내용상 실제로 건드린 spec 파일 전량을 나열하는 것이 관례다. 이번 라운드 consistency-check(`plan_coherence`)도 이 누락을 지적하지 않았다.
  - 제안: 코드 결함이 아니라 plan 메타데이터 완결성 문제. 후속 커밋에서 `spec_impact` 리스트에 `spec/5-system/6-websocket-protocol.md` 를 추가하는 것을 권장(차단 사유는 아님).

- **[INFO]** `node-output-allowlist.ts` 의 `assertAllowlistCoversHandlerContract` 컴파일타임 결속은 `NodeHandlerOutput` 의 **공개 5키**만 강제하고, 이번에 추가된 wire-전용 8키(위젯 4 + chat-channel 4)는 타입 결속이 없어 **리터럴 테스트만이 유일한 방어**다(spec·JSDoc·developer 본인이 명시적으로 인지하고 있는 한계). 코드·문서·plan 모두 이 사실을 정확히 서술하고 있고 리터럴 대조 테스트(`node-output-allowlist.spec.ts` "[리터럴] wire 전용 키가 목록에서 사라지면 여기서 잡힌다")가 실재해 방어 공백은 아니다. 참고용 기록.

## 요약

`toFanoutEnvelope` 단일 chokepoint 에 `allowlistFanoutNodeOutput` 을 배선해 SSE/webhook/chat-channel fanout 의 `nodeOutput`(top-level)·`buttonConfig.nodeOutput` 두 자리를 REST `getStatus` 와 동일한 fail-closed allowlist 로 좁힌 변경이다. `NodeHandlerOutput` 공개 5키에 대한 컴파일타임 assertion, wire-전용 8키(위젯 4 + 신규 chat-channel 4)에 대한 리터럴 테스트, copy-on-change 및 `__proto__` 오염 방지까지 자매 유틸(`stripExternalOnlyFields`)의 관례를 그대로 계승했다. 실측 결과 (1) `_retryState`/`_resumeState`/미지 키가 `nodeOutput`·`buttonConfig.nodeOutput` 양쪽에서 제거되고 대조군(허용 키)은 보존되며, (2) 내부 WS(`broadcastToChannel`)는 원문을 그대로 유지하고, (3) chat-channel 이 top-level flat 으로 읽는 `payload`/`title`/`rendered`/`nodeType` 4키가 실제 렌더러 코드와 정확히 일치해 보존되는 것을 캐너리 테스트와 소스 직접 대조로 확인했다. 뮤테이션 검증(4/4 예측 일치, plan 기재)과 본 리뷰의 독립 실행(대상 2파일 81건 + 영향권 확장 1031건, 전부 GREEN)이 서로 부합한다. spec 문서(`14-external-interaction-api.md` §R17, `6-websocket-protocol.md` §4.4)는 코드와 line-level 로 일치하도록 갱신됐고, 이전 라운드 consistency-check(WARNING 6건 — naming disambiguation·JSDoc 표 3그룹 동기화·트래커 4→8키 등)가 이번 커밋에 모두 반영된 것도 diff 로 확인했다. 남은 항목은 plan frontmatter 의 `spec_impact` 누락 1건(INFO, 비차단)뿐이며 기능적·spec 정합성 결함은 발견되지 않았다.

## 위험도
NONE
