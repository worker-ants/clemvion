# 동시성(Concurrency) Review

## 발견사항

- **[INFO]** `admitExecutionOrDefer` / `lockNonTerminalExecutionRow` / `updateExecutionStatus`(else 분기) 세 지점에 새로 붙은 `assertRowArray` 가드는 트랜잭션 경계에 따라 결과가 갈린다 — 이는 코드 주석이 이미 정확히 문서화했지만 동시성 관점에서 명시적으로 확인해 둔다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `admitExecutionOrDefer`(약 2911~2942행, `manager.transaction(...)` 콜백 내부) / `lockNonTerminalExecutionRow`(8187~8211행, `this.dataSource.transaction(...)` 콜백 내부에서 호출됨) / `updateExecutionStatus` else 분기(8486~8528행, 트랜잭션 밖 단발 raw UPDATE)
  - 상세: 앞 두 지점은 `pg_advisory_xact_lock`/`FOR UPDATE` 를 쥔 트랜잭션 콜백 안에서 throw 하므로, 예외가 나면 TypeORM 이 ROLLBACK 을 발행해 advisory lock 과 row lock 이 정상적으로 해제된다 — 락이 잡힌 채 예외로 함수를 벗어나 데드락/락 누수로 이어지는 경로는 없다. 반면 `updateExecutionStatus` else 분기는 트랜잭션 밖에서 실행되는 단발 `UPDATE ... RETURNING` 이라, 이 UPDATE 문 자체는 Postgres 에서 이미 자체 암묵 트랜잭션으로 커밋된 뒤에 `assertRowArray` 가 평가된다. 즉 이 지점의 throw 는 방금 적용된 UPDATE 를 되돌리지 못한다. 다만 이는 이번 diff 가 새로 만든 위험이 아니다 — 가드 이전에도 `updated.length > 0` 자체가 `updated` 가 배열이 아니면 TypeError 를 던져 사실상 동일한 지점에서 동일하게 예외가 전파됐다(진단 메시지만 개선됨). 판정(성공/실패, 롤백 가능 여부)에는 변화가 없다.
  - 제안: 조치 불요 — 코드 주석(8517~8522행)이 이미 이 비대칭을 정확히 설명하고 있다. 추후 이 else 분기를 트랜잭션으로 감싸는 리팩터가 있다면, 그때는 가드 throw 가 실제로 방금 UPDATE 를 롤백하게 되어 현재보다 더 강한 보장이 된다는 점만 참고.

- **[INFO]** `runExecutionFromQueue` 의 admission 호출부에 추가된 `try { admission = await this.admitExecutionOrDefer(...) } catch { release; throw }` 는 advisory-lock 기반 admission gate(기존 TOCTOU 방지 설계, 이번 diff 로 로직 변경 없음)와 상호작용을 정확히 확인했다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3679-3685` (`runExecutionFromQueue`)
  - 상세: admission 이 throw 하는 경우는 오직 위 트랜잭션 콜백 내부에서 `assertRowArray` 가 실패해 ROLLBACK 된 뒤 재전파되는 경로뿐이다. 이 시점엔 이미 advisory lock 이 해제돼 있으므로(트랜잭션 종료), catch 블록에서 `releaseExecutionRouting` 을 호출하고 그대로 재throw 해도 다른 workspace/execution 의 admission 과 데드락을 일으키지 않는다. in-memory routing map 의 등록/해제가 이 catch 로 대칭을 이루어, 이전에 있던 "throw 경로만 release 를 안 함" 누수(자매 `deferred`/`catch(runExecution)` 분기는 이미 release 함)가 닫혔다. 새 테스트(`execution-engine.service.spec.ts` 신규 `it('admission 이 throw → routing release 후 그대로 재전파 + runExecution 미호출')`)가 이 대칭을 직접 고정한다.
  - 제안: 조치 불요 — 긍정적 발견으로 기록.

- **[INFO]** `chat-channel.dispatcher.spec.ts` 신규 테스트 2건이 `jest.spyOn(Logger.prototype, 'debug'/'warn')` 로 NestJS `Logger` 클래스 prototype 을 전역 패치한다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:790-791`, `:818-819`
  - 상세: 현재 Jest 설정(파일 내 `it()` 순차 실행, `it.concurrent` 미사용)에서는 `try { ... } finally { debugSpy.mockRestore(); warnSpy.mockRestore(); }` 로 감싸 실패 시에도 복원이 보장되므로 교차 오염 위험은 없다. 다만 전역 prototype 패치라 향후 같은 파일/스위트에서 `it.concurrent` 로 전환되면 이 패턴이 깨질 수 있다(side_effect 리뷰가 이미 같은 지적을 INFO 로 남겨 중복 지적하지 않음).
  - 제안: 현재로선 조치 불요.

## 요약

이번 diff 의 실질 프로덕션 변경은 raw SQL `.query()` 4개 지점(`admitExecutionOrDefer` admission UPDATE, `lockNonTerminalExecutionRow` FOR UPDATE SELECT, `updateExecutionStatus` else 분기 guarded UPDATE, `executions.service.ts` `computeChainDepth` 재귀 CTE)에 `assertRowArray` 타입 내로잉 가드를 추가하고, `runExecutionFromQueue` 의 admission 호출을 `try/catch` 로 감싸 throw 시에도 routing context 를 release 하도록 고친 것이다. 기존 동시성 프리미티브(per-workspace `pg_advisory_xact_lock` 기반 admission 직렬화, `FOR UPDATE` row lock, guarded UPDATE 를 통한 lost-update 방지)의 로직 자체는 변경되지 않았다. 트랜잭션 콜백 내부의 두 가드(admission, lockNonTerminalExecutionRow)는 throw 시 ROLLBACK 으로 락이 정상 해제되어 데드락·락 누수를 유발하지 않으며, 트랜잭션 밖의 한 지점(`updateExecutionStatus` else 분기)은 throw 가 이미 커밋된 UPDATE 를 되돌리지 못한다는 점이 코드 주석에 정확히 문서화돼 있고 이는 가드 이전과 동일한 실패 지점·판정이라 새로운 회귀가 아니다. 신규 admission throw 경로의 routing-context release 대칭성은 전용 테스트로 고정되어 있다. 새로 도입된 락·세마포어·비동기 조정 로직은 없고, 기존 것을 깨는 변경도 없다.

## 위험도

NONE
