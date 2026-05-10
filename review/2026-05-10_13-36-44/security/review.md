## 발견사항

### **[WARNING]** 실행기(executor) 에러 메시지 무검열 노출

- **위치**: `workflow.handler.ts:175` — `buildSubWorkflowError`
- **상세**: `message = err instanceof Error ? err.message : String(err)` 로 추출한 원문 메시지가 `output.error.message` 에 그대로 삽입됩니다. Executor가 `Queue enqueue failed: connection refused to redis://internal-host:6379` 또는 내부 파일 경로가 포함된 메시지를 던질 경우, 워크플로우 작성자(인증된 사용자지만 인프라 세부 정보까지 볼 필요는 없는)에게 인프라 토폴로지가 노출됩니다.
- **제안**: `error-codes.ts` 에 이미 구현된 `truncateForErrorDetails` 가 LLM/이메일 노출을 이유로 정의되어 있으나, `buildSubWorkflowError` 에서는 사용되지 않습니다. 최소한 다음처럼 길이를 제한하고, 프로덕션 환경에서는 내부 호스트명·포트를 별도 sanitizer로 걸러야 합니다:
  ```typescript
  const message = truncateForErrorDetails(
    err instanceof Error ? err.message : String(err),
    500,
  ) ?? 'Unknown error';
  ```

---

### **[WARNING]** `mapSubWorkflowError` 문자열 패턴 매칭 — 에러 코드 위장 가능성

- **위치**: `workflow.handler.ts:195–218` — `mapSubWorkflowError`
- **상세**: `lower.includes('workflow not found')` / `lower.includes('queue')` 와 같은 단순 문자열 포함 여부로 에러 코드를 분류합니다. Sub-workflow 내부 노드가 사용자 입력값이 포함된 에러 메시지(`Workflow not found in table 'orders'` 등)를 던지면 `SUB_WORKFLOW_NOT_FOUND` 로 잘못 분류될 수 있습니다. 현재 코드에서는 에러 분기 라우팅 로직이 달라지는 것에 그치나, 향후 분기 조건이 보안 결정에 영향을 준다면 위험해집니다.
- **제안**: Executor 계층에서 구조화된 에러 타입(예: `class WorkflowNotFoundError extends Error {}`)을 던지고, `instanceof` 로 분류하는 방식으로 전환해야 합니다. 현재 주석도 이 점을 인식하고 있습니다(`until the executor exposes a structured error type`). 임시 해결책으로 패턴을 더 구체적인 prefix로 제한하는 것을 권장합니다.

---

### **[INFO]** 에러 details에 인프라 컨텍스트 포함

- **위치**: `workflow.handler.ts:177–181`
- **상세**: `details: { workflowId: configEcho.workflowId, mode: configEcho.mode }` 는 CONVENTIONS §3.2에 따른 설계이지만, `workflowId` 는 내부 UUID로 워크플로우 목록 탐색에 사용될 수 있습니다. 현재 `output.error.details` 가 클라이언트(프론트엔드)까지 그대로 전달된다면 공개 API 응답에서 내부 ID 열거가 가능합니다.
- **제안**: API 게이트웨이 또는 응답 직렬화 계층에서 `details` 필드를 역할 기반으로 필터링하거나, `workflowId` 를 클라이언트 측 별칭으로 매핑하는지 확인이 필요합니다.

---

### **[INFO]** `maskEmailForErrorDetails` 미사용

- **위치**: `error-codes.ts:98–104`
- **상세**: 이메일 마스킹 유틸리티가 정의되어 있으나, 검토된 `workflow.handler.ts` 내 어디에서도 호출되지 않습니다. Sub-workflow 에러 메시지에 이메일 주소가 포함될 경우(예: 권한 오류에 계정 주소가 담기는 경우) 자동으로 마스킹되지 않습니다.
- **제안**: Executor 에러 메시지를 `output.error.message` 에 노출하기 전, 이메일 패턴을 감지해 `maskEmailForErrorDetails` 를 적용하는 파이프라인을 추가하거나, 함수 사용 규약을 문서화하여 호출자가 직접 적용하도록 강제해야 합니다.

---

## 요약

이번 변경은 Sub-Workflow 에러 코드 세분화, Sync 결과 1단 래핑, Async 출력 보강 등 기능적 개선이 목적이며, 인젝션·인증우회·암호화 등 OWASP Top 10 주요 취약점은 발견되지 않았습니다. 주요 우려는 Executor가 던지는 내부 에러 메시지가 `truncateForErrorDetails` 나 별도 sanitizer 없이 `output.error.message` 에 그대로 노출된다는 점으로, 인프라 세부 정보(호스트명, 포트, 내부 경로)가 워크플로우 작성자에게 노출될 수 있습니다. 에러 코드 분류를 문자열 패턴 매칭에 의존하는 구조적 취약성도 Executor가 구조화된 에러 타입을 지원하는 시점에 해소되어야 합니다.

## 위험도

**LOW**