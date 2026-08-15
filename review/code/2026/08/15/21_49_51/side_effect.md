# 부작용(Side Effect) 리뷰

## 검토 방법

프롬프트에 실린 diff(38개 파일, 이후 라운드 산출물 포함 시 총 62+개)는 `ws-event-types-extract`
브랜치 전체(`origin/main..HEAD` 7개 커밋 — 직전 4라운드 `/ai-review` + `/consistency-check`
산출물 포함)를 담고 있다. 실 코드 변경은 `codebase/backend/**` 27개 파일뿐이고, 나머지는
`plan/**`·`review/**`·spec frontmatter 문서다. 이번 리뷰는 프롬프트의 diff 게이트가 아니라
현재 소스(`git diff origin/main...HEAD -- codebase/`, `Read`)를 직접 열어 최종 상태를 대조했다.

## 발견사항

- **[INFO]** 유일한 실행-순서 의존 변경 — `TERMINAL_SHAPE` 를 호출-시점 파생에서 모듈-스코프 상수로 되돌림
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` (`TERMINAL_SHAPE` 상수 선언, `emitTerminalExecution` 메서드 — 소스 51~84행 선언부, 143행 사용부)
  - 상세: 이번 diff 26개 코드 파일 중 이 파일 하나만 순수 import 경로 교체가 아니라 실제 평가 시점(eager module-scope vs lazy call-time) 을 바꾼다. 안전성은 `ExecutionEventType` 의 새 출처(`websocket-events.types.ts`)가 `import` 0줄인 의존성-프리 모듈이라는 사실에 전적으로 의존하며, 그 불변식은 새로 추가된 `websocket-events.types.spec.ts` 정적 가드(TS 파서 기반, `import`/`export…from`/`import=require`/top-level `require`/동적 `import()` 5가지 형태 전수 검사)로 회귀 시 즉시 실패하도록 고정돼 있다. `TERMINAL_SHAPE` 는 export 되지 않는 module-private 상수라 외부 뮤테이션 표면이 없다. 이번 세션에서 직접 `git diff`로 재확인한 결과 코드 형태(리터럴 인라인 → 상수 참조)만 바뀌었고 반환 shape·값은 동일하다.
  - 제안: 조치 불필요 — 설계·근거·회귀 가드가 코드에 함께 커밋돼 있고, 이전 4라운드 리뷰가 동일 결론(LOW/NONE)에 수렴했다.

- **[INFO]** 공개 export 표면(re-export facade) 보존 — 인터페이스 변경 없음, 직접 대조 완료
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` (신규 `import { … } from './websocket-events.types'` + `export { … } / export type { … }` 블록)
  - 상세: `git diff origin/main...HEAD -- codebase/backend/src/modules/websocket/websocket.service.ts` 를 직접 열어, 삭제된 12개(값 4 + 타입 8) 원본 선언과 신규 re-export 목록을 1:1 대조 — 완전 일치(`ExecutionEventType`/`NodeEventType`/`BackgroundRunEventType`/`NotificationEventType` 값 4종 + `ExecutionChannelEvent`/`ChatChannelRoutingInfo`/`ExecutionRoutingContext`/`ToolCallStartedPayload`/`UserMessagePayload`/`ToolCallCompletedPayload`/`NotificationNewPayload`/`KbEventType` 타입 8종). `MAX_SANITIZE_DEPTH` 상수·`WebsocketService` 클래스·`sanitizePayloadForWs`/`CREDENTIAL_KEY_PATTERN` 등 구현부는 이동 대상이 아니라 원 파일에 그대로 남아 있다. 기존에 `from '.../websocket.service'` 로 값·타입을 가져오던 호출부는 이번 diff 밖에서도 무변경으로 계속 동작한다.
  - 제안: 없음 — 확인용 기록.

- **[INFO]** 새 신규 전역/공유 상태·환경변수·네트워크·파일시스템 쓰기 — 전무 (실측)
  - 위치: `codebase/backend/**` 전체 diff
  - 상세: `git diff origin/main...HEAD -- codebase/` 에서 추가된 라인 전체를 `writeFile`/`process.env`/`fetch`/`axios`/`exec`/`spawn`/`Math.random`/`Date.now`/`new Date(` 패턴으로 스캔 — 매치 0건. 신규 파일 `websocket-events.types.spec.ts` 가 `fs.readFileSync`/`fs.readdirSync`/`fs.existsSync` 를 쓰지만 인자는 전부 `__dirname` 기반 상수 경로이고 read-only(테스트 시점에 `src/modules/websocket` 이하 소스 트리를 파싱해 정적 가드를 계산)라 파일시스템 쓰기·삭제나 사용자 입력 개입이 없다.
  - 제안: 없음 — 확인용 기록.

- **[NONE]** 함수/메서드 시그니처, emit 호출부·이벤트 채널명, DI 그래프(`forwardRef`) — 전부 무변경
  - 상세: 24개 backend production/spec 파일(TERMINAL_SHAPE 를 제외한 나머지 전부)은 import 문 재배치 외의 로직 변경이 없음을 `git diff` 로 확인했다. `emitExecutionEvent`/`emitNodeEvent`/`emitTerminalExecution` 등 emit 호출부·인자 순서·채널 명명(`execution:<id>`, `background:run:<id>`, `notifications:<userId>`, `kb:<documentId>`)은 이번 diff 에서 하나도 건드리지 않았다. `websocket.gateway.ts`↔`websocket.service.ts` 간 `forwardRef` 기반 DI 순환도 그대로 유지된다(`websocket-events.types.ts` 는 그 순환에 참여하지 않는 별도 층으로 신설된 것이지, 기존 순환 자체를 제거한 것이 아님).

- **[NONE]** `plan/`·`review/`·spec frontmatter 변경들
  - 상세: 라인 인용을 심볼 기준으로 갱신한 in-progress plan 4건, 신규 plan 문서, 이전 4라운드 `/ai-review`+`/consistency-check` 산출물, `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 목록 1줄 추가는 전부 이 turn/이전 turn의 정상 문서 워크플로 산출물이며 런타임 부작용과 무관하다.

## 요약

이번 변경은 `websocket.service.ts` 가 짊어졌던 ES-module 순환(#1174 회귀 원인) 위의 값/타입 선언을 `import` 0줄짜리 의존성-프리 모듈(`websocket-events.types.ts`)로 분리하고, 25곳 이상의 소비 지점 import 경로를 재배선한 거의 전량 기계적 리팩터다. 공개 export 표면은 re-export facade 로 완전히 보존되어 기존 호출자에 영향이 없음을 원본/신규 export 집합 직접 대조로 확인했다. 유일하게 실행 순서에 의존하는 변경(`TERMINAL_SHAPE` 모듈-스코프 상수화)은 새 모듈이 순환 밖에 있다는 사실에 근거해 설계되었고, 같은 커밋에 도입된 TS-파서 기반 정적 가드(`websocket-events.types.spec.ts`)가 그 불변식을 회귀 시 즉시 실패하도록 고정한다(이미 4라운드 리뷰를 거치며 별칭 오판정·`export…from` 누락 등 가드 자체의 결함이 전부 교정됨을 코드로 확인). 전역 상태 오염, 시그니처/이벤트 채널 변경, 파일시스템 쓰기, 네트워크 호출, 환경변수 읽기/쓰기는 diff 전체를 패턴 스캔한 결과 전무하다.

## 위험도

NONE
