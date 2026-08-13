# 부작용(Side Effect) Review

## 대상 요약

실질 코드 변경은 5개 파일뿐이다 (파일 1~5). 나머지(파일 6~34)는 `plan/in-progress/*.md`
체크박스 갱신과, 이전 리뷰/일관성 검토 세션(`14_01_46`, `14_18_42`, `17_05_10`)의 산출물이
저장소에 신규 커밋되는 것으로 — 순수 문서 파일 추가이며 런타임 부작용 대상이 아니다.

- 파일 1 `chat-channel.dispatcher.spec.ts` — 테스트 전용, 프로덕션 코드 변경 없음.
- 파일 2 `execution-engine.service.spec.ts` — 테스트 전용.
- 파일 3 `execution-engine.service.ts` — 프로덕션 코드: `admitExecutionOrDefer` 에
  `Array.isArray(rows)` fail-closed 가드(throw) 추가.
- 파일 4 `executions.service.spec.ts` — 테스트 전용.
- 파일 5 `executions.service.ts` — 프로덕션 코드: `SNAPSHOT_CACHE_MAX_ENTRIES` 를
  `const` → `export const` 로 가시성 확대.

파일 3 의 가드가 실제로 트랜잭션 롤백 불변식을 보존하는지, `runExecutionFromQueue` →
`ExecutionRunProcessor` 까지 호출 체인을 직접 열어 대조했다(아래 상세).

## 발견사항

- **[INFO]** admission 가드가 `TypeError` → 명시적 `Error` 로 예외 타입/메시지를 바꾼다 — 관측 표면 변경
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의
    `admitExecutionOrDefer` 내부 `if (!Array.isArray(rows)) { throw new Error(...) }` (게이트 2931~2936)
  - 상세: 이전에는 `rows` 가 배열이 아니면 `rows.length` 접근에서 암묵적
    `TypeError: Cannot read properties of undefined (reading 'length')` 가 던져졌다. 이번 diff 는
    같은 지점에서 **명시적으로** `Array.isArray` 를 검사해 다른 문구·다른 에러 클래스(둘 다 plain
    `Error` 이므로 클래스 자체는 동일하지만 메시지가 바뀜)를 던진다. 던지는 것 자체(→ 트랜잭션
    롤백 → BullMQ job failed)는 이전과 **동일한 제어 흐름**이라 기능적 회귀는 없다. 다만 로그
    문자열(`Cannot read properties of undefined` → `admission: UPDATE ... RETURNING 이 배열이 아님`)에
    의존하는 외부 모니터링/알림 규칙이 있었다면 매칭이 조용히 끊긴다 — 이 저장소에는 그런 규칙의
    존재 여부를 확인할 수 있는 자료가 없어 가능성만 남긴다.
  - 제안: 조치 불요(의도된 진단 개선). 운영 알림 규칙이 별도로 존재한다면 문구 갱신을 함께 검토.

- **[확인, 발견 아님]** fail-closed 가드가 트랜잭션 롤백 불변식을 실제로 보존하는지 호출 체인 끝까지 추적 — 문제 없음
  - 위치: `execution-engine.service.ts` `admitExecutionOrDefer`(게이트 2906~2939, `manager.transaction`
    콜백 내부) → 호출부 `runExecutionFromQueue`(게이트 3669, try/catch 없이 그대로 전파) →
    `queues/execution-run.processor.ts` `process()`(그대로 전파 → BullMQ 가 job 을 failed 처리) →
    `onFailed()` 의 `finalizeStalledExhausted` 는 `status='running'` 조건부라, 가드가 던진 시점엔
    DB 트랜잭션이 롤백돼 `status` 가 여전히 `pending` 이므로 no-op — 새로운 상태 다이버전스를
    만들지 않는다.
  - 상세: 이 파일의 `plan/in-progress/backend-lint-gate-broken-on-main.md` 완료 메모(파일 6)가
    기록한 대로, 이전 라운드(`14_01_46`)에서 이 가드를 `return false`(defer)로 썼다가 side_effect
    WARNING(트랜잭션 커밋 vs defer 판정 불일치)이 지적돼 `throw` 로 되돌린 이력이 있다. 이번
    diff 에 실제로 반영된 코드는 그 **수정 후** 상태(throw)이며, 직접 코드를 읽어 `admit ted`
    분기·`(d)` defer 분기·예외 분기 세 갈래가 서로 겹치지 않음을 확인했다. 새로운 부작용 없음.

