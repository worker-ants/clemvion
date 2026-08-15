# 테스트(Testing) 리뷰 — ws-event-types-extract (websocket.service 값/타입 분리)

## 개요

이번 변경은 `websocket.service.ts` 가 함께 export 하던 enum/interface 15종을 의존성-프리
모듈 `websocket-events.types.ts` 로 추출하고, 순환(ES-module cycle) 위에 있던 12곳 호출부의
import 경로를 갈아끼운 **순수 리팩터**다 (`plan/in-progress/ws-event-types-extract.md`,
`spec_impact: none`). 대부분의 파일(1~24번 중 20여 개)은 import 문 1~2줄만 바뀌었고 런타임
동작은 그대로다. 유일하게 동작이 실질적으로 바뀌는 지점은
`execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` — 종전 "호출 시점 지연 평가" 우회를
"모듈 스코프 상수"로 되돌린 부분이다(§1174 재현/역재현 검증 대상). 테스트 관점에서는 이
지점과, "ES-module 순환에 다시 참여하지 않는다"는 문서화된 불변식의 자동 검증 여부를 중심으로
검토했다.

## 발견사항

- **[WARNING] "의존성-프리 모듈이 순환에 다시 편입되지 않는다"는 불변식에 전용 회귀 테스트가 없다 — 보호막이 전부 우연적(incidental)이다**
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:1-21` (헤더 주석 — "import 가 0줄이라 순환에 참여하지 않는다"), `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:68-84`("**우회를 되돌린 이유는 그게 캐너리이기 때문이다**")
  - 상세: 이 리팩터가 고치는 버그(#1174)는 "모듈 평가 시점에 enum 이 아직 `undefined`" 라는 매우 구체적인 실패 모드였고, 재발 시 **72 suites** 가 한꺼번에 `Cannot read properties of undefined` 로 터졌다(plan 실측). 이 위험을 막는 장치로 소스에는 정성적 서술(주석)만 있고, 저장소를 확인한 결과:
    - `websocket-events.types.ts` 자체를 겨냥한 `.spec.ts`/`.test.ts` 가 없다(`websocket` 디렉터리 spec 목록에 부재 — `websocket.service.spec.ts`/`websocket.gateway.spec.ts`/`execution-seq-allocator.service.spec.ts`/`notifications-channel-authorizer.spec.ts`/`ws-rate-limit*.spec.ts` 뿐).
    - `eslint.config.mjs` 에 `no-restricted-imports`/`import/no-cycle` 류 규칙이 없고, `package.json` 에 `dependency-cruiser`/`madge` 등 순환 탐지 도구도 설치돼 있지 않다(grep 0건).
    - `#1174` 문자열로 어떤 `.spec.ts` 도 이 시나리오를 명시적으로 재현하지 않는다(grep 0건) — plan 이 언급한 "역재현(12곳만 옮긴 뒤 66 suites 실패 → 9곳 가른 뒤 425/425 통과)" 검증은 **구현 중 1회성 수작업**으로 보이고, 그 실증을 고정하는 자동화된 테스트 아티팩트가 코드베이스에 남아있지 않다.
    - 실질적 보호는 `execution-event-emitter.service.spec.ts` 의 `emitTerminalExecution` 관련 4개 `it` (아래 항목 참고)이 `TERMINAL_SHAPE[payload.type]` 를 매 테스트마다 평가하면서 **우연히** 이 불변식을 검증하는 형태다. 이 파일이 실제로 순환 밖에 있는지, 순환이 되살아났을 때 정확히 이 파일의 이 상수가 즉시 죽는지는 코드 구조를 아는 사람의 추론에 의존하며, `import`/`require` 그래프 자체를 단언하는 코드는 없다.
  - 제안: 아래 둘 중 하나(비용이 낮은 순).
    1. `execution-event-emitter.service.spec.ts` 최상단에 "이 describe 블록이 #1174 캐너리 역할을 한다" 는 주석을 남겨, 향후 대량 실패 시 원인 진단을 빠르게 한다(현재는 소스 파일에만 그 서술이 있고 스펙 파일엔 없어, 실패가 나면 어느 테스트가 신호인지 바로 안 보인다).
    2. 더 견고하게는 `websocket-events.types.ts` 를 겨냥한 최소 스모크 테스트를 추가한다 — 예: `jest.isolateModules`로 이 모듈만 단독 require 해 모든 export 값이 `undefined` 가 아님을 단언하거나, 소스 텍스트를 정적으로 읽어 `^import ` 로 시작하는 줄이 0개임을 단언(정규식 fallback, 이 저장소 메모의 "정적 가드는 blind 정규식 vs 정밀 파서" 관례상 이런 단순 shape 판별은 정규식으로 충분)한다. 이렇게 하면 "72 suites 가 왜 다 죽었는지" 추론할 필요 없이 **단일 이름 있는 테스트**가 정확히 이 불변식을 가리킨다.

