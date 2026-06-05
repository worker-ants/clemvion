# 요구사항(Requirement) 리뷰 — PR-A2a `_resumeCheckpoint` schemaVersion + 재구성 견고화

## 발견사항

### **[INFO]** 통합 테스트의 `RESUME_INCOMPATIBLE_STATE` 검증 경로가 취약한 간접 검증에 의존
- 위치: `execution-engine.service.spec.ts` 신규 통합 테스트 (lines 200–222)
- 상세: `RESUME_INCOMPATIBLE_STATE` 코드가 실제로 Execution 에 반영됐는지를 `mockExecutionRepo.createQueryBuilder.mock.results.flatMap(r => r.value.set?.mock?.calls ?? [])` 체인으로 검증한다. `buildUpdateChain` 에서 `set` 은 `chain.set.mockReturnValue(chain)` 으로 설정되어 있어 `set.mock.calls[0][0].error.code` 를 읽을 수 있다. 현재 구현에서는 동작하나, `markExecutionCancelled` 내부 QueryBuilder 체인 순서가 바뀌거나 `.set()` 호출이 분리되면 `mock.results[*].value.set` 접근이 `undefined` 가 되어 테스트가 false-pass(assertion 이 silently skip)될 수 있다. `expect(codes.length).toBeGreaterThan(0)` 등 최소한의 사전 가드가 없다.
- 제안: `expect(codes.length).toBeGreaterThan(0)` 또는 `expect(cancelSetCalls.length).toBeGreaterThan(0)` 을 `expect(codes).toContain(...)` 이전에 추가해 "set 호출 자체가 0건이면 테스트 실패"를 보장하는 방어 가드를 넣는 것을 권장. 현재 기능은 올바르게 동작하나 테스트 견고성 측면의 개선점.

### **[INFO]** `buildRetryReentryState` retry 모드(non-resumeMode)에서 schemaVersion strip 이 적용됨 — 의도된 동작인지 확인 필요
- 위치: `execution-engine.service.ts` 신규 구현 (lines 1723–1736)
- 상세: `buildRetryReentryState` 는 `resumeMode` 여부와 무관하게 `schemaVersion` 을 항상 strip 한다. `_retryState` 에는 `schemaVersion` 이 애초에 없으므로 no-op 이고 실질적 문제는 없다. 하지만 spec §1.3 comment "retry 모드에서는 no-op" 의 문서화 범위가 "필드 기본값 보강" 에 한정되어 있고, `schemaVersion` strip 에 대한 명시적 언급은 없다. spec 에서 `_retryState` 가 `schemaVersion` 을 포함하지 않음이 이미 확정된 사항이므로 코드 동작은 올바름.
- 제안: 기능 이슈 없음. spec §1.3 의 "checkpoint allow-list" 설명에 `_retryState` 에는 schemaVersion 이 없음을 한 줄 명시하면 미래 독자의 혼란 제거 가능.

### **[INFO]** `buildResumeCheckpoint(undefined)` 반환 테스트 — 타입 시그니처 일치 확인
- 위치: `execution-engine.service.spec.ts` 신규 단위 테스트 lines 100–102
- 상세: 테스트는 `buildResumeCheckpoint(undefined)` 가 `undefined` 를 반환함을 검증한다. 구현은 `if (!resumeState || typeof resumeState !== 'object') return undefined;` 로 정확히 처리한다. 엣지 케이스 커버 완전.

### **[INFO]** Spec §7.5 실패 케이스 표의 `RESUME_INCOMPATIBLE_STATE` 결과 — `Execution cancelled` 대 `NodeExecution failed` 양방 검증 누락
- 위치: `execution-engine.service.spec.ts` 통합 테스트 lines 200–226
- 상세: spec §7.5 실패 케이스 표(line 909)는 "`RESUME_INCOMPATIBLE_STATE` 시 Execution `cancelled` + `error.code='RESUME_INCOMPATIBLE_STATE'`, 동반 NodeExecution `failed`" 를 명시한다. 통합 테스트는 Execution `cancelled` + error code 를 검증하지만, **동반 NodeExecution `failed` 마킹**(`mockNodeExecutionRepo.createQueryBuilder` 호출 여부)을 검증하지 않는다. 기존 rehydration describe `beforeEach` 가 `mockNodeExecutionRepo.createQueryBuilder` 도 setup 하므로 테스트를 추가할 수 있다. 단 기존 `RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` 테스트(lines 9115, 9177)가 이 검증 패턴을 이미 갖추고 있으므로 일관성 관점에서 누락이 눈에 띈다.
- 제안: `expect(mockNodeExecutionRepo.createQueryBuilder).toHaveBeenCalled()` 를 `RESUME_INCOMPATIBLE_STATE` 통합 테스트에 추가해 spec §7.5 표의 "동반 NodeExecution `failed`" 요구사항을 명시 검증할 것을 권장. 현재 구현(`markNodeExecutionFailed` 호출)은 올바르나 테스트가 이를 확인하지 않음.

## 요약

PR-A2a 의 핵심 기능 요구사항(CHECKPOINT_SCHEMA_VERSION 상수 도입, `buildResumeCheckpoint` stamp, 미래 버전 가드 → `RESUME_INCOMPATIBLE_STATE`, `buildRetryReentryState` schemaVersion strip + 핵심 필드 방어적 기본값)은 모두 spec §1.3 / §7.5 에 정의된 행위 명세와 line-level 로 일치한다. 특히 (1) `schemaVersion` 부재·현재 이하 → backward-compatible, (2) 초과 → graceful `RESUME_INCOMPATIBLE_STATE` 분기, (3) `buildRetryReentryState` 의 schemaVersion strip + messages/turnCount/토큰/toolCalls 방어적 기본값 모두 구현돼 있다. 단위 테스트 5개(stamp/undefined/strip/방어적 기본값 4)와 통합 테스트 1개(버전 가드)가 의도한 동작을 검증한다. 발견된 사항은 모두 INFO 등급으로 기능 결함은 없으며, 테스트 견고성(간접 검증 가드 부재, NodeExecution failed 검증 누락)과 소규모 spec 문서화 개선이 전부다.

## 위험도

LOW