- **[INFO]** `SNAPSHOT_CACHE_MAX_ENTRIES` 가시성 확대 (`const` → `export const`) — 공개 표면 소폭 확장
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:63`
  - 상세: 값(256)·의미 변경 없음. `grep -rn "SNAPSHOT_CACHE_MAX_ENTRIES" codebase/backend/src`
    결과 소비처는 정의부·내부 사용(`writeSnapshotCache` 인근)·신규 테스트뿐이라 이름 충돌이나
    의도치 않은 외부 소비자는 없다. 자매 상수 `MAX_EXECUTION_PATH_ROWS` 가 이미 같은 목적으로
    export 돼 있어 패턴도 일관된다.
  - 제안: 조치 불요.

- **[INFO]** 신규 테스트 2건이 `Logger.prototype.debug`/`warn` 을 전역(prototype) 스파이로 패치
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` 신규
    `describe('ChatChannelDispatcher.handle — toChatChannelEvent null 의 로그 레벨 분기', ...)` 블록
    내부 두 `it` (게이트 790~791, 818~819)
  - 상세: `@nestjs/common` `Logger` 클래스의 prototype 을 패치하는 전역성 변경이지만, 두 테스트
    모두 `try { ... } finally { debugSpy.mockRestore(); warnSpy.mockRestore(); }` 로 감싸 assertion
    실패 시에도 복원이 보장된다(게이트 792~813, 820~838 확인). Jest 는 스펙 파일별 모듈 격리를
    제공하므로 다른 스펙 파일로는 전파되지 않는다.
  - 제안: 조치 불요. `it.concurrent` 로 전환 시 이 패턴이 깨질 수 있음은 인지해 둘 것(향후 참고).

- **[정보, 부작용 없음]** `makeDispatcherHarness` 공통 헬퍼 추출 — 상태 공유 없음 확인
  - 위치: `chat-channel.dispatcher.spec.ts` `function makeDispatcherHarness(...)` (게이트 723~763)
  - 상세: 종전에 두 `describe` 블록이 각자 복제하던 fixture 배선을 모듈 상단 팩토리 함수로
    통합했다. 함수는 매 호출마다 새 `jest.fn()`/객체 리터럴을 생성해 반환하므로, 두 describe
    블록(및 그 안의 개별 `it`)이 mock 인스턴스를 공유하지 않는다 — 리팩터가 테스트 간 상태 누수를
    새로 만들지 않았음을 코드 레벨로 확인했다.

- **[해당 없음]** `plan/in-progress/*.md`, `review/code/**`, `review/consistency/**` 변경 — 순수 문서
  - 위치: 파일 6, 7 및 파일 8~34 전체
  - 상세: 체크박스 갱신·이전 리뷰 세션 산출물의 신규 커밋으로, 코드 실행 경로에 영향을 주는
    상태 변경이 아니다. 전역 변수·파일시스템 부작용·시그니처/인터페이스 변경·환경 변수·네트워크
    호출·이벤트/콜백 어느 관점에도 해당하지 않는다.

## 요약

이번 diff 의 실질 프로덕션 코드 변경은 두 곳뿐이다 — `execution-engine.service.ts` 의
`Array.isArray(rows)` fail-closed 가드(throw 유지, 트랜잭션 롤백 불변식 보존 확인)와
`executions.service.ts` 의 상수 export 전환(값 불변, 충돌 없음). 전자는 이전 라운드에서
지적됐던 "defer 로 삼켜 트랜잭션이 커밋된다" 는 WARNING 이 이미 `throw` 로 정정된 상태로
반영돼 있음을 호출 체인 끝까지(`runExecutionFromQueue` → BullMQ processor → `onFailed`) 직접
추적해 확인했으며, 새로운 상태 다이버전스는 발견되지 않았다. 나머지는 테스트 보강(전역
`Logger.prototype` 패치는 `try/finally` 로 안전하게 복원)과 순수 문서 커밋이다. CRITICAL/WARNING
급 부작용은 발견되지 않았다.

## 위험도

LOW
