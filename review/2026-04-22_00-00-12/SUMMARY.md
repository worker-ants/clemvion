# Code Review 통합 보고서

## 전체 위험도
**LOW–MEDIUM** — `get_current_workflow` 도구 추가 자체는 올바르게 구현되었으나, 프롬프트 인젝션 리스크 강화, 스냅샷 스키마 불일치, 디스패치 구조 취약점이 복합적으로 존재함

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | **Indirect Prompt Injection 리스크 강화** — 시스템 프롬프트에 "authoritative source" 지침이 추가되어 LLM이 사용자 제어 데이터(노드 label 등)를 더 적극적으로 해석하게 됨. `JSON.stringify`가 개행을 이스케이프하나 워크플로우 공유 시나리오에서 내부 위협 벡터가 될 수 있음 | `system-prompt.ts` — authoritative snapshot 지침 단락 | 스냅샷 삽입 전후에 `<workflow-snapshot>…</workflow-snapshot>` 경계 마커 추가; 서버 측 노드 label/description 길이 제한 및 특수문자 검증 적용 |
| 2 | Security | **`redactConfig` 단일 의존 보안 경계** — 민감 데이터 보호가 이 함수 하나에 집중되어 있고, 테스트는 `apiKey`만 커버. 커스텀 키 패턴(`api-key`, `secret`, `password`, `token`, `credential` 대소문자 변형 등)이 누락될 경우 LLM 및 SSE 스트림으로 노출 | `workflow-assistant-stream.service.ts:buildCurrentWorkflowResult()` / `system-prompt.ts` | denylist → allowlist 방식 전환 검토; 다양한 시크릿 키 패턴 변형 테스트 추가 |
| 3 | Architecture / Maintainability | **스냅샷 스키마 불일치 (시스템 프롬프트 vs `get_current_workflow` 응답)** — 시스템 프롬프트 엣지에는 `id` 없음, `buildCurrentWorkflowResult`에는 있음. `remove_edge`가 `id`를 필수로 요구하므로 LLM이 프롬프트 스냅샷만 보고 호출하면 실패; 두 표현의 조용한 발산 위험 | `system-prompt.ts:44–52` vs `workflow-assistant-stream.service.ts:buildCurrentWorkflowResult` | 시스템 프롬프트 엣지 매핑에 `id: e.id` 추가하여 두 포맷 통일; 또는 의도적 차이라면 주석으로 명시 |
| 4 | Architecture / Requirement | **`get_current_workflow` 디스패치가 `handleExploreCall` 밖에서 처리됨** — `explore` kind 도구임에도 선행 `if` 분기로 우회. `handleExploreCall` switch에 케이스 없음 → 해당 조건부 제거 시 `UNKNOWN_EXPLORE_TOOL` 무음 실패 | `workflow-assistant-stream.service.ts:214–225`, `handleExploreCall` switch | `handleExploreCall`에 `case 'get_current_workflow': throw new Error('handled separately')` 방어 코드 추가; 또는 `shadow: ShadowWorkflow`를 인자로 추가해 switch 내부로 흡수 |
| 5 | Maintainability | **매직 문자열 `'get_current_workflow'` 다중 파일 하드코딩** — `tool-definitions.ts`, `service.ts` 조건부, 시스템 프롬프트 prose에 분산됨. 이름 변경 시 한 곳만 놓쳐도 무음 오류 | `tool-definitions.ts:17`, `workflow-assistant-stream.service.ts:224`, `system-prompt.ts` | `tool-definitions.ts`에 `export const TOOL_NAME = { GET_CURRENT_WORKFLOW: 'get_current_workflow' } as const` 추가 후 전 파일에서 참조 |
| 6 | Maintainability | **스냅샷 매핑 로직 중복** — `ShadowSnapshot → {nodes[], edges[]}` 변환 코드가 두 곳에 미묘하게 다른 형태로 분산. `category`/`id` 포함 여부가 달라 한쪽만 수정 시 조용히 발산 | `system-prompt.ts:34–51` vs `workflow-assistant-stream.service.ts:443–466` | `toWorkflowView(snapshot, options?: { includeId?: boolean; includeCategory?: boolean })` 공유 헬퍼로 추출 |
| 7 | Testing | **테스트 커버리지 공백 (엣지 필드, 경계값, 에러 경로)** — `sourcePort`/`targetPort`/`type`/`id` 미검증; `category`/`position` 미검증; 빈 워크플로우 케이스 없음; `shadow.snapshot()` 예외 경로 없음; `handleExploreCall` 우회 여부 미확인 | `workflow-assistant-stream.service.spec.ts` | 엣지 전체 필드 `toMatchObject` 검증 추가; 빈 워크플로우 테스트 추가; `snapshot` mock throw 시나리오 추가; `expect(mocks.exploreTools.getWorkflow).not.toHaveBeenCalled()` 추가 |
| 8 | Scope | **`frontend/package-lock.json` 무관 변경 혼입** — 기능과 무관하게 수십 개 패키지의 `"peer"` 메타데이터 재분류 및 `@emnapi` 패키지 추가. 이전 `npm install` 결과가 혼입된 것으로 추정 | `frontend/package-lock.json` 전체 | 의도된 변경이 아니면 `git checkout frontend/package-lock.json`으로 되돌림; 의도된 경우 별도 커밋으로 분리 |
| 9 | Documentation | **서비스 클래스 JSDoc 및 테스트 헤더 미갱신** — `handleExploreCall`에 두 갈래 경로가 생겼으나 클래스 JSDoc 미반영; 테스트 파일 상단 커버리지 목록에 신규 2개 케이스 누락 | `workflow-assistant-stream.service.ts` 클래스 JSDoc, `workflow-assistant-stream.service.spec.ts` 상단 주석 | JSDoc에 `get_current_workflow`는 shadow 스냅샷 직접 반환(DB 조회 없음) 분기 설명 추가; 테스트 헤더 목록에 2개 케이스 추가 |
| 10 | API Contract | **SSE 이벤트 타입 스펙·구현 불일치 (기존 이슈)** — 스펙 §5.3은 편집 도구 결과를 `event: edit`으로 문서화하나 구현은 모두 `event: tool_call` + `kind` 필드 사용 | `spec/4-ai-assistant.md §5.3` vs `workflow-assistant-stream.service.ts` | 스펙을 구현 기준으로 정정하거나 별도 이슈로 추적 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | 시스템 프롬프트 토큰 ~150개 증가 (매 턴 고정 비용) | `system-prompt.ts` — authoritative snapshot 지침 + few-shot 예시 | 고트래픽 환경에서 지침 문구 압축 검토; 현재 규모는 무시 가능 |
| 2 | Performance | `redactConfig` 이중 호출 가능성 — 시스템 프롬프트 조립 시 + `get_current_workflow` 응답 시 | `workflow-assistant-stream.service.ts:buildCurrentWorkflowResult` | LLM이 편집 후에만 호출하도록 프롬프트가 유도하므로 현재 수준에서 캐싱은 과잉 |
| 3 | Requirement | 도구 description에 config redact 미언급 — LLM이 API 키 값을 기대하고 오판할 수 있음 | `tool-definitions.ts:114` | description 끝에 `"Sensitive config fields are redacted to [REDACTED]."` 추가 |
| 4 | Architecture | `handleExploreCall` 책임 경계 모호 — 이름과 달리 `get_current_workflow`를 처리하지 않음 | `workflow-assistant-stream.service.ts:407–437` | `handleExternalExploreCall`로 이름 변경하거나 위 WARNING 통합 방안으로 해결 |
| 5 | Testing | `as never` DTO 캐스팅으로 타입 검사 우회 — DTO 구조 변경 시 컴파일 오류 미발생 | `spec.ts` 전체 `baseDto as never` 패턴 | `as AssistantMessageRequestDto` 또는 `satisfies AssistantMessageRequestDto`로 전환 |
| 6 | Testing | in-turn `add_node` 테스트에서 노드 `type` 필드 미검증 | `spec.ts` — `reflects in-turn edits` 테스트 | `expect(newNode?.type).toBe('http_request')` 추가 |
| 7 | Security | 알 수 없는 도구 이름이 `'edit'` 기본값으로 처리됨 (기존 이슈) | `service.ts:214` — `?? 'edit'` fallback | fallback을 `'explore'` 또는 명시적 에러로 변경 검토 |
| 8 | Documentation | `buildCurrentWorkflowResult`에 redact 정책 적용 이유 주석 부재 | `workflow-assistant-stream.service.ts:buildCurrentWorkflowResult` | `// 시스템 프롬프트 스냅샷과 동일 보안 정책 — config redact 적용` 한 줄 추가 |
| 9 | Documentation | spec §5.3에 `get_current_workflow`의 `tool_call` 이벤트 발행 여부 불명확 | `spec/4-ai-assistant.md §5.3` | "탐색 배지는 `get_current_workflow` 포함 모든 explore 도구에 표시" 한 줄 추가 |
| 10 | Database | `get_current_workflow`는 DB 대신 인메모리 shadow 반환 — 멀티 클라이언트 협업 추가 시 동시성 이슈 잠재 | `workflow-assistant-stream.service.ts:buildCurrentWorkflowResult` | 현재는 문제없음; 향후 협업 기능 추가 시 설계 재검토 필요 |
| 11 | Dependency | `@emnapi/core@1.9.2`, `@emnapi/runtime@1.9.2` 신규 추가 (rolldown dev+optional 전이 의존성) | `frontend/package-lock.json` | 프로덕션 영향 없음; 주기적 `npm audit` 모니터링 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | **LOW–MEDIUM** | authoritative snapshot 지침으로 prompt injection 리스크 강화; redactConfig 단일 보안 경계 |
| Architecture | **LOW** | 스냅샷 스키마 불일치 (edge `id`); `get_current_workflow` 디스패치 분산 |
| Maintainability | **LOW** | 매직 문자열 다중 하드코딩; 스냅샷 매핑 로직 중복 |
| Testing | **LOW** | 엣지 필드·경계값·에러 경로 미검증; `as never` 타입 우회 |
| Scope | **LOW** | `package-lock.json` 무관 변경 혼입 |
| Documentation | **LOW** | 서비스 JSDoc·테스트 헤더 미갱신 |
| API Contract | **LOW** | SSE 이벤트 타입 스펙·구현 불일치 (기존) |
| Side Effect | **LOW** | 엣지 `id` 시스템 프롬프트 누락으로 `remove_edge` 직접 호출 어려움 |
| Performance | **LOW** | 토큰 증가·redact 재연산 (현재 규모 무시 가능) |
| Requirement | **LOW** | `handleExploreCall` switch 케이스 누락; 도구 description redact 미언급 |
| Concurrency | **NONE** | 이슈 없음 |
| Database | **NONE** | 이슈 없음 |
| Dependency | **NONE** | 이슈 없음 |

