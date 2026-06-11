### 발견사항

- **[INFO]** `warnSpy.mockRestore()` 인라인 호출 — 단언 실패 시 spy 누수
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/errcode-wiring-92dc2c/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts` L50-61, L201-212, L216-231, L327-344
  - 상세: 신규 추가된 `it.each(['CODE_MEMORY_LIMIT', 'HTTP_BLOCKED'])` 블록(L50-61)을 포함해 `Logger.prototype.warn` spy를 테스트 본문 끝에 `warnSpy.mockRestore()` 로 수동 복원한다. `expect(result.key)` 단언이 먼저 실패하면 `mockRestore()`가 실행되지 않아 이후 테스트의 Logger.warn 상태가 오염될 수 있다. `Unknown fallback` describe 블록, `event.error undefined guard` describe 블록에도 동일 패턴이 반복된다.
  - 제안: 각 describe 블록에 `afterEach(() => jest.restoreAllMocks())` 추가하거나, jest.config 에 `restoreMocks: true` 전역 설정. 최소한 신규 추가 `it.each` 블록이 기존 블록과 동일 파일 내 동일 패턴을 따르고 있으므로 일관적으로 수정해야 한다.

- **[INFO]** `CODE_MEMORY_LIMIT` / `HTTP_BLOCKED` 결과 단언 중복
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/errcode-wiring-92dc2c/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts` L175-194 (상위 `it.each`) vs L201-212 (no-warn 전용 블록)
  - 상세: 상위 `it.each` 에 `CODE_MEMORY_LIMIT`/`HTTP_BLOCKED`를 추가(L176-177)하면서 동시에 L201-212 하위 블록에서도 `result.key === 'executionFailedInternal'` 단언을 포함하고 있어 동일 결과를 두 번 검증한다. 하위 블록의 목적은 "no CCH-ERR-04 warn log" 검증이므로 `result.key` 단언은 부차적 의도를 흐린다.
  - 제안: 하위 `it.each` 블록에서 `result.key` 단언을 제거하거나, 상위 목록에서 두 코드를 제거해 테스트 의도를 단일화. 또는 테스트명에 "(no-warn only)" 를 명시해 의도를 구분.

- **[INFO]** `http-request.handler.ts` HTTP_BLOCKED 경로 단위 테스트 부재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/errcode-wiring-92dc2c/codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` L354-374 (SSRF block 분기)
  - 상세: `ErrorCode.HTTP_BLOCKED` literal 치환이 `as const` 타입 보장으로 런타임 동작 변화는 없지만, SSRF 차단 경로(error 포트 라우팅, `configEcho` Principle 7 미노출, `meta.durationMs` 포함 등)에 대한 단위 테스트가 없다. `plan/in-progress/http-ssrf-all-auth-followups.md` 테스트 항목이 미체크 상태로 남아 있다.
  - 제안: `none/custom × {IMDS, RFC1918, localhost}` 교차 조합 테스트, SSRF 차단 시 `configEcho` credential 미포함 단언, `HTTP_BLOCKED` 코드 분기 커버리지를 후속 plan 항목으로 연결. 본 PR의 리팩터링(literal → enum) 이 올바르게 전파되었는지 확인하는 smoke 테스트라도 추가 권고.

- **[INFO]** `classifyCodeNodeError` 반환 타입 `string` — LEGACY_TO_NORMALIZED 키 타입 안전성
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/errcode-wiring-92dc2c/codebase/backend/src/nodes/data/code/code.handler.ts` `classifyCodeNodeError` 선언부
  - 상세: 반환 타입이 `string`으로 넓게 선언되어 `LEGACY_TO_NORMALIZED` Record의 키 타입과 연결되지 않는다. 새로운 분기 경로를 추가할 때 컴파일 타임에 매핑 누락을 감지하지 못한다. 기존 테스트 `classifyCodeNodeError (unit)` describe 는 세 내부 분류 문자열을 직접 단언해 회귀는 잡히지만, 타입 좁힘 자체가 없으면 향후 테스트에서 잘못된 string 값이 매핑 표를 통과해도 TypeScript 단계에서 걸리지 않는다.
  - 제안: 반환 타입을 `'EXECUTION_TIMEOUT' | 'EXECUTION_MEMORY_EXCEEDED' | 'CODE_RUNTIME_ERROR'` 유니온으로 좁히면 `LEGACY_TO_NORMALIZED` 키 완전성을 컴파일 단계에서 강제할 수 있다.

- **[INFO]** `plan/in-progress/code-node-isolated-vm-followups.md` — 테스트 항목 미체크 상태
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/errcode-wiring-92dc2c/plan/in-progress/code-node-isolated-vm-followups.md` 테스트 섹션
  - 상세: `classifyCodeNodeError` null/undefined 케이스, `console.warn/error` 캡처, `syntaxIsolate` disposed 재생성 경로, `$vars` copy-out 실패 fallback 직접 검증 항목이 미체크 상태다. 본 PR에서 rename/리팩터가 완료되었으나 이와 연관된 엣지 케이스 테스트가 plan 에만 남아 있고 실제 spec 파일에는 없다.
  - 제안: 적어도 `classifyCodeNodeError({} as any)` (기존 커버됨), `classifyCodeNodeError(null as any)` / `classifyCodeNodeError(undefined as any)` 케이스를 단위 테스트에 추가. `console.warn/error` prefix 테스트는 통합 테스트 범위지만 plan 체크박스 진행 추적 필요.

### 요약

이번 변경의 핵심인 `execution-failure-classifier.ts` `INTERNAL_CODES` Set 등재(W1), `classifyCodeNodeError` rename(W2), `LEGACY_TO_NORMALIZED` 개선(INFO) 모두 테스트가 추가·갱신되어 기본 커버리지는 양호하다. no-warn 회귀 테스트(CCH-ERR-04 noise 제거 검증)와 경계값 테스트(`statusCode: 0`, 음수, float)도 포함되어 있어 테스트 품질이 전반적으로 높다. 다만 `warnSpy.mockRestore()` 가 테스트 본문 인라인에만 존재해 단언 실패 시 spy 누수가 발생할 수 있고, `CODE_MEMORY_LIMIT`/`HTTP_BLOCKED` 결과 단언이 두 블록에 중복되어 의도가 흐려진다. `http-request.handler.ts` SSRF 경로 단위 테스트 부재는 런타임 동작 변화가 없어 즉시 필수는 아니나 후속 plan 항목으로 연결 필요하다.

### 위험도

LOW
