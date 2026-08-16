# 성능(Performance) 리뷰

## 대상 요약

실질 코드 diff 는 6개 파일(총 +557/-14): `redact-stored-error.ts`(신규) ·
`redact-stored-error.spec.ts`(신규) · `executions.service.ts` ·
`executions.service.spec.ts` · `background-runs.service.ts` ·
`background-runs.service.spec.ts`. 나머지(`.claude/docs/plan-lifecycle.md`,
`CHANGELOG.md`, `plan/**`, `review/**`)는 문서/plan 산출물이라 실행 경로에 영향이 없다.

변경 성격은 DB `Execution.error`/`NodeExecution.error` (jsonb) 컬럼 값을 **응답 egress
시점**에 정규식 기반 자격증명 마스킹(`deepRedactSecrets` 위임)으로 가리는 것이다. 이 리뷰는
`git diff origin/main...HEAD` 로 재확인한 최종 코드(직전 라운드 `17_12_34` performance W1 —
"uncapped 배열 무조건 spread" — 수정 반영 후) 기준이다.

## 발견사항

- **[INFO]** (긍정 관찰, 조치 불요) 직전 라운드(`17_12_34` performance W1)에서 지적된
  "`nodeExecutions` uncapped 배열에 무조건 spread" 가 copy-on-change 로 올바르게 수정됨
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:627-636`
    (`findById` 내부 `reconciledNodeExecutions` 조립부)
  - 상세: `manager.find(NodeExecution, ...)` 조회에는 `take` 상한이 없어(자매
    `ExecutionNodeLog` 조회와 달리) 대규모 ForEach 실행에서 행 수가 커질 수 있다. 수정된
    코드는 `ne.error == null ? ne : {...ne, error: redactStoredErrorForResponse(ne.error)}`
    형태로, **실패 행에 대해서만** 얕은 복사를 수행하고 성공 행(절대다수)은 원본 참조를
    그대로 반환한다. 자매 함수 `reconcilePreParkWaitingStatus` 의 copy-on-change 관례와
    이제 일치하며, 알고리즘 비용이 O(전체 행 수) 가 아니라 O(실패 행 수) 로 제한된다.
  - 제안: 없음 — 이미 올바르게 수정됨.

- **[INFO]** `toResponseExecution` 이 구조분해 이후 객체를 한 번 더 spread 해 얕은 복사가
  두 번 발생 — 미미하나 회피 가능
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:970-976`
    (`private toResponseExecution`)
  - 상세: 종전 `stripPrivateRelations` 는 `const { trigger, executor, ...rest } = execution;
    return rest as Execution;` 로 스프레드 1회였다. 신규 코드는 같은 구조분해에 이어
    `return { ...rest, error: redactStoredErrorForResponse(rest.error) };` 로 **두 번째
    얕은 복사**를 추가한다. `findById`/`stop`(단건 응답)에서는 필드 수(~20여 개)에 비례하는
    무시할 수준의 오버헤드지만, `getChain`(`rows.map((e) => this.toResponseExecution(e))`,
    상한 없는 `getMany()`)처럼 다건 응답에서는 체인 길이만큼 누적된다.
  - 제안: `const { trigger: _t, executor: _e, error, ...rest } = execution; return { ...rest,
    error: redactStoredErrorForResponse(error) };` 로 `error` 를 구조분해 시점에 함께
    꺼내면 스프레드 1회로 줄일 수 있다. 다만 실질 영향은 미미해 필수 조치는 아니다.

- **[INFO]** 정규식 기반 마스킹(`deepRedactSecrets`)의 호출 지점이 5곳으로 확장됐으나 각각
  유계(bounded) 경로라 누적 비용은 낮음
  - 위치: `executions.service.ts` — `toExecutionDto`(목록, 926줄) ·
    `findById`(nodeExecutions map, 634줄) · `toResponseExecution`(974줄, `findById`/`getChain`/
    `stop` 공용) / `background-runs.service.ts:302`(body 노드 페이지)
  - 상세: `redactStoredErrorForResponse` 는 `err == null` 이면 즉시 반환하고, 값이 있어도
    문자열 길이에 선형인 6개 정규식을 순차 적용하는 정도다. 호출 규모는 `findByWorkflow`
    페이지네이션(기본 `limit=20`), `background-runs` 의 `NODE_EXECUTIONS_MAX_LIMIT=200`
    으로 상한이 걸려 있어 요청당 비용이 유계다. `deepRedactSecrets` 내부 `DEEP_REDACT_CACHE`
    (WeakMap, depth-0 캐시)는 요청마다 새로 조회되는 엔티티 객체라 적중하지 않지만, 응답
    egress 시점 1회성 연산이라 캐시 미적중이 실질 문제는 아니다.
  - 제안: 조치 불요. 다만 향후 `getChain`(체인 길이 상한 없음) 이나 대규모 재실행 체인이
    실제로 관측되면(현재는 재실행 사용자 조작 빈도로 자연 유계) `take` 상한 도입을 검토할
    여지는 남아 있다 — 이번 diff 의 범위는 아니다.

- **[INFO]** 진행 중(RUNNING) 실행은 `SNAPSHOT_CACHE`/`writeSnapshotCache` 대상이 아니라
  폴링·WS 재연결마다 `findById` 전체가 재계산됨 — 이 diff 가 새로 만든 비용이 아니라
  기존 캐시 정책의 연장
  - 위치: `executions.service.ts:592-636` (`findById` 트랜잭션 블록, 코드 주석에 명시)
  - 상세: 실패 노드가 있는 실행은 폴링마다 `redactStoredErrorForResponse` 가 재실행되지만,
    (a) 실패 노드에 한정된 O(실패 행 수) 비용이고 (b) RUNNING 상태는 데이터가 계속
    바뀌므로 애초에 캐싱 대상이 아니다(캐시했다면 stale 응답 위험). 코드 주석이 이 트레이드
    오프를 이미 명시적으로 인지하고 있다.
  - 제안: 조치 불요 — 캐싱 불가 사유가 정당하다.

## 요약

이번 변경은 알고리즘적으로 새로운 N+1, 블로킹 I/O, 캐시 무효화 문제를 도입하지 않는다.
핵심 위험(uncapped `nodeExecutions` 배열에 무조건 spread)은 직전 리뷰 라운드에서 이미
포착돼 copy-on-change 로 정확히 수정된 상태이며, 모든 신규 마스킹 호출 지점은 페이지네이션
또는 조기 null 반환으로 유계다. 유일한 잔여 관찰은 `toResponseExecution` 의 이중 spread(미미,
선택적 최적화)와, 향후 `getChain` 체인 길이가 커질 경우를 대비한 `take` 상한 검토 여지뿐이며
둘 다 이번 PR 의 필수 차단 사유는 아니다.

## 위험도

LOW
