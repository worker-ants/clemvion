# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/` (구현 완료 후, diff-base=origin/main)
구현 대상: codebase/backend (7개 파일, 171 추가/28 삭제)

---

### 발견사항

변경 사항은 3개 영역으로 구성된다.

**M-1 — `extractClientIpFromHeaders` 반환형 `string|null` → `string|undefined`**
**M-2 — `GlobalExceptionFilter` 테스트 갭 보강**
**M-3 — `getActiveExecutionStatus` 의 private 브래킷 접근 → 공개 메서드 캡슐화**

세 변경 모두 기존 Rationale 결정과 충돌하는 항목이 발견되지 않았다.

---

#### M-1 분석

- target 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts`
- 관련 Rationale: `spec/5-system/1-auth.md § Rationale 2.3.B` (클라이언트 IP 신뢰 m-3)

Rationale 2.3.B 는 `extractClientIpFromHeaders` 의 **행동 모델**(헤더 전용·req.ip 폴백 없음)을 정의하지, 반환 sentinel 의 타입(`null` vs `undefined`)을 규정하지 않는다. 변경 후 코드 JSDoc 이 두 함수의 반환형 비대칭(`extractClientIp → string|null`, `extractClientIpFromHeaders → string|undefined`)을 의도적 설계로 명시하고 있으며, 이는 spec 의 "두 경로 분리" 원칙을 언어 타입 레벨에서 명시하는 보완이다. `hooks.service.ts` 의 `?? undefined` 4곳 제거는 동일 표현의 중복 제거로 행동 변화가 없다.

기각된 대안 재도입 여부: **없음**. Rationale 2.3.B 가 명시적으로 기각한 "`req.ip` 폴백 추가"는 이 변경에 전혀 포함되지 않는다.

---

#### M-2 분석

- target 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts`
- 관련 Rationale: `spec/5-system/3-error-handling.md § Rationale` ("4xx http-error message 고정 문구 — CWE-209 방지")

테스트 파일만 변경되었다. 새 테스트가 검증하는 `QueryFailedError(23505)→409 RESOURCE_CONFLICT`, nested error envelope 인식, 비-23505→500 마스킹 은 모두 이미 구현된 `GlobalExceptionFilter` 의 기존 분기에 대한 커버리지이다. 3-error-handling Rationale 의 "CWE-209 방지 — 4xx 내부 원문 echo 금지" 원칙을 새 테스트가 명시적으로 단언(`expect(body.error.message).not.toContain('duplicate key value')`)하여 원칙을 강화한다.

기각된 대안 재도입 여부: **없음**.

---

#### M-3 분석

- target 위치: `codebase/backend/src/modules/hooks/hooks.service.ts`, `codebase/backend/src/modules/executions/executions.service.ts`
- 관련 Rationale: 없음 (구현 캡슐화 사항으로 spec Rationale 대상 외)

`executionsService['executionRepository']` private 브래킷 접근을 `ExecutionsService.getStatusById()` 공개 메서드로 대체한다. 동작 동등이며 Rationale 에 기록된 어떤 결정도 변경하지 않는다. `getStatusById` 의 "예외 흡수 + logger.warn" 설계는 `spec/5-system/12-webhook.md § Rationale` "fail-open + error 레벨 로깅" 원칙과 무관한 영역(내부 상태 조회)이며, 조회 실패를 null 로 흡수하고 warn 만 남기는 것은 guard 의 fail-open 정책과 다른 SRP 맥락이다. 혼동 여지가 없다.

기각된 대안 재도입 여부: **없음**.

---

### 요약

검토 대상 변경(M-1~M-3)은 모두 `spec/5-system/` 의 기존 Rationale 결정과 충돌하지 않는다. M-1 은 Rationale 2.3.B 의 헤더 기반 IP 추출 원칙을 타입 수준에서 명시하는 보완이고, M-2 는 3-error-handling Rationale 의 CWE-209 방지 원칙을 테스트로 고정하는 강화이며, M-3 은 캡슐화 리팩터로 Rationale 적 결정과 무관하다. 명시적으로 기각된 대안(`req.ip` 폴백 webhook 경로 적용, fail-closed guard, 4xx 메시지 원문 echo)의 재도입은 없고, 합의된 invariant(헤더 전용 IP 추출·CWE-209 고정 문구·fail-open + error 로깅)는 그대로 유지된다.

### 위험도

NONE
