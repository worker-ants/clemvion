# 요구사항(Requirement) 리뷰 — ws-event-types-extract (6라운드째)

## 검토 방법

`git diff origin/main...HEAD`(base `8e0728a90`, HEAD `b5ef57c3a`)로 27개 backend 코드 파일 + plan/review
문서 전체를 대조했다. 이 브랜치는 이미 5라운드(`19_27_37`→`20_05_17`→`20_27_08`→`20_50_49`→`21_14_51`)의
`/ai-review` + fix 사이클을 거쳤고, 매 라운드 RESOLUTION.md 가 "반영"을 주장한다. 이번 라운드는 (a) 그
주장을 **소스 직접 열람으로 재검증**하고 (b) 직전 라운드(`21_14_51`) 이후 유일하게 새로 추가된 커밋
(`b5ef57c3a`, 가드 테스트 파일만 수정)에 새 결함이 없는지, (c) 요구사항 충족·spec fidelity 관점에서
지금까지 어느 라운드도 짚지 않은 갭이 남아 있는지에 집중했다.

직접 실행/대조한 검증:

- `git diff origin/main...HEAD --stat -- codebase/` — 27파일, 프로덕션 로직 변경은
  `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 모듈 스코프 승격 1건뿐임을 재확인. 나머지
  26개는 import 문 치환만.
- `git show b5ef57c3a -- codebase/` — 직전 라운드 이후의 유일한 신규 커밋. `websocket-events.types.spec.ts`
  단독 수정(45+/12-)이며 프로덕션 코드 변경 없음. `leavesValueEdge(declTypeOnly, hasNamedBindings,
  valueNameCount)` 도입 로직을 직접 추적: `import { type Foo }`(선언 미표시+named 존재+값 이름 0) →
  `false`(간선 없음, 정답), `import Foo from`/`import * as X`/side-effect(named 없음) → `true`(간선 있음,
  정답), `import { Foo, type Bar }`(named 존재+값 이름 1) → `true`(정답) — 세 상태 분기가 실제로 올바르게
  갈린다.
- `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` — 호출 시점 인라인 리터럴(구 코드)과
  모듈 스코프 상수(신 코드)의 매핑이 `completed→EXECUTION_COMPLETED/COMPLETED`,
  `failed→EXECUTION_FAILED/FAILED`, `cancelled→EXECUTION_CANCELLED/CANCELLED` 로 **바이트 단위로 동일**함을
  `git diff` 로 직접 대조. `emitTerminalExecution` 의 `wire.error`/`wire.result.cancelledBy` 조립 로직(§6/§6.5
  계약)은 이번 diff 범위 밖(더 이전 커밋 `8e0728a90`, 이미 `origin/main` 에 있음)이라 재검토 대상 아님.
- `websocket-events.types.ts` — `grep -c "^import"` = 0(의존성-프리 확인), `grep -n "^export"` 결과 12개
  export 가 `websocket-events.types.spec.ts` 의 `EXPECTED_EXPORTS` 배열과 순서까지 정확히 1:1 일치.
- `websocket.service.ts` 상단 re-export 블록 — `export { … }` 4개(값) + `export type { … }` 8개(타입) =
  12개, 신규 모듈의 export 집합과 완전히 일치(하위호환 facade 무결).
- `chat-channel.dispatcher.ts`/`notification-fanout.service.ts`/`sse-adapter.service.ts` — 3라운드
  전(`20_05_17` W1)에 지적된 `import type` 누락이 현재 소스에서 전부
  `import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';` 로 고쳐져 있음을
  `grep` 으로 직접 확인. 해당 3파일의 diff 는 import 문 교체 외 로직 변경이 전혀 없음(`git diff` 전문 확인).
