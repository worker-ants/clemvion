# 테스트(Testing) 리뷰 — `envelope.output` allowlist 확장 (`node-output-envelope`, 재검토 라운드)

## 범위 확인 및 방법론

이번 diff(32개 파일) 중 실제 테스트 대상 코드는 여전히 2개뿐이다 —
`codebase/backend/src/modules/websocket/websocket.service.ts` 와
`codebase/backend/src/modules/websocket/websocket.service.spec.ts`. 나머지는
CHANGELOG·plan·spec·`review/consistency/**`·`review/code/2026/08/24/11_05_39/**`(직전
라운드의 review 산출물 자체가 이번 diff 에 커밋 대상으로 포함됨) 문서다.

직전 라운드(`11_05_39`)의 testing 리뷰가 이미 이 코드를 상세히 분석해 INFO 8건만 남겼고,
그중 **INFO 8**("`output` 경로가 chat-channel 4키 보존을 직접 단언하지 않는다")이 이번
diff 에서 신규 `it.each` 캐너리(915~935행)로 실제로 해소됐음을 `Read`로 직접 대조했다. 이
라운드에서는 그 해소가 vacuous 하지 않은지 **직접 실행 + 뮤테이션으로 재검증**했다.

### 직접 실행 확인 (실측)

```
codebase/backend $ npx jest src/modules/websocket/websocket.service.spec.ts --silent
Tests: 62 passed, 62 total
```

### 뮤테이션 재검증 (자체 실행, 개발자 주장에 기대지 않음)

`websocket.service.ts:216` 의 `next = narrowTopLevelNodeOutput(next, 'output');` 를
`// MUTATED-OUT: ...` 로 무력화하고 재실행:

```
Tests: 2 failed, 60 passed, 62 total
```

