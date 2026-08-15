# 부작용(Side Effect) 리뷰 — `finalizeStalledExhausted` 트랜잭션 원자화

## 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted` 의 Execution/NodeExecution 두 UPDATE 를 `dataSource.transaction()` 으로 원자화 (자매 `cancelParkedExecution`/`markWebChatIdleTimeout` 과 동형)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 대응 테스트 하네스(`installStalledTx`) 추가/치환
- `CHANGELOG.md`, `plan/in-progress/eia-stalled-atomicity.md`(신규), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `spec/5-system/4-execution-engine.md` — 문서만 변경
- `review/code/2026/08/15/16_04_38/**`, `review/consistency/2026/08/15/15_54_20/**` — 직전 라운드 리뷰/consistency-check 산출물이 신규 파일로 커밋됨 (프로세스 의무 산출물, 코드 아님)

`git diff origin/main --stat` 로 실측한 28개 파일 전량과 프롬프트 목록이 일치함을 직접 확인했다. 실질 코드 변경은 `execution-engine.service.ts`(단일 함수, 단일 hunk) + `execution-engine.service.spec.ts`(대응 describe 블록) 두 파일뿐이다.

## 발견사항

- **[INFO]** 트랜잭션 도입으로 "둘째 UPDATE 실패 시 최종 관측 상태"가 바뀐다 — 의도된 변경이며 예외 전파 계약은 그대로다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3354`(`await this.dataSource.transaction(async (manager) => {`), `:3403`(`if (!finalized) return;`)
  - 상세: 이전엔 Execution UPDATE 가 먼저 autocommit 되고 NodeExecution UPDATE 가 실패하면 Execution 만 `FAILED` 로 남고 자식이 영구 `RUNNING` 으로 고아가 됐다(이 PR 이 고치는 바로 그 결함). 이제는 두 UPDATE 가 한 트랜잭션이라 둘째가 실패하면 **Execution 도 함께 롤백**돼 `RUNNING` 으로 되돌아간다 — 부분 성공 상태가 완전 무성공 상태로 바뀐 것으로, 이는 원자성 수정의 목적 그 자체다. 함수 자체는 diff 전후 모두 `try/catch` 가 없어 `dataSource.transaction()` 이 throw 하면 예외가 그대로 호출자(`execution-run.processor.ts` 의 `onFailed` 안 `.catch()`)로 전파된다 — 이 흡수 위치는 diff 가 만든 변화가 아니라 기존부터 있던 구조다(직접 대조: `execution-run.processor.ts` 는 이번 diff 에 포함되지 않음).
  - 제안: 조치 불요 — 의도된 동작. 다만 "둘째 UPDATE 실패 시 트랜잭션 전체가 throw 하고 캐치되지 않는다"는 계약을 잠그는 테스트가 없다는 점은 이미 testing/maintainability 리뷰어가 별도 INFO 로 지적한 바와 같은 결이라 중복 등재하지 않는다.

- **[INFO]** 함수 시그니처·이벤트 emit payload·유일 호출부는 diff 전후 동일 — 공개 인터페이스 영향 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3341`(`async finalizeStalledExhausted(executionId: string): Promise<void>` — 선언부는 diff 밖, 시그니처 불변 확인), `:3409-3421`(`emitExecution(executionId, ExecutionEventType.EXECUTION_FAILED, {status, error, durationMs})` 블록)
  - 상세: `emitExecution` 호출 인자(이벤트 타입·payload shape·`toTerminalErrorPayload(stalledError)`·`stalledDurationMs`)는 트랜잭션 콜백 밖으로 옮겨진 위치만 다르고 값·순서·조건은 동일하다. 유일한 호출부 `execution-run.processor.ts` 의 `onFailed`(`void … .catch(...)`, fire-and-forget)는 이 diff 에 포함되지 않아 영향받지 않는다. CHANGELOG 의 "수신자 영향 없음" 서술과 실제 코드가 일치함을 직접 대조로 확인했다.
  - 제안: 없음.

- **[INFO]** 테스트 mock 재정의(`installStalledTx`)는 테스트 간 상태 누수 없이 스코프가 닫혀 있다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4879-4905`(`installStalledTx` — `mockExecutionRepo.createQueryBuilder`/`mockNodeExecutionRepo.createQueryBuilder` 를 throw 로 재정의 + `service.dataSource.transaction` spy 치환), 대조 `:255`(최상위 `beforeEach`), `:285`(`mockExecutionRepo = {...}` 재할당), `:336`(`mockNodeExecutionRepo = {...}` 재할당)
  - 상세: `installStalledTx` 가 재정의하는 세 mock 은 전부 최상위 `beforeEach` 에서 매 테스트마다 새 객체 리터럴로 재할당되고, `service` 자체도 `Test.createTestingModule` 로 매 테스트 재컴파일된다(코드 확인 완료). 따라서 한 테스트가 `mockExecutionRepo.createQueryBuilder` 를 throw 무장으로 덮어써도 다음 테스트로 전이되지 않는다. `installStalledTx` 는 `describe('finalizeStalledExhausted (PR4)', ...)` 블록 스코프의 지역 함수라 자매 헬퍼 `installCancelTx`(다른 describe 블록)와 이름·스코프 모두 충돌하지 않는다.
  - 제안: 없음.

- **[INFO]** 신규 파일 다수 추가는 프로젝트 컨벤션상 의무 산출물이며 런타임 부작용이 아니다
  - 위치: `review/code/2026/08/15/16_04_38/**`(13개 파일), `review/consistency/2026/08/15/15_54_20/**`(7개 파일), `plan/in-progress/eia-stalled-atomicity.md`(신규)
  - 상세: `git diff --stat` 상 28개 변경 파일 중 21개가 이런 문서/JSON 산출물이다. 애플리케이션 코드가 만드는 파일시스템 부작용이 아니라 CLAUDE.md 가 의무화한 `--impl-prep` consistency-check·`/ai-review` 결과물이 그대로 커밋에 실린 것으로, 코드 실행 경로와 무관하다.
  - 제안: 없음(정보성 확인).

전역 변수 신설/수정, 환경 변수 읽기/쓰기, 예상치 못한 네트워크 호출, 공개 함수 시그니처·이벤트 payload 변경, 예상치 못한 파일시스템 쓰기 경로는 발견되지 않았다. `finalizeStalledExhausted` 가 이미 주입돼 있던 `this.dataSource`(다른 자매 함수들에서도 동일하게 사용 중, `:775` 생성자 주입)를 그대로 재사용해 신규 의존성 도입도 없다.

## 요약

이번 변경은 `finalizeStalledExhausted` 의 Execution/NodeExecution 두 UPDATE 를 이미 자매 함수(`cancelParkedExecution`, `markWebChatIdleTimeout`)가 쓰는 `dataSource.transaction` 패턴으로 원자화한 것으로, 함수 시그니처·유일 호출부·이벤트 emit payload·no-op 조기 반환 시 관측 가능한 동작이 모두 그대로 유지된다(직접 소스 대조로 확인). 부분 실패 시 최종 관측 상태가 "Execution 만 FAILED 로 잔류"에서 "전체 롤백으로 RUNNING 유지"로 바뀌는 것은 이 PR 이 의도하는 원자성 수정 그 자체이며, 예외 전파 경로(캐치 없음 → caller 의 `.catch()` 흡수)는 diff 이전부터 동일해 회귀가 아니다. 새로 도입된 전역 상태·환경 변수·예상치 못한 파일시스템/네트워크 부작용은 없으며, 테스트 mock 재정의도 `beforeEach` 재생성 덕에 테스트 간 누수 없이 스코프가 닫혀 있다. 나머지 21개 변경 파일은 프로젝트가 의무화한 리뷰/plan 산출물로 런타임 부작용과 무관하다. 부작용 관점에서 CRITICAL/WARNING 급 문제는 발견되지 않았다.

## 위험도

NONE
