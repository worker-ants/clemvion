# 신규 식별자 충돌 검토 — §8 admission regression 테스트 보강 (TEST-ONLY)

## 검토 대상 및 제약

계획된 작업은 "§8 admission gate 회귀 커버리지를 위한 TEST-ONLY 신규 테스트명/헬퍼" 추가로 기술되었으나, 오케스트레이터가 전달한 `naming_collision.md` payload 는 `--impl-prep`(scope=`spec/5-system/`) 범용 컨텍스트 번들(`1-auth.md`, `10-graph-rag.md` 전문 + `0-overview.md`/`1-data-model.md`/여러 `plan/in-progress/*.md`/cafe24 API 카탈로그 발췌 등)이며, admission gate 회귀 테스트 작업 자체에 특화된 신규 식별자 목록(구체적 `describe`/`it`/helper 함수명 초안)은 포함되어 있지 않다. 따라서 본 검토는 (a) payload 에 명시된 §8 admission gate 관련 기존 식별자, (b) 저장소 내 실제 §8 admission gate 테스트 자산(`execution-concurrency-cap.e2e-spec.ts`, `execution-engine.service.spec.ts`, `test/helpers/*`)을 기존 사용처 기준선으로 교차 검증한 결과다. 계획 단계에서 구체적 신규 이름 목록이 확정되면 그 목록을 대상으로 한 재검토를 권장한다(아래 요약 참고).

## 발견사항

