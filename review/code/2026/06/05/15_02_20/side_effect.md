# 부작용(Side Effect) 리뷰

## 발견사항

### [WARNING] `applyCancellation` 시그니처 변경 — `void` → `Promise<void>` (async)
- 위치: `execution-engine.service.ts` (diff 헌더 `applyCancellation`)
- 상세: 공개 메서드 `applyCancellation(executionId: string): void`가 `async applyCancellation(executionId: string): Promise<void>`로 변경됐다. `continuation-execution.processor.ts`의 `case 'cancel'` 에서 `void this.engine.applyCancellation(executionId)` → `await this.engine.applyCancellation(executionId)` 로 이미 호출 측도 함께 수정됐다. 그러나 이 메서드가 `ExecutionEngineService`의 공개 인터페이스이므로, **다른 호출자**(예: 다른 모듈, HTTP 컨트롤러, 별도 큐 소비자)가 여전히 반환값을 무시(fire-and-forget)하고 있다면 오류 전파 누락이 발생한다. `cancelParkedExecution` 내부의 DB write 실패는 `try/catch`로 삼켜지지만, 미래 외부 호출자가 `void` 반환을 기대하면 unhandled rejection이 될 수 있다.
- 제안: `applyCancellation`을 호출하는 나머지 사이트(컨트롤러, 테스트 외 코드)를 전수 grep해 `void` 로 버린 호출이 남아있지 않은지 확인한다. 현재 테스트(`execution-engine.service.spec.ts` L342)와 processor는 `await` 처리 완료됐으나 전체 코드베이스에서 누락 여부를 검증해야 한다.

### [WARNING] `runNodeDispatchLoop` 반환 타입 변경 — `Promise<void>` → `Promise<{ parked: boolean }>`
- 위치: `execution-engine.service.ts` (private 메서드 `runNodeDispatchLoop`)
- 상세: private이라 외부 노출은 없으나, 테스트(`execution-engine.service.spec.ts` L10417)에서 `svcAny.runNodeDispatchLoop = jest.fn().mockResolvedValue(undefined)` → `mockResolvedValue({ parked: false })`로 교체됐고, L10573에서도 동형 교체가 됐다. **기존에 `undefined`를 반환하도록 모킹한 테스트가 남아 있다면** `dispatchResult.parked`를 읽을 때 undefined 역참조로 런타임 오류가 발생한다. 변경된 diff에서 2개 사이트만 확인됐으나, 동일 파일에 `runNodeDispatchLoop` mock을 사용하는 테스트가 더 있을 수 있다.
- 제안: `grep -n "runNodeDispatchLoop.*mockResolvedValue(undefined)\|mockResolvedValue(void 0)"` 로 전체 테스트 파일을 검색해 누락된 mock 교체가 없는지 확인한다.

### [WARNING] `cancelParkedExecution` 내 `finalizeRehydrationCleanup` 호출 — 의도치 않은 LLM 캐시 삭제
- 위치: `execution-engine.service.ts` `cancelParkedExecution` (L1077)
- 상세: `finalizeRehydrationCleanup`은 `pendingContinuations.delete`, `contextService.deleteContext`, `clearLlmDefaultConfigCache`를 함께 호출한다. park-release 후 코루틴은 이미 정리됐으므로 대부분 멱등하게 no-op이지만, **멀티턴 AI(PR-B2 전까지 in-memory 루프 유지)** 실행에 대해 `applyCancellation`이 호출될 경우, `pendingContinuations.has(executionId)`가 true이면 `rejectPending` 분기로 빠져 이 경로를 피한다. 그러나 in-memory 코루틴이 존재하는 중간 타이밍(waitForAiConversation 진입 전/후 경합)에서 `pendingContinuations.has` miss가 발생하면 `cancelParkedExecution`으로 떨어져 `contextService.deleteContext`가 살아 있는 컨텍스트를 삭제하는 부작용이 생긴다.
- 제안: `cancelParkedExecution`에서 `finalizeRehydrationCleanup` 호출 전, context가 실제로 무주(orphaned)인지 한 번 더 확인하거나, 멀티턴 AI가 완전히 park-release로 전환(PR-B2)된 이후로 이 정리 호출의 범위를 확장하는 것을 고려한다. 현 PR-B1 범위에서는 form/button 전용이므로 실질적 위험은 낮으나, 주석으로 명시하면 좋다.

