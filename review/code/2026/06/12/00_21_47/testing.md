# Testing Review — errcode-wiring

## 발견사항

### **[INFO]** warnSpy 인라인 mockRestore — afterEach 격리 미적용
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts` 라인 50-61 (신규 블록) 및 라인 216-231 (기존 블록)
- 상세: 새로 추가된 `it.each(["CODE_MEMORY_LIMIT", "HTTP_BLOCKED"])` 블록이 `warnSpy.mockRestore()`를 테스트 콜백 마지막에 수동 호출한다. `expect(result.key).toBe(...)` 단언 실패 시 이후 줄이 실행되지 않아 spy가 복원되지 않은 채 다음 테스트로 넘어갈 수 있다. Jest 워커 격리로 파일 간 오염은 없지만 같은 파일 내 이후 테스트(특히 Unknown fallback CCH-ERR-04 블록)에서 Logger.prototype.warn spy 상태가 잘못 유지될 수 있다.
- 제안: 각 describe 블록에 `afterEach(() => jest.restoreAllMocks())`를 추가하거나, jest.config에 `restoreMocks: true`를 전역 설정으로 적용.

### **[INFO]** CODE_MEMORY_LIMIT/HTTP_BLOCKED 분류 결과가 두 블록에서 중복 검증됨
- 위치: `execution-failure-classifier.spec.ts` 라인 175-194 (it.each 배열 내 추가)와 라인 201-212 (no-warn 전용 it.each)
- 상세: 두 블록 모두 `result.key === "executionFailedInternal"`를 단언하여 분류 정확성을 2회 검증한다. 라인 196-200 코멘트("UX is unchanged")가 의도를 명확히 설명해 가독성은 양호하다. 위험 없음.
- 제안: 현 상태 유지 가능. 향후 코드 추가 시 동일 중복 패턴이 반복되지 않도록 팀 컨벤션 문서화 권고.

### **[INFO]** HttpRequestHandler HTTP_BLOCKED 경로 — 직접 단위 테스트 부재
- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` (파일 6) — 대응 변경 spec 없음
- 상세: `http-request.handler.ts` 변경은 리터럴 `"HTTP_BLOCKED"` → `ErrorCode.HTTP_BLOCKED` 참조화이다. `ErrorCode.HTTP_BLOCKED === "HTTP_BLOCKED"`는 as const 타입 보장으로 컴파일 타임에 검증된다. 그러나 SSRF 차단 시 `output.error.code === "HTTP_BLOCKED"`가 되는지 검증하는 `http-request.handler.spec.ts` 테스트가 이번 diff에 포함되지 않았다. `plan/in-progress/http-ssrf-all-auth-followups.md §테스트`의 "none/custom × {IMDS, RFC1918, localhost} 교차 조합 test.each" 등이 미체크 상태이다.
- 제안: 이번 PR은 enum 참조화 + 노이즈 제거로 범위가 작아 동작 변화 없으므로 즉시 필수는 아니다. 후속 plan 항목을 통해 커버할 것을 권고한다.

### **[INFO]** classifyCodeNodeError — null/undefined 인수 에지케이스 커버리지 갭
- 위치: `code.handler.spec.ts` `classifyCodeNodeError (unit)` 블록 마지막 케이스
- 상세: 현재 `classifyCodeNodeError({} as any)`는 커버하지만, `classifyCodeNodeError(null as any)` / `classifyCodeNodeError(undefined as any)`는 테스트되지 않는다. `err?.code`와 `err?.message` 모두 optional chaining으로 처리되어 런타임 crash는 없다. `plan/in-progress/code-node-isolated-vm-followups.md §테스트`에 이미 후속 항목으로 등재됨.
- 제안: 이번 리네임 자체는 안전하다. 후속 PR에서 null/undefined 케이스 추가 권고 (followup plan 이미 추적 중).

### **[INFO]** LEGACY_TO_NORMALIZED Object.freeze — 뮤테이션 방어 테스트 없음
- 위치: `code.handler.ts` LEGACY_TO_NORMALIZED 상수 선언부
- 상세: `Object.freeze`가 적용되어 뮤테이션이 strict mode에서 TypeError로 차단된다. 테스트에서 외부 뮤테이션 후 정상 매핑 유지를 검증하지 않으나, Object.freeze는 V8 엔진 보장이므로 별도 테스트가 없어도 신뢰 가능하다.
- 제안: 수용 가능. 프로젝트 테스트 범위 밖으로 판단.

---

## 요약

이번 변경의 테스트 관점 품질은 전반적으로 양호하다. 핵심 변경인 `CODE_MEMORY_LIMIT`/`HTTP_BLOCKED` classifier 등재는 (1) 기존 it.each 배열에 두 코드를 추가하여 분류 정확성을 검증하고, (2) 별도 it.each 블록에서 Logger.prototype.warn spy로 CCH-ERR-04 warn 로그 미발화를 회귀 검증하는 두 레이어로 충실히 커버된다. `classifyCodeNodeError` 리네임도 spec 파일 내 모든 호출처가 정확히 갱신되었다. spy를 afterEach가 아닌 인라인 mockRestore()로 정리하는 패턴은 단언 실패 시 spy 누수 위험을 내포하나 Jest 워커 격리 환경에서 실질적 오염 가능성은 낮다. `HttpRequestHandler`의 HTTP_BLOCKED 경로 단위 테스트 누락은 후속 plan에 이미 추적 중이며, as const 타입 보장으로 런타임 동작 변화가 없어 수용 범위이다. 전체적으로 이번 PR의 테스트 변경은 목적에 부합하며 추가 수정이 필요한 Critical/Warning 사항은 없다.

## 위험도

LOW