- **[INFO]** admission gate 관련 신규 테스트는 이미 존재하는 §8 e2e 파일에 준하는 명명 컨벤션을 따라야 함
  - target 신규 식별자: (미확정 — planned) 새 `it(...)` 케이스명, 새 helper 함수명
  - 기존 사용처: `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts:38` `describe('동시성 cap admission gate (e2e, PR2b §8)', ...)`, 동 파일의 `createCapWorkflow`(:61)·`insertRunningBlocker`(:117)·`execute`(:127)·`getStatus`(:137)·`poll`(:147)
  - 상세: 이 파일은 PR2b(#800/#801, 이미 main 병합)로 §8 admission gate(동시성 cap + 5분 queue-wait cancel)의 happy-path 2개 시나리오만 커버한다. "admission regression 보강"이 이 파일에 케이스를 추가하는 방향이라면, `poll`/`execute`/`getStatus`/`createCapWorkflow` 등은 이미 파일 스코프 내 정의돼 있으므로 동일 파일 내에서 중복 선언하면 컴파일 에러(TS2451: Cannot redeclare block-scoped variable)가 난다. 반대로 새 별도 e2e 파일(예: `execution-admission-*.e2e-spec.ts`)을 만드는 방향이라면, `poll` 이라는 이름은 `execution-crash-redrive.e2e-spec.ts:92`, `execution-park-resume.e2e-spec.ts:102`·`:567`, `execution-stalled-redelivery.e2e-spec.ts:90` 에도 각각 독립적으로 이미 존재한다 — 이는 파일별 `describe` 클로저 내부 지역 함수라 이름이 겹쳐도 실제 충돌은 없는, 이 코드베이스의 확립된 관행이다. 다만 신규 파일이 기존 파일과 `import`/`export` 관계 없이 동일 패턴(`poll`, `execute`, `getStatus`)을 재사용하는 것은 문제 없으나, 만약 이 helper 들을 `test/helpers/` 로 승격(export)하려는 계획이 있다면 이름이 지금 5개 e2e 파일에 정의된 동명 지역 함수와 시그니처가 다를 수 있어 승격 시 실제 충돌(동일 파일 스코프에서 로컬 선언 vs import 혼용)이 발생할 수 있다.
  - 제안: (1) 기존 `execution-concurrency-cap.e2e-spec.ts` 에 케이스를 추가한다면 새 `it(...)` 설명 문자열만 추가하고 기존 helper 함수명 재사용, 신규 helper 가 필요하면 `createCapWorkflow`/`insertRunningBlocker` 와 구분되는 명확한 이름(예: `insertQueuedPeer`, `createCapWorkflowWithPriority` 등) 사용. (2) 별도 파일로 분리한다면 파일명은 `execution-admission-*` 접두를 피하고 기존 컨벤션(`execution-concurrency-cap-*` 또는 `execution-admission-regression.e2e-spec.ts`)을 명시적으로 `execution-concurrency-cap.e2e-spec.ts` 와 구분되게 짓는다. (3) helper 공용화 계획이 있다면 `test/helpers/` 로 승격 전 기존 5개 e2e 파일의 지역 `poll` 구현 차이(타임아웃 파라미터·predicate 시그니처)를 통합 검토.

- **[INFO]** `describe` 블록 제목의 "§8" 표기 일관성
  - target 신규 식별자: (미확정 — planned) 새 `describe(...)` 블록 제목
  - 기존 사용처: `execution-concurrency-cap.e2e-spec.ts:38` `describe('동시성 cap admission gate (e2e, PR2b §8)', ...)`
  - 상세: 기존 파일은 "PR2b §8" 를 describe 제목에 명시해 spec 섹션 추적성을 확보했다. 신규 회귀 테스트가 동일 §8 을 다루면서 다른 PR 라벨(예: 없음 또는 "PR5")을 붙이면 나중에 §8 관련 테스트를 grep 할 때 파편화될 수 있다. 실질적 "충돌"은 아니며 명명 일관성 이슈.
  - 제안: 신규 describe 제목에도 `§8` 앵커와 어떤 PR/plan 산출물인지 식별 가능한 라벨을 유지 — 예: `describe('동시성 cap admission gate 회귀 — 추가 시나리오 (e2e, §8)', ...)`.

- **[INFO]** 에러 코드/상태 문자열은 신규 도입 없이 재사용 확인
  - target 신규 식별자: 없음(재사용 예상) — `EXECUTION_QUEUE_WAIT_TIMEOUT`, `'pending'`/`'running'`/`'cancelled'`/`'completed'` 상태값
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2551` (`const code = 'EXECUTION_QUEUE_WAIT_TIMEOUT';`), `spec/5-system/4-execution-engine.md §8`(payload 에는 본문이 직접 포함되지 않았으나 payload 내 여러 교차참조 라인 — 예: L2237, L2241, L2244 — 에서 동일 앵커로 재확인됨)
  - 상세: TEST-ONLY 작업이 새 에러 코드나 새 status enum 값을 도입하는 것이 아니라 기존 값을 assertion 에 재사용하는 것이라면 충돌 우려 없음. 다만 만약 "회귀 커버리지" 확장 과정에서 새로운 admission 관련 에러 코드(예: `EXECUTION_CAP_EXCEEDED` 류)를 테스트가 기대하도록 계획한다면, 이는 spec 미정의 코드이므로 별도로 spec 쪽(`4-execution-engine.md §8`)에 먼저 정의되어야 하며 test-only 로 임의 신설하면 스펙-구현 불일치가 생긴다.
  - 제안: 테스트가 새 에러 코드/상태를 assert 하는 경우, 이는 이미 "TEST-ONLY" 범위를 벗어나므로(spec 신설 필요) 사전에 project-planner 트랙으로 전환할 것.

## 요약

이번 검토에서 전달된 payload 는 실제로는 §8 admission gate 회귀 테스트 작업에 특화되지 않은 `spec/5-system/` 전체 impl-prep 컨텍스트 번들이라, target 이 도입할 구체적 신규 식별자(테스트명·helper명) 목록 자체가 확인되지 않았다. 저장소의 기존 §8 admission gate 관련 테스트 자산(`execution-concurrency-cap.e2e-spec.ts` 및 그 내부 `createCapWorkflow`/`insertRunningBlocker`/`execute`/`getStatus`/`poll` 지역 helper, 그리고 4개의 다른 e2e 파일에 독립적으로 존재하는 동명 `poll` 패턴)을 기준선으로 볼 때, "TEST-ONLY" 로 §8 회귀 케이스를 추가하는 작업 자체는 CRITICAL 급 식별자 충돌 소지가 낮다 — 기존 관행(파일별 지역 스코프 helper 재사용, `describe` 제목에 `§8` 라벨 유지)만 따르면 된다. 다만 helper 공용화(export 승격)나 새 에러 코드/상태 도입이 동반될 경우 스펙과의 정합성 재검토가 필요하다.

## 위험도

LOW

---

BLOCK: NO
