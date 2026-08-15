# 유지보수성(Maintainability) 리뷰

## 스코프 요약

이번 diff 는 대부분(파일 1~6, 8~21, 24) `websocket.service.ts` 에서 값/enum 만 `websocket-events.types.ts`
로 옮기고 import 경로만 갈아끼운 기계적 변경이다. 실질 로직·구조 변경은 `execution-event-emitter.service.ts`
(모듈 스코프 `TERMINAL_SHAPE` 상수 도입)와 `websocket.service.ts`/`websocket-events.types.ts`
(re-export facade 신설) 두 곳에 집중되어 있어 리뷰도 이 두 곳에 집중했다. `plan/**`·`review/consistency/**`
는 프로세스 산출물(마크다운)이라 소스 코드 유지보수성 관점 밖으로 판단해 제외했다.

## 발견사항

- **[WARNING]** `ExecutionEventEmitter` 클래스 JSDoc 이 새로 삽입된 `TERMINAL_SHAPE` JSDoc 에 의해 클래스 선언에서 완전히 떨어져 나가(orphan) **툴링에서 영구히 보이지 않게** 됨
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:51-67` (클래스를 설명하는 JSDoc, "실행 엔진이 발행하는 도메인 이벤트의 단일 진입점...")이 바로 다음 줄 `68-84`(새로 추가된 `TERMINAL_SHAPE` JSDoc)와 `85-98`(`const TERMINAL_SHAPE = {...}`)에 가로막혀, 클래스 선언(`100-101`)에는 어떤 JSDoc 도 붙지 않는다.
  - 상세: TypeScript 는 심볼 바로 위에 **연속으로 쌓인 마지막 JSDoc 블록만** hover/IntelliSense 문서로 채택한다(중간에 다른 선언이 끼면 그 이전 블록들은 그 선언 쪽으로도, 원래 목표 쪽으로도 붙지 않고 사라진다). 실제로 TypeScript LanguageService(`getQuickInfoAtPosition`, VSCode hover 가 쓰는 것과 동일 API)로 이 구조를 재현해 확인했다 — 동일 패턴(`DocA`+`DocB`+`const`+blank+`class`)에서 `class` 는 `documentation: []`, `const` 는 `DocB` 만 반환하고 `DocA` 는 어디에도 나타나지 않았다. 이 클래스 JSDoc 은 "왜 이 facade 가 필요한가(C-6 strangle step)", "왜 `emitTerminalExecution` 만 thin wrapper 가 아닌가" 같은 이 파일의 핵심 설계 근거를 담고 있어, 향후 이 클래스를 hover 로 살펴볼 개발자에게는 사실상 사라진 문서가 된다.
  - 아이러니: 바로 이웃 파일 `websocket.service.ts:126-127` 이 "블록 JSDoc 으로 두었더니 붙을 선언이 없어 **바로 아래 KB union 문서로 읽혔다** — `14_55_29` maintainability W4" 라며 정확히 같은 결함 클래스를 이미 겪고 line-comment(`//`)로 우회해 놓았는데, 같은 PR 이 새 파일에서 그 패턴을 재도입했다.
  - 제안: `TERMINAL_SHAPE` 와 그 JSDoc 을 클래스 선언 **아래**(또는 클래스 내부 private static)로 옮기거나, 클래스 JSDoc 과 `TERMINAL_SHAPE` JSDoc 사이 어느 한쪽을 `//` 라인 코멘트로 바꿔 인접 오염을 끊는다.

- **[WARNING]** `NotificationEventType` 의 원래 설명(채널·권위 출처)이 새로 추가된 disambiguation JSDoc 에 가려 툴링에서 사라짐
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:209-212`("사용자 알림 도메인 이벤트. 채널: `notifications:<userId>`. 권위 정의: spec/5-system/6-websocket-protocol.md §4.4")가 바로 아래 `213-219`(새로 추가된 "⚠️ 인앱 알림 벨 전용" disambiguation JSDoc)에 인접해, `220` 의 `export enum NotificationEventType` 에는 `213-219` 블록만 문서로 채택된다.
  - 상세: 위와 동일한 메커니즘을 이 구체적 심볼로 재현·확인함 — `getQuickInfoAtPosition` 이 `NotificationEventType` 에 대해 반환한 `documentation` 은 disambiguation 텍스트 하나뿐이고, 채널명·SoT 문서 링크를 담은 원본 설명은 결과에 없음. 이 PR 자체가 (consistency review WARNING #3 대응으로) disambiguation JSDoc 을 추가하면서 기존 JSDoc 을 밀어냈다.
  - 제안: 두 블록을 하나의 JSDoc 으로 합친다(원 설명 + disambiguation 경고를 한 블록 안에 문단으로 이어 쓰기). 별도 블록을 유지해야 한다면 앞 블록을 `//` 라인 코멘트로 바꾼다.

