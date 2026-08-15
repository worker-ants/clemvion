# 아키텍처(Architecture) 리뷰 — `21_49_51`

## 검토 방법

이 diff(`origin/main...HEAD`)는 `ws-event-types-extract` 리팩터(backend 27개 소스/spec 파일)
+ 그 위에 누적된 6차례 코드 리뷰(`19_27_37`→`20_05_17`→`20_27_08`→`20_50_49`→`21_14_51`→
본 라운드)와 2차례 consistency-check 산출물 + spec frontmatter 1줄로 구성된다. 직전
아키텍처 라운드(`21_14_51`)는 위험도 NONE 으로 확정했고, 그 이후의 유일한 델타는 커밋
`b5ef57c3a`("이번엔 오탐이었고 원인은 내 대조군이었다")로 — `git show b5ef57c3a --stat` 로
실측한 결과 이 커밋은 `websocket-events.types.spec.ts` **단 하나**만 건드리며, 회귀 가드의
`leavesValueEdge()` 판별 로직을 인라인 `type` 태그까지 인식하도록 세 상태로 가른 것이다.
프로덕션 아키텍처 표면(모듈 경계·순환·레이어 책임)에는 손을 대지 않았다.

프롬프트 게이트가 아니라 현재 워크트리 소스를 직접 대조했다:

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` 전체(266줄) — import 0줄 재확인
- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 전체(352줄) — `moduleRefs`/`leavesValueEdge`/`originalName` 로직 재독
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `ExecutionEventType` import 경로(`./websocket-events.types`, 23행) 재확인
- `codebase/backend/src/modules/websocket/websocket.service.ts` (1-140행) — 값/타입 import·re-export 분리, credential 마스킹 구현 위치
- `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` 전체(206줄) — `TERMINAL_SHAPE` 모듈 스코프 상수 + facade 책임 범위
- `grep -rn "websocket\.service'"` 로 production 소스 전체에서 잔존 값 import 지점 전수 확인

## 발견사항

이번 라운드에서 새로 지적할 CRITICAL/WARNING 급 아키텍처 결함은 없다.

- **[INFO]** re-export facade 가 여전히 3중 수동 동기화 지점(`websocket.service.ts` 의
  `export {...}`/`export type {...}` 블록 / `websocket-events.types.ts` 선언 /
  `websocket-events.types.spec.ts` 의 `EXPECTED_EXPORTS`)이다 — `20_27_08`/`20_50_49`/
  `21_14_51` architecture.md 가 이미 반복 기록·수용한 관찰이며, 이번 라운드의 유일한 델타
  (`leavesValueEdge` 세분화)는 이 구조를 바꾸지 않는다. 재확인만 하고 새 항목으로 세지 않는다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:31-46`, `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:49-62`
  - 제안: 조치 불필요(4개 라운드 연속 합의 유지 — `tsc` 가 drift 를 fail-closed 로 잡는다는 근거).

- **[INFO]** 회귀 가드가 lint/CI 아키텍처 계층이 아니라 unit-test 계층(`websocket-events.types.spec.ts`)에서 `src/` 전체를 파일마다 파싱해 스캔하는 fitness-function 배치도 이전 라운드가 이미 검토·합의한 사안이다. 이번 델타는 그 판별 로직(`leavesValueEdge`)의 정확도를 높이는 방향이며 배치 자체를 바꾸지 않는다.
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` (`collectOffenders`, `moduleRefs`)
  - 제안: 조치 불필요 — 이전 라운드가 "후속 PR 에서 `no-restricted-imports` 승격 고려"로 이미 처분했고, 이번 라운드가 그 판단을 뒤집을 근거가 없다(오히려 뮤테이션 19 RED/9 GREEN 으로 현재 위치에서의 실효성이 재입증됐다).

## 확인 완료 — 이번 델타(`leavesValueEdge` 세분화)의 아키텍처 영향 (문제 없음)

- 판별 로직이 `declTypeOnly`/`hasNamedBindings`/`valueNameCount` 세 값을 받는 순수 함수
  `leavesValueEdge()` 로 분리되어, 기존 `moduleRefs()` 안에 인라인돼 있던 조건식보다 오히려
  **단위 테스트 가능성·가독성이 개선**됐다. `21_14_51` architecture.md 가 긍정 평가했던
  "간선 판별이라는 단일 책임을 한 곳에 모으는 SRP 정리" 방향과 일치하며 후퇴가 없다.
- production 소스(`grep -rn "websocket\.service'" codebase/backend/src`)를 전수 재확인한
  결과, `websocket.service` 로부터 남아 있는 값 import 는 전부 `WebsocketService` 클래스
  자체(DI 주입 목적)뿐이고 — `chat-channel.dispatcher.ts`, `websocket.module.ts`,
  `execution-event-emitter.service.ts`, `background-execution.processor.ts`,
  `notification-fanout.service.ts`, `sse-adapter.service.ts`, `embedding.service.ts`,
  `graph-extraction.service.ts`, `notifications.service.ts` — 이벤트 enum/타입을 값으로
  가져오는 지점은 0건이다. `websocket.gateway.ts` 도 `ExecutionEventType` 을
  `./websocket-events.types` 에서 직접 가져온다(23행). #1174 순환의 두 핵심 노드
  (`websocket.service`↔`websocket.gateway`) 모두 값 간선을 새 의존성-프리 모듈로 옮긴
  상태가 유지되고 있다.
- `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 모듈 스코프 상수는
  `websocket-events.types` 만 값으로 참조(순환 이탈)하며, `ExecutionEventEmitter` 클래스는
  여전히 "이벤트 발행 facade"라는 단일 책임에 집중돼 있다 — `registerExecutionRouting`/
  `releaseExecutionRouting` 이 엄밀히는 facade 범위를 넘는다는 점은 클래스 자신의 JSDoc
  (177-188행)이 이미 인지·기록하고 있고 이번 diff 의 변경 대상도 아니다.
