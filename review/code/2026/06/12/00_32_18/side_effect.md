# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] 테스트 내 Logger.prototype.warn spy — 단언 실패 시 복원 누락
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts` 라인 50-61, 201-212
- 상세: 새로 추가된 `it.each(['CODE_MEMORY_LIMIT', 'HTTP_BLOCKED'])` 테스트 블록에서 `jest.spyOn(Logger.prototype, 'warn').mockImplementation(...)` 후 `warnSpy.mockRestore()`를 테스트 본문 마지막에 직접 호출한다. `expect(result.key).toBe(...)` 또는 `expect(warnSpy).not.toHaveBeenCalled()` 단언이 실패하면 `mockRestore()`가 실행되지 않아 `Logger.prototype.warn`이 mock 상태로 남는다. 이는 같은 파일 내 이후 테스트(`Unknown fallback (CCH-ERR-04)` describe 등)의 Logger.warn 관찰 결과를 오염시키는 공유 상태 변경에 해당한다. 프로덕션 런타임 부작용은 아니나 테스트 실행 환경의 전역 프로토타입을 일시적으로 변경하는 패턴이므로 부작용 관점에서 기록한다.
- 제안: `afterEach(() => jest.restoreAllMocks())` 추가 또는 `try { ... } finally { warnSpy.mockRestore(); }` 구조로 보호.

### [INFO] `LEGACY_TO_NORMALIZED` 모듈 상수 이동 — 런타임 의미 변화 없음
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` 모듈 상단 (신규 위치)
- 상세: `RE_TIMED_OUT`, `RE_MEMORY_LIMIT`, `RE_ISOLATE_DISPOSED`, `LEGACY_TO_NORMALIZED` 상수가 파일 하단(클래스 선언 이후)에서 클래스 선언 이전으로 이동되었다. TypeScript `const`는 호이스팅이 없으므로 순서 변경은 런타임 의미에 영향이 없다. 이동된 상수들은 모두 모듈 초기화 시 한 번만 생성되며 이후 변경되지 않는 불변값(`Object.freeze` 적용, `Readonly` 타입 고정)이다. 의도치 않은 상태 변경 없음.
- 제안: 없음. 의도된 리팩터이며 부작용 없음.

### [INFO] `LEGACY_TO_NORMALIZED` 기본값 변경 — 공개 API 내부 코드 노출 차단
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` `failure()` 내 `normalizedCode` 할당
- 상세: 기존 `?? errorCode`(미상 내부 코드를 그대로 노출)에서 `?? ErrorCode.CODE_EXECUTION_FAILED`(safe fallback)로 변경되었다. `classifyCodeNodeError`가 반환하는 세 가지 내부 코드 모두 `LEGACY_TO_NORMALIZED`에 매핑되어 있으므로 실제로 fallback 경로에 진입하는 케이스는 없다. 미래에 `classifyCodeNodeError`에 새 분기가 추가될 경우 이전 코드는 내부 코드 문자열이 `output.error.code`로 클라이언트에 그대로 노출되는 부작용을 낳을 수 있었으나 이번 변경으로 방어된다. 의도된 변경이며 기존 동작에 대한 부작용 없음.
- 제안: 없음. defence-in-depth 관점에서 올바른 방향.

### [INFO] `classifyError` export 심볼 삭제 → `classifyCodeNodeError` 추가
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts`
- 상세: `export function classifyError(...)` 가 삭제되고 `export function classifyCodeNodeError(...)` 가 새로 추가되었다. 이는 모듈의 공개 export 심볼이 변경된 것이다. 코드베이스 내 호출처 10곳이 일괄 갱신되었다고 plan에 명시되어 있고 test spec 파일의 import도 갱신되었다. 외부 패키지나 다른 모듈에서 `classifyError`를 직접 import하는 경우가 있다면 컴파일 오류가 발생할 수 있으나, JSDoc의 `@internal` 표시와 "test-only export" 주석으로 외부 소비자가 없음이 명확히 문서화되어 있다.
- 제안: 없음. 변경은 의도적이며 코드베이스 내 호출처가 모두 갱신되었다.

### [INFO] `ErrorCode.HTTP_BLOCKED` 참조 교체 — 런타임 동작 동일
- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` L354, L369
- 상세: `'HTTP_BLOCKED'` 문자열 literal이 `ErrorCode.HTTP_BLOCKED`로 교체되었다. `ErrorCode` 객체는 `as const` 선언이므로 `ErrorCode.HTTP_BLOCKED === 'HTTP_BLOCKED'`가 컴파일 타임에 보장된다. 런타임 동작 변화 없음. `error.code` 필드 값이 변경되지 않으므로 이 필드를 읽는 하위 시스템(chat-channel classifier 포함)에 부작용 없음.
- 제안: 없음.

## 요약

이번 변경은 에러 코드 wiring 정리 PR로서, `CODE_MEMORY_LIMIT`·`HTTP_BLOCKED`를 `INTERNAL_CODES`에 등재하고, `classifyError` → `classifyCodeNodeError` rename, `LEGACY_TO_NORMALIZED` 타입·선언 위치 정리, `HTTP_BLOCKED` literal → enum 참조화로 구성된다. 모든 변경은 의도된 범위 안에 있으며, 의도치 않은 전역 상태 변경·파일시스템 부작용·환경 변수 읽기/쓰기·네트워크 호출·이벤트/콜백 변경이 없다. 유일한 부작용 관련 주의 사항은 테스트 파일에서 `jest.spyOn(Logger.prototype, 'warn')` spy를 `afterEach`가 아닌 본문 인라인에서 복원하는 패턴으로, 단언 실패 시 Logger 프로토타입이 mock 상태로 남아 후속 테스트를 오염시킬 수 있으나 이는 프로덕션 부작용이 아닌 테스트 환경 격리 문제이며 INFO 수준이다. 전반적으로 런타임 부작용 위험이 없는 안전한 변경이다.

## 위험도

NONE
