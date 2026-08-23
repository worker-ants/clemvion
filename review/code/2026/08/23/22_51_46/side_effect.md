# 부작용(Side Effect) Review

## 발견사항

- **[WARNING]** 공유 allowlist 확장이 SSE 를 위한 변경인데 REST `getStatus` 의 공개 응답 표면도 함께 넓어진다 — 이번 PR 이 그 공유를 처음 만든다
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:85-88`(`NODE_OUTPUT_ALLOWED_KEYS` 에 `payload`·`title`·`rendered`·`nodeType` 4키 추가) + `codebase/backend/src/modules/websocket/websocket.service.ts:9,182-205`(`allowlistFanoutNodeOutput` 신설·배선). 영향받는 기존 소비처는 `codebase/backend/src/modules/external-interaction/interaction.service.ts:392`(`allowlistNodeOutputKeys(stripAndRedact(nodeExec.outputData) ?? {})`) — 이 diff 에는 포함되지 않았지만 저장소에서 직접 확인.
  - 상세: `NODE_OUTPUT_ALLOWED_KEYS` 는 이번 PR 전에는 REST `getStatus`(`interaction.service.ts`) 단일 소비처였다(`websocket.service.ts` 의 `import { allowlistNodeOutputKeys } ...` 는 이번 diff 의 신규 추가분). 이번 PR 이 그 상수를 WS `toFanoutEnvelope` 에도 공유시키면서, chat-channel(Discord/Telegram/Slack) 렌더러가 필요로 하는 `payload`·`title`·`rendered`·`nodeType` 4키를 **같은 배열**에 추가했다 — plan/spec 모두 "표면별로 목록을 가르지 않는다"를 명시적으로 선택했다(`plan/in-progress/sse-nodeoutput-allowlist.md` "설계" 절, `spec/5-system/14-external-interaction-api.md` §R17). 그 결과 REST `getStatus` 의 `nodeOutput` 응답도 이 4키를 **그대로 통과**시키게 된다(`interaction.service.ts:431-435` 의 `{ ...base, nodeOutput: out }` 가 allowlist 통과분을 그대로 REST body 에 싣는다). 이번 라운드에서 위젯(`channel-web-chat`) 소비 경로만 안전이 실측됐고("위젯은 `output.rendered`·`config.items` 처럼 한 겹 아래로 읽는다") REST 의 다른/미래 소비처나 다른 노드 타입(AI/HTTP 등)이 우연히 top-level `payload`/`title` 이라는 흔한 이름의 필드를 낼 경우까지는 검증되지 않았다. `payload`·`title` 은 특히 범용적인 이름이라, chat-channel 전용으로 열어 둔 게이트가 무관한 핸들러의 동명 필드까지 REST/SSE 양쪽으로 fail-open 시킬 위험을 넓힌다 — 이 PR 이 추가한 canary(`websocket.service.spec.ts`)는 전부 WS/fanout 경로만 검증하고, REST 쪽에 해당 4키 통과를 확인하는 canary 는 이 diff 에 없다.
  - 제안: (a) REST `getStatus` 응답에서 이 4키가 실제로 통과하는지(또는 REST 소비처엔 애초에 등장하지 않아 무해한지) 확인하는 canary 를 `interaction.service.spec.ts` 에 추가, (b) 두 소비처가 서로 다른 위험 허용치를 가진다면 (표면별 분리를 피하려는 설계 의도와는 별개로) REST 전용 예외 처리 여지를 spec/plan 에 한 줄 남길 것. 이미 설계상 의도된 트레이드오프이므로 CRITICAL 은 아니나, "이 변경의 의도는 SSE인데 실제로는 REST 공개 인터페이스도 넓어졌다"는 사실이 REST 측 테스트로 확인되지 않은 점은 부작용 관점에서 기록할 가치가 있다.

## 확인했으나 문제 없음 (근거 기록)

- **단일 chokepoint 주장 실측**: `codebase/backend/src/modules/websocket/websocket.service.ts` 전체를 grep 한 결과 `nodeOutput` 을 실을 수 있는 emit 경로(`emitExecutionEvent`, `emitNodeEvent`)는 둘 다 `toFanoutEnvelope`(신설 `allowlistFanoutNodeOutput` 이 걸리는 지점)를 거친다. `broadcastToChannel` 을 직접 호출하는 다른 두 곳(`emitBackgroundRunEvent`, `emitNotificationEvent`)은 `nodeOutput`/`buttonConfig` 를 나르지 않는 별개 이벤트라 이 allowlist 가 필요 없다. plan 의 "호출부 넷이 실은 chokepoint 하나" 주장은 실측과 일치.
- **불변성/copy-on-change**: `allowlistFanoutNodeOutput`(`websocket.service.ts:182-205`)는 원본 `envelope`/`bc` 를 변이하지 않고 스프레드로만 새 객체를 만든다. 변경이 없으면 `next`(=입력 참조)를 그대로 반환 — 의도치 않은 상태 변경(관점 1)·전역 변수 도입(관점 2) 없음.
- **함수 시그니처**: `toFanoutEnvelope(executionId, maskedWireEnvelope)` 의 파라미터·반환 타입은 변경 없음(내부 구현만 `allowlistFanoutNodeOutput` 로 감쌈) — 관점 4 위반 없음.
- **내부 WS 불변**: `broadcastToChannel` 에 넘기는 `wireEnvelope` 은 `toFanoutEnvelope` 호출 이전에 이미 발송되고, `allowlistFanoutNodeOutput` 은 그 뒤 새 clone 에만 작용 — 신규 canary(`websocket.service.spec.ts` `[캐너리] fanout 의 nodeOutput...`, `[캐너리] fanout 의 buttonConfig.nodeOutput...`)가 이를 명시적으로 검증.
- **환경 변수/네트워크 호출**: 이번 diff 전 파일에 걸쳐 `process.env` 읽기/쓰기, 외부 HTTP 호출 등 신규 도입 없음.
- **파일시스템**: `node-output-allowlist.ts`/`websocket.service.ts` 변경은 순수 함수·주석 갱신뿐, 신규 파일 I/O 없음. plan/`review/consistency/**` 신규 파일들은 리뷰·plan 산출물로 이 워크플로가 항상 만드는 정상 산출물이며 애플리케이션 코드 부작용이 아님.
- **`Object.freeze` 유지**: `NODE_OUTPUT_ALLOWED_KEYS` 는 여전히 `Object.freeze` 로 런타임 불변 — 새 4키 추가가 이 보장을 깨지 않음(`node-output-allowlist.spec.ts` "목록이 런타임에도 불변이다" 캐너리가 계속 통과).

## 요약

핵심 프로덕션 변경(`websocket.service.ts` 의 `allowlistFanoutNodeOutput` 신설·배선, `node-output-allowlist.ts` 의 4키 추가)은 순수 함수·copy-on-change·단일 chokepoint 배선으로 깔끔하게 구현됐고, 시그니처·전역 상태·파일시스템·환경변수·네트워크 관점에서는 부작용이 없다. 다만 `NODE_OUTPUT_ALLOWED_KEYS` 가 이번 PR 에서 처음으로 REST(`interaction.service.ts`)와 WS(`websocket.service.ts`) 두 소비처 사이에 공유되면서, chat-channel 전용으로 의도된 4키(`payload`·`title`·`rendered`·`nodeType` — 특히 앞의 둘은 범용적인 이름)가 REST `getStatus` 공개 응답에도 그대로 열린다. 이는 spec/plan 이 의식적으로 선택한 설계(표면별 목록 분리를 피함)이지만, 그 폭 확장이 REST 측 canary 로는 확인되지 않아 "SSE 를 고치려다 REST 인터페이스도 조용히 넓어졌다"는 부작용 성격의 잔여 리스크로 남는다.

## 위험도
LOW