실패한 2건은 `[캐너리] execution.node.* 의 envelope.output 도 allowlist 를 지난다`(956행)와
`[잔여 고정] flat 폴백 shape 이 오면 목록 밖 키는 떨어진다`(1007행) — plan
(`plan/in-progress/node-output-envelope.md` M1 행)이 사전에 적어 둔 예측("신규 `output`
캐너리 + flat 폴백 캐너리 2건 RED")과 정확히 일치했다. 뮤턴트 적용 후 `git checkout --`
으로 원복하고 62/62 GREEN 재확인함. **이 PR 의 핵심 변경(`envelope.output` allowlist 배선)이
non-vacuous 테스트로 커버된다는 것을 재현 가능한 형태로 직접 확인했다.**

## 발견사항

- **[INFO]** 새로 닫힌 `envelope.output` 표면의 신규 캐너리 3종이 전부 `NodeEventType.NODE_COMPLETED` 만 쓰고, `.NODE_FAILED` 변형에 대한 직접 증거가 없다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:915`(chat-channel 4키 `output` 경로 캐너리) / `:956`(`_retryState` 제거 캐너리) / `:1007`(flat 폴백 캐너리) — 세 `it`/`it.each` 블록 전부 4번째 인자로 `NodeEventType.NODE_COMPLETED` 를 씀
  - 상세: 이번 PR 이 spec 문서(WS §4.1)와 plan 에서 명시적으로 주장하는 것은 "`execution.node.completed`**/`.failed`** 모두 같은 `output` 키로 `NodeExecution.outputData` 를 싣고, emit 6곳 중 `execution-engine.service.ts` 의 `finalizeErrorPortNode`(`.failed` 경로)도 포함된다"는 것이다(WS §4.1 `execution.node.failed` 행에 `output` 열도 이번에 신규 추가됨). 코드 상으로는 `toFanoutEnvelope`(narrowing 이 걸리는 chokepoint)가 `NodeEventType` 값과 무관하게 균일 적용되므로(`websocket.service.ts:399-421` `emitNodeEvent` 어디에도 `eventType` 분기 없음, 직접 대조 확인) 아키텍처적으로는 위험이 낮다. 그런데 이 프로젝트가 바로 이 PR 안에서 채택한 논리 — *"같은 헬퍼를 공유하니 논리적으로는 보장되지만 직접 증거는 아니다"*(915행 JSDoc, 직전 라운드 INFO 8 을 그대로 인용)를 `nodeOutput` vs `output` 두 키 사이에 적용해 신규 캐너리를 추가했다 — 를 한 단계 더 깊이(`completed` vs `failed` 두 이벤트 타입 사이)는 적용하지 않았다. 이미 값-패턴 마스킹 테스트(`:1296` `값-패턴 마스킹` describe)는 `NODE_FAILED` 를 쓰지만 그건 다른 계층(값 마스킹)이지 이번에 추가된 최상위 키 allowlist 는 검증하지 않는다.
  - 제안: 필수는 아님(단일 chokepoint 구조상 이벤트 타입 분기가 생길 가능성이 낮음) — 다만 신규 캐너리 3종 중 하나를 `NODE_FAILED` + `output: { _retryState: {...}, error: {...} }` 형태로 파라미터화하면, 향후 `emitNodeEvent` 가 이벤트 타입별로 분기하도록 리팩터될 때(예: `.failed` 전용 error 포맷팅 경로가 생기는 경우) 이 표면이 다시 조용히 빠지는 것을 직접 잡는다. 이 PR 이 반복해서 겪은 실패 패턴("논리적 보장 vs 직접 증거")과 같은 클래스라 비용 대비 가치가 있다.

- **[INFO]** (직전 라운드에서 이미 지적된 항목, 여전히 미해소 — 참고용 재확인) `nodeOutput` 과 `output` 이 한 envelope 에 동시에 존재하는 케이스가 여전히 미검증
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:215-216` (`let next = narrowTopLevelNodeOutput(envelope, 'nodeOutput'); next = narrowTopLevelNodeOutput(next, 'output');` 순차 호출)
  - 상세: `11_05_39` testing 라운드가 이미 지적했고 이번 diff 에서 추가 조치는 없다. 실제 emit 사이트 기준으로는 각 이벤트 타입이 두 키 중 하나만 쓰므로 낮은 위험이지만, "순차 적용이 두 번째 호출에 첫 결과(`next`)를 올바르게 전달한다"를 직접 겨냥한 테스트는 여전히 없다. 새로운 결함은 아니므로 이번 PR 을 막을 사안은 아니다.
  - 제안: 필수 아님 — 두 키가 실제로 공존하는 emit 사이트가 생기면 추가.

- **[INFO]** 신규 테스트 3종이 이번 라운드에서도 여전히 무관한 `describe` 블록(`llmCalls strip — 외부 fanout 수신자 보호`) 안에 위치 — 이미 트래커에 등재된 기존 항목의 연장이라 새 지적 아님
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:604`(`describe` 시작) ~ `:915`,`:956`,`:1007`(신규 3건 위치) — 다음 `describe`(`emitNotificationEvent`)는 `:1214`
  - 상세: `maintainability.md`(`11_05_39`)가 이미 이 클래스의 이슈(기존 describe 배치 문제에 이번 PR 이 2건을 더했다는 것)를 지적했고, plan 문서(`sse-nodeoutput-allowlist.md`)에 이동 대상으로 등재돼 있다고 기록돼 있다. 이번 diff 는 여기에 1건(flat 폴백 캐너리)을 추가로 더했다(직전 라운드 시점엔 신규 3건, 지금은 확인 결과 여전히 3건이 이 블록 안). 조치 불요 — 트래커가 이미 소유.

## 확인된 강점 (직접 재검증 결과 포함)

- **뮤테이션 재현성** — 개발자가 plan 에 남긴 M1 예측("신규 `output` 캐너리 + flat 폴백 캐너리 2건 RED")을 독립적으로 재현했고 일치했다(위 "뮤테이션 재검증" 절). GREEN 만 확인하고 끝내지 않았다는 이 저장소의 원칙이 리뷰 단계에서도 재확인됨.
- **대조군(제거/보존) 패턴 일관 유지** — `:956`~`:992` 의 신규 캐너리가 `not.toHaveProperty`(제거)와 `toEqual`(보존)을 항상 짝으로 둔다. 통째로 날려서 통과하는 구현을 배제.
- **내부 WS 불변 검증이 새 캐너리에도 이어짐** — `:984-991` 이 `gateway.broadcastToChannel` mock 호출 인자(wire)는 필터링 안 됨을 매 캐너리마다 재확인.
- **테스트 격리** — `beforeEach`(`:51`)에서 매번 새 `WebsocketService` + fake allocator 생성, 전역/모듈 상태 공유 없음. 신규 테스트도 이 패턴을 그대로 따름.
- **회귀 계약 이행** — `#1208` 이 남긴 `[잔여]` 캐너리("닫히면 이 단언을 뒤집는 것이 그 작업의 일부")를 삭제가 아니라 명시적으로 뒤집어(`:956` `[캐너리]`) 이행했다. 테스트 이력이 문서 역할을 겸함.
- **가독성** — JSDoc 이 "왜 이 캐너리가 필요한가"(직전 라운드 INFO 8 인용, 헬퍼 공유가 논리적 보장일 뿐 직접 증거가 아니라는 이유)까지 테스트 코드 안에 명시해 다음 사람이 의도를 오독하지 않게 한다.

## 요약

이번 라운드는 직전 testing 리뷰(`11_05_39`)가 남긴 유일한 실질 갭(INFO 8, `output` 경로 chat-channel 보존 미검증)을 정확히 겨냥한 `it.each` 캐너리로 해소했고, 그 해소가 vacuous 하지 않다는 것을 이 리뷰가 독립적으로 재실행+뮤테이션(2건 RED, 예측과 일치)으로 재확인했다. `envelope.output` allowlist 배선의 핵심 동작(제거·보존·내부 WS 불변)은 non-vacuous 테스트로 견고하게 커버된다. 남은 갭은 전부 INFO 수준이다 — (1) 새로 닫힌 표면의 `.failed` 이벤트 변형에 대한 직접 캐너리가 없다(아키텍처적으로 단일 chokepoint 라 위험은 낮지만, 이 PR 이 스스로 세운 "논리적 보장 ≠ 직접 증거" 기준을 한 단계 덜 적용했다), (2) `nodeOutput`/`output` 동시 존재 케이스 미검증(직전 라운드 이월, 낮은 위험), (3) describe 블록 배치(기존 트래커 항목의 연장). Critical/Warning 급 결함은 발견하지 못했다.

## 위험도

LOW
