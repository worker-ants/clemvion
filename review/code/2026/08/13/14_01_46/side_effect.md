# 부작용(Side Effect) Review

## 발견사항

- **[WARNING]** `Array.isArray` fail-closed 분기가 트랜잭션 커밋 여부를 바꾼다 — "예외로 인한 자동 롤백"에서 "정상 반환에 의한 커밋"으로
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2926-2932` (`admitExecutionOrDefer` 내부)
  - 상세: 이 분기 이전에는 `rows`가 배열이 아니면 `rows.length` 접근에서 `TypeError`가 던져지고, 그 예외가 `this.executionRepository.manager.transaction(async (m) => {...})` 콜백 밖으로 전파돼 TypeORM 이 트랜잭션을 **롤백**한 뒤 재던졌다 — 즉 `UPDATE ... RETURNING id`가 실제로 행을 갱신했더라도 그 변경은 항상 되돌려졌다. 이번 diff 는 그 경로를 `this.logger.warn(...); return false;`로 바꿔 **예외를 던지지 않고 정상 반환**하게 한다. `manager.transaction()`은 콜백이 예외 없이 완료되면 커밋하므로, `rows`가 배열이 아닌 상황에서 만약 실제로는 UPDATE 가 1행을 갱신했다면(가정상 극히 드묾 — pg 드라이버의 파라미터 쿼리는 항상 배열을 반환) 그 상태 변경(`execution.status='running'`)이 **커밋된 채로** 애플리케이션 레벨에서는 `admitted=false`(defer)로 처리된다. 이는 DB 상태와 애플리케이션 추적 상태가 어긋나는 새로운 다이버전스 창을 연다 — 이전에는 예외=항상 롤백이라는 불변식이 있었지만, 지금은 그 불변식이 이 특정 분기에서 깨진다.
  - 제안: 코드 주석이 이미 "fail-closed 를 명시"한다고 밝히고 있으므로 의도된 트레이드오프로 보이나, 이 분기가 실제로 도달 가능한 것은 pg 드라이버가 계약을 어길 때뿐이라는 전제가 사실이라면 그 사실을 명시적으로 문서화(예: "이 분기는 롤백을 보장하지 않는다 — 도달 시 UPDATE 가 이미 커밋됐을 수 있음")하거나, 안전을 위해 `return false` 대신 명시적으로 예외를 재던져 기존 롤백-보장 불변식을 유지하는 방안도 고려할 가치가 있다.

- **[INFO]** 모듈 상수 `SNAPSHOT_CACHE_MAX_ENTRIES` 가 `const` → `export const` 로 가시성 확대 (공개 인터페이스 변경)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:63`
  - 상세: 값(256)은 그대로이며 테스트에서 심볼을 참조하도록 export 만 넓혔다. 기존에 이미 `export const MAX_EXECUTION_PATH_ROWS`가 같은 목적으로 export 돼 있어 패턴이 일관되고, `grep -rn "SNAPSHOT_CACHE_MAX_ENTRIES" codebase/backend/src`로 확인한 결과 이 심볼을 사용하는 곳은 정의부·내부 사용처(`writeSnapshotCache`)·신규 테스트뿐이라 이름 충돌이나 의도치 않은 외부 소비자는 없다. 다만 모듈의 사적 구현 상수가 공개 표면으로 노출됐으므로, 향후 다른 모듈이 이 상수를 import 해 결합도를 높일 수 있는 소지는 남는다.
  - 제안: 현재로선 실질적 위험 없음. 후속 변경에서 이 상수를 소비하는 외부 모듈이 생기면 캐시 구현 세부사항에 대한 의존을 재검토할 것.

- **[INFO]** 신규 테스트가 `Logger.prototype.debug`/`warn` 을 전역(prototype) 스파이로 패치
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:769-770`, `:797-798` / `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4492`
  - 상세: `jest.spyOn(Logger.prototype, 'debug'/'warn').mockImplementation()`은 `@nestjs/common`의 `Logger` 클래스 prototype 을 패치하는 전역성 변경이다. 다만 세 곳 모두 `try { ... } finally { debugSpy.mockRestore(); warnSpy.mockRestore(); }` 패턴으로 감싸 assertion 실패 시에도 복원이 보장되며, 각 스펙 파일은 Jest 의 파일별 모듈 격리로 다른 스펙 파일에 전파되지 않는다. 같은 파일 내에서도 `it()` 블록은 순차 실행되고 서비스/디스패처 인스턴스는 매번 새로 생성되므로 교차 오염 위험은 낮다.
  - 제안: 현재 구현 그대로 유지 가능. 향후 `it.concurrent`로 전환하면 이 패턴이 깨질 수 있음을 인지해 둘 것.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 변경은 문서 전용 — 부작용 없음
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md` (체크박스 갱신 + 완료 기록 blockquote 추가)
  - 상세: 코드/런타임 부작용 없음. 확인만.

## 요약

이번 diff 는 대부분 테스트 추가(캐시 LRU 경계값·로그 레벨 분기·admission fail-closed 가드)이며, 신규 테스트는 모두 `beforeEach` 로 fixture 를 재생성하고 `Logger.prototype` 스파이는 `try/finally`로 복원해 교차 오염 위험이 낮다. 프로덕션 코드 변경은 두 곳으로 (1) `executions.service.ts`의 `SNAPSHOT_CACHE_MAX_ENTRIES` export 확대는 값 변경 없이 가시성만 넓혀 위험이 낮고, (2) `execution-engine.service.ts`의 `Array.isArray(rows)` fail-closed 가드는 의도적으로 "예외 전파" 를 "warn + defer" 로 바꾸면서 — 그 분기에 한해 — 기존에 예외가 보장하던 트랜잭션 자동 롤백 불변식이 더 이상 보장되지 않는 잠재적 상태 다이버전스를 만든다. 이는 저자가 인지하고 문서화한 트레이드오프이며 실제 도달 가능성은 pg 드라이버 계약 위반이라는 매우 희박한 조건에 한정되지만, "커밋 vs defer 판정" 이 어긋날 수 있다는 점은 부작용 관점에서 명시적으로 남겨 둘 가치가 있다.

## 위험도

LOW
