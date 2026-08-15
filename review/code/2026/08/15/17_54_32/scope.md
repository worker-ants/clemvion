### 발견사항

- **[WARNING]** 클래스 레벨 JSDoc(파사드 설계 근거)이 삭제되고 새 타입의 JSDoc으로 대체됨 — 원래 내용은 어디에도 보존되지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:11-30` (게이트 기준, `@Injectable() export class ExecutionEventEmitter` 바로 위)
  - 상세: 변경 전 이 위치의 JSDoc은 `ExecutionEventEmitter` **클래스**의 존재 이유를 설명했다 — "실행 엔진이 발행하는 도메인 이벤트의 단일 진입점", "옛 코드는 `ExecutionEngineService` 가 `WebsocketService.emitExecutionEvent`/`emitNodeEvent` 를 24곳에서 직접 호출했다", "(C-6 strangle step 1)", "향후 단계에서 비-WS 채널(Sentry/OTel)을 추가할 때 호출 사이트를 더 건드리지 않아도 되도록" 등. 이번 diff는 이 JSDoc 블록 전체를 **신규 타입 `TerminalEventPayload` 용 JSDoc으로 치환**했고(§6 필드 집합 표 근거, union 도입 이유), 클래스(`export class ExecutionEventEmitter`) 자체에는 이제 **어떤 docstring도 남지 않는다**. `grep -rn "C-6 strangle\|단일 진입점\|24곳에서 직접 호출"` 로 저장소 전체를 확인한 결과 원문이 다른 곳으로 옮겨지지도 않고 완전히 소실됐다(`graph-traversal.service.ts`·`node-handler-dependencies.provider.ts` 는 각각 "C-6 strangle step 2/3"만 언급, step 1 원문과 무관). 이번 PR의 목적은 "종결 emit에 타입 초크포인트를 세우는 것"이며 클래스 전체 설계 배경 문서 삭제는 그 목적과 무관한 부수 삭제다.
  - 제안: 신규 `TerminalEventPayload` JSDoc은 그대로 두되, 원래 클래스 docstring(파사드 존재 이유·C-6 strangle 단계·향후 비-WS 채널 확장 노트)은 `@Injectable()` 바로 위(클래스 선언부)로 이동시켜 보존한다.

- **[INFO]** "타입 초크포인트 도입"이라는 선언된 리팩터 범위에 `retry-turn.service.ts` 의 기존 결함(`failRetryExecution` cancelled 분기의 `cancelledBy` 누락, `retry-turn-terminal-guard.md` #2 소유) 수정이 같은 커밋에 흡수됨
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (`failRetryExecution`, 게이트 978-1003), `plan/in-progress/eia-terminal-emit-facade.md:18-38`, `plan/in-progress/retry-turn-terminal-guard.md:307-311`
  - 상세: 이는 은폐된 확장이 아니라 plan 문서("다른 plan 과의 관계" 절)·커밋 메시지·spec §6 각주·자매 plan 체크박스에서 **명시적으로 교차 참조되며 정당화**된 흡수다(타입 파사드가 `cancelledBy` 를 필수 필드로 만들자 컴파일러가 기존 미해결 결함을 드러냈다는 서사). 사전 `consistency-check --impl-prep`(`17_20_28`)이 plan_coherence WARNING #1 로 이 교차참조 누락을 지적했고, 최종 diff에는 그 지적이 반영되어 있다(`retry-turn-terminal-guard.md` #2 를 흡수한다는 절 추가 + 체크박스 동기화). 순수 "범위(scope)" 관점에서는 리팩터 커밋에 동작 변경(신규 `cancelledBy: 'user'` 필드 emit)이 섞인 것은 사실이나, 투명하게 문서화·근거 제시·자매 문서 동기화가 되어 있어 CRITICAL/WARNING 급 은닉된 확장은 아니다.
  - 제안: 없음(참고용) — 다만 커밋 메시지 제목이 `refactor(engine): ...` 인데 실질적으로 `fix` 요소(결함 흡수)가 포함되어 있어, 향후 유사 패턴에서는 `refactor` + `fix` 혼합임을 제목에도 드러내는 편이 추적에 유리하다.

### 요약
핵심 변경(`ExecutionEventEmitter.emitTerminalExecution` 판별 union 파사드 도입 + 직접 `emitExecution` 호출 11곳 전량 치환 + wire 형태 회귀 테스트 4건 + 호출부 spec 재작성 + spec/plan 동시 동기화)은 `plan/in-progress/eia-terminal-emit-facade.md` 에 사전 선언된 설계·조치 항목과 정확히 일치하며, `git show --stat` 로 확인한 17개 파일 전량이 이 목적에 직접 연결된다. 비-종결 이벤트(`emitExecution` 을 쓰는 message/started 류 8곳)는 의도대로 손대지 않았고, import 정리도 실제 사용 여부와 일치해 dead import 가 없다. `retry-turn-terminal-guard.md` #2 흡수는 리팩터 범위를 살짝 넘는 동작 변경이지만 문서·spec·자매 plan 에 전부 교차 참조되어 투명하다. 유일한 실질적 스코프 이탈은 `execution-event-emitter.service.ts` 클래스 docstring 이 신규 타입 JSDoc 으로 치환되며 원문이 보존 없이 삭제된 것 — 이번 작업 목적과 무관한 문서 손실이다.

### 위험도
LOW