- 클래스 레벨 DI 순환(`forwardRef(() => ExecutionEngineService)` 등, `websocket.gateway.ts`)
  은 의도적으로 그대로 남아 있으며, 이는 `websocket-events.types.ts` 헤더 주석이 스스로
  명시한 범위("이 모듈은 그 봉인 기법을 대체하지 않는 보완 조치다 — 값 평가 순서만
  정리한다")와 정확히 일치한다. 은폐된 리스크가 아니라 문서화된 범위 밖 결정이다.

## 설계 평가

6차례 리뷰 이력의 마지막 단계인 이번 diff 는 프로덕션 아키텍처 표면을 전혀 바꾸지 않고,
회귀 가드 자신의 판별 정확도(오탐 제거)만 개선한다. 핵심 설계 — ES-module 순환 위에 있던
`websocket.service.ts` 에서 값(enum)·타입 선언을 의존성 0 인 leaf 모듈
(`websocket-events.types.ts`)로 물리적으로 분리하고, 하위호환은 re-export facade 로
유지하며, "다시 순환에 편입되지 않는다"는 불변식을 AST 기반 정적 가드(fitness function)로
코드에 고정한 것 — 은 SRP(서비스 구현 vs 값/타입 선언의 분리)와 DIP(구체 서비스가 아니라
값·타입 leaf 모듈에 의존)에 부합하는 정석적 순환 차단 기법이다. 6라운드에 걸친 발견의
성격 이동(1라운드: 제품 코드 결함(gateway 누락) → 2~5라운드: 가드 자신의 미검출(FN) →
6라운드: 가드 자신의 오탐(FP))은 근본 원인이 판별 로직 이원화에서 단일 헬퍼 통합으로
수렴했고, 그 이후는 그 헬퍼의 경계 조건을 다듬는 수준으로 좁아졌다는 것을 보여준다 —
구조적 수렴의 증거다.

## 요약

이번 라운드(`21_49_51`)는 직전 라운드(`21_14_51`)가 NONE 으로 확정한 아키텍처 구조 위에서,
회귀 가드의 값/타입 간선 판별 로직이 인라인 `type` 태그를 정확히 인식하도록 다듬은
테스트-전용 델타 하나만 추가한다. `websocket.gateway.ts` 의 순환 노드 이탈은 회귀하지
않았고, `websocket-events.types.ts` 는 여전히 import 0줄이며, production 소스 전수 grep
으로 재확인한 결과 이벤트 enum/타입을 옛 경로(`websocket.service`)에서 값으로 가져오는
지점이 0건임을 확인했다. 클래스 레벨 DI 순환(`forwardRef`)이 의도적으로 남아 있다는 사실도
소스 주석에 정직하게 문서화되어 있다. 잔여 관찰(re-export facade 3중 수동 동기화, 가드의
테스트-계층 배치)은 4개 라운드 전부터 이미 INFO 로 합의된 비차단 사안이며 이번 라운드가
이를 악화시키지 않았다. 이 PR 을 막을 아키텍처 사유는 없다.

## 위험도

NONE
