## 발견사항

### [INFO] 마스킹 포맷이 짧은 비밀값의 끝 4자를 노출
- **위치:** `explore-tools.service.ts` `maskSensitiveFields` 적용 결과 (`"****<last4>"` 포맷)
- **상세:** `apiKey: 'sk-abcd1234'` → `'****1234'` 형태로 마지막 4자가 노출됩니다. 운영 환경에서 짧은 키(8자 미만) 또는 순차적 토큰이 사용되는 경우, 노출된 suffix가 패턴 추론에 활용될 수 있습니다. 테스트에서는 `password: 'p@ss'` → `'****'` (≤4자는 전체 마스킹)으로 처리되어 단일 정책이 아닌 분기가 존재합니다.
- **제안:** `maskSensitiveFields` 유틸의 `last4` 노출 정책을 재검토하거나, 민감도가 높은 키 종류(authorization, token)는 suffix를 생략하고 `'[REDACTED]'` 고정 치환을 사용하는 것을 권장합니다.

---

### [INFO] 자식 실행 타임라인 병렬 로딩에 동시성 상한 없음
- **위치:** `explore-tools.service.ts:getExecutionDetails` — `Promise.all(directChildren.map(...))`
- **상세:** 직계 자식 실행(sub-workflow depth 1)이 수십 개 이상인 경우, 모든 `loadTimeline()` 쿼리가 동시에 실행되어 TypeORM 커넥션 풀 부하가 급증할 수 있습니다. LLM이 반복적으로 해당 도구를 호출하면 DB 리소스 고갈 가능성이 있습니다.
- **제안:** `Promise.all` 대신 `p-limit` 또는 청크 단위 순차 실행(`Promise.allSettled` + concurrency cap)을 도입하거나, 자식 실행 목록 자체에 `TAKE N` 상한을 추가하세요.

---

### [INFO] `getExecutionDetails`에서 workspace 검증을 DB 쿼리 이후에 수행
- **위치:** `explore-tools.service.ts:getExecutionDetails` — `findOne({ where: { id: executionId } })` 이후 `execution.workflow?.workspaceId !== workspaceId` 체크
- **상세:** `getWorkflowExecutions`와 달리 `getExecutionDetails`는 DB 쿼리에 `workspaceId` 조건을 포함하지 않고, 결과를 받은 후 애플리케이션 레벨에서 workspace를 검증합니다. 기능적으로는 안전하지만(`EXECUTION_NOT_FOUND` 반환), DB 레이어에서 필터링하는 방어적 설계와 불일치합니다. 또한 `execution.workflow`가 lazy-load 또는 null인 경우 `workspaceId`가 `undefined`가 되어 `undefined !== workspaceId`가 `true`가 되므로 정상적으로 거부되지만, 관계 로딩 실패 시 동작이 암묵적입니다.
- **제안:** 쿼리 레벨 방어를 추가하거나 `workflow` relation이 반드시 로드됨을 명시적으로 보장하세요:
  ```typescript
  const execution = await this.executionRepo.findOne({
    where: { id: executionId, workflow: { workspaceId } },
    relations: ['workflow'],
  });
  ```

---

### [INFO] 부모 실행 조회 시 workspace scope 없이 단순 id 조회
- **위치:** `explore-tools.service.ts:isExecutionInScope` — `findOne({ where: { id: execution.parentExecutionId } })`
- **상세:** 스코프 검증을 위해 부모 실행을 조회할 때 workspace 조건이 없습니다. 부모 실행이 같은 workspace 내에 있다는 전제는 실제 제약이 아닌 논리적 추론에 의존합니다. 정상 운영에서는 문제가 없으나, 데이터 무결성 이슈 발생 시 cross-workspace parent 관계가 이론적으로 가능합니다.
- **제안:** 부모 조회 시에도 workspace 조건을 포함하거나, 조회 후 `parent.workflow?.workspaceId === workspaceId`를 추가로 검증하세요.

---

### [INFO] LLM 생성 `args.status` 값의 UI 렌더링
- **위치:** `tool-call-badge.tsx` — `` `executions (${status})` ``
- **상세:** `status`는 LLM이 생성한 tool call argument에서 옵니다. React 텍스트 노드로 렌더링(`<span>{label}</span>`)되므로 XSS는 불가능합니다. 다만 LLM이 비정상 긴 문자열을 생성하는 경우 UI가 비어 보이거나 레이아웃이 깨질 수 있습니다. `truncate` 클래스가 적용되어 있어 시각적 영향은 제한적입니다.
- **제안:** 현행 구현으로 충분하나, 서버 응답(`call.result.items`)에서 status를 읽는 방식(신뢰된 소스)으로 전환하면 더 견고합니다.

---

## 요약

변경사항은 보안 관점에서 전반적으로 양호합니다. `workspaceId`와 `currentWorkflowId`를 LLM 인자가 아닌 서버 세션에서 바인딩하는 설계로 핵심 스코프 경계를 LLM이 우회할 수 없으며, UUID 형식 검증·상태값 화이트리스트·limit 클램핑이 모두 DB 접근 이전에 수행됩니다. `EXECUTION_NOT_FOUND`와 `EXECUTION_NOT_IN_SCOPE`를 구분하여 정보 누출을 최소화하고, 민감 필드 마스킹이 재귀적으로 적용되는 점도 긍정적입니다. 주요 관심사는 자식 실행 병렬 쿼리의 동시성 상한 부재와 `getExecutionDetails`의 workspace 검증이 DB 레이어가 아닌 애플리케이션 레이어에서 수행된다는 점이며, 두 사항 모두 즉각적인 취약점이 아닌 개선 권고 수준입니다.

## 위험도

**LOW**