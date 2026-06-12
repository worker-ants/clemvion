# 테스트(Testing) 리뷰 결과

## 발견사항

### [WARNING] `getActiveExecutionStatus` — `pending` 상태 분기 미검증
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.spec.ts` (hooks.service.spec.ts 파일 3, 새 테스트 블록)
- 상세: 새로 추가된 테스트(`CCH-CV-03 (b), R9`)는 `status: 'running'` 케이스만 검증한다. 구현 코드(`getActiveExecutionStatus`)는 `running`과 `pending` 모두 비-terminal로 처리하고 동일하게 `executionStillRunning` 안내를 발송해야 하지만, `status: 'pending'`인 경우의 테스트가 없다. `ExecutionStatus.PENDING`이 실제로 동일 경로를 타는지 별도 케이스로 검증 필요.
- 제안: `status: 'pending'` mock으로 동일 동작(sendMessage 호출, `{ executionId: 'ignored' }` 반환)을 검증하는 케이스 추가.

### [WARNING] `getActiveExecutionStatus` — DB 예외(catch) 경로 미검증
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` (`getActiveExecutionStatus` 메서드, 라인 ~1650-1661)
- 상세: `executionRepository.findOne`이 예외를 throw할 경우 `.catch(() => null)` 로 처리하여 `null` 반환 → `activeStatus === null` → `hasActiveExecution = false` 경로로 이어진다. 이 DB 오류 경로가 테스트로 검증되지 않아, DB 장애 시 의도치 않게 새 execution이 시작될 수 있음에도 해당 시나리오가 누락되었다.
- 제안: `execRepo.findOne.mockRejectedValueOnce(new Error('db error'))` 케이스를 추가해 예외 시 새 execution 시작(혹은 무시)이 의도와 일치하는지 검증.

### [WARNING] `sendExecutionStillRunningNotice` — sendMessage 실패(catch) 경로 미검증
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` (`sendExecutionStillRunningNotice` 메서드, 라인 ~1679-1690)
- 상세: `sendExecutionStillRunningNotice` 는 `sendMessage` 실패 시 `logger.warn` 후 swallow 한다. 현재 `CCH-CV-03 (b)` 테스트는 `sendMessage` 성공 시 반환값만 확인한다. `sendMessage`가 throw해도 `{ executionId: 'ignored' }` 가 정상 반환되는지, 부작용(로그 경고 등) 검증이 없다.
- 제안: `mockAdapter.sendMessage.mockRejectedValueOnce(new Error('network'))` 케이스를 추가해 best-effort 경로에서도 올바른 반환이 보장되는지 검증.

### [WARNING] `§5.4` — `botIdentity` 필드가 configUpdates에 없을 때 null 반환 테스트가 `triggers.service.spec.ts`에만 존재, controller 레벨 미검증
- 위치: `/codebase/backend/src/modules/chat-channel/chat-channel.controller.spec.ts` (파일 1)
- 상세: `chat-channel.controller.spec.ts`의 `ROTATE_RESULT`에는 `botIdentity: { botId: 111, username: 'bot' }` 고정값만 있고, `botIdentity: null` 케이스 시 controller가 값을 그대로 pass-through하는지 확인이 없다. `triggers.service.spec.ts`에만 null 케이스가 있고 controller 레벨에는 없다.
- 제안: controller spec에 `botIdentity: null`인 `ROTATE_RESULT`를 mock으로 사용하는 케이스를 추가하거나, 기존 테스트에 comment로 "controller는 pass-through만 하므로 service 레벨에서 충분"이라는 근거를 명시해 의도를 문서화.

### [INFO] CCH-CV-03 (b) 테스트에서 `execRepo` 접근 방식이 취약
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.spec.ts`, 신규 테스트 블록 라인 276-283
- 상세: `moduleRef.get(ExecutionsService).executionRepository`를 nested type cast로 가져오는 방식은 내부 구현에 강하게 결합된다. `executionRepository`가 private 혹은 구조 변경 시 테스트가 조용히 실패하거나(mock이 무시됨) 런타임 캐스트 오류가 발생할 수 있다. `beforeEach`에서 이미 `{ findOne: jest.fn().mockResolvedValue(null) }`로 초기화되어 있어 테스트 간 공유 mock이 오염될 가능성도 있다.
- 제안: `moduleRef.get(ExecutionsService)`의 `executionRepository`를 `beforeEach`에서 변수로 추출해 재사용하거나, `executionRepository`를 별도 `provide`로 분리해 mock 주입하면 결합도와 격리성을 개선할 수 있다.

### [INFO] `waiting_for_input` 상태에서 정상 forwarding 경로 유지 여부 회귀 테스트 필요
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.spec.ts`
- 상세: `isActiveExecution`(boolean) → `getActiveExecutionStatus`(ExecutionStatus|null) 리팩토링 이후, 기존 `waiting_for_input` 상태에서 interact forwarding이 정상 동작하는지 확인하는 테스트가 파일에 포함되어 있는지 파악이 필요하다. diff에서는 새로운 `running` 케이스만 추가했고 `waiting_for_input` 케이스 회귀 테스트가 diff에 명시적으로 보이지 않는다. 기존 테스트가 이를 커버한다면 문제없으나, 커버하지 않는다면 리팩토링 후 핵심 경로가 무방비 상태.
- 제안: `execRepo.findOne.mockResolvedValue({ status: 'waiting_for_input' })` 상태에서 `interactionService.interact`가 호출되고 `{ executionId: state.executionId }` 반환을 확인하는 케이스가 기존 테스트에 있음을 확인. 없다면 추가 필수.

### [INFO] `languageHints.executionStillRunning` 커스터마이징 경로 미검증
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` (`sendExecutionStillRunningNotice`, 라인 ~1675-1677)
- 상세: `config.languageHints?.executionStillRunning`이 설정된 경우의 커스텀 메시지 경로가 테스트되지 않는다. default 문구만 검증하고 있어 config override 경로는 커버리지 갭.
- 제안: `config.languageHints.executionStillRunning = '처리 중입니다'`를 설정한 케이스에서 `sendMessage`에 해당 텍스트가 전달되는지 검증하는 케이스를 선택적으로 추가.

---

## 요약

이번 변경은 `isActiveExecution`(boolean) → `getActiveExecutionStatus`(ExecutionStatus|null) 리팩토링과 `CCH-CV-03 (b)` 경로 추가, `§5.4` 응답 확장을 포함한다. 핵심 신규 경로(`running` 상태 → executionStillRunning 안내+무시)에 대한 단위 테스트가 추가되었고 `§5.4 botIdentity` 케이스도 null/non-null 두 경우가 검증된다. 그러나 동등한 비-terminal 상태인 `pending` 케이스, DB 예외 catch 경로, `sendMessage` 실패 swallow 경로, `waiting_for_input` 상태의 정상 forwarding 회귀가 명시적으로 검증되지 않아 경계 케이스 커버리지에 갭이 있다. `execRepo` mock 접근 방식의 취약한 내부 결합도도 테스트 격리성 측면에서 개선이 필요하다.

## 위험도

MEDIUM
