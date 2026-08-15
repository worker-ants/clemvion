# 아키텍처 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 발견사항

- **[WARNING]** 신규 raw-UPDATE 취소 경로 5곳에 동일한 "SQL 계산 바인딩 + RETURNING 파싱" 오케스트레이션이 그대로 복제됐다 (shotgun-surgery 형태)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `cancelParkedExecution`(1023행), `markWebChatIdleTimeout`(1150행 본문의 raw UPDATE 블록), `markExecutionCancelled`(2809행), `markQueueWaitTimeout`(2885행), `finalizeStalledExhausted`(3333행)
  - 상세: 5곳 모두 `const terminalFinishedAt = new Date()` 선언 → `.set({ …, durationMs: () => TERMINAL_DURATION_MS_SQL })` → `.setParameter(TERMINAL_FINISHED_AT_PARAM, terminalFinishedAt)` → `.returning([...])` → `toFiniteNumber((result.raw as …)?.[0]?.duration_ms) ?? null` 로 이어지는 8~10줄짜리 동일 시퀀스를 손으로 반복한다. 이 PR 은 이미 순수 계산부(`resolveTerminalDurationMs`)와 SQL 상수(`TERMINAL_DURATION_MS_SQL`)를 `shared/utils/terminal-duration.ts` 로 뽑아 DRY 를 적용했는데, 정작 호출부의 "파라미터 바인딩 + RETURNING 행 파싱" 오케스트레이션은 추출하지 않고 5곳에 그대로 남겨뒀다. 같은 서비스가 이미 `emitCancellationEvent`(1101행)라는 헬퍼로 취소 4경로의 `try/catch` 보일러플레이트를 단일화한 선례가 있어, 이번에도 같은 판단을 쓰기 좋은 지점이었다.
  - 제안: `bindTerminalUpdate(qb, finishedAt)` / `extractReturnedDurationMs(result)` 같은 얇은 헬퍼로 겹치는 부분만 추출한다(WHERE/andWhere 조건, SET 의 나머지 필드, 트랜잭션 유무는 호출부마다 달라 전체를 하나로 합치긴 어렵다 — 겹치는 부분만).

