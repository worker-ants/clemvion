### 발견사항

- **[WARNING]** `classifyCodeNodeError` 반환 타입이 `string`으로 넓게 선언되어 `LEGACY_TO_NORMALIZED` 키 타입 안전성을 저해한다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/errcode-wiring-92dc2c/codebase/backend/src/nodes/data/code/code.handler.ts` — `classifyCodeNodeError` 함수 선언부
  - 상세: `LEGACY_TO_NORMALIZED`가 `Readonly<Record<string, ErrorCodeValue>>`로 값 타입이 강하게 고정되었음에도, `classifyCodeNodeError`의 반환 타입이 `string`이어서 해당 함수가 반환할 수 있는 실제 값 집합(`'EXECUTION_TIMEOUT' | 'EXECUTION_MEMORY_EXCEEDED' | 'CODE_RUNTIME_ERROR'`)이 컴파일러에게 불투명하다. 결과적으로 `LEGACY_TO_NORMALIZED[errorCode]` lookup의 타입 안전성 강화 효과가 약화된다.
  - 제안: 반환 타입을 `'EXECUTION_TIMEOUT' | 'EXECUTION_MEMORY_EXCEEDED' | 'CODE_RUNTIME_ERROR'` 유니온으로 좁혀 `LEGACY_TO_NORMALIZED` 키와 타입 단계에서 연결되도록 한다.

- **[INFO]** `execution-failure-classifier.spec.ts`에서 `CODE_MEMORY_LIMIT`과 `HTTP_BLOCKED`에 대한 `result.key === 'executionFailedInternal'` 단언이 두 `it.each` 블록에서 중복 검증된다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/errcode-wiring-92dc2c/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts` L175-194, L201-212
  - 상세: 상위 `it.each` 목록(L175-194)에 두 코드가 포함되어 기본 분류 결과를 검증하고, 하위 추가 블록(L201-212)에서 동일 코드의 `result.key`를 또 단언한다. 하위 블록의 추가 의도는 warn 로그 미발생 여부 확인임에도 분류 키 중복 단언이 혼재하여 각 블록의 관심사가 모호해진다.
  - 제안: 하위 블록(L201-212)에서 `result.key` 단언을 제거하고 warn-spy 미호출 단언만 남겨 각 블록이 단일 관심사를 검증하도록 한다.

- **[INFO]** `warnSpy.mockRestore()`가 테스트 본문 인라인에서 호출되어, 단언 실패 시 spy가 복원되지 않고 누수될 수 있다.
  - 위치: `execution-failure-classifier.spec.ts` L53-61, L216-231, L327-344
  - 상세: `it.each` 콜백 내에서 spy를 생성하고 마지막 줄에서 `mockRestore()`를 호출하지만, expect가 실패하면 이후 코드가 실행되지 않아 spy가 복원되지 않은 채 후속 테스트로 넘어간다. 이번 PR에서 새로 추가된 블록(L53-61)이 기존 패턴을 그대로 답습했다.
  - 제안: 각 describe 블록에 `afterEach(() => jest.restoreAllMocks())`를 추가하거나, jest.config에 `restoreMocks: true`를 전역 설정해 단언 실패 여부와 무관하게 spy가 항상 복원되도록 한다.

- **[INFO]** `execution-failure-classifier.ts` 내 신규 주석의 "refactor 04 C-3" 참조가 PR 내부 약어로 코드베이스 신규 진입자에게 맥락이 불명확하다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/errcode-wiring-92dc2c/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` `HTTP_BLOCKED` 항목 주석
  - 상세: "refactor 04 C-3"는 PR 슬러그 계층의 약어로 코드베이스에서 직접 추적이 불가능하다. 같은 블록에 이미 spec 섹션 참조(`§3.1 매핑 표`)가 있어 참조 방식 일관성도 떨어진다.
  - 제안: "refactor 04 C-3"를 제거하거나 `spec/conventions/chat-channel-adapter.md §3.1` 링크로 대체한다.

- **[INFO]** `http-request.handler.ts` 내 `HTTP_TRANSPORT_FAILED`, `HTTP_4XX`, `HTTP_5XX` 등 나머지 error code literal이 이번 PR에서 `ErrorCode.*` 참조로 미전환되어 파일 내 일관성이 부분적이다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/errcode-wiring-92dc2c/codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`
  - 상세: `HTTP_BLOCKED`만 `ErrorCode.HTTP_BLOCKED`로 전환되고 나머지 error code 문자열 리터럴은 그대로 남아, 동일 파일 내에서 enum 참조와 문자열 리터럴이 혼재한다. 이 상태로 병합되면 미래 리팩터링 시 일관성 파악에 추가 노력이 필요하다.
  - 제안: 후속 plan 항목으로 등록해 `HTTP_TRANSPORT_FAILED`, `HTTP_4XX`, `HTTP_5XX` 등을 `ErrorCode.*` 참조로 일괄 전환한다.

---

### 요약

전반적으로 이번 변경은 에러 코드 wiring 정리의 의도가 명확하고, 코드 상수 선언 위치 이동, `Object.freeze` 적용, `Readonly<Record<string, ErrorCodeValue>>` 타입 강화 등 유지보수성 개선 조치들이 충실히 적용되었다. `LEGACY_TO_NORMALIZED`와 관련 상수들이 `CodeHandler` 클래스 선언 이전으로 이동되어 논리적 응집성이 향상되었고, 인라인 주석도 분류 근거를 잘 설명한다. 다만 `classifyCodeNodeError`의 반환 타입이 여전히 `string`으로 넓게 선언되어 있어(경고 수준) 타입 강화 노력이 절반만 완성된 상태이며, 테스트 파일의 spy 복원 패턴이 단언 실패 시 누수될 수 있고, `http-request.handler.ts` 내 error code 참조 일관성 문제가 후속 조치로 남아 있다.

### 위험도

LOW
