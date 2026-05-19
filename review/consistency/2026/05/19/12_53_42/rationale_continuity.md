# Rationale 연속성 검토 결과

검토 대상: `LlmService.withRetry` 에 RFC 7231 Retry-After 헤더 존중 로직 추가  
plan: `plan/in-progress/llm-retry-after.md`  
변경 파일: `codebase/backend/src/modules/llm/llm.service.ts`, `codebase/backend/src/modules/llm/llm.service.spec.ts`

---

## 발견사항

### [INFO] spec §6 "exponential backoff" 표현과의 관계 — 추가 명문화 권장

- target 위치: `plan/in-progress/llm-retry-after.md §결정 사항 > 상한 60s`
- 과거 결정 출처: `spec/5-system/7-llm-client.md §6` 에러 처리 표 — "속도 제한 | 429 | `LLM_RATE_LIMIT` — 재시도 (exponential backoff, 최대 3회)"
- 상세: spec §6 는 429 재시도 전략을 "exponential backoff, 최대 3회"로 명시한다. 본 plan 은 Retry-After 헤더가 존재하면 그 값을 우선하고 exponential backoff 를 후순위로 두는 분기를 추가하며, 최대 3회 제한은 유지한다. spec §6 에 Rationale 절이 없어 "exponential backoff 만 사용한다"는 결정이 명시적으로 기각 근거를 가진 것은 아니다. 따라서 CRITICAL/WARNING 급 충돌은 아니나, spec 표현이 "exponential backoff" 단독 기술에서 "Retry-After 헤더 우선 + fallback exponential backoff" 로 변경되는 것이므로, 향후 독자가 spec §6 을 보고 구현과 불일치를 인식할 수 있다.
- 제안: 구현 완료 후 `spec/5-system/7-llm-client.md §6` 표의 해당 행을 "재시도 (Retry-After 헤더 우선; 없으면 exponential backoff, 최대 3회, 상한 60s)" 로 갱신하고, Rationale 절을 신설해 "RFC 7231 Retry-After 존중 결정 — provider 지시 대기 시간을 무시하고 더 짧게 재시도하면 429 반복이 누적되어 무의미한 소진이 발생함" 을 기재하도록 project-planner 에 위임 권장.

---

### [INFO] spec §8.3 "스트리밍 중 재시도 미적용" 원칙과의 경계 명확성

- target 위치: `plan/in-progress/llm-retry-after.md §변경 범위 §1)`
- 과거 결정 출처: `spec/5-system/7-llm-client.md §8.3` — "재시도(rate limit)는 스트리밍 중에는 적용하지 않는다. 시작 전 네트워크 초기화 단계에서만 기존 exponential backoff 규칙을 적용."
- 상세: plan 은 `withRetry` 만 수정하고 "provider client (anthropic/openai/google) 무변경" 을 명시한다. 스트리밍 경로 (`chatStream`) 는 `withRetry` 를 사용하지 않으며 현행 코드에서도 분리되어 있다. 따라서 spec §8.3 의 "스트리밍 중 재시도 미적용" 원칙은 침해되지 않는다. 단, `withRetry` 가 비스트리밍 경로에만 호출됨을 코드 주석 또는 plan 에 명시해 두면 향후 reviewer 가 §8.3 충돌 여부를 재검토할 필요가 없어진다.
- 제안: plan §변경 범위 §1) 에 "스트리밍 경로(`chatStream`)는 `withRetry` 를 사용하지 않으므로 §8.3 원칙과 충돌 없음" 한 줄 추가 권장 (선택 사항).

---

## 요약

Rationale 연속성 관점에서 중대한 충돌은 발견되지 않았다. `spec/5-system/7-llm-client.md` 에는 Rationale 절이 없어 "exponential backoff 만 사용한다"는 결정이 명시적 기각 근거를 갖지 않는다. plan 이 추가하는 Retry-After 우선 + fallback exponential backoff 패턴은 기존 재시도 전략을 대체가 아닌 보강이며, 최대 3회 제한 invariant 를 유지한다. 스트리밍 중 재시도 미적용 원칙(§8.3)도 침해하지 않는다. 다만 spec §6 표현이 구현과 불일치하게 남는 것을 방지하기 위해 구현 후 spec 갱신과 Rationale 신설을 권장한다.

---

## 위험도

LOW