- `npx jest src/modules/websocket/websocket-events.types.spec.ts` 단독 실행 → **5/5 PASS**.
- `npx tsc --noEmit -p tsconfig.build.json`(실제 `nest build` 가 쓰는 설정) → **에러 0**.
- `plan/in-progress/ws-event-types-extract.md` — `18_53_27` rationale_continuity WARNING("§4.4 Rationale
  과 겹치는데 상호 참조가 없음")이 실제로 plan 본문에 "§4.4 가 유예한 것과 이건 다른 층위다" 절 +
  대조표(대상/수단/`forwardRef`/emit 경로)로 반영돼 있음을 확인. spec 본문(`4-execution-engine.md` §4.4)
  자체에 후속 Rationale 한 줄을 더하는 것은 plan 체크리스트에 미체크 상태로 planner-턴 항목으로 정확히
  등재돼 있다(developer 는 `spec/` write 권한이 없으므로 이 범위에서는 정답).

## 발견사항

- **[INFO]** spec 6곳의 `KbEventType`/`ExecutionChannelEvent` "정본 위치" 서술이 물리적으로 stale — 이미
  추적됨, 신규 문제 아님
  - 위치: `spec/5-system/10-graph-rag.md:552`, `spec/5-system/8-embedding-pipeline.md:276`,
    `spec/5-system/6-websocket-protocol.md:740,1034`, `spec/data-flow/6-knowledge-base.md:288`,
    `spec/data-flow/0-overview.md:110` (전부 `plan/in-progress/ws-event-types-extract.md` 후속 절에 이미
    미체크 항목으로 등재됨)
  - 상세: 이 6곳은 `KbEventType`/이벤트 타입의 "권위 있는 정의"가 `websocket.service.ts`(또는
    `WebsocketService` 클래스)에 있다고 서술하는데, 실제 선언은 이번 리팩터로
    `websocket-events.types.ts` 로 이동했다(re-export 로 값 자체는 여전히 `websocket.service` 경유로도
    접근 가능하므로 **동작에는 영향 없음** — 순수 문서 포인터 staleness). `spec_impact: none` 과 무모순 —
    선언 위치 이동은 §5.4 이하 계약(필드 셋·이벤트명) 자체를 바꾸지 않았다. 이 항목은 developer 의
    `spec/` write 권한 밖이라 plan 이 이미 planner-턴 후속 항목으로 정확히 인계해 뒀다(새로 발견한 갭
    아님, 5라운드 전부터 추적 중).
  - 제안: 코드 조치 불필요. planner 턴에서 6곳 정정 시 "정의는 `websocket-events.types.ts`, 하위호환
    re-export 는 `websocket.service.ts`" 형태로 갱신 권장.

## 요약

`websocket.service.ts` 가 안고 있던 ES-module 순환 위 값 평가 순서 문제(#1174 재발 위험)를
의존성-프리 모듈 `websocket-events.types.ts` 로 물리적으로 분리한다는 plan 의 요구사항을 코드가 정확히
충족한다. 5라운드에 걸친 이전 리뷰가 이미 실질 결함(제품 코드: gateway.ts 순환 잔여 노드 — 1라운드에서
해소) 및 가드 자체의 판별 결함(`export…from`/별칭 오판정/`require()`/인라인 `type` 오탐 — 각 2~5라운드에서
순차 해소)을 전부 찾아냈고, 이번 라운드에서 소스를 직접 열어 그 수정들이 실제로 반영돼 있음을
독립적으로 재확인했다(`tsc --noEmit` 에러 0, 신규 가드 5/5 PASS, export 표면 12개 1:1 일치, `import type`
누락 3곳 전부 해소, `TERMINAL_SHAPE` 매핑이 구/신 코드 간 바이트 단위 동일). 직전 라운드(`21_14_51`)
이후 유일한 신규 커밋(`b5ef57c3a`)은 가드 테스트 파일만 건드리며, 새로 도입된 `leavesValueEdge` 3-상태
분기 로직을 직접 추적한 결과 인라인 `type` 태그·혼합 값/타입·side-effect import 케이스 전부 올바르게
판정한다. §4.4 Rationale 과의 상호참조 누락(consistency-check WARNING)도 plan 본문에 명시적으로
반영됐다. 유일한 잔여 관찰은 spec 6곳의 "정본 위치" 서술이 물리적으로 stale하다는 것인데, 이는 동작에
영향 없고 이미 5라운드 전부터 plan 의 planner-턴 후속 항목으로 추적 중이라 이번 PR 을 막을 사유가
아니다. 요구사항 충족 관점에서 새로 발견된 Critical/Warning은 없다.

## 위험도

NONE