---

## 발견 없는 에이전트

- **Concurrency** — 단일 요청 격리, 동기 핸들러, Node.js 단일 스레드 보장으로 경쟁 조건 없음
- **Database** — 신규 DB 쿼리·스키마 변경 없음; `get_current_workflow`는 인메모리 전용
- **Dependency** — 실질적 외부 의존성 추가 없음; `package-lock.json` 변경은 peer 재분류 수준

---

## 권장 조치사항

1. **(즉시) 시스템 프롬프트 스냅샷 엣지에 `id` 추가** — `system-prompt.ts` 엣지 매핑에 `id: e.id` 포함. `remove_edge`가 ID를 요구하는 상황에서 LLM이 프롬프트 스냅샷만으로 호출할 경우 실패하는 실질적 기능 결함.

2. **(즉시) `handleExploreCall` switch에 방어 케이스 추가** — `case 'get_current_workflow': throw new Error('handled by caller')` 또는 인라인 주석으로 암묵적 의존 관계 명시. 향후 리팩토링 시 무음 실패 방지.

3. **(단기) 도구 이름 상수화** — `TOOL_NAME = { GET_CURRENT_WORKFLOW: 'get_current_workflow' } as const`를 `tool-definitions.ts`에 추가하고 `service.ts`, `system-prompt.ts`에서 참조.

