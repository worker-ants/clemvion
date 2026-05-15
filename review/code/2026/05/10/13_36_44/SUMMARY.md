# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 기존 저장 워크플로우 및 expression에 대한 무음 파괴(silent breakage) 경로 2개, spec 예시와 구현 간 직접 모순 1개 확인

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API Contract / Side Effect | **Sync 출력 1단 래핑 — 하위 호환성 없는 파괴적 변경.** `output: inlineResult` → `output: { result: inlineResult }` 변경으로 기존 `$node["X"].output.<field>` expression이 전부 `undefined` 반환. Zod `passthrough()` 특성상 런타임 오류 없이 silent data loss 발생 | `workflow.handler.ts:136-142` | 배포 전 DB 쿼리로 영향 워크플로우 식별 + 배포 후 expression 오류 모니터링 지점 마련. 또는 버전 플래그(`outputVersion: 2`)로 단계적 롤아웃 |
| 2 | API Contract / Side Effect | **`mappingDefSchema` 필드명 파괴적 변경 — 기존 저장 데이터 무음 실패.** `target`/`source` → `paramName`/`expression` 리네임으로 기존 DB 저장 `inputMapping`이 Zod 유효성 검사는 통과하지만 핸들러가 `mapping.paramName`만 읽어 `subInput = { undefined: undefined }` 삽입. 서브 워크플로우가 파라미터 없이 실행되어 실행 자체는 성공 | `workflow.schema.ts:9-27` | DB 마이그레이션 스크립트로 `target`→`paramName`, `source`→`expression` 일괄 변환. 또는 핸들러에서 `mapping.paramName ?? mapping['target']` 호환 폴백을 일정 기간 유지 |
| 3 | Documentation / Maintainability | **spec §5.3 JSON 예시의 에러 코드 직접 모순.** 예시 메시지 `"Workflow not found: wf_uuid_9999"`에 `"code": "SUB_WORKFLOW_FAILED"` 표기. 그러나 `mapSubWorkflowError` 구현은 이 메시지를 `SUB_WORKFLOW_NOT_FOUND`로 매핑 | `spec/4-nodes/2-flow/1-workflow.md` §5.3 | `"code": "SUB_WORKFLOW_NOT_FOUND"`로 수정하거나, 메시지를 `SUB_WORKFLOW_FAILED` fallback이 실제로 나오는 케이스("Node 'Transform' exceeded maximum iteration count" 등)로 교체 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API Contract / Side Effect | **Async `meta.status` 제거 — expression 소비자 무음 파괴.** `meta: { status: 'started' }` → top-level `status: 'started'` 이동. `$node["X"].meta.status === 'started'` 조건 분기가 `undefined === 'started'` → `false`로 비정상 동작. 스키마에 `meta` 필드가 `optional`로 남아 스키마 레벨 오류도 없음 | `workflow.handler.ts:101-108`, `workflow.schema.ts` | deprecation 기간 동안 `meta: { status: 'started' }` 병행 반환 후 제거. 또는 전체 워크플로우 expression 일괄 마이그레이션 |
| 2 | Architecture / API Contract / Dependency / Security | **`mapSubWorkflowError` — executor 에러 메시지 문자열 계약에 암묵적 의존.** `toLowerCase().includes()` 패턴 매칭으로 에러 코드 분류. executor가 메시지 포맷 변경 시 분류가 조용히 `SUB_WORKFLOW_FAILED`로 퇴보하며 컴파일 오류 없음. 보안 측면에서 사용자 입력값 포함 메시지("Workflow not found in table 'orders'")가 `SUB_WORKFLOW_NOT_FOUND`로 오분류될 수도 있음 | `workflow.handler.ts:196-218` | `WorkflowExecutor` 인터페이스에 구조화된 에러 타입(`WorkflowNotFoundError` 등) 정의 후 `instanceof` 분기로 전환. 단기적으로는 executor 실제 메시지를 검증하는 통합 테스트 추가 |
| 3 | Security | **executor 에러 메시지 무검열 노출.** `err.message`가 `output.error.message`에 그대로 삽입. `"Queue enqueue failed: connection refused to redis://internal-host:6379"` 같은 인프라 세부 정보가 워크플로우 작성자에게 노출. `truncateForErrorDetails`가 이미 `error-codes.ts`에 정의되어 있으나 `buildSubWorkflowError`에서 미사용 | `workflow.handler.ts:175` (`buildSubWorkflowError`) | `truncateForErrorDetails(err instanceof Error ? err.message : String(err), 500)` 적용. 프로덕션에서는 내부 호스트명·포트 sanitizer 추가 |
| 4 | Architecture / Dependency / Maintainability | **`mapSubWorkflowError` — 테스트 목적 모듈 export.** "Exported for unit testing" 명시됐으나 모듈 public API를 오염시키는 anti-pattern. 함수가 이미 공개 계약이 되어 향후 시그니처 변경 시 하위 호환성 고려 필요 | `workflow.handler.ts:193`, `workflow.handler.spec.ts` | `workflow-error-mapper.ts` 등 별도 모듈로 분리(OCP 개선 + 테스트 export 문제 동시 해소). 또는 `@internal` JSDoc 태그 추가 |
| 5 | Documentation / Maintainability / Scope | **작업 식별자(D-1, A-2, A-3, Phase 1) 주석 — 소스 코드·테스트에 잔류.** CLAUDE.md 규약("현재 task·fix·호출자를 참조하지 않는다") 위배. plan 문서가 `complete/`로 이동하거나 삭제되면 컨텍스트 없이 노이즈로 전락 | `workflow.handler.ts:136,160`, `workflow.handler.spec.ts`, `error-codes.spec.ts:29` | 태스크 ID 제거, 불변적 설계 의도로 대체. 예: `// D-1 —` → `// sync result wraps one level so downstream access is uniform regardless of sub-workflow output shape` |
| 6 | Architecture / API Contract / Maintainability | **`workflowNodeOutputSchema`에 더 이상 방출되지 않는 `meta.status` 필드 잔류.** async 핸들러가 `meta.status`를 제거했으나 스키마 `meta` 객체에 `status: z.string().optional()`이 남아 스키마-핸들러 드리프트 발생. 스키마를 문서로 신뢰하는 소비자 오도 | `workflow.schema.ts` (`workflowNodeOutputSchema`) | `meta` 스키마에서 `status` 필드 제거. 또는 후방 호환 파싱이 필요하다면 `@deprecated` 주석 명시 |
| 7 | Architecture | **`output.result.result` 이중 중첩 위험.** D-1 래핑으로 서브 워크플로우 최종 출력에 `result` 키가 있을 경우 `output.result.result` 이중 중첩 발생. 스펙 예시 자체가 이를 보여주나 경고 없음 | `workflow.handler.ts:137-142`, `spec/4-nodes/2-flow/1-workflow.md:115-120` | 래핑 키를 충돌 가능성이 낮은 이름(`$output`, `subResult`, `value`)으로 변경하거나, 이중 중첩 케이스를 스펙·문서에 명시적 경고로 추가 |
| 8 | Requirement / Security | **`'timeout'` 단독 키워드 매칭이 과도하게 광범위.** 서브 워크플로우 내부 노드 에러(`"PostgreSQL connection timeout after 5s"`)도 `SUB_WORKFLOW_TIMEOUT`으로 오분류 가능. `SUB_WORKFLOW_TIMEOUT`의 의미(서브 워크플로우 실행 자체의 시간 초과)와 구분 안 됨 | `workflow.handler.ts` `mapSubWorkflowError` | 조건에 실행 컨텍스트 추가. 예: `'sub-workflow'`와의 AND 조건, 또는 `'timeout'` 단독 매칭 제거하고 `'timed out'`만 유지 |
| 9 | Testing | **`SUB_WORKFLOW_TIMEOUT` async 경로 통합 테스트 누락.** sync 경로만 통합 테스트 존재. `executeAsync` reject → `buildSubWorkflowError` → `TIMEOUT` 코드 전체 경로 미검증 | `workflow.handler.spec.ts` | async 경로 케이스 추가: `mockExecutor.executeAsync.mockRejectedValue(new Error('Sub-workflow execution timed out...'))` |
| 10 | Testing | **`SUB_WORKFLOW_QUEUE_FAILED` sync 경로 통합 테스트 누락.** async 경로만 통합 테스트 존재. 대칭성 검증 불완전 | `workflow.handler.spec.ts` | sync 경로 케이스 추가 또는 "semantic하게 async 전용" 임을 주석으로 문서화 |
| 11 | Concurrency | **`_executedNodes` Set 공유 변이 — parallel 노드 컨텍스트 잠재 위험.** `parallel` 노드가 `Promise.all`로 브랜치를 동시 실행할 때, 브랜치 안에 Workflow(sync) 노드가 있으면 여러 `executeInline`이 동일 Set에 동시 접근. "Set 멤버십 확인 → await → Set 삽입" 패턴이 await 경계에서 인터리브 가능 | `workflow.handler.ts` (`executeInline` 호출부) | 이번 PR 범위 밖이나, sync 서브 워크플로우를 병렬 실행하는 엔진 경로에서 `new Set(context._executedNodes)`로 Set 격리 검토 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | **async top-level `status` 접근 예시 누락.** 스펙(§5.2)에는 있으나 end-user 문서에 `$node["X"].status` 접근 경로 미언급 | `flow.en.mdx`, `flow.mdx` async 섹션 | 양쪽 MDX async 예시 블록에 `$node["X"].status` 접근 예시 한 줄 추가 |
| 2 | Maintainability | **`mapSubWorkflowError` JSDoc — 임시 구현 후속 추적 장치 없음.** "until the executor exposes a structured error type" 명시됐으나 제거 조건·추적 링크 없어 영구 코드화 위험 | `workflow.handler.ts` JSDoc | `TODO: remove pattern-matching once WorkflowExecutor throws a typed error` 추가 또는 `plan/`에 후속 항목 등록 |
| 3 | Maintainability | **크로스파일 참조 주석 stale 위험.** `error-codes.ts`의 `// See workflow.handler.ts#mapSubWorkflowError` — 함수 이동·rename 시 자동 갱신 안 됨 | `error-codes.ts:40` | 기능 설명 중심으로 대체: `// Code is selected by mapSubWorkflowError() based on the executor's thrown message.` |
| 4 | Security | **`maskEmailForErrorDetails` 미사용.** 이메일 마스킹 유틸이 정의되어 있으나 `buildSubWorkflowError` 내에서 미호출. 권한 오류 메시지에 계정 주소가 포함될 경우 노출 | `error-codes.ts:98-104` | executor 에러 메시지 노출 전 이메일 패턴 감지 후 `maskEmailForErrorDetails` 적용 파이프라인 추가 |
| 5 | Security | **`workflowId`가 error.details에 포함.** `details: { workflowId, mode }`는 CONVENTIONS §3.2 설계이나, `workflowId`가 클라이언트까지 그대로 전달 시 내부 UUID 열거 가능 | `workflow.handler.ts:177-181` | API 게이트웨이 또는 응답 직렬화 계층에서 역할 기반 `details` 필터링 여부 확인 |
| 6 | Testing | **비-Error 객체 throw 케이스 미검증.** `throw 'plain string'`이나 `throw { code: 'x' }` 형태의 non-Error 객체에 대한 테스트 없음 | `workflow.handler.ts:175`, `workflow.handler.spec.ts` | `mockExecutor.executeInline.mockRejectedValue('plain string error')` 케이스 추가 |
| 7 | Testing | **`"queue error occurred"` 경계 케이스 미문서화.** `queue` 포함하나 `failed`/`enqueue`/`reject` 미포함 시 `SUB_WORKFLOW_FAILED` 반환되는 비직관적 경계가 테스트에 문서화 안 됨 | `workflow.handler.spec.ts` | `"queue error occurred"` 케이스를 경계 명시 테스트로 추가 |
| 8 | Architecture | **`ErrorCode` 단일 전역 객체 확장성.** 모든 노드 카테고리 에러 코드가 단일 파일에 누적. 이번 +3개, 이전 DB +3개로 God Object화 위험 | `error-codes.ts` | 중기적으로 `workflow-error-codes.ts`, `db-error-codes.ts` 등 도메인별 분리 후 `error-codes.ts`에서 re-export 구조 고려 |
| 9 | API Contract | **신규 에러 코드 추가 — additive 변경, 기존 `SUB_WORKFLOW_FAILED` fallback 유지로 비파괴적.** 단, 에러 포트에서 `code === 'SUB_WORKFLOW_FAILED'`를 전수 조건으로 쓰는 클라이언트는 새 코드를 미처리 | `error-codes.ts:38-41` | 릴리즈 노트에 "에러 포트 핸들러는 알 수 없는 코드를 graceful하게 처리해야 한다" 가이드 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| API Contract | HIGH | Sync 출력 래핑 + 필드 리네임 + `meta.status` 제거 모두 파괴적 변경 |
| Side Effect | HIGH | 두 파괴적 변경이 Zod `passthrough()` 덕분에 무음 실패 |
| Documentation | MEDIUM | spec §5.3 예시 코드와 구현 직접 모순 |
| Maintainability | MEDIUM | spec §5.3 오류 + 문자열 패턴 fragility + 작업 ID 주석 |
| Security | LOW | executor 에러 메시지 미검열 노출, 패턴 매칭 오분류 가능성 |
| Architecture | LOW | `mapSubWorkflowError` 임시 패턴의 구조적 문제, OCP 위반 |
| Dependency | LOW | executor 에러 문자열 암묵적 의존, public export 설계 |
| Concurrency | LOW | `_executedNodes` Set 공유 (기존 설계, 이번 PR 악화 없음) |
| Testing | LOW | async/sync 통합 테스트 대칭성 불완전 |
| Requirement | LOW | `'timeout'` 매칭 과도, spec 예시 불일치 |
| Scope | LOW | spec §5.3 JSON 예시 미갱신 |
| Performance | NONE | 예외 경로 소규모 연산, 성능 영향 없음 |
| Database | NONE | DB 관련 코드 없음 |