### [INFO] `waitForFormSubmission` / `waitForButtonInteraction` 시그니처 변경 — `parkMode` 매개변수 추가
- 위치: `execution-engine.service.ts` private 메서드 두 개
- 상세: `parkMode: ParkMode = 'await'` 기본값이 있어 하위 호환은 유지된다. 반환 타입이 `Promise<void>` → `Promise<void | ParkSignal>`로 확장됐으나 private이므로 외부 API 영향 없다. 기존 호출자가 반환값을 무시하던 경우(`await this.waitForFormSubmission(...)` — 반환값 버림)는 이제 `PARK_RELEASED`를 버리게 되지만, diff 내 모든 호출 사이트가 `parkSignal`로 받아서 검사하도록 이미 수정됐다. 누락된 호출 사이트가 없다면 문제 없다.
- 제안: 코드베이스 내 `waitForFormSubmission` / `waitForButtonInteraction` 호출 전수를 확인해 반환값 미처리 사이트가 없는지 점검한다.

### [INFO] `PARK_RELEASED` 모듈 스코프 Symbol — 전역은 아니나 모듈 내 공유 상태
- 위치: `execution-engine.service.ts` L270: `const PARK_RELEASED = Symbol('park_released')`
- 상세: 모듈 최상위 `const`로 선언됐으며 전역 오염 없고 `export` 되지 않는다. Symbol은 인스턴스가 아닌 정의 단위로 유일하므로 `=== PARK_RELEASED` 비교는 안전하다.
- 제안: 이슈 없음.

### [INFO] e2e 테스트(`execution-park-resume.e2e-spec.ts`) 파일시스템 부작용
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` (신규 파일)
- 상세: `createDbClient()`로 PostgreSQL에 직접 연결하고 `afterAll`에서 `db.end()`로 정리한다. `beforeAll`에서 생성한 워크스페이스/워크플로우 행은 테스트 종료 후 DB에 잔류한다(명시적 cleanup 없음). 이는 기존 e2e 패턴과 동일하며 의도된 동작이다.
- 제안: 이슈 없음 (기존 e2e 패턴 준수).

### [INFO] `flushResumeDrive` — 실제 타이머 기반 테스트 헬퍼 도입
- 위치: `execution-engine.service.spec.ts` L226-228
- 상세: `setTimeout(resolve, ms)` 기반이므로 Jest fake timer 환경에서는 작동하지 않는다. 해당 테스트 파일이 fake timer를 사용하는 다른 `describe` 블록과 공존한다면, `flushResumeDrive`를 호출하는 테스트가 fake timer 스코프에 진입하면 영구 hang이 발생한다.
- 제안: `flushResumeDrive`를 사용하는 테스트 블록에서 `jest.useFakeTimers()`가 활성화되지 않는지 확인한다. 현재 해당 테스트들은 `flushPromises`(setImmediate 기반)를 혼용하므로 real timer 환경을 전제하고 있어 문제 없어 보이나, 파일 전체에서 `useFakeTimers` 호출 여부를 점검하는 것이 안전하다.

---

## 요약

이번 변경의 핵심 부작용 위험은 두 가지다. 첫째, `applyCancellation`의 `void → async` 시그니처 전환으로 인해 코드베이스 내 fire-and-forget 호출 사이트가 남아 있다면 에러 전파가 묵음 처리된다(테스트·processor는 수정됐으나 다른 호출자 검증 필요). 둘째, `runNodeDispatchLoop` 반환 타입 변경으로 기존 `mockResolvedValue(undefined)` mock이 남아 있으면 런타임 역참조 오류로 이어진다. `cancelParkedExecution`이 `finalizeRehydrationCleanup`을 호출해 살아있는 멀티턴 AI 컨텍스트를 삭제하는 경합 시나리오는 PR-B1 범위에서 확률이 낮으나 PR-B2 전까지 미명시 위험으로 남는다. 나머지 변경(Symbol 도입, 기본값 매개변수 확장, e2e 신규 파일)은 의도된 설계에 부합하며 부작용 없다.

## 위험도

**MEDIUM**

STATUS: SUCCESS
