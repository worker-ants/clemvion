# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** dispatch loop 전역 가드가 3곳에 물리적으로 복제되어 있고, 이번 커밋이 그 복제 패턴을 한 단계 더 늘렸다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1638`(`runNodeDispatchLoop`), `:3729`(`executeInline`), `:4261`(`runExecution`) — 세 곳 모두 동일한 `await this.assertExecutionNotCancelled(executionId);` 한 줄 + 동일한 한글 주석
  - 상세: 세 개의 `while (pointer < sortedNodeIds.length)` 루프는 이미 이전부터 서로 다른 물리적 코드 사본이었다(`nodeMap`/`subNodeMap` 등 변수명만 다를 뿐 "reachable 체크 → maxNodeIterations → disabled skip → dispatch" 골격이 동일). 이번 diff는 새 불변식(외부 cancel 체크)을 그 세 사본 각각에 손으로 넣어야 했고, 작업 지시에 적힌 대로 "처음 1곳만 넣었을 때 테스트가 RED로 남아서" 발견됐다 — 즉 복제 자체가 이미 한 번 실제 결함(가드 누락)을 유발했다. 앞으로 노드 경계마다 강제해야 할 새 불변식이 또 생기면 동일한 실수가 재발할 구조적 위험이 남아있다.
    같은 클래스 안에 이 문제를 다루는 두 가지 선례가 이미 존재한다: (1) `runNodeDispatchLoop` 자체가 과거 `resumeFromCheckpoint`/`resumeGraphAfterRetry` 두 곳의 ~175줄 중복을 추출해 만든 결과물이다(`:1567` 주석, PR #365). (2) park 진입 if/else 로직은 정확히 이 3곳(`runNodeDispatchLoop`·`executeInline`·`runExecution`)을 대상으로 `dispatchParkEntry`/`buildParkEntryRegistry` 단일 호출로 통일한 선례가 있다(`plan/complete/refactor/02-architecture.md:221`). 반대로 노드 단위 task-queue로의 전면 통합은 "엔진 재작성급, 고위험"이라는 이유로 명시적으로 기각된 바 있다(`plan/complete/spec-draft-exec-intake-queue.md:147`). 즉 "3개 루프 전체를 하나로 합치는 것"은 이 팀이 이미 시도해보고 위험하다고 판단한 범위이지만, "매 반복 진입부에서 호출하는 가드 시퀀스를 단일 지점으로 묶는 것"은 성공한 선례가 있는 더 작은 범위다.
  - 제안: 이번 변경 자체를 되돌릴 필요는 없다(스코프가 크고, mutation 검증으로 3곳 모두 실제로 걸리는지 이미 확인됨 — `plan/in-progress/node-cancellation-residual-signal-propagation.md:85`). 다만 "노드 경계 진입부 가드 시퀀스"를 단일 헬퍼로 승격하는 후속 작업을 백로그에 남기는 것을 권한다. 다만 `executeInline`은 `assertActiveTimeWithinLimit`를 호출하지 않는 비대칭이 diff 이전부터 있었으므로(`:3726` 주변에는 이 가드가 없음), 단순히 두 가드를 하나로 묶는 헬퍼를 만들면 그 비대칭을 그대로 옮기거나(의도 보존) 아니면 의도치 않게 없애버릴(동작 변경) 위험이 있다 — 통합 전에 그 비대칭이 의도된 것인지부터 확인이 필요하다.

- **[WARNING]** 새 메서드 JSDoc의 비용 설명이 실제 구현과 다르다 — "단일 컬럼 SELECT"라고 적었지만 실제로는 전체 row(JSONB 포함)를 읽는다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7787`(주석) vs `:7799`(구현)
  - 상세: JSDoc은 "**비용.** 노드 경계마다 PK 인덱스 SELECT 1건(**status 단일 컬럼**)"이라고 명시하지만, 실제 구현은 `this.executionRepository.findOneBy({ id: executionId })`로 TypeORM의 기본 `findOneBy`를 쓴다. `findOneBy`는 컬럼을 좁혀 select하지 않고 엔티티의 전체 컬럼을 가져온다 — `Execution` 엔티티에는 `input_data`/`output_data` 등 대용량일 수 있는 `jsonb` 컬럼이 포함돼 있다(`codebase/backend/src/modules/executions/entities/execution.entity.ts:74,77`). 이 패턴 자체는 파일 안에서 이미 여러 번 쓰이는 기존 관용구라 새 문제는 아니지만(`:545`, `:1188`, `:3192` 등도 동일하게 `findOneBy({id})` 사용), 이 메서드의 JSDoc만 "단일 컬럼이라 저렴하다"는 더 구체적이고 실제보다 낙관적인 주장을 하고 있다. 이 클래스는 문서 정확성에 대한 기준이 높은 편이라(예: W3 SECURITY 주석들처럼 노출 범위를 세밀하게 구분), 이 부정확함은 향후 성능 분석이나 디버깅 시 잘못된 전제를 심어줄 수 있다.
  - 제안: 주석의 "status 단일 컬럼" 표현을 삭제하거나("PK 인덱스로 row 1건 조회, 노드 경계마다") 실제로 `select`를 좁혀 주석과 구현을 일치시킨다(예: `createQueryBuilder`에 `.select(['execution.status'])` 또는 raw `query`).

- **[INFO]** 구조적으로 동일한 "가드 후 throw" 메서드 두 개가 로그 레벨을 다르게 쓴다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7801`(`assertExecutionNotCancelled` → `logger.log`) vs `:7764`(`assertActiveTimeWithinLimit` → `logger.warn`)
  - 상세: 두 메서드는 이름 규약(`assert*`)·호출 위치(같은 3개 루프의 노드 경계)·역할(불변식 위반 시 throw로 dispatch를 중단)이 사실상 동일한 패턴인데, 하나는 `warn`, 다른 하나는 `log`(info)를 쓴다. 취소는 사용자가 의도한 정상 흐름이라 `log`가 적절하다는 해석도 가능하지만, 그 판단 근거가 주석에 명시돼 있지 않아 다음 사람이 "왜 다르지?"를 다시 조사해야 한다.
  - 제안: 의도적 구분이면 한 줄 주석으로("취소는 사용자 의도 흐름이라 warn 대신 log") 근거를 남기고, 아니면 레벨을 통일한다.

- **[INFO]** e2e 신규 대기 구간의 매직 넘버가 파일의 기존 관례(명명된 상수 + 근거 주석)를 따르지 않는다
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:319` — `await new Promise((r) => setTimeout(r, 2_000));`
  - 상세: 같은 파일은 타이밍 관련 리터럴을 최상단에 명명 상수로 뽑고 그 값을 고른 이유까지 문서화하는 관례를 갖고 있다(`INFLIGHT_WINDOW_MS = 5_000`, `:73` 및 그 위 JSDoc — "5초인 이유: ..."). 반면 이번에 추가된 `2_000`은 인라인 리터럴로만 남아 있고, 바로 위 주석은 "왜 기다려야 하는가"는 설명하지만 "왜 2초인가"(1초로는 부족한가? 5초는 과한가?)는 설명하지 않는다. 같은 파일 안에서 두 가지 다른 관례가 섞여 있는 셈이다.
  - 제안: `DISPATCH_SETTLE_WINDOW_MS` 같은 이름으로 상수화하고, `INFLIGHT_WINDOW_MS` 주석 스타일에 맞춰 "왜 2초인가"를 한 줄 덧붙이면 파일 내 일관성이 회복된다. 차단 사유는 아님(값 자체는 합리적이고 주석도 충분한 맥락을 준다).

- **[INFO]** 신규 유닛 테스트가 파일 안에서 이미 확립된 `flushPromises()` 2연속 호출 관용구를 근거 주석 없이 사용
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4964-4965`
  - 상세: `await flushPromises(); await flushPromises();` 2연속 호출은 이 스펙 파일에서 이미 여러 곳(예: `:4541`, `:4800`, `:5020` 등)에 등장하는 기존 관용구이므로 새 패턴을 도입한 것은 아니다. 다만 새 테스트에는 "왜 두 번인가"에 대한 주석이 없다 — 다른 곳도 대부분 그렇긴 하지만, 이 테스트는 바로 위에 `flushResumeDrive`의 상세한 타이밍 설명(`:92-99`)이 있는 파일이라 대비가 눈에 띈다.
  - 제안: 선택 사항. 굳이 고치지 않아도 기존 스타일과 일치한다.

## 유지보수성 관점 답변 — 3곳 순회 루프 복제를 어떻게 다룰지

이 복제는 **이번 diff가 새로 만든 문제가 아니라, 이미 존재하던 아키텍처적 부채를 이번 diff가 다시 노출시킨 것**이다. 근거는 세 가지다.

1. 이 클래스는 정확히 같은 3-사이트 패턴(`runNodeDispatchLoop`·`executeInline`·`runExecution`)에 대해 이미 한 번 통합을 성공시킨 이력이 있다(`dispatchParkEntry` 레지스트리, `plan/complete/refactor/02-architecture.md:221`). 즉 "3곳에 흩어진 분기 로직을 단일 호출로 묶는다"는 접근 자체는 이 팀에게 낯설지 않고 검증된 방법이다.
2. 반대로 "3개 루프 몸체 자체를 완전히 하나로 합친다"(즉 `runExecution`/`executeInline`이 `runNodeDispatchLoop`를 직접 호출하도록 바꾼다)는 훨씬 큰 범위이며, 이는 노드 단위 task-queue 전면 재설계 검토에서 "엔진 재작성급, 고위험"으로 명시적으로 기각된 방향과 맞닿아 있다(`plan/complete/spec-draft-exec-intake-queue.md:147`). 지금 당장 이 리팩터를 이번 버그 수정 PR 범위에 넣는 것은 과도하다.
3. 반면 이번 diff가 보여준 실제 비용은 "노드 경계마다 강제해야 할 새 불변식이 생길 때마다 3곳을 손으로 동기화해야 하고, 하나라도 빠뜨리면 테스트가 잡아줄 때까지 모른다"는 것이다. 이 비용은 이미 한 번(이번 PR 작업 중) 현실화됐다.

따라서 권장하는 처리는 "지금 당장 전체 통합"도 "방치"도 아니라, **중간 크기의 후속 작업**이다 — 세 루프의 "몸체"는 그대로 두되, 매 반복 진입부에서 실행하는 가드 시퀀스(`assertActiveTimeWithinLimit`·`assertExecutionNotCancelled`, 그리고 미래에 추가될 것)를 단일 지점(헬퍼 메서드 또는 park-entry 선례와 같은 registry/params 패턴)으로 승격해 "새 불변식 추가 = 헬퍼 본문 1곳 수정 + 필요 시 3개 호출부에서 옵션 전달"로 좁히는 것이다. 단, `executeInline`이 `assertActiveTimeWithinLimit`를 호출하지 않는 기존 비대칭(`:3726` 부근)을 이 통합이 의도치 않게 없애거나 반대로 그대로 고착시키는 문제이므로, 통합 전에 그 비대칭이 의도된 설계인지부터 확인해야 한다. 이번 PR이 이미 수행한 mutation 검증(가드 제거 시 RED 3회 → 복원 시 GREEN 1회, `plan/in-progress/node-cancellation-residual-signal-propagation.md:85`)은 정확히 이런 종류의 누락을 잡기 위한 좋은 보완 장치이므로, 구조적 통합이 이뤄지기 전까지는 이 mutation 검증을 회귀 가드로 유지하는 것이 최소 방어선이 된다.

## 요약

핵심 변경(`assertExecutionNotCancelled` 신설 + 3개 dispatch loop 호출부 배선)은 그 자체로는 가독성·네이밍·함수 길이 모두 양호하다 — 단일 책임, 명확한 이름, 근거를 상세히 남긴 JSDoc(왜 DB를 다시 읽는지, 왜 `abortSignal`로 대체 불가한지)이 이 코드베이스의 기존 문서화 수준과 잘 맞는다. 워크플로 에러 클래스(`ExecutionCancelledError`)의 생성자를 옵셔널 message로 확장한 것도 하위 호환을 지키면서 의미를 넓히는 깔끔한 변경이다. e2e 스펙의 타이밍 수정(관측 시점을 A 종료 이후로 미룸)도 근본 원인(가짜 통과 구조)을 정확히 짚고 주석으로 남겼다. 가장 눈에 띄는 구조적 이슈는 요청받은 대로 3개 dispatch loop에 동일 가드를 복제해 넣어야 했던 부분인데, 이는 이 클래스에 이미 존재하던 아키텍처 부채이고 이번 PR이 새로 만든 것은 아니지만, 실제로 한 번 결함(가드 누락)을 유발한 만큼 후속 통합 작업으로 추적할 가치가 있다. 그 외에는 새 메서드의 비용 주석이 실제 구현(전체 row fetch)과 어긋난다는 점, 로그 레벨 비일관, e2e의 매직 넘버 정도가 경미하게 남는다.

## 위험도

LOW
