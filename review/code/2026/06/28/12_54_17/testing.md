# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** `warn.mockRestore()` 가 `try/finally` 로 이동됐으나 `afterEach` 훅보다 격리 보장이 약함
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/seq-allocator-test-cov-74e999/codebase/backend/src/modules/websocket/execution-seq-allocator.service.spec.ts` L341–L356 (DEL reject 테스트)
  - 상세: `try/finally` 패턴은 해당 `it` 블록 내부의 expect 실패 시 spy 복원을 보장한다. 이는 이전 리뷰에서 지적된 "expect 실패 시 spy 잔류" 문제를 해결한 올바른 접근이다. 다만 `seqKeyTtlSeconds` describe 블록에 이미 `afterEach` 로 환경을 복구하는 기존 패턴이 존재하므로, `afterEach(() => warn.mockRestore())` 혹은 jest 전역 `restoreMocks: true` 설정과의 일관성은 여전히 미확보 상태다. 단, 현재 기능 보장에는 문제없음.
  - 제안: jest 설정에 `restoreMocks: true` 가 없다면 spy 를 사용하는 describe 블록에 `afterEach(() => jest.restoreAllMocks())` 추가를 후속 작업으로 고려. 현재 `try/finally` 구현은 비차단.

- **[INFO]** `await Promise.resolve()` 단일 flush 의존 — microtask 체인 깊이 변화 시 취약
  - 위치: `execution-seq-allocator.service.spec.ts` L344–L347
  - 상세: 현재 구현은 `.catch()` 핸들러 body 가 동기(즉각 실행)라는 전제 하에 `await Promise.resolve()` 1회로 microtask 큐를 flush 한다. 이 전제가 현 프로덕션 코드에서는 유효하다. 그러나 미래에 `.catch()` 내부에 `await` 가 추가되거나 promise 체인이 깊어지면 이 테스트는 `warn` 호출을 검증하기 전에 flush 가 완료되지 않아 false-negative 가 된다. 주석은 이 전제를 명시하고 있어 의도는 명확하다.
  - 제안: `jest.useFakeTimers()` + `jest.runAllMicrotasks()` 패턴 또는 `setImmediate` 기반 flush 헬퍼 도입을 중장기적으로 고려. 현재는 비차단.

- **[INFO]** `sanitize` 경계 케이스 테스트 2개가 단일 `it` 블록 내에 병합됨
  - 위치: `execution-seq-allocator.service.spec.ts` L474–L477
  - 상세: `'정확히 128자는 보존, 129자는 128 로 cap (off-by-one 경계)'` 테스트가 128자 보존과 129자 cap 두 개의 어설션을 단일 `it` 블록에 담고 있다. 이는 하나의 어설션이 실패해도 나머지 어설션이 실행되지 않아 실패 원인 파악이 덜 정밀해질 수 있다. 단, 두 어설션이 논리적으로 동일한 `off-by-one` 계약을 공유하므로 묶는 것이 의미상 자연스럽고, 현 구현에서 허용 가능한 설계 선택이다.
  - 제안: 후속 리팩에서 `it.each([[128, 128], [129, 128]])` 패턴으로 분리하면 실패 메시지 명확성이 높아진다. 현재는 비차단.

- **[INFO]** `warn` spy 의 `mockImplementation(() => undefined)` 적용 — 실제 logger 동작 억제는 적절하나 검증 완전성 확인
  - 위치: `execution-seq-allocator.service.spec.ts` L335–L339
  - 상세: `jest.spyOn(...).mockImplementation(() => undefined)` 로 실제 logger 출력을 억제하면서 호출 횟수와 인자를 검증한다. `warn` 이 1회 호출됐는지 (`toHaveBeenCalledTimes(1)`) 와 인자에 `executionId` 가 포함됐는지 (`stringContaining('exec-del-fail')`) 두 계약이 모두 검증되고 있어 커버리지 관점에서 충분하다.
  - 제안: 현 상태 유지. warn 메시지 전체 포맷이 중요하다면 `toHaveBeenCalledWith(expect.stringMatching(/exec-del-fail/))` 수준의 정규식 검증도 옵션이나 현재 `stringContaining` 으로 충분.

- **[INFO]** `sanitize` private static 직접 접근의 리팩토링 취약성 — 컴파일 타임 보호 없음
  - 위치: `execution-seq-allocator.service.spec.ts` L461–L463
  - 상세: `(ExecutionSeqAllocator as unknown as { sanitize: (v: string) => string }).sanitize` 패턴은 TypeScript `private` 접근을 런타임에만 확인한다. 프로덕션 코드에서 `sanitize` 메서드 이름·시그니처 변경 시 테스트 컴파일은 성공하지만 런타임에서 `undefined is not a function` 오류가 발생한다. 이 위험은 기존 리뷰(보류 INFO #4)에서 인지된 구조적 패턴 문제다.
  - 제안: `AllocatorInternals` 공용 타입 추출(보류 INFO #3)과 함께 후속 리팩에서 해결. 현재 비차단.

## 요약

이번 변경은 순수 테스트 파일 추가이며 프로덕션 코드를 변경하지 않는다. 추가된 5개 케이스는 이전 리뷰에서 요청된 커버리지 갭(sanitize off-by-one 경계, release warn 메시지 내용 검증, spy 안전 복원)을 모두 충실히 반영했다. `try/finally` 를 통한 spy 복원 보장, `stringContaining` 을 이용한 warn 메시지 검증, 128/129 경계 케이스 추가는 테스트 견고성을 실질적으로 향상시켰다. 남아 있는 INFO 항목(단일 `it` 내 복수 어설션, microtask flush 단일 의존, private static 런타임 전용 접근)은 기능 동작에 영향이 없는 구조적 개선 사항이며 즉각적인 수정 불필요하다. 전반적인 테스트 격리·가독성·커버리지 수준은 이전 리뷰 대비 명확히 향상됐다.

## 위험도

NONE
