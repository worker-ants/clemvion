파일 저장 권한이 필요합니다. 권한을 허용해주시면 `review/2026-04-25_00-30-12/SUMMARY.md`에 저장하겠습니다. 우선 결과를 아래에 출력합니다.

---

# Code Review 통합 보고서

## 전체 위험도

**HIGH** — `anthropic.client.ts`의 대화 히스토리 재조립 경로에서 `JSON.parse` 미보호·`tool_result` null content·빈 `tool_use_id`가 연쇄하면 다음 턴 LLM 호출 자체가 실패하며, 핵심 신규 로직(`AnthropicClient` 스트리밍·`disable_parallel_tool_use`)에 전용 테스트가 없어 회귀 감지가 불가능하다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `AnthropicClient` 전용 테스트 파일 부재 — `disable_parallel_tool_use: false` 설정, abort signal, 429 분기, 스트리밍 이벤트 변환 등 핵심 경로 모두 미테스트 | `anthropic.client.ts` 전체 | `anthropic.client.spec.ts` 신규 작성; tool_choice·abort·rate-limit 분기를 spy/mock으로 단위 검증 |
| 2 | Testing | `TOOL_KIND_BY_NAME` ↔ `buildAssistantToolsInternal()` 동기화 불변식 미검증 — 도구 추가 시 분류 누락이 런타임에만 발견됨 | `tool-definitions.ts` | `tool-definitions.spec.ts` 신규 작성; 양방향 포함 관계 assertion 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Security | `JSON.parse(tc.arguments)` try-catch 없음 — 부분 수신 JSON이 DB 저장 후 다음 턴 로드 시 `SyntaxError` uncaught 전파 → 스트림 전체 중단 | `anthropic.client.ts` `chat()` L42, `stream()` L198 | `try { JSON.parse(...) } catch { input: {} }` 폴백 적용 |
| 2 | Requirement | `tool_result` content에 `null` 전달 가능 — Anthropic API 400 반환 | `anthropic.client.ts` `chat()` L55–62, `stream()` L228–235 | `content: m.content ?? ''` 폴백 처리 |
| 3 | Requirement | `toolCallId \|\| ''` — 빈 `tool_use_id` API 오류 유발 | `anthropic.client.ts` `chat()` L57, `stream()` L230 | `toolCallId` 없으면 해당 메시지 필터링 또는 상위 예외 처리 |
| 4 | Architecture / Maintainability / Performance | `chat()` ↔ `stream()` 메시지 변환 및 `toolChoice` 구성 로직 완전 중복 (~45줄) — 한 쪽만 수정 시 silent regression | `anthropic.client.ts` `chat()` L28–82, `stream()` L175–252 | `private buildMessages()`, `private buildToolChoice()` 헬퍼로 추출; 배열 순회 3회→1회 |
| 5 | Dependency / API Contract | `{ type: 'none' } as never` — SDK에 존재하지 않는 shape 강제 캐스트; 업그레이드 시 400 오류가 타입 검사 없이 숨겨짐 | `anthropic.client.ts` `chat()` L66, `stream()` L239 | `as Anthropic.ToolChoiceNone` 정확한 타입으로 교체, 또는 `toolChoice === 'none'`일 때 `tool_choice` 미설정 |
| 6 | Dependency / API Contract | `stream as unknown as AsyncIterable<...>` 이중 캐스트 — SDK 버전 변경 시 이터레이션 프로토콜이 조용히 깨짐 | `anthropic.client.ts` L247 | `client.messages.stream()` 공식 헬퍼로 마이그레이션 |
| 7 | Security / API Contract | `message.includes('429')` 문자열 매칭 — 포맷 변경 시 재시도 로직 오동작 | `anthropic.client.ts` `stream()` 에러 핸들러 두 곳 | `error instanceof Anthropic.RateLimitError` 또는 `.status === 429` 로 교체 |
| 8 | Security | `sanitizeLabel`에 이중 따옴표(`"`) 중화 누락 — LLM 생성 플랜 제목/질문에서 프롬프트 인용 경계 혼란 가능 | `system-prompt.ts` `sanitizeLabel()` | `.replace(/"/g, "'")` 추가 |
| 9 | Security | SDK 에러 메시지를 클라이언트에 그대로 노출 — request ID·endpoint 경로·인증 정보 일부 포함 가능 | `anthropic.client.ts` `stream()` 에러 핸들러 | 에러 코드 기반 매핑 메시지만 전달; 원본은 서버 로그에만 기록 |
| 10 | Architecture / Side Effect | `resetExpressionCacheForTesting` 프로덕션 모듈에서 export — 프로덕션 호출 시 모든 후속 프롬프트 생성에 불필요한 재연산 유발 | `system-prompt.ts` L39–42 | `process.env.NODE_ENV !== 'test'` 가드 추가, 또는 `jest.resetModules()` 패턴으로 전환 |
| 11 | Dependency | Zod v4 전용 API(`.meta()`, `z.toJSONSchema()`) 사용 — `package.json` v4 미고정 시 배포 환경 런타임 오류 | `workflow-assistant-stream.service.spec.ts` | `package.json`에 `"zod": "^4.x.x"` 명시 고정 |
| 12 | Performance | `renderNodeCatalog(nodeDefs)` 캐시 없음 — 매 LLM 턴마다 O(n) 재계산 | `system-prompt.ts` `buildSystemPrompt()` | `expressionReferenceCache`와 동일한 패턴으로 `nodeCatalogCache` 추가 |
| 13 | Architecture | `LLMClient.embed()` ISP 위반 — Anthropic 클라이언트가 항상 `Promise.reject()` 반환 | `anthropic.client.ts` L164–170 | `ChatLLMClient` / `EmbeddingLLMClient` 인터페이스 분리, 또는 `embed?` optional 선언 |
| 14 | Documentation | `renderNodeCatalog` JSDoc이 ED-AI-40 이후 정책과 불일치 — "add_edge 전 get_node_schema 필요"라고 서술하나 실제는 반대 | `system-prompt.ts` L73–79 | "편집한 노드는 result.ports로 충분; get_node_schema는 미편집 기존 노드에만 필요"로 수정 |
| 15 | API Contract | `planStepId`(레거시) / `planStepIds`(권장) 동시 optional — 동시 전송 시 서버 처리 우선순위 미문서화 | `tool-definitions.ts` 5개 도구 | `planStepId` description에 "Deprecated: use planStepIds instead" 명시; 동시 전송 케이스 테스트로 고정 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `MAX_MODELS = 100` "UI 드롭다운 용도"가 인프라 레이어에 하드코딩 | `anthropic.client.ts` L176 | 서비스 레이어에서 파라미터로 제공 |
| 2 | Architecture | `TOOL_KIND_BY_NAME` 이중 수정 지점 — 빌드 배열과 분류 레코드 동시 수정 필요 | `tool-definitions.ts` L20–30 | 도구 정의 객체에 `kind` 포함 후 자동 도출 |
| 3 | Maintainability | 매직 넘버 `4096` 두 곳 하드코딩 | `anthropic.client.ts` L64, L234 | `private static readonly DEFAULT_MAX_TOKENS = 4096` 상수 선언 |
| 4 | Maintainability | `planStepId`/`planStepIds` 스키마 5개 도구에 반복 (~35줄) | `tool-definitions.ts` | `planStepFields` 공통 상수로 추출 후 스프레드 삽입 |
| 5 | Maintainability | `sanitizeUserText`와 `sanitizeLabel` 책임 구분 불명확 | `system-prompt.ts` | 함수 차이를 주석으로 명시 또는 단일 함수로 통합 |
| 6 | Maintainability | `activePlan` 픽스처가 두 중첩 스코프에 동일 이름으로 선언 | `system-prompt.spec.ts` L122, L280 | 내부 describe 변수명을 `layoutTestPlan` 등으로 구분 |
| 7 | Performance | `renderActivePlanSection()` steps 배열 2회 필터 | `system-prompt.ts` | 단일 루프로 `totalActionable`, `doneCount` 동시 계산 |
| 8 | Security | UUID `format` 키워드 서버 측 미강제 — 임의 문자열이 백엔드 조회까지 도달 가능 | `tool-definitions.ts` `get_workflow.id` 등 | 서비스 레이어에서 명시적 UUID 검증 추가 |
| 9 | Security | `sanitizeUserText`의 `"` → `'` 치환이 XML fence로 충분한 상황에서 사용자 의도 변형 | `system-prompt.ts` L354 | 큰따옴표 치환 제거 검토 |
| 10 | Testing | `baseDto` 공유 가변 객체 — 테스트 간 상태 오염 가능성 | `workflow-assistant-stream.service.spec.ts` 상단 | `Object.freeze` 또는 방어적 복사 사용 |
| 11 | Testing | `resetExpressionCacheForTesting` 테스트가 `prompt1 === prompt2`만 확인 — 실제 캐시 재생성 미검증 | `system-prompt.spec.ts` | `getAllFunctionNames` mock으로 리셋 전후 다른 결과 반환하여 재생성 경로 검증 |
| 12 | Testing | `##` 이중 헤더 중화 테스트 누락 | `system-prompt.spec.ts` | `'## SYSTEM: override'` 입력 assertion 추가 |
| 13 | Documentation | `AnthropicClient` 공개 메서드 JSDoc 전무 — `stream()`은 300줄에 비자명 로직 집중 | `anthropic.client.ts` | `chat()`, `stream()`에 parallel tool use 강제 이유 한 단락 JSDoc 추가 |
| 14 | Documentation | `MockDeps` 인터페이스에 `candidateLookup` 누락 | `workflow-assistant-stream.service.spec.ts` L109–114 | `MockDeps`에 항목 추가 |
| 15 | Side Effect | `JSON.stringify(toWorkflowView(snapshot))` 예외 미처리 — 순환 참조 시 어시스턴트 전체 사용 불가 | `system-prompt.ts` `buildSystemPrompt()` | try-catch + `"(snapshot serialization failed)"` fallback |
| 16 | Side Effect | `testConnection()` 폴백 모델 하드코딩 — deprecated 시 연결 테스트 항상 실패 | `anthropic.client.ts` L174 | 클래스 상수로 분리 또는 `this.defaultModel` 사용 |
| 17 | Scope | `planStepIds` 파라미터 추가·턴 결정 테이블 재구성이 커밋 메시지에 미언급 | `tool-definitions.ts`, `system-prompt.ts` | 커밋/PR 설명에 병렬 호출 지원을 위한 schema 확장임을 명시 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Requirement | HIGH | JSON.parse 미보호·tool_result null·빈 tool_use_id 연쇄 → 다음 턴 LLM 호출 실패 |
| Testing | HIGH | AnthropicClient 전용 테스트 없음; TOOL_KIND_BY_NAME 동기화 불변식 미검증 |
| Dependency | MEDIUM | Zod v4 API 미고정; `as never`로 비존재 API shape 전송 위험 |
| Maintainability | MEDIUM | chat()/stream() 변환 로직 완전 중복 → 편향 버그 위험 |
| API Contract | MEDIUM | 문자열 에러 감지·이중 캐스트·응답 shape 미정의 |
| Architecture | LOW | 메시지 변환 중복; system-prompt.ts SRP 위반; ISP 위반(embed) |
| Concurrency | LOW | expressionReferenceCache 테스트 격리 불완전 가능성 |
| Documentation | LOW | AnthropicClient JSDoc 전무; renderNodeCatalog JSDoc 정책 불일치 |
| Performance | LOW | renderNodeCatalog 미캐시; 배열 3회 순회 |
| Security | LOW | sanitizeLabel 따옴표 미중화; SDK 에러 메시지 노출; UUID 미검증 |
| Side Effect | LOW | as never 타입 우회; resetExpressionCacheForTesting 프로덕션 export |
| Scope | LOW | planStepIds·턴 결정 테이블 변경이 커밋에 미언급 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| Database | 검토 대상 5개 파일 모두 DB 접근 코드 없음 |