---

## 발견 없는 에이전트
- **Database** — DB 쿼리·ORM·마이그레이션 관련 코드 없음
- **Performance** — 모든 변경이 예외 경로 또는 포인터 복사 수준, 런타임 성능 영향 없음

---

## 권장 조치사항

1. **[즉시 — 배포 전 필수]** `mappingDefSchema` 필드 리네임(`target`/`source` → `paramName`/`expression`)에 대한 DB 마이그레이션 스크립트 작성 또는 핸들러에 `mapping.paramName ?? mapping['target']` 호환 폴백 추가 — 배포 즉시 기존 모든 서브 워크플로우의 파라미터 전달이 무음으로 중단됨
2. **[즉시 — 배포 전 필수]** Sync 출력 래핑(`output.result`)의 영향 범위를 DB 쿼리로 사전 식별하고 마이그레이션 계획 수립 또는 피처 플래그 도입
3. **[즉시]** `spec/4-nodes/2-flow/1-workflow.md` §5.3 JSON 예시의 `"code"` 값을 `"SUB_WORKFLOW_NOT_FOUND"`로 수정
4. **[단기]** Async `meta.status` 제거에 대한 기존 워크플로우 expression 영향 조사 및 deprecation alias 또는 마이그레이션 가이드 제공
5. **[단기]** `buildSubWorkflowError`에 `truncateForErrorDetails` 적용으로 인프라 정보 노출 차단
6. **[단기]** `SUB_WORKFLOW_TIMEOUT` async 경로 통합 테스트 추가 (대칭성 확보)
7. **[단기]** 소스 코드·테스트의 작업 식별자 주석(D-1, A-2, A-3, Phase 1) 제거 및 설계 의도 기반 주석으로 대체
8. **[중기]** `WorkflowExecutor` 인터페이스에 구조화된 에러 타입 도입 후 `mapSubWorkflowError` 패턴 매칭을 `instanceof` 분기로 전환 (plan 항목으로 등록)
9. **[중기]** `mapSubWorkflowError`를 `workflow-error-mapper.ts` 별도 모듈로 분리 (테스트 export 문제·OCP 위반 동시 해소)
10. **[중기]** `workflowNodeOutputSchema`의 `meta.status` 필드 제거 (스키마-핸들러 드리프트 해소)