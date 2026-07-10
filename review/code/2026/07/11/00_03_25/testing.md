# 테스트(Testing) 리뷰 — EIA/WS continuation 명령 ↔ 대기 표면 가드 (§7.5.1)

검토 범위: `execution-engine.service.{ts,spec.ts}`, 신규 `waiting-surface-guard.{ts,spec.ts}`,
`interaction.controller.ts`/`interaction.service.ts`(doc-only), `hooks.service.{ts,spec.ts}`,
`test/execution-park-resume.e2e-spec.ts`, `plan/in-progress/eia-command-waiting-surface-guard.md`.

검증 방법: diff 정독 + 실제 리포지토리 소스(park/resume 실제 로직, WS gateway, REST controller,
관련 spec 파일) 교차 확인 + 대상 unit 테스트 실행(`jest`)으로 회귀 여부 실측.

```
$ npx jest src/modules/execution-engine/execution-engine.service.spec.ts --silent
Tests: 392 passed, 392 total
$ npx jest src/modules/execution-engine/waiting-surface-guard.spec.ts \
           src/modules/hooks/hooks.service.spec.ts \
           src/modules/executions/executions.controller.spec.ts \
           src/modules/websocket/websocket.gateway.spec.ts --silent
Tests: 138 passed, 138 total
```

## 오케스트레이터 지정 4개 질문 — 결론 먼저

1. **공용 mock 기본값 변경이 기존 테스트를 vacuous 하게 만드는가 → 아니오, 확인됨.**
   `execution-engine.service.spec.ts` 전체 392개 테스트가 diff 반영 후에도 모두 통과. 코드
   추적으로 다음을 확인:
   - `resolveWaitingNodeExecutionId`가 `rows.length !== 1`(0건/다중)이면 `assertCommandMatchesWaitingSurface`
     호출 **이전에** throw 하므로, 기존 "0건/다중 row" 계열 테스트(L2030~2085)는 표면 가드를
     아예 거치지 않는다 — 변경 영향 없음.
   - "predecessor 조회"(`getLatestPredecessorOutputs`, L4640/4705)·"배치 이력 조회"(`rehydrateContext`,
     L6198) 등 `mockNodeExecutionRepo.find`를 재정의하는 다른 테스트는 전부 무관한 다른 쿼리
     (COMPLETED 조회, 로그 배치)라 표면 가드와 겹치지 않는다.
   - `select`에 `outputData: true`가 추가됐지만 이 select shape 를 문자 그대로 단언하는 기존
     테스트는 없다(grep 확인) — 깨질 표면적 자체가 없었다.
   - 공용 기본값(`interactionType: 'ai_conversation'`, `node.type: 'ai_agent'`)은 의도적으로
     "가장 관대한 표면"을 골라, 표면 가드와 무관한 나머지 대다수 테스트(publish 페이로드
     검증, 에러 전파, 로그 등)가 계속 원래 검증 대상만 검증하도록 설계됐다 — 우회가 아니라
     "그 테스트가 원래 보지 않던 축을 permissive 기본값으로 고정"이므로 vacuous 화가 아니다.

2. **`armSlowPathResume`가 rawPersisted 를 find row 에 넣어 form/buttons/ai 세 경로를 실제로
   커버하는가 → 예, 그리고 비-vacuous 하게 커버한다.**
   `armSlowPathResume`는 하드코딩 스텁이 아니라 **직전 `service.execute`/최초 turn 이 실제로
   `mockNodeExecutionRepo.save()`에 기록한 `outputData`를 그대로 재사용**해 `find`/`findOne`
   mock 을 무장한다(L1003-1064). 호출부를 전수 확인한 결과:
   - form 노드(`node-form`, `node-form-w13`) — `continueExecution` 경로, L5670/5715/5815/5847/5874/7854
   - buttons 노드(`node-carousel`) — `continueButtonClick` 경로, L6373/6434
   - ai 노드(`node-agent`, `node-agent-dispatch`, `node-ie-w5b`(multi-turn information_extractor),
     `rc-ai`) — `continueAiConversation`/`endAiConversation`/`continueButtonClick`/`continueExecution`
     경로, 다수
   실제 park 로직을 추적해 페어링을 검증함: `button-interaction.service.ts:386-389`가
   `withInteractionMeta(..., 'buttons')`로 `outputData.meta.interactionType='buttons'`를 진짜로
   영속하고, `form-interaction.service.ts:132`가 `interactionType:'form'`을 영속한다. 즉
   `armSlowPathResume`가 재생하는 데이터는 실제 애플리케이션 코드가 만든 것과 동형이며,
   `assertCommandMatchesWaitingSurface`가 이를 읽어 표면을 올바르게 판정한다 — 그렇지 않았다면
   L6373/6434(carousel resume)가 새 가드에 걸려 실패했어야 하는데 실제로는 통과한다(실측
   192/392 중 통과 확인). 손으로 지어낸 fixture 가 아니라 "실제 실행 경로가 만든 값"을 재사용하는
   구조라 매우 견고하다.