- **[WARNING]** raw SQL 문자열이 `Execution` 엔티티의 컬럼명을 하드코딩하면서 엔티티 정의와 타입 수준으로 연결돼 있지 않다
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:76` — `TERMINAL_DURATION_MS_SQL = 'GREATEST(0, (EXTRACT(EPOCH FROM (:terminalFinishedAt::timestamptz - started_at)) * 1000)::bigint)::int'`
  - 상세: `started_at` 컬럼명은 `execution.entity.ts:56` 의 `@Column({ name: 'started_at', … })` 매핑과 일치해야만 동작하는데, 그 관계가 코드 상 어디에도 명시돼 있지 않다 — 문자열 리터럴 두 곳이 우연히 같은 값을 쓰고 있을 뿐이다. `terminal-duration.spec.ts` 의 테스트도 `TERMINAL_DURATION_MS_SQL.toContain('started_at')` 로 상수 자기 자신만 검증할 뿐 엔티티 메타데이터와 대조하지 않는다. 컬럼이 리네임되면 컴파일은 통과하고 런타임 SQL 에러(또는 더 나쁘게, 조용한 오동작)로만 드러난다. 같은 디렉터리의 자매 유틸 `terminal-error-payload.ts` 는 순수 JS 변환만 담당해 DB 스키마와 무관한 반면, 이 파일은 "shared/utils" 관습(DB-무관 순수 함수)에 raw SQL/컬럼명이라는 데이터 레이어 지식을 섞어 넣었다 — 레이어 경계가 새고 있다.
  - 제안: 최소한 컬럼명을 `Execution` 엔티티 메타데이터(`getMetadata().findColumnWithPropertyName('startedAt')?.databaseName` 등)에서 유도하거나, 유닛 테스트에서 엔티티 메타데이터와 대조하는 assertion 을 추가해 drift 를 정적으로 잡는다.

- **[INFO]** `execution-engine.service.ts` 가 8,747줄짜리 단일 `@Injectable` 클래스로, 이번 PR 은 여기에 종결 duration 오케스트레이션 책임을 더 얹었다 (단일 책임 원칙 관점의 누적 부채)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (파일 전체)
  - 상세: admission·retry·cancellation·stalled 복구·idle timeout·이벤트 emit·이번 PR 의 duration 계산까지 한 클래스가 담당한다. 이 PR 자체가 새로 만든 문제는 아니고(추가분은 헬퍼 호출 몇 줄 수준), 저장소에 이미 추적 중인 리팩터 트랙(`plan/` 하위 refactor 시리즈)이 있는 것으로 보이는 만성 부채라 차단 사유는 아니다. 다만 이런 God-class 에 cross-cutting 로직(예: 이번 duration 계산)을 계속 얹기보다, 이미 추출된 `shared/utils/terminal-duration.ts`·`terminal-error-payload.ts` 같은 협력자를 서비스가 "소비"만 하는 방향이 장기적으로 낫다 — 이번 PR 은 그 방향을 정확히 따랐다는 점은 긍정적이다.

- **[INFO]** 테스트 파일에 공유 QueryBuilder mock 팩토리가 없어, 이번 변경(`setParameter`/`returning` 스텁 추가)이 ~18곳의 개별 리터럴 mock 객체를 손으로 고쳐야 했다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (diff 전역 — `setParameter: jest.fn().mockReturnThis()` / `returning: jest.fn().mockReturnThis()` 삽입이 반복되는 모든 지점)
  - 상세: `grep -c "update: jest.fn()"` 기준 18곳이 `{ update, set, where, andWhere, execute }` 형태의 ad-hoc 리터럴을 각자 구성하고 있고, `common/__test-utils__/`·`integrations/__test-utils__/` 어디에도 `createMockQueryBuilder()` 류의 공유 팩토리가 없다(직접 확인: `find … -iname "*mock-query-builder*"` 무결과). 이번처럼 QueryBuilder 체인에 메서드 하나를 추가하는 변경이 반복되면 매번 두 자릿수 지점을 손으로 동기화해야 한다.
  - 제안: (강제 아님) `common/__test-utils__/` 에 `createMockQueryBuilder(overrides?)` 팩토리를 도입하면 향후 같은 클래스의 변경 비용이 O(1) 로 줄어든다. 이번 PR 범위에서 굳이 요구할 정도는 아니다.

## 확인했으나 문제 없음 (긍정 평가)

- `resolveTerminalDurationMs`/`toFiniteNumber` 를 `shared/utils/terminal-duration.ts` 로 추출한 것은 직전 PR(#1170)의 `toTerminalErrorPayload` 패턴을 그대로 재사용한 일관된 설계 판단이다 — 종결 emit 16경로에 흩어질 수 있었던 로직을 단일 지점으로 모아, 이 저장소가 반복적으로 겪은 "한 곳씩 빠지는" divergence 버그 클래스(주석이 명시적으로 인용하는 #1168/#1169/#1170)를 구조적으로 방지한다.
- `finishedAt`/`durationMs` 계산을 `if (lastNodeId)` 블록 밖으로 옮긴 수정(`driveResumeAwaited:2404`, `driveCallStackResume:2589`, `driveStuckRedrive:3556`, `runExecution:4748`, `retry-turn.service.ts` 동일 메서드)은 단순 버그 수정을 넘어 **원래 뒤엉켜 있던 두 관심사를 분리**한 것이다 — `outputData` 는 마지막 노드에 의존하지만 `finishedAt`/`durationMs` 는 그렇지 않은데, 우연히 같은 `if` 블록에 있었다. 이 분리는 정확한 방향이다.
- `emitCancellationEvent`(execution-engine.service.ts:1101) 의 옵션 객체에 `durationMs?: number | null` 을 추가한 확장은 기존 시그니처를 깨지 않는 개방-폐쇄 원칙에 부합하는 확장이다.
- `shared/utils/terminal-duration.ts` → `execution-engine.service.ts`/`retry-turn.service.ts` 방향의 단방향 의존이며, 순환 참조는 발견되지 않았다.
- `resolveTerminalDurationMs` 의 파라미터 타입은 `Execution` 전체가 아니라 `{ durationMs?, startedAt?, finishedAt? }` 구조적 타입만 요구해 인터페이스 분리 원칙을 잘 지킨다(부분 select 행도 그대로 넘길 수 있음).
- 순수 계산 로직(`terminal-duration.spec.ts`)과 서비스 통합 테스트(`execution-engine.service.spec.ts`)가 별도 파일로 분리돼 테스트 레이어 응집도가 좋다.

## 요약

이번 PR 은 EIA 종결 이벤트(`completed`/`failed`/`cancelled`) 16개 emit 경로에 `durationMs` 를 일관되게 채우는 작업으로, 직전 PR 이 `error` 필드에 적용한 "공유 정규화 헬퍼로 divergence 방지" 패턴을 그대로 재사용해 설계 일관성을 지켰고, `outputData` 와 `finishedAt`/`durationMs` 가 우연히 얽혀 있던 조건 분기도 올바르게 분리했다. 다만 raw-UPDATE 취소 경로 5곳의 "SQL 파라미터 바인딩 + RETURNING 파싱" 오케스트레이션이 동일 형태로 복제돼 있고(추출된 SQL 상수·순수 함수와 대비되는 미완의 DRY), 그 SQL 상수 자체가 `Execution` 엔티티 컬럼명(`started_at`)을 타입 수준 연결 없이 하드코딩해 스키마 drift 에 취약하다는 두 지점이 남는다. 둘 다 기능을 막는 결함은 아니며, 기존 God-class·mock 중복 같은 만성 부채는 이번 diff 가 새로 만든 것이 아니라 INFO 로만 기록했다.

## 위험도

LOW