- **[INFO]** 이식 과정에서 남은 것으로 보이는, 이 파일 어떤 선언과도 무관한 고아 JSDoc(`WARN #10 Security`)
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:239-246` — credential-key 마스킹(`sanitizeInner`/`CREDENTIAL_KEY_PATTERN`)을 설명하는데, 그 구현은 의도적으로 이 파일에 옮기지 않고 `websocket.service.ts` 에 남겼다(같은 diff 의 `websocket.service.ts:48-50` 주석 "아래는 구현 세부다 — 타입 모듈이 아니라 이 파일에 남는다" 참고, 실제 문서화는 `websocket.service.ts:66-76` 에 이미 존재). 그 결과 이 블록은 바로 아래 `248-263`(`KbEventType` 문서)에 가려 완전히 죽은 텍스트가 됨 — 삭제해도 정보 손실이 없다(같은 내용이 `websocket.service.ts` 에 이미 온전히 있음).
  - 제안: `websocket-events.types.ts:239-247` 블록 삭제.

- **[INFO]** 같은 리팩터 내에서 타입 전용 import 문법이 두 가지로 혼용됨
  - 위치: `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts` 및 `codebase/backend/src/modules/knowledge-base/graph/graph-extraction.service.ts` — `import { type KbEventType } from '../../websocket/websocket-events.types';` (inline `type` modifier). 반면 같은 diff 의 대다수 파일(`chat-channel.dispatcher.spec.ts`, `interaction-stream.controller.spec.ts`, `interaction-stream.controller.ts`, `notification-fanout.service.spec.ts`, `sse-adapter.service.spec.ts`, `sse-adapter.service.ts` 등)은 `import type { X } from '...'` (문장 단위 type-only import) 를 쓴다.
  - 상세: `codebase/backend/eslint.config.mjs` 에 `@typescript-eslint/consistent-type-imports` 류 규칙이 없어 lint 로는 걸러지지 않는다. 기능 차이는 없으나 같은 PR 한 번의 기계적 치환 안에서 스타일이 갈리면 이후 diff 검토·grep 기반 감사(`import type` 패턴 검색 등)의 일관성이 떨어진다.
  - 제안: 저장소 다수 스타일인 `import type { X } from '...'` 로 통일. 필요하면 `@typescript-eslint/consistent-type-imports` 규칙 추가를 별도 항목으로 고려.

- **[INFO]** re-export facade 가 식별자 12개를 4곳(값 import·타입 import·값 export·타입 export)에 수동 나열
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:14-46`
  - 상세: 기존 import 경로(`websocket.service`)를 그대로 유지하기 위한 의도적 설계(plan 문서에 근거 명시)이며, 항목 누락 시 `tsc` 가 즉시 컴파일 에러로 잡아주므로(fail-closed) 실질 리스크는 낮다. 다만 향후 `websocket-events.types.ts` 에 새 export 를 추가할 때마다 이 4곳을 함께 갱신해야 하는 수동 동기화 지점이라는 점은 기록해 둔다.
  - 제안: 즉각 조치 불요. 다음에 이 파일을 만지는 사람을 위해 `// 여기 추가 시 위 4블록 모두 갱신` 같은 한 줄 주석을 고려할 수 있다.

## 요약

핵심 로직 변경(순환 참조 회피를 위한 값/타입 모듈 분리, `TERMINAL_SHAPE` 모듈 스코프 상수)은 설계 의도가 JSDoc·plan 문서에 충분히 근거와 함께 기록되어 있고, 나머지 20여개 파일의 import 경로 교체는 전부 기계적이고 위험이 낮다. 다만 이번 diff 가 **직접 새로 도입한** JSDoc 삽입 두 곳(`ExecutionEventEmitter` 클래스 doc, `NotificationEventType` doc)이 이 저장소가 이미 한 번 겪고 명시적으로 회피 패턴을 남긴 "스택된 블록 JSDoc → 앞 블록 orphan" 결함을 그대로 재현했다 — TypeScript LanguageService 로 직접 재현해 두 경우 모두 원래 문서가 hover/IntelliSense 에서 완전히 사라짐을 확인했다. 기능적 리스크는 없으나(런타임/컴파일 영향 없음) 설계 근거 문서가 조용히 무효화되는 것이므로 다음 커밋에서 바로잡을 것을 권한다. 그 외에는 import 스타일 혼용, 죽은 고아 코멘트, re-export 수동 동기화 등 경미한 INFO 수준 지적뿐이다.

## 위험도

LOW