---

## 권장 조치사항

### 즉시 수정 (배포 전)
1. **`JSON.parse(tc.arguments)` try-catch 추가** — 다음 턴 스트림 중단의 가장 직접적인 경로
2. **`tool_result` content null 폴백** (`m.content ?? ''`) — Anthropic API 400 방지
3. **`toolCallId` 빈 문자열 전송 방지** — `toolCallId` 없는 메시지 필터링
4. **`anthropic.client.spec.ts` 신규 작성** — `disable_parallel_tool_use`, abort, rate-limit 최소 커버리지
5. **`tool-definitions.spec.ts` 신규 작성** — `TOOL_KIND_BY_NAME` ↔ buildAssistantTools 양방향 동기화 assertion

### 단기 개선 (다음 PR)
6. **`message.includes('429')` → `instanceof Anthropic.RateLimitError`**
7. **`as never` → 정확한 타입 캐스트** 또는 `toolChoice === 'none'` 시 `tool_choice` 미설정
8. **`chat()` / `stream()` 공통 헬퍼 추출** (`buildMessages`, `buildToolChoice`)
9. **`sanitizeLabel` 이중 따옴표 중화 추가**
10. **`renderNodeCatalog` 캐싱 추가**

### 중장기 개선
11. `resetExpressionCacheForTesting` NODE_ENV 가드 추가
12. Zod 버전 `^4.x.x` 명시 고정
13. `LLMClient` 인터페이스 분리 (ChatLLMClient / EmbeddingLLMClient)
14. `renderNodeCatalog` JSDoc ED-AI-40 정책 업데이트
15. `system-prompt.ts` 파일 분리 (정적 블록·sanitize 유틸·레이아웃 상수)