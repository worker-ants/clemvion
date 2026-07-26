# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-node-cancellation-chat-channel-correction.md`

## 검토 방법

target 문서(spec draft)가 제안하는 3개 diff(§1-a, §1-b, §1-c) + Warning 성격의 §6 commerce 2행
갱신을, 프롬프트에 포함된 `spec/0-overview.md`·`spec/1-data-model.md` 전문과, 컨텍스트 예산 초과로
생략된 나머지 spec 파일(`spec/conventions/node-cancellation.md`, `spec/4-nodes/1-logic/10-parallel.md`,
`spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`,
`spec/4-nodes/7-trigger/providers/telegram.md`, `spec/4-nodes/7-trigger/0-common.md`,
`spec/4-nodes/4-integration/4-cafe24.md`, `spec/4-nodes/4-integration/5-makeshop.md` 등)를 직접
`Read`/`grep` 하여 대조했다. 실측 대상: 실제 코드(`codebase/backend/src/nodes/`,
`codebase/backend/src/modules/chat-channel/`, MakeShop·Cafe24 client/handler/spec), git 이력
(`origin/main` 커밋 `e83da5052`), 관련 plan 문서(`node-cancellation-residual-signal-propagation.md`),
그리고 직전 impl-done 라운드(`review/consistency/2026/07/26/00_08_39/SUMMARY.md`).

## 발견사항

### 검증 결과 — Critical/Warning 없음

target 의 핵심 주장("chat-channel 은 노드가 아니다")을 아래 5개 독립 소스로 교차 검증했고, **전부
target 의 서술과 정확히 일치**했다. 즉 target 은 기존 spec 과 새 모순을 만드는 것이 아니라, **이미
존재하던 cross-spec 모순(잘못된 두 지점)을 나머지 정본에 맞춰 정정**하는 방향이다.

1. **코드 실측** — `codebase/backend/src/nodes/` 전 카테고리(ai/core/data/flow/integration/logic/
   presentation/trigger)에 `chat` 이름의 노드 파일 0건, `node-types.constants.ts` 미등록 (재확인:
   `grep -rn chat codebase/backend/src/nodes/core/node-types.constants.ts` 0건, `find ... -iname
   "*chat*"` 0건).
2. **`spec/1-data-model.md` §2.8 Trigger** (본 프롬프트에 전문 포함, 779행) — 이미 명시:
   `type | webhook / schedule / manual (chat-channel 은 별도 type 이 아니라 webhook 트리거의
   config.chatChannel 변형 — Spec Chat Channel 참조)`. target 의 주장과 **완전히 합치** — 오히려
   target 이 고치려는 두 지점(`node-cancellation.md` §1/§6, `10-parallel.md`)만 이 SoT 와 어긋나
   있었다.
3. **`spec/5-system/15-chat-channel.md` CCH-AD-05** — `ChatChannelDispatcher` 는 `executionEvents$`
   를 `onModuleInit` 에서 구독하는 outbound adapter 로 정의. 실제 코드
   (`codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`)에서
   `SUBSCRIBED_EVENTS`(`execution.waiting_for_input`/`execution.ai_message`/`execution.completed`/
   `execution.failed`/`execution.cancelled` 등)와 JSDoc(`WebsocketService.executionEvents$ 를
   onModuleInit 에서 subscribe`)을 확인했고, `abortSignal` 참조는 0건이었다. target 의 "outbound
   방향이라 §4 cascade 대상이 아니고, 취소 시 오히려 `execution.cancelled` 를 발송" 서술과 정확히
   일치.
4. **저장소 전수 grep** (`grep -rn "chat-channel.*노드\|노드.*chat-channel" spec/`) — chat-channel
   을 "노드"로 오분류하는 지점은 정확히 target 이 고치려는 두 파일(`node-cancellation.md:24,137`,
   `10-parallel.md:244`) 뿐이었다. 그 외 모든 참조(`4-nodes/7-trigger/0-common.md`,
   `4-nodes/7-trigger/providers/telegram.md`, `data-flow/14-chat-channel.md` 등)는 이미 "webhook
   트리거의 config.chatChannel 변형" 으로 정확히 서술하고 있다. 즉 target 은 **누락 없이 정확히
   drift 지점만** 고친다.
5. **`codebase/backend/src/nodes/core/node-handler.interface.ts`** — line 239-241 JSDoc 이 이미
   `chat-channel` 은 여기 해당하지 않는다 — 노드가 아니라 webhook 트리거의 config.chatChannel
   변형" 으로 정정돼 있다(§6 위임 plan `node-cancellation-residual-signal-propagation.md` 가 이미
   반영). target 의 spec 정정이 이 코드 측 정정과 나란히 정렬된다.

### 변경 2 (Warning) 사실관계 검증 — 정확

- `git log origin/main` 에 `e83da5052 feat(nodes): MakeShop·Cafe24 노드에 execution abortSignal
  전파 (§4 cascade + §5.1 분류) (#1019)` 존재 확인.
- `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts` 에서 §4 cascade 패턴
  (`AbortController`, `opts.signal`, `upstream.aborted` already-aborted 분기, `node-cancellation.md
  §4` 인용 주석) 실측 확인.
- `cafe24.handler.spec.ts:750`, `makeshop.handler.spec.ts:577`, `cafe24-api.client.spec.ts:137`,
  `makeshop-api.client.spec.ts:136` 의 인용 테스트 제목(`rethrows AbortError so the ENGINE can
  classify the node as cancelled` 등)을 실제 파일에서 라인 단위로 대조 — target 의 인용과 **byte
  단위로 일치**.
