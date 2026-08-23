# 부작용(Side Effect) Review

## 리뷰 범위 및 방법

이 diff(`origin/main` 대비 56개 파일)의 실질 프로덕션 코드 변경은 2개 TS 파일
(`codebase/backend/src/modules/websocket/websocket.service.ts`,
`codebase/backend/src/shared/utils/node-output-allowlist.ts`)뿐이다. 나머지는
spec(`.spec.ts`) 테스트, `CHANGELOG.md`/`plan/**`/`spec/**` 문서, 그리고 이전 두
라운드(`22_51_46`, `23_16_40`)의 `review/**` 산출물(과거 리뷰 결과 자체가 이번
커밋 세트에 포함되어 diff 파일 목록에 잡힘 — 애플리케이션 부작용이 아니라 이
리뷰 워크플로가 항상 만드는 정상 산출물)이다. 이 세 카테고리를 확인한 결과 부작용
관점의 리스크는 프로덕션 코드 2개 파일에 집중된다.

## 발견사항

- **[WARNING]** SSE/webhook/chat-channel fanout 의 `nodeOutput`(및 `buttonConfig.nodeOutput`)이 fail-open deny-list 에서 fail-closed 13키 allowlist 로 전환되어, 이미 운영 중인 외부 API 응답 바디가 이 배포 시점부터 소급 축소된다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` 함수 `allowlistFanoutNodeOutput`(182~205행), `private toFanoutEnvelope`(468~476행, 특히 472~474행 배선) / `codebase/backend/src/shared/utils/node-output-allowlist.ts` `NODE_OUTPUT_ALLOWED_KEYS`(66~92행)
  - 상세: `toFanoutEnvelope` 는 `emitExecutionEvent`/`emitNodeEvent` 의 유일한 외부 출구이고, 이 chokepoint 를 지나는 SSE(`SseAdapter`)·webhook(`NotificationFanout`)·chat-channel(`ChatChannelDispatcher`) 세 구독자 전원의 `nodeOutput` 응답 payload 가 이번 배포부터 좁아진다. 이는 함수 자체의 결함이 아니라 **의도된 보안 하드닝**(EIA §R17, `_retryState` 등 엔진 내부 필드 유출 차단)이지만, 호출자가 인지하지 못하는 제3자 webhook 구독자에게 관측 가능한 하위 호환성 변경을 전파한다는 점에서 부작용 성격을 갖는다. 알려진 두 소비처(위젯 `channel-web-chat`, chat-channel 렌더러)는 실측으로 무손실이 확인됐고(신규 캐너리 `websocket.service.spec.ts` `[캐너리] chat-channel 이 top-level 로 읽는 … 는 fanout 에 남는다`), `CHANGELOG.md`(24~43행)·`spec/5-system/14-external-interaction-api.md` §R17·`spec/5-system/6-websocket-protocol.md` §4.4 가 이 변경을 명시적으로 기록했다. 이 항목은 이전 두 라운드(`22_51_46` W1, `23_16_40` W1)에서 이미 식별·CHANGELOG/spec 정정+캐너리로 완화됐고, 이번 라운드(`23_56_18`)는 그 완화 위에 코드 변경 없이 문서 정정만 추가했다 — 신규 결함은 아니지만 side effect 관점에서 최종 확인차 다시 기재한다.
  - 제안: 이미 취해진 조치(CHANGELOG 자기반증형 정정 + spec §R17 flip + REST/WS 양쪽 캐너리)로 충분하며 추가 코드 변경은 불필요. 운영 로그 접근이 생기면 배포 전/후 `nodeOutput` 키 분포 표본 감사를 수행할 것(RESOLUTION.md 가 이미 "이 세션에서 수행 불가"로 명시한 재개 조건).

- **[INFO]** `NODE_OUTPUT_ALLOWED_KEYS` 가 REST `getStatus`(`interaction.service.ts`)와 WS `toFanoutEnvelope` 두 표면의 공유 상수가 되어, 한 표면(chat-channel/SSE)을 위해 넓힌 4키가 다른 표면(REST)의 공개 응답에도 자동 통과한다.
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts` 66~92행(배열), `codebase/backend/src/modules/websocket/websocket.service.ts` 9행(신규 import)
  - 상세: 설계 문서(`node-output-allowlist.ts` 3~16행, `plan/complete/sse-nodeoutput-allowlist.md`)가 "표면별로 목록을 가르지 않는다"를 의식적으로 선택했고, `interaction.service.spec.ts`(719~763행)의 신규 캐너리가 이 확장이 REST 에서도 통과함을 명시적으로 고정해 우연이 아니라 의도임을 테스트가 말한다. 구조적으로는 여전히 "한 표면을 위한 배열 추가가 다른 표면의 노출 표면도 함께 바꾼다"는 결합이 남지만, 재개 조건(3번째 소비처 등장 시 재검토)이 코드 주석에 명시돼 있다.
  - 제안: 조치 불요(이미 캐너리로 의도 고정, 재개 조건 명시).

