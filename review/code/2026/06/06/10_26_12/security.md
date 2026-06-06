# 보안(Security) 코드 리뷰

**리뷰 대상**: `execution-engine.service.ts` (PR-B1 park 즉시 해제 + slow-path 일원화), `execution-engine.service.spec.ts`, 및 consistency review 산출물(`review/consistency/2026/06/06/` 하위)

---

## 발견사항

### **[INFO]** 폼 데이터 화이트리스트 — 빈 필드 정의 시 필터 우회
- **위치**: `execution-engine.service.ts` L3780–3790 (`waitForFormSubmission`)
- **상세**: `allowedFieldNames.size === 0` 조건이 참이면(노드 config 에 `fields` 배열이 비어 있거나 미정의) 제출된 모든 키를 무조건 통과시킨다. 외부 공격자가 임의 키를 주입해도 화이트리스트 방어가 무력화된다. 코드 주석(WARN #8)이 이 동작을 의도적으로 허용한다고 명시하나, 빈 필드 정의가 "아무 노드 설정이 없는 폼" 과 "공격자가 빈 config 를 전달한 폼" 을 구분하지 못한다.
- **제안**: `fields` 가 비어 있을 때 빈 객체를 반환하는 fail-closed 정책을 고려하거나, 적어도 최대 키 수·값 크기 상한으로 2차 방어를 추가한다. 현재 구조에서 fields 가 비어있는 폼은 실제 UX 상 의미 없으므로 `size === 0` 시 `{}` 반환이 더 안전하다.

---

### **[INFO]** `assertSameWorkspace` — `callerWorkspaceId` 부재 시 fail-open
- **위치**: `execution-engine.service.ts` L877–893 (`assertSameWorkspace`)
- **상세**: `callerWorkspaceId` 가 `undefined` 이면 경고 로그만 남기고 cross-workspace sub-workflow 호출을 허용한다. 코드 주석이 "점진적 도입" 과 "향후 fail-closed 전환" 을 명기하고 있으나, 현재 상태에서 `parentWorkspaceId` 를 설정하지 않는 레거시 진입점이 workspace 격리를 우회할 수 있다. 공격자가 직접 엔진 API 에 도달하기 어렵지만(BullMQ Worker 내부), 내부 취약점이 겹칠 경우 격리 우회로 이어질 수 있다.
- **제안**: 레거시 호출자가 `parentWorkspaceId` 를 전달하도록 완전히 마이그레이션 완료 후 fail-closed(`throw`)로 전환하는 일정을 plan 에 명기한다.

---

### **[INFO]** `_resumeCheckpoint` allow-list — `mcpServers` 필드 포함
- **위치**: `execution-engine.service.ts` L4566–4577 (`buildResumeCheckpoint`), L4549–4552 (주석)
- **상세**: `mcpServers` 가 "secret-ref 기반(평문 secret 미포함)" 이라고 주석에 명시돼 있어 현재 구현 의도는 명확하다. 그러나 `mcpServers` 의 실제 shape 이 향후 변경돼 평문 token 을 포함하게 되면 자동으로 DB 에 영속된다. allow-list 에 포함된 필드가 credential-free 임을 보장하는 자동화 검증이 없다.
- **제안**: `mcpServers` 가 포함될 때 secret 필드(`apiKey`, `token` 등)가 없음을 검증하는 단위 테스트("canary" 패턴)를 `_resumeCheckpoint` 테스트(spec 파일 L4476–4483 패턴)와 동일하게 추가하거나, `mcpServers` 를 checkpoint 에서 제외하는 방향을 재검토한다.

---

### **[INFO]** 에러 메시지에서 `executionId` / `workflowId` 외부 노출 범위
- **위치**: `execution-engine.service.ts` L4943–4953 (`resolveWaitingNodeExecutionId`), L1780–1795 (`RehydrationError`)
- **상세**: `InvalidExecutionStateError` 와 `RehydrationError` 의 메시지에 `executionId`, `nodeId`, 노드 타입 등이 포함된다. 해당 예외가 컨트롤러 레이어에서 클라이언트 응답으로 직접 전달되면 내부 ID 가 노출된다. 현재 L4938–4945 에서 `resolveWaitingNodeExecutionId` 는 서버 로그에만 상세를 남기고 고정 메시지를 throw 하는 것으로 주석이 명시하나, 실제 `InvalidExecutionStateError` 가 클라이언트에 그대로 직렬화되는지는 컨트롤러/필터 레이어 코드에 의존한다.
- **제안**: 전역 예외 필터(NestJS `ExceptionFilter`)가 `InvalidExecutionStateError` / `RehydrationError` 의 `message` 를 클라이언트 응답에서 블라킹하는지 확인하고, 미적용 시 error filter 에 이 예외 타입을 명시적으로 처리한다.

---

### **[INFO]** `error.stack` — 서버 로그에는 기록되나 범위 확인 필요
- **위치**: `execution-engine.service.ts` L3553–3560 (WARN #7), L2181–2184
- **상세**: `error.stack` 을 DB 에 저장하지 않고 서버 로그(`this.logger.error`)에만 기록하는 패턴이 올바르게 구현돼 있다. 다만 L2181–2184 의 별도 경로(`markExecutionCancelled` 컨텍스트)도 동일 패턴인지 확인이 필요하다.
- **제안**: 단일 "에러 → DB" 경로에서 `.stack` 을 제거하는 헬퍼 함수로 중복 패턴을 통합하면 향후 신규 경로에서의 누락을 방지할 수 있다.

---

### **[INFO]** 테스트 파일의 "canary" 검증 패턴 — 긍정적 보안 설계
- **위치**: `execution-engine.service.spec.ts` L4476–4483, L5561–5566
- **상세**: `_resumeCheckpoint` 에 `INTERNAL_SYSTEM_PROMPT_SHOULD_NOT_PERSIST` / `cred-leak-canary` 가 포함되지 않음을 검증하는 명시적 테스트가 존재한다. `details` 에 Bearer 토큰이 sanitize 되는지도 테스트가 커버한다. 보안 회귀를 자동으로 잡는 좋은 패턴이다.

---

## 요약

PR-B1(`exec-park-durable-resume`)의 `execution-engine.service.ts` 변경은 보안 관점에서 전반적으로 양호하다. 하드코딩된 시크릿 없음, SQL 인젝션 위험 없음(TypeORM parameterized query 전용), XSS/커맨드 인젝션 벡터 부재, credential 영속 방지(`_resumeState` strip + `_resumeCheckpoint` allow-list)가 체계적으로 구현돼 있다. `sanitizeLastErrorMessage` 로 에러 메시지 내 토큰 노출 차단, `error.stack` DB 미저장, 서브워크플로 재귀 깊이 제한(MAX_RECURSION_DEPTH=10), workspace 격리 등 주요 OWASP 항목이 코드 레벨과 테스트 레벨 양쪽에서 커버된다. 발견된 항목은 모두 INFO 수준으로, 빈 폼 필드 정의 시 화이트리스트 우회·`assertSameWorkspace` fail-open·`mcpServers` 향후 credential 포함 위험·에러 ID 외부 전달 범위가 설계 문서에 명시돼 있으나 추가 방어 조치를 고려할 만한 수준이다.

## 위험도

LOW

STATUS: OK