- 결론: 이미 병합된 구현을 반영하는 표 정정이 맞고, "§2.2 사전 체크" 문구를 빼는 이유(§2.2 는
  CPU-바운드/즉시완료 절이라 HTTP client 무관, 실제 구현은 §4 already-aborted 분기)도 §2.2/§4 본문
  정의와 합치한다.
- 다른 spec 파일(`spec/4-nodes/4-integration/4-cafe24.md`, `5-makeshop.md`,
  `spec/2-navigation/4-integration.md`)에서 MakeShop/Cafe24 의 signal 전파 상태를 별도로 서술하는
  곳은 없었다(`grep -n "node-cancellation\|signal.*전파\|abortSignal"` 0건) — 이 Warning 정정으로
  새로 stale 해지는 2차 참조가 없다.

### 관련 developer plan 과의 정합성 — 확인됨, 모순 없음

`plan/in-progress/node-cancellation-residual-signal-propagation.md` (developer 소유, `status:
in-progress`)가 독립적으로 동일한 결론(chat-channel → won't-do/범주 오류, MakeShop/Cafe24 →
2026-07-25 완료)에 이미 도달해 있다. target 은 이 developer-level 판단을 spec SoT 로 승격하는
것일 뿐이며, 두 문서 간 서술이 어긋나는 지점은 없다.

### 직전 impl-done Critical 과의 정합성 — 확인됨

`review/consistency/2026/07/26/00_08_39/SUMMARY.md` 의 유일한 BLOCK 사유(Critical: chat-channel
"노드" 오분류가 `1-data-model.md`/`15-chat-channel.md` 와 모순)와 부수 WARNING(MakeShop/Cafe24 §6
표 staleness)이 target 의 변경 1·변경 2 와 정확히 1:1 대응한다. 권장 조치 1·2 를 target 이 그대로
집행한다.

### [INFO] §6 표 신규 상태값 `N/A` 가 기존 범례에 미정의

- target 위치: 변경 1-b 의 diff(`spec-draft-...md` 78행) — `| ~~chat-channel 노드 signal 전파~~ |
  N/A | ... |`
- 충돌 대상: `spec/conventions/node-cancellation.md` §6 상단 범례(123행) — `✓ = 구현됨, 🚧 = 부분
  구현(사전 abort 체크만, in-flight 중단은 미구현), — = 미구현(Planned, ...)`. 3개 기호만 정의돼
  있고 `N/A` 는 없다.
- 상세: 새로 도입하는 `N/A` 상태 기호가 기존 범례에 없어, 표를 읽는 사람이 `N/A` 를 "미구현
  (Planned)" 의 `—` 와 다른 뜻(= 철회, cascade 대상 아님)으로 즉시 구분하려면 셀 안의 부연 설명
  텍스트에 의존해야 한다. 기능적 문제는 아니며(부연 설명이 이미 상세하다), 다른 spec 문서의 상태
  표(`spec/0-overview.md` §6 의 ✅/🚧/❌, `spec/5-system/17-agent-memory.md` 의 취소선+✅ 패턴)도
  표마다 범례를 국지적으로 정의하는 관행이라 저장소 전역 규약 위반은 아니다.
- 제안: (선택) §6 범례 줄에 `N/A = 범주 오류로 대상에서 철회` 한 항을 추가하면 향후 같은 패턴(다른
  행이 범주 오류로 철회될 때)의 판독성이 좋아진다. 필수 아님 — target 그대로 반영해도 무방.

### 취소선(strikethrough) 표기 방식 — 저장소 기존 관행과 일치 (충돌 없음, 참고용)

target 의 "삭제 대신 취소선 + 철회 사유 inline" 방식은 `spec/2-navigation/9-user-profile.md`,
`spec/5-system/17-agent-memory.md`, `spec/5-system/13-replay-rerun.md`,
`spec/conventions/conversation-thread.md`, `spec/data-flow/6-knowledge-base.md` 등 다수 spec 문서가
이미 채택한 확립된 패턴과 형식적으로 일치한다. 별도 지적 사항 없음.

## 요약

target 문서는 새로운 cross-spec 충돌을 만들지 않는다. 오히려 `spec/1-data-model.md §2.8`
(Trigger.type 정의)과 `spec/5-system/15-chat-channel.md`(CCH-AD-05, outbound adapter 정의)라는
이미 확립된 SoT 에 맞춰, 그 SoT 와 유일하게 어긋나 있던 두 지점(`spec/conventions/node-cancellation.md`
§1·§6, `spec/4-nodes/1-logic/10-parallel.md` §best-effort 컨트랙트)을 정정하는 초안이다. 데이터
모델·API 계약·요구사항 ID·상태 전이·RBAC 어느 축에서도 새로 도입되는 정의가 없고(신규 식별자 0건,
직전 라운드 `naming_collision` 결과와 합치), 코드·테스트·git 이력 실측 결과 모든 사실 주장(chat 노드
파일 0건, `ChatChannelDispatcher` 의 outbound-only 구독, MakeShop/Cafe24 §4 cascade + §5.1 rethrow
구현 및 병합)이 정확했다. 저장소 전수 grep 으로 "chat-channel 을 노드로 오분류"하는 다른 잔여
지점이 없음을 확인했고, Warning 변경(commerce 2행)이 새로 stale 하게 만드는 2차 참조도 없다. 유일한
지적은 표 범례 완결성에 관한 사소한 INFO 1건으로, 차단 사유가 아니다.

## 위험도

NONE