4. **(단기) 스냅샷 매핑 헬퍼 추출** — `toWorkflowView(snapshot, options)` 공통 함수로 `system-prompt.ts`와 `buildCurrentWorkflowResult`의 중복 제거 및 필드 일관성 확보.

5. **(단기) 테스트 보강** — 엣지 전체 필드 검증(`sourcePort`, `targetPort`, `type`, `id`), `category`/`position` 검증, 빈 워크플로우 케이스, `snapshot` 예외 경로, `handleExploreCall` 우회 여부(`not.toHaveBeenCalled`) 추가.

6. **(단기) `package-lock.json` 정리** — 의도치 않은 혼입이라면 되돌리고, 의도된 변경이라면 별도 커밋으로 분리.

7. **(중기) Prompt Injection 방어 강화** — 스냅샷 주입 시 `<workflow-snapshot>` XML 태그로 경계 명시; 서버 측 노드 label 길이·특수문자 검증 추가; `redactConfig`에 다양한 시크릿 키 패턴 변형 테스트 추가.

8. **(중기) JSDoc·스펙 동기화** — 서비스 클래스 JSDoc에 `get_current_workflow` 직접 처리 분기 설명 추가; 테스트 파일 헤더에 신규 케이스 2개 추가; spec §5.3 SSE 이벤트 타입 불일치 정정.