3. **buttons 표면 회귀(엉뚱한 continue 포트 분기)가 e2e 로 실제 커버되는가 → 아니오, unit 뿐이다.
   불충분하다고 판단 — WARNING.**
   `test/execution-park-resume.e2e-spec.ts`에 추가된 유일한 회귀 e2e(L241-355 부근)는
   **form 대기 + `end_conversation`** 조합 하나뿐이다. plan 체크리스트("e2e 비-vacuity 실증 —
   가드 비활성 시 `end_conversation` 이 202 반환(재현), 가드 복원 시 409")도 이 form 케이스만
   가리킨다. **buttons 표면의 "엉뚱한 continue 포트 분기"는 코드 주석·plan 문서가 직접 지목한
   원본 결함인데도 unit(`execution-engine.service.spec.ts` L2167-2173,
   `waiting-surface-guard.spec.ts` "buttons 대기 — click_button 만 허용")로만 검증되고 e2e 는
   전혀 없다.**
   게다가 repo 전체를 검색한 결과(`grep -rln "buttonId\|button_click\|waitForButtonInteraction"
   codebase/backend/test/*.e2e-spec.ts` → 0건) **buttons 재개 경로 자체가 이 PR 이전부터 e2e
   커버리지가 전무**하다(`park-entry-dispatch.ts:83`의 "resume 측은 인라인이라 e2e 만 커버"라는
   주석과 실제 상태가 어긋난다). 더 중요한 문제: form 표면은 정적 `blockingInteraction`(handler
   metadata)만으로 판정돼 실제 Postgres JSONB 왕복을 전혀 거치지 않는다. 반면 buttons/ai 표면은
   `NodeExecution.outputData`가 실제 DB 에 JSONB 로 저장됐다가 다시 읽혀야 판정되는데, 이 왕복은
   **unit(mock)만으로는 검증 불가능한 축**(컬럼 타입 캐스팅·키 보존·TypeORM select 매핑 등)이다.
   즉 이번에 추가된 유일한 e2e 는 정확히 "DB 왕복이 필요 없는" 표면을 골라 검증한 셈이라,
   원 결함의 실제 재현 시나리오(버튼 대기)에 대한 종단 신뢰는 이 PR 만으로는 약하다.
   - 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts`
   - 제안: `carousel`/버튼 프레젠테이션 노드로 대기 → `submit_form`(또는 임의 비-`click_button`
     명령) 전송 → 409 확인 + execution 이 `waiting_for_input` 유지 확인 + 정상 `click_button` 후
     무손실 재개까지 검증하는 e2e 1건 추가를 권장. F-1 처럼 후속 defer 로 미룰 사안이 아니라
     이번 PR 이 고치는 바로 그 결함의 재현 시나리오다.

4. **WS gateway 경로·REST `/continue` 경로의 새 거부가 테스트되는가 → 간접적으로 충분히
   커버됨(직접적인 신규 테스트는 없음) — INFO 수준.**
   - WS gateway(`websocket.gateway.ts`)의 4개 continuation 핸들러는 전부
     `buildContinuationErrorAck`로 수렴하며, 이 메서드는 `error instanceof ExecutionError`
     여부만 보고 `code`/`message`를 그대로 ack 에 실어 보낸다(신규 로직 아님, 이 diff 로 변경
     안 됨). `InvalidExecutionStateError`→ack 매핑은 이미 `websocket.gateway.spec.ts`
     L920/1166/1257 등에서 제네릭하게(원인 무관) 검증돼 있다. WS gateway 는 엔진을 완전히
     mock 하므로 애초에 표면 가드 로직 자체를 통과시키지 않는다 — 가드 로직 검증 책임은
     `execution-engine.service.spec.ts`가, 매핑 검증 책임은 gateway spec 이 이미 나눠 갖고
     있어 구조적으로는 맞다. 다만 "표면 불일치로 인한 거부"라는 **새 원인**에 대해 WS 진입점을
     통해 실제로 도달 가능함을 보이는 신규/전용 테스트는 없다.
   - REST `/continue`(`executions.controller.ts`, 이번 diff 밖 — 미변경 파일)도 동일 패턴:
     `InvalidExecutionStateError`→422 `INVALID_STATE` 매핑은 `executions.controller.spec.ts`
     L84-107 에 원인 무관 제네릭 테스트로 이미 존재. 실제 "표면 불일치" 트리거는
     `execution-engine.service.spec.ts`의 `continueExecution` 관련 표면 매트릭스 테스트가
     엔진 레벨에서 커버한다.
   - EIA `/interact` 는 유일하게 실제 e2e(HTTP+DB+queue+worker) 로 이 신규 거부 사유를
     증명한다(파일 9). WS/REST 는 그 수준의 종단 증명이 없다는 점에서 EIA 대비 비대칭이지만,
     세 진입점이 동일한 chokepoint(`resolveWaitingNodeExecutionId`)를 공유하고 그 매핑 계층은
     사전 테스트가 있어 실질 리스크는 낮다.
   - 제안(낮은 우선순위): 여유가 있다면 `websocket.gateway.spec.ts`에 "engine 이
     `assertCommandMatchesWaitingSurface`발 `InvalidExecutionStateError`를 던지면 ack 에
     `errorCode: INVALID_EXECUTION_STATE`가 실린다"는 케이스를 1개 추가하면(현재도
     `InvalidExecutionStateError`를 mock 으로 던지는 테스트는 있으나 "표면 불일치"라는 사유를
     명시하는 주석/시나리오는 없음) 의도 문서화 측면에서 도움이 된다. 필수는 아님.

## 관점별 발견사항

- **[WARNING] buttons 표면 회귀의 e2e 부재 (위 질문 3 상세 참조)**
  - 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts`
  - 상세: 이 PR 이 고치는 원 결함 두 가지(form 빈 폼 제출 / buttons 엉뚱한 포트 분기) 중
    e2e 회귀 가드는 form 만 추가됐다. buttons 표면은 DB JSONB 왕복을 실제로 거쳐야 판정되는
    유일한 비-AI 표면인데, 이 축을 실제 Postgres 로 검증하는 테스트가 하나도 없다(기존에도
    없었고, 이번에도 추가되지 않았다).
  - 제안: 위 질문 3 의 제안 참조.

- **[INFO] `readPersistedInteractionType` non-object edge case 일부 미검증**
  - 위치: `waiting-surface-guard.spec.ts` L637-645 `readPersistedInteractionType` describe
  - 상세: `null`/`undefined`/문자열/`{}`/`{meta:null}`/`{meta:{interactionType:7}}` 는
    커버되나, 배열(`outputData: []`, `typeof [] === 'object'`라 object 분기를 타 `out.meta`
    는 `undefined`가 되어 결과적으로 안전하게 `undefined` 반환)이나 `{meta: {interactionType: ''}}`
    (빈 문자열 — 현재 로직상 `typeof === 'string'`이라 `''`를 유효한 interactionType 으로
    반환해버림, 이후 `resolveWaitingSurface`에서 `'' !== 'buttons'/'ai_conversation'/...`라
    결국 `undefined`로 fail-closed 되긴 하지만 이 경로 자체는 테스트가 없음)는 다루지 않는다.
    실제 결함 유발 가능성은 낮으나(둘 다 최종적으로 fail-closed 로 수렴) 명시적 케이스가
    있으면 향후 리팩터 시 회귀를 더 빨리 잡는다.
  - 제안: 필수는 아님. 여유 있을 때 1~2 케이스 추가 권장.

- **[INFO] registry 대칭 테스트가 `parkEntryRegistry`만 검증 (`resumeTurnRegistry`는 구조적으로 unit 불가)**
  - 위치: `waiting-surface-guard.spec.ts` "registry 대칭 — parkEntryRegistry.selects 와 동일 판정"
    (L747-772), 대응 소스 `execution-engine.service.ts:1846`(`resumeTurnRegistry` getter,
    `this`-bound 클로저라 서비스 인스턴스 없이 독립 구성 불가)
  - 상세: JSDoc(`waiting-surface-guard.ts:931`)은 "선택 우선순위·술어는 `resumeTurnRegistry` /
    `parkEntryRegistry` 와 동일"이라 **두 registry** 대칭을 주장하지만, 실제 자동 테스트는
    `buildParkEntryRegistry`(독립 factory, `park-entry-dispatch.ts:96`)로만 대칭을 확인한다.
    `resumeTurnRegistry`는 서비스 내부 private getter 라 독립 테스트가 불가능한 기존 아키텍처
    제약(그 자체는 이 PR 책임이 아니고 `park-entry-dispatch.ts:83` 주석에도 이미 명시된 선례)
    이다. form/buttons 두 표면의 두 registry selects 문자열 조건은 코드상 실제로 동일한 의미라
    drift 리스크는 낮지만, 자동 가드가 실제로 미치는 범위는 문서 주장보다 좁다.
  - 제안: 문서적 정확성 문제일 뿐 시급하지 않음. `resumeTurnRegistry`의 form/buttons selects 를
    향후 리팩터할 계획이 있다면 그때 `buildParkEntryRegistry`처럼 독립 factory 로 뽑아
    동일하게 unit 대칭 테스트를 씌우는 편이 근본 해법.

- **[INFO] `hooks.service.ts`의 swallow 대상이 두 개의 이질적 `STATE_MISMATCH` 원인을 구분하지 않음**
  - 위치: `hooks.service.ts` `forwardToInteractionService` catch 블록,
    `hooks.service.spec.ts` "표면 불일치(409 STATE_MISMATCH) forwarding 은 warn 후 삼킴" 테스트
  - 상세: `interaction.service.ts`의 `interact()`가 `ConflictException`(`STATE_MISMATCH`)을
    던지는 경로는 두 가지다 — (a) `assertWaiting`: execution 이 애초에 `waiting_for_input`이
    아님(예: 그 사이 완료/취소됨, race), (b) 이번에 추가된 `assertCommandMatchesWaitingSurface`
    발 표면 불일치. `hooks.service.ts`의 catch 는 `err instanceof ConflictException`만 보고
    무조건 `"현재 대기 표면과 맞지 않아 거부됨"`이라는 고정 warn 문구를 남긴다 — (a) 케이스에서는
    이 로그 문구가 실제 원인과 다르게 부정확하다. 신규 테스트 두 개는 모두 (b) 시나리오(직접
    `ConflictException({code:'STATE_MISMATCH'})`를 mock)만 만들어 이 구분을 검증하지 않는다.
  - 상세: 기능적 결함은 아니다(두 경우 모두 webhook 재시도 폭주 방지를 위해 삼키는 것이
    맞는 설계) — 순수 로그 메시지 정확성 이슈이며 테스트 우선순위는 낮음.
  - 제안: 필요 시 `err.getResponse()`의 `error.code`로 두 원인을 구분하거나, 로그 문구를
    "대기 상태 불일치(표면 또는 execution 상태)"처럼 일반화. 테스트 관점에서는 필수 아님.

- **[INFO] `execution-engine.service.spec.ts`의 `it.each` AI 표면 테스트가 4개 명령을
  단일 테스트 블록에 루프로 묶음 (L2186-2201)**
  - 위치: `표면 매트릭스 가드 (§7.5.1)` describe, `'%s 대기 — 4종 명령 모두 통과'`
  - 상세: 하나의 `it` 안에서 4개의 publish 함수를 순회하며 `armWaitingSurface`를 매번 재무장.
    실패 시 어떤 명령에서 실패했는지는 jest 출력(호출 스택/assertion 라인)으로 특정 가능하나,
    개별 `it.each`로 명령별로 쪼갰다면 실패 리포트가 한 단계 더 명확했을 것.
  - 제안: 선택적 리팩터. 현재도 읽고 디버깅하는 데 큰 문제는 없다.

- **[정보/확인 — 우수 사례] `resolveWaitingNodeExecutionId`/`assertCommandMatchesWaitingSurface`의
  0건·다중 row·node 부재·표면 판정 불가·표면 불일치 등 fail-closed 분기가 각각 독립 테스트로
  1:1 대응**된다 (`waiting-surface-guard.spec.ts`의 순수 함수 unit + `execution-engine.service.spec.ts`의
  서비스 레벨 integration-style unit 이 이중으로 같은 로직을 다른 층위에서 검증). 에러
  메시지의 client-safe 고정 문자열 vs `serverDetail` 분리도 전용 테스트(L2227-2237)로
  명시 검증됨 — CWE-209 류 정보 노출 회귀를 잘 잡는다.

## 나머지 관점 요약

- **테스트 존재 여부**: 신규 로직(`waiting-surface-guard.ts`) 전체가 순수 함수 unit +
  서비스 레벨 unit + (form 한정) e2e 3계층으로 덮여 있다. `interaction.controller.ts` 변경은
  Swagger 설명 문자열뿐이라 테스트 불필요.
- **Mock 적절성**: `hooks.service.spec.ts`의 새 테스트는 `InteractionService`를 모듈 경계에서
  mock 해 실제 표면 가드 로직을 재검증하지 않고 "swallow 여부"만 검증한다 — 책임 분리가
  적절하다(가드 자체는 이미 다른 파일에서 실제 데이터로 검증됨). `execution-engine.service.spec.ts`의
  `handlerRegistry`는 실제 인스턴스(mock 아님)라 `getMetadata` 판정이 현실적이다.
- **테스트 격리**: `handlerRegistry`/`mockNodeRepo`/`mockNodeExecutionRepo` 모두 outer
  `beforeEach`에서 매 테스트 재생성(L239 이하) — `jest.spyOn`/직접 재할당이 다음 테스트로
  누수되지 않는다. `hooks.service.spec.ts`도 `moduleRef`가 top-level `beforeEach(async () =>
  {...})`로 매 테스트 재구성돼 동일하게 안전.
  `waiting-surface-guard.spec.ts`는 외부 상태가 전혀 없는 순수 함수 테스트라 격리 이슈 없음.
- **테스트 가독성**: 세 파일 모두 한글 주석으로 "왜 이 값을 이렇게 무장하는지", "재현된 결함이
  무엇인지"를 상세히 남겨 의도 파악이 쉽다. `armWaitingSurface`/`armStaticFormSurface` 같은
  헬퍼 추출로 반복 축소.
- **테스트 용이성**: `resolveWaitingSurface`/`isCommandAllowedOnSurface`/
  `readPersistedInteractionType`를 순수 함수로 분리한 설계(`waiting-surface-guard.ts`)가
  결정 로직을 서비스 의존성 없이 격리 테스트 가능하게 만든 좋은 예. 다만 위에서 지적했듯
  `resumeTurnRegistry`는 여전히 서비스에 `this`-bound 돼 있어 `parkEntryRegistry`(독립 factory)
  수준의 단위 테스트 용이성에 못 미친다(기존 부채, 이 PR 범위 밖).
- **회귀 테스트**: 표면 매트릭스(`SURFACE_ALLOWED_COMMANDS`)에 대한 완전성 테스트("모든 표면이
  매트릭스에 등재 + 알려진 명령만 나열")가 미래 표면 추가 시 매트릭스 갱신 누락을 hard-fail
  시키는 좋은 가드. 다만 위 WARNING(버튼 e2e 부재)이 회귀 커버리지의 실질적 구멍이다.

## 요약

표면 가드(`waiting-surface-guard.ts`)와 그 서비스 통합(`assertCommandMatchesWaitingSurface`)은
순수 함수 unit(`waiting-surface-guard.spec.ts`) + 서비스 레벨 unit(`execution-engine.service.spec.ts`
신규 describe 블록, 11개 케이스) 두 층위로 촘촘히 검증되며, 오케스트레이터가 우려한 "공용 mock
기본값 변경으로 인한 vacuous 화"는 실제 코드 추적과 전체 스위트 실행(392/392, 138/138 전부
통과)으로 **발생하지 않았음을 확인**했다. `armSlowPathResume`도 하드코딩이 아니라 실제 park
로직이 만든 페이로드를 재생하는 방식이라 form/buttons/ai 세 경로를 비-vacuous 하게 커버한다.
유일하게 실질적인 갭은 **buttons 표면의 "엉뚱한 continue 포트 분기" 회귀가 e2e 로 증명되지
않는다는 점**이다 — form 표면 e2e 하나만 추가됐는데, 하필 form 은 DB JSONB 왕복이 필요 없는
표면이라 buttons/ai 표면이 의존하는 실제 영속-복원 경로는 어떤 e2e 로도 검증되지 않은 채
남는다. WS/REST 진입점의 신규 거부는 기존 제네릭 에러 매핑 테스트로 간접 커버돼 리스크가
낮다. 그 외에는 로그 메시지 정확성·registry 대칭 테스트 범위 등 경미한 INFO 수준 지적뿐이다.

## 위험도

MEDIUM — 핵심 로직은 견고하게 테스트됐으나, 이 PR 이 고치는 원 결함 두 건 중 하나(buttons
엉뚱한 포트 분기)의 e2e 회귀 증명이 빠져 있어 실제 프로덕션 환경(DB JSONB 왕복 포함) 재현
신뢰도가 완전하지 않다. merge 를 막을 정도는 아니나 후속 e2e 추가를 권장한다.