- **[INFO]** `execution.node.completed`/`.failed` 의 `envelope.output`(같은 `NodeExecution.outputData` 를 다른 키로 싣는 표면)은 이번 allowlist 좁히기 대상에서 **의도적으로 제외**됐고, 그 상태가 신규 캐너리로 고정됐다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` — `it('[잔여] execution.node.* 의 envelope.output 은 아직 allowlist 를 지나지 않는다', …)` (`fe4d58de7` 커밋에서 추가)
  - 상세: 실측 결과 버튼 재개 record 에 같은 allowlist 를 걸면 `{}` 가 되어(13키 중 하나도 안 맞음) 외부 발송이 통째로 빈다는 것을 확인하고, 그 표면은 닫지 않기로 결정했다. `_retryState` 가 이 경로로는 여전히 나가는 **알려진 잔여 갭**이지만, 이는 이번 diff 가 만든 새 결함이 아니라 원래 fail-open 상태를 유지한 것이고, spec(§R17)·CHANGELOG·트래커(`spec-sync-external-interaction-api-gaps.md`) 세 곳 모두 이 잔여를 별도 항목으로 등재해 갭이 "닫힌 것처럼" 보이지 않게 했다.
  - 제안: 조치 불요(범위 밖으로 명시적으로 분리·등재됨).

## 확인했으나 문제 없음 (근거 기록)

- **의도치 않은 상태 변경 없음**: `allowlistFanoutNodeOutput`(`websocket.service.ts` 182~205행)은 입력 `envelope`/`bc`/`top`/`inner` 를 전혀 변이하지 않는다. `allowlistNodeOutputKeys`(`node-output-allowlist.ts` 121~137행)도 `out ??= { ...obj }` 로 얕은 복사본을 만든 뒤 그 **복사본**에서 `delete` 하므로 원본 객체는 그대로다. 바뀐 게 없으면 원본 참조를 그대로 반환하는 copy-on-change 관례를 두 함수 모두 지킨다.
- **전역 변수 없음**: 새로 추가된 것은 모듈 스코프 순수 함수 `allowlistFanoutNodeOutput` 하나뿐이고, mutable 전역/모듈 상태는 도입되지 않았다. `NODE_OUTPUT_ALLOWED_KEYS` 는 여전히 `Object.freeze` 로 런타임 불변이 유지된다(`node-output-allowlist.ts` 92행, 기존 상수의 원소 확장일 뿐 가변성 변화 없음).
- **파일시스템 부작용 없음**: 프로덕션 코드(`websocket.service.ts`, `node-output-allowlist.ts`)는 순수 함수·주석 갱신뿐 파일 I/O 가 없다. `plan/**`·`review/**` 신규 파일은 이 저장소 워크플로가 매 라운드 정상적으로 만드는 산출물이다.
- **시그니처 변경 없음**: `private toFanoutEnvelope(executionId, maskedWireEnvelope)`(468~471행)의 파라미터·반환 타입은 그대로다 — 내부 구현만 `allowlistFanoutNodeOutput` 로 감쌌다. `emitExecutionEvent`/`emitNodeEvent` 등 공개 메서드 시그니처도 변경 없음. `allowlistNodeOutputKeys` 자체(`node-output-allowlist.ts` 121행)도 REST #1205 이후 기존 시그니처 그대로이고, 이번 PR 은 소비처를 하나 더 추가했을 뿐 시그니처를 바꾸지 않았다.
- **내부 WS 채널 비영향**: `emitExecutionEvent`(300~350행)에서 `gateway.broadcastToChannel(channel, eventType, wireEnvelope)` 호출(319행)이 `this.toFanoutEnvelope(executionId, wireEnvelope)` 호출(327행)보다 먼저 끝나고, `allowlistFanoutNodeOutput`/`stripExternalOnlyFields` 는 그 이후 새로 만든 clone 에만 작용한다 — `wireEnvelope` 객체 자체는 마스킹 이후 한 번도 mutate 되지 않는다. 신규 캐너리(`websocket.service.spec.ts`)가 `gateway.broadcastToChannel.mock.calls[0][2]` 로 wire envelope 이 `_retryState`/`someUnknownInternalField` 를 그대로 유지함을 명시적으로 단언한다.
- **순환 import 없음**: `node-output-allowlist.ts` 가 `NodeHandlerOutput` 을 `import type` 으로만 가져오므로(1행) 이 파일이 이 저장소가 과거 겪은 ES-module 순환(#1174, 헤더 주석 16~18행 참조) 클래스의 새 사례를 만들지 않는다. `websocket.service.ts` 가 값(`allowlistNodeOutputKeys`)을 import 하는 방향은 `node-output-allowlist.ts` → `websocket.service.ts` 역방향 의존이 없어 순환이 생기지 않는다.
- **환경 변수 읽기/쓰기 없음**: 이번 diff 어디에도 `process.env` 접근이 없다.
- **네트워크 호출 없음**: 순수 in-memory 동기 변환(객체 필터링)만 수행 — 외부 서비스 호출 도입 없음.
- **이벤트 종류·타이밍·구독 관계 불변**: `emitExecutionEvent`/`emitNodeEvent` 가 발행하는 이벤트 타입·타이밍·`executionEvents$` 구독 관계(SSE/webhook/chat-channel)는 변경되지 않았다. 오직 그 이벤트가 나르는 `nodeOutput`/`buttonConfig.nodeOutput` **payload 의 키 집합**만 좁아진다(위 WARNING).
- **재조립 최소화 검증**: `buttonConfig` 분기의 copy-on-change 도 캐너리(`[캐너리] buttonConfig.nodeOutput 이 이미 깨끗하면 buttonConfig 를 재조립하지 않는다`)가 `fanout.payload`·`fanout.payload.buttonConfig` 양쪽의 참조 동일성을 단언해, top-level 분기만이 아니라 두 분기 모두에서 불필요한 재구성이 없음을 확인한다.
- **소비처 재확인**: `grep -rn "node-output-allowlist"` 로 확인한 결과 프로덕션 코드에서 이 유틸을 import 하는 곳은 `interaction.service.ts`(REST, 기존)와 `websocket.service.ts`(WS, 신규) 두 곳뿐이다 — 신규 소비처가 의도치 않게 더 늘지 않았다.

## 요약

핵심 프로덕션 변경(`node-output-allowlist.ts` 의 allowlist 4키 확장, `websocket.service.ts` 의 `allowlistFanoutNodeOutput` 신설과 `toFanoutEnvelope` 배선)은 순수 함수·copy-on-change·단일 chokepoint 로 구현돼 있어 의도치 않은 상태 변경, 전역 변수 도입, 파일시스템/환경변수/네트워크 부작용, 함수 시그니처·이벤트 구독 관계 변경이 없다. 내부 WS(에디터) 채널이 이 필터링의 영향을 받지 않는다는 안전 조건도 캐너리 테스트로 명시적으로 고정돼 있다. 유일하게 실질적인 부작용은 이미 운영 중인 SSE/webhook/chat-channel 응답 바디를 소급 축소하는 하위 호환성 변경(WARNING)인데, 이는 이전 두 라운드(`22_51_46`, `23_16_40`)에서 이미 식별되어 CHANGELOG 자기반증형 정정·spec §R17 flip·REST/WS 양쪽 캐너리로 완화됐고, 이번 라운드는 그 위에 새 프로덕션 코드 변경 없이 문서 정정(CHANGELOG·plan 트래커 취소선+정정 블록)과 `envelope.output` 잔여 갭을 명시적으로 고정하는 캐너리만 추가했다. 신규로 발견된 미완화 부작용은 없다.

## 위험도
LOW
