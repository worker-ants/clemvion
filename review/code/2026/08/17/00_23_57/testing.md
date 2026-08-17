# 테스트(Testing) 리뷰 — EIA 값-패턴 마스킹 후속 (`outputData` 확장 + `inputData` 철회)

## 검증 방법

- `git diff f5351e9c2..HEAD` 로 truncated 프롬프트 대신 전체 diff 를 직접 확인.
- `npx jest` 로 영향받은 5개 스위트(`executions.service.spec.ts`,
  `background-runs.service.spec.ts`, `websocket.service.spec.ts`,
  `redact-stored-error.spec.ts`, `sanitize-error-message.spec.ts`) 전체 실행 —
  **184/184 PASS**.
- Mutation 검증: `background-runs.service.ts` 의
  `outputData: redactStoredDataForResponse(row.outputData)` 를
  `outputData: row.outputData` 로 되돌려 관문을 제거 → 새로 추가된
  `body nodeExecutions[] 의 outputData 는 마스킹하고 inputData 는 원문 유지` 테스트가
  즉시 RED (`sk-live-abc123` 노출 검출). 이 테스트가 vacuous 하지 않음을 확인 후 원복,
  `git status` 로 원복 완전성 확인.

## 발견사항

- **[INFO]** 성능 주장(CHANGELOG "emit 당 순회 2→3회, N=3000 실측 0.0181→0.0323ms")을
  고정하는 자동 회귀 테스트가 없다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` —
    `값-패턴 마스킹 — emit 두 경로 × wire·fanout` describe 블록 (기능 테스트만 있고
    perf 벤치는 없음)
  - 상세: 수치는 CHANGELOG.md 서술로만 존재하고 코드로 pin 되어 있지 않다. 절대값이
    작아(0.03ms) 실사용 영향은 미미하지만, 향후 `deepRedactSecretsPreserving` 이
    더 무거워질 경우(예: `preserveKeys` 하위 트리 판정 로직 확장) 이 수치가 조용히
    깨져도 감지할 안전망이 없다.
  - 제안: 필수는 아니나, `it.skip`/`test.concurrent` 없이도 대략적 상한(예:
    "N=3000 이벤트가 Xms 이내")을 서브프로세스나 넉넉한 여유(safety margin)로 고정하는
    스모크 테스트를 고려. 다만 이 저장소의 기존 관례(perf 는 리뷰 서술로만 고정한 사례 다수)를
    벗어나지 않는 선택도 합리적이다.

- **[INFO]** `llmCalls` wire 보존(`WIRE_PRESERVED_FIELDS`)이 `emitExecutionEvent` 경로로만
  테스트되고 `emitNodeEvent` 경로에서는 별도로 검증되지 않는다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:1061` 부근 —
    `it('llmCalls 는 wire 에서 원문 유지 — 에디터 디버깅 탈출구 (strip-only 결정 보존)', ...)`
    (`emitExecutionEvent` 만 호출)
  - 상세: 두 emit 이 `maskWireEnvelope` 라는 동일 private 메서드를 공유하므로 로직 자체는
    한 번 검증으로 충분하지만, 이 저장소가 반복해 겪은 *"자매 넷 중 하나만"* 패턴을
    감안하면 `emitNodeEvent` 쪽에서 향후 별도 분기가 생겨도 이 테스트만으로는 못 잡는다.
    같은 describe 안의 다른 테스트들(①~④)은 두 emit × wire·fanout 네 조합을 모두
    각각 겨누는데, `llmCalls` 보존과 마커 비-재마스킹 테스트 두 개만 `emitNodeEvent`
    쪽 짝이 없다.
  - 제안: 대칭성이 필요하면 `emitNodeEvent` 에도 동일 `llmCalls` 보존 케이스 1건 추가.
    위험도가 낮아 필수는 아님(공유 private 메서드이고 두 emit 모두 `this.maskWireEnvelope`
    를 통일된 방식으로 호출하는 것을 이미 코드로 확인함).