- **[INFO] 새로 생성된 `websocket-events.types.ts` 자체에 대한 전용 스펙 파일이 없다**
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts` (파일 전체 — 신규 파일, 대응 `.spec.ts` 부재)
  - 상세: enum 값(`ExecutionEventType`, `NodeEventType`, `BackgroundRunEventType`, `NotificationEventType`, `KbEventType`)과 인터페이스 필드 자체는 순수 이동(move)이라 기존에 `websocket.service.spec.ts` 가 re-export 경로(`./websocket.service`)를 통해 이미 간접 검증하고 있다 — 이 부분은 회귀 위험이 낮다. 다만 새 파일이 "의존성 0" 이라는 계약을 스스로 갖는 독립 모듈이 됐는데도 그 계약을 확인하는 자기 자신의 테스트가 없다는 점은 위 WARNING 과 같은 축의 갭이다.
  - 제안: 위 WARNING 제안 2번과 통합해 처리 가능. 별도 조치 불필요.

- **[INFO] 회귀 테스트 관점에서는 이번 diff 가 대체로 안전하게 마무리됐다 — 확인한 영역**
  - 위치: 검증 방법 — `codebase/backend/src/modules/execution-engine/button-interaction.service.spec.ts`, `.../form-interaction.service.spec.ts`, `.../queues/background-execution.processor.spec.ts`, `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.spec.ts`, `.../graph/graph-extraction.service.spec.ts` 를 직접 grep
  - 상세: 프롬프트에 diff 가 실린 프로덕션 파일 중 대응 스펙 diff 가 안 보인 5개(`button-interaction.service.ts`/`form-interaction.service.ts`/`background-execution.processor.ts`/`embedding.service.ts`/`graph-extraction.service.ts`)를 개별 확인한 결과, 대응 스펙들이 (a) websocket 모듈을 아예 참조 안 하거나(button/form-interaction, background-execution.processor — mock 객체로만 대체) (b) `WebsocketService` 만 참조하고 그 클래스의 import 경로는 이번 diff 로 안 바뀌었으므로(embedding/graph-extraction) **stale import 로 인한 컴파일 깨짐 위험이 없다**. plan 이 보고한 "lint/unit(425)/build/e2e(276) 전부 PASS" 와 정합.
  - 제안: 없음 (확인 목적의 기록).

## 요약

이번 변경은 spec 영향 없는 순수 import-path 리팩터이고, 대부분의 diff 는 기계적이라 새로운
테스트가 필요하지 않다. 다만 유일하게 동작을 바꾸는 지점(`TERMINAL_SHAPE` 를 모듈 스코프로
되돌린 것)은 과거 72 suites 를 한꺼번에 무너뜨린 실패 모드의 재발을 막는 것이 목적인데, 그
안전장치가 코드 주석의 서술과 "우연히 그 상수를 건드리는 기존 테스트들의 부수 효과"에만
의존하고 있다 — 이 불변식을 직접 겨냥하는 이름 있는 테스트나 정적 가드(lint rule/circular
import 검사)는 없다. 리팩터 자체의 정합성(스테일 import 없음, 425/425 unit + e2e 276 PASS)은
확인됐으므로 이번 PR 을 막을 사유는 아니지만, 다음에 같은 클래스의 회귀가 나면 다시 "72개 스펙이
왜 동시에 죽었는지" 를 처음부터 추론해야 하는 상태로 남는다.

## 위험도

LOW
