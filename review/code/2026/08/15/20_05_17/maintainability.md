# 유지보수성(Maintainability) 리뷰

## 스코프 요약

이번 diff 는 이전 리뷰 라운드(`19_27_37`)의 Warning 5건을 반영한 수정 커밋(`65da1a9d7`) +
그 RESOLUTION/plan 문서(`plan/in-progress/ws-event-types-extract.md`,
`review/code/2026/08/15/19_27_37/**`)를 포함한다. 실 소스 변경은 여전히 대부분
`websocket.service.ts` → `websocket-events.types.ts` 값/타입 추출 + 22개 소비 지점의
import 경로 교체다. `review/**`·`plan/**` 는 프로세스 산출물(마크다운)이라 이전 라운드와
동일하게 소스 코드 유지보수성 관점 밖으로 판단해 제외했다.

## 이전 라운드(`19_27_37`) Warning 반영 상태 — 직접 재확인

RESOLUTION.md 의 "반영" 주장을 코드로 직접 대조했다. 5건 모두 실제로 고쳐져 있다.

- **W1** (`websocket.gateway.ts:23`) — `ExecutionEventType` import 가 `./websocket-events.types` 로 전환됨. 확인.
- **W2** (`execution-event-emitter.service.ts`) — `TERMINAL_SHAPE` JSDoc+선언(현재 51-84행)이 클래스 JSDoc(86-101행) **앞**으로 이동해, 클래스 JSDoc 이 다시 `@Injectable() export class`(103-104행)에 직접 인접. 고아 상태 해소 확인.
- **W3** (`websocket-events.types.ts:209-221`) — `NotificationEventType` 위 두 JSDoc 블록이 한 블록으로 병합됨. 확인.
- **W4** (`websocket.service.ts:48-61`) — WARN #10 credential 마스킹 JSDoc 이 실제 구현(`CREDENTIAL_KEY_PATTERN`, 59행)) 바로 위로 이동. 고아 해소 확인.
- **W5** — `websocket-events.types.spec.ts` 신설(169줄). `^import` 만이 아니라 TS 파서로 `export … from`/`import =`/동적 `import()`/`require()` 를 전부 순회하는 설계이고, "공허 방지"(선언 존재·allowlist 파일 실재) 단언까지 갖춰 회귀 가드로서 견고하다.

## 발견사항

- **[WARNING]** `ExecutionChannelEvent` 단독 import 3곳이 순수 타입인데도 `import type` 을 안 씀 — **이번 split 자체가 만든 새 불일치**이고, 같은 인터페이스를 옮긴 자매 파일들과 갈린다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:11`, `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts:11`, `codebase/backend/src/modules/external-interaction/sse-adapter.service.ts:8` — 전부 `import { ExecutionChannelEvent } from '../websocket/websocket-events.types';` 형태.
  - 상세: `origin/main` 기준 이 세 파일은 원래 `import { ExecutionChannelEvent, WebsocketService } from '../websocket/websocket.service';` 처럼 **값(`WebsocketService`)과 타입을 한 statement 에 섞어** import 했으므로 `type` 키워드가 없어도 정상이었다(statement 전체가 순수 타입 전용이 아니었으므로). 이번 PR 이 `WebsocketService`(값)와 `ExecutionChannelEvent`(순수 `interface`, 런타임 표현 없음)를 **서로 다른 import statement 로 분리**하면서, `ExecutionChannelEvent` 만 남은 statement 는 이제 100% 타입 전용이 됐는데 `type` 키워드를 붙이지 않았다. 정확히 같은 분리를 겪은 자매 파일들 — `chat-channel.dispatcher.spec.ts:7`, `notification-fanout.service.spec.ts:2`, `sse-adapter.service.spec.ts:6`(대응 `type WebsocketService` 도 6행에서 분리), 그리고 production 파일인 `interaction-stream.controller.ts:25`·`interaction-stream.controller.spec.ts:3` — 는 전부 `import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';` 로 정확히 처리됐다. 즉 같은 기계적 치환을 8곳에 적용해 5곳은 맞고 3곳(전부 production 코드, spec 아님)만 놓쳤다.
  - 기능적으로 당장 깨지지는 않는다(`tsc` 가 파일 내 사용처를 보고 여전히 값-미사용 import 를 erase 하며, `isolatedModules: true` 이지만 `verbatimModuleSyntax`/`importsNotUsedAsValues` 는 꺼져 있어 컴파일 에러가 나지 않음을 `tsconfig.json` 으로 확인). 다만 이번 PR 의 핵심 주제 자체가 "값 import 와 타입 import 를 명확히 갈라야 순환·평가 문제를 피한다"이고, 그 안전장치 판별식(`websocket-events.types.spec.ts:144-145` — `import type` 은 방출 시 사라지므로 순환 간선을 안 만든다)이 바로 이 `type` 키워드 유무에 의존한다. 이 세 곳은 지금은 `websocket-events.types` 를 직접 가리켜 무해하지만, 값-스타일 import 형태로 남아 있으면 향후 실수로 값도 필요해질 때(예: 다른 export 를 같은 statement 에 추가) `type` 분리 필요성이 코드만 봐서는 드러나지 않는다 — 딱 이번 리팩터가 고치려던 "타입/값 구분이 흐려진다" 부류의 사소한 재발이다.
  - 제안: 세 곳을 `import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';` 로 통일. 기계적 1줄 수정이며 이미 자매 spec 파일들이 정답 형태를 보여주고 있어 리스크 없음.

- **[INFO]** re-export facade(`websocket.service.ts:14-46`)의 12개 식별자 4-블록 수동 나열은 이전 라운드에서 이미 식별·의도적 무조치(INFO #5, `tsc` fail-closed 근거)로 처리된 항목이라 이번 라운드에서 재지적하지 않는다 — 상태 불변 확인만 했다.

## 요약

이전 라운드가 지적한 5건(JSDoc 고아 2곳, 순환 노드 누락 1곳, 회귀 테스트 부재 1곳, disambiguation JSDoc 병합 1곳)은 코드를 직접 열어 대조한 결과 전부 정확히 반영되어 있고, 신설된 `websocket-events.types.spec.ts` 는 정규식이 아니라 TS 파서로 5가지 모듈 간선 형태를 전수 검사하는 견고한 설계다. 다만 이번 라운드 자체 diff 를 다시 훑어 새로 확인한 결과, `WebsocketService`(값)와 `ExecutionChannelEvent`(순수 타입)를 분리하는 기계적 치환 과정에서 production 파일 3곳(`chat-channel.dispatcher.ts`, `notification-fanout.service.ts`, `sse-adapter.service.ts`)이 `import type` 을 놓쳤다 — 같은 치환을 받은 spec 파일들과 `interaction-stream.controller.ts` 는 올바르게 처리됐다. 기능·컴파일에는 영향 없는 스타일 불일치이지만, 이 PR 이 스스로 세운 "값/타입 import 를 명확히 가른다"는 원칙과 그걸 검증하는 신규 가드의 판별 기준(`import type` 여부)에 정확히 부합하는 지점이라 이번 턴에 함께 정리하는 편이 싸다.

## 위험도

LOW