- **[INFO]** `maskIfPresent` (executions.service.ts) 의 `value == null` 방어 분기 —
  JSDoc 은 "TypeORM 이 런타임에 `undefined` 를 줄 수 있는 경로에 대한 방어"라고 명시하지만,
  테스트 fixture 는 전부 명시적 `null` 만 쓰고 리터럴 `undefined` 컬럼 값으로 이 분기를
  겨누는 케이스는 없다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` —
    `maskIfPresent` 함수, `codebase/backend/src/modules/executions/executions.service.spec.ts`
    의 `outputData 응답 마스킹` describe
  - 상세: `== null` 은 `null`/`undefined` 를 동일하게 처리하므로 기능적으로는 이미
    `null` 케이스로 그 분기가 실행되고 있어 실질적 커버리지 갭은 아니다(같은 코드 경로).
    다만 JSDoc 이 명시적으로 "TypeORM 이 undefined 를 줄 수 있다"는 런타임 관찰을
    근거로 들고 있는 만큼, 그 구체적 시나리오(엔티티 필드가 실제로 `undefined`)를
    fixture 로 한 번 지정해 두면 문서의 주장과 테스트가 1:1 대응해 더 명확해진다.
    현재도 fail-safe 하지 않을 이유는 없어 등급을 INFO 로 둔다.

## 강점 (참고)

- `redactStoredDataForResponse`(신설) 가 자매 `redactStoredErrorForResponse` 와
  **동일 항목 세트**(값 마스킹·중첩 키·null 정규화·비변이·copy-on-change·마커 보존
  캐너리·잔여 갭 캐너리·무손상 캐너리)를 각각 별도로 겨눠, 이 저장소가 반복 지적받은
  "자매 함수 중 하나만 테스트" 패턴을 구조적으로 피했다.
- `executions.service.spec.ts` 의 `⑥-b copy-on-change` 테스트는 값 비교가 아니라
  **참조 동일성**(`toBe`)으로 판정해, `outputData === ne.outputData` 항이 빠지는
  뮤턴트를 잡을 수 있게 설계됨 (RESOLUTION.md 기록상 실제 뮤테이션 검증까지 거침).
  `inputData` 만 leaky 한 행을 섞어 "비대상 컬럼은 복제되지 않는다"는 회귀 캐너리
  역할도 겸함 — 이 컬럼에 관문이 실수로 다시 붙으면 이 단언이 즉시 RED.
- `outputData` 마스킹 대상 확장과 `inputData` 비대상 결정이 **양방향**으로 각 표면에서
  고정되어 있다(예: `findById`·`findByWorkflow`·`getChain`·`stop`·`nodeExecutions[]`
  전부에서 "outputData 는 `***`, inputData 는 원문" 을 동시에 단언) — 재제출 경로
  보호라는 CRITICAL 결정이 한쪽만 테스트되어 조용히 뒤집힐 위험을 낮췄다.
- WS 스위트는 두 emit(`emitExecutionEvent`/`emitNodeEvent`) × 두 채널(wire/fanout)
  네 조합을 개별 `it` 으로 명시적으로 겨눠, 공유 헬퍼를 하나만 테스트해 다른 한쪽의
  호출 누락을 놓치는 이 저장소의 반복 결함 패턴을 피했다.
- `deepRedactSecretsPreserving` 의 캐시 비공유 테스트(같은 객체를 두 모드로 불러도
  서로 오염 안 됨)는 `WeakMap` 공유로 인한 은닉 버그를 정확히 겨눈 회귀 테스트.
- 마스킹 마커(`[REDACTED]`/`[REDACTED_DEPTH]`) 보존 계약이 3개 레이어(sanitize-error
  -message 유닛, redact-stored-error 유닛, websocket 통합)에서 각각 캐너리로
  고정되어 12-webhook §5.3 계약 위반을 어느 레이어에서 깨도 잡을 수 있다.
- 테스트 격리: 각 스위트 `beforeEach` 에서 mock/서비스 인스턴스를 매번 재생성하고,
  fixture 는 전부 팩토리 함수(`baseFake`/`makeBgNodeExec`/`makeBodyNodeExec`)로
  매 호출 새 객체를 반환해 테스트 간 상태 공유가 없다. `.only`/`.skip` 잔존 없음.
  실행 순서 의존성도 확인되지 않음.
- Mock 적절성: TypeORM QueryBuilder 체이닝(`leftJoin`/`where`/`orderBy`/`take`/
  `getMany`/`getRawOne` 등)을 실제 서비스 호출 순서와 일치시켜 목업했고, 값 자체가
  아니라 서비스가 실제로 관문(마스킹 함수)을 통과시키는지를 검증하는 데 집중해
  mock 이 실제 동작과의 괴리를 만들지 않는다.

## 요약

`Execution.error` 옆에 방치돼 있던 `outputData`/`inputData` 컬럼 마스킹(그리고 `inputData`
는 재제출 경로 보호를 위해 최종적으로 마스킹 대상에서 철회)이라는, 결정 자체가 두 번
뒤집힌 민감한 변경임에도 테스트가 그 뒤집힌 결정을 방향별로 정확히 반영해 양방향(마스킹
되어야 하는 것 / 되면 안 되는 것)을 각 표면·각 emit 경로마다 개별적으로 고정하고 있다.
mutation 검증으로 새 테스트가 실제로 관문 제거를 감지함을 직접 확인했고, 전체 스위트가
그린이며 격리·가독성·회귀 방지 설계가 이 저장소가 과거 반복 지적받은 결함 클래스
(자매 표면 중 하나만 테스트·vacuous 부정 단언·마커 재마스킹)를 정확히 겨냥해 막고 있다.
남은 갭은 전부 INFO 수준(perf 회귀 자동화 부재, `emitNodeEvent` 쪽 `llmCalls` 보존
비대칭 테스트, `undefined` 리터럴 fixture 부재)이며 기능적 위험은 낮다.

## 위험도

LOW
