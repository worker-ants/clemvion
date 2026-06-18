# 정식 규약 준수 검토 결과

검토 대상: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts` (diff)
검토 모드: `--impl-done`, scope=`spec/5-system/4-execution-engine.md`, diff-base=`origin/main`

---

## 발견사항

### 발견사항 없음

diff 범위가 순수 테스트 파일(`*.spec.ts`) 의 **단언(expect) 추가와 테스트 케이스 신설**에 한정된다. 명명 규약·출력 포맷 규약·문서 구조 규약·API 문서 규약 관점에서 점검할 대상은 다음과 같다.

---

#### 1. 명명 규약

변경된 코드는 `LLM_API_ERROR`, `LLM_PROVIDER_QUOTA` 두 에러 코드 문자열을 참조한다.

- `LLM_API_ERROR`: `spec/4-nodes/3-ai/1-ai-agent.md §10` 의 에러 코드 표에 직접 등재되어 있지 않으나, `classifyLlmError` 의 `분류 불가 fallback` 경로가 내부적으로 산출하는 코드로 추론된다. 테스트 주석이 "미등록 explicit code 는 분류 시 그대로 보존(passthrough)" 라고 설명하는데, `details.status=429` 를 가진 에러가 `LLM_API_ERROR` 로 결과되는 것은 `extractHttpStatus` 경로를 타지 않아 `LLM_RATE_LIMIT` 으로 승격되지 않는다는 의미다. 해당 동작은 §10 분류 규칙 ( `429→LLM_RATE_LIMIT` 는 raw `.status` 기반이며 `details.status` 로는 촉발되지 않는다는 설계)과 일치한다.

- `LLM_PROVIDER_QUOTA`: 신규 테스트가 `code: 'LLM_PROVIDER_QUOTA'` 를 명시 code 로 에러 객체에 주입하고, 결과로 동일 코드가 보존된다고 단언한다. `spec/conventions/error-codes.md §1` 의 "의미 기반 명명" 원칙은 *등록된 공용 코드*에 적용되며, 테스트에서 임의 "vendor 전달 explicit code" 의 passthrough 동작을 검증하는 목적으로 사용하는 인라인 문자열 리터럴은 이 원칙의 직접 적용 대상이 아니다. `LLM_PROVIDER_QUOTA` 는 프로덕션 코드가 발행하는 코드가 아니라 *테스트 픽스처(provider가 실제로 심는 임의 explicit code 시나리오)* 임이 주석에서 명확하다.

**결론**: 두 코드 모두 명명 규약 위반 없음.

---

#### 2. 출력 포맷 규약

신설 테스트는 `result.code`, `result.details.retryable` 을 단언한다. 이는 `spec/4-nodes/3-ai/1-ai-agent.md §10` 의 `output.error.details.retryable` 필수 invariant 및 CONVENTIONS Principle 3.2.1 과 정합한다.

테스트 L59: `(result.details as Record<string, unknown>).retryable` 을 `false` 로 단언 — 미등록 코드의 보수적 `non-retryable` 처리 규칙(§10 §1097)을 검증하므로 규약 준수.

---

#### 3. 문서 구조 규약

diff 에 spec 문서 변경이 없다. Target 문서 `spec/5-system/4-execution-engine.md` 는 변경되지 않았다. 기존 spec 문서의 frontmatter(`id`/`status`/`code`/`pending_plans`) 및 Overview / 본문 / Rationale 3섹션 구조는 이미 준수되고 있다(기존 상태 검토).

---

#### 4. API 문서 규약

테스트 파일이므로 OpenAPI/Swagger 데코레이터·DTO 명명 패턴과 무관하다.

---

#### 5. 금지 항목 점검

- `spec/conventions/error-codes.md §1`: 인라인 문자열 리터럴로 에러 코드를 발행하는 것은 `AuditLogsService.record` 패턴과 달리 `error-codes.md` 가 금지하지 않는다(audit-actions.md 의 `AUDIT_ACTIONS` union 강제 패턴이며, LLM 에러 코드에는 동일 메커니즘 없음). 테스트 픽스처 리터럴은 적용 범위 외.
- `spec/conventions/error-codes.md §4`: 내부 분류 코드가 `output.error.code` 로 직접 발행되지 않아야 한다는 규약 — diff 에 내부 분류 코드 노출 없음. passthrough 경로에서 explicit code 보존은 §10 분류 규칙에 명시된 정규 동작임.
- `spec/conventions/audit-actions.md §1`: 적용 범위 외.

---

### 요약

검토 diff 는 `ai-turn-orchestrator.service.spec.ts` 의 기존 테스트에 `expect(result.code).toBe('LLM_API_ERROR')` 단언을 추가하고, 미등록 explicit code passthrough 동작(`LLM_PROVIDER_QUOTA` 픽스처)을 신규 테스트로 검증한 변경이다. 두 변경 모두 `spec/4-nodes/3-ai/1-ai-agent.md §10` 의 분류 규칙 ("명시 code 보존 + non-retryable") 및 `output.error.details.retryable` invariant(CONVENTIONS Principle 3.2.1)와 정확히 일치한다. `spec/conventions/error-codes.md` 의 명명 원칙·`spec-impl-evidence.md` 의 frontmatter 의무·`swagger.md` 의 DTO 규약 중 어느 항목과도 충돌하지 않는다. 정식 규약 위반 발견사항 없음.

---

### 위험도

NONE
