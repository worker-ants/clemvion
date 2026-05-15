# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `GoogleClient.stream()` 테스트 부재(HIGH)와 LLM API 에러 메시지 클라이언트 노출·프롬프트 인젝션(MEDIUM) 이 주요 위험. 나머지는 LOW 수준의 코드 품질 개선 사항.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `stream()` 핵심 시나리오(abort, tool_call finishReason override, usage fallback, 스트림 중 throw) 전체 미테스트 — `google.client.spec.ts`가 untracked 상태로 머지 시 검증 없음 | `google.client.ts` `stream()` 전체 | SDK mock 기반 시나리오 테스트 작성 필수 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | LLM API 원시 에러 메시지(Google 프로젝트 ID, 인프라 정보 포함 가능)를 SSE로 클라이언트에 그대로 노출 | `google.client.ts` catch 블록, `workflow-assistant-stream.service.ts` 외부 catch | `classifyStreamError` 코드 기반 정적 문자열로 교체, 원문은 서버 로그만 |
| 2 | Security | 워크플로우 노드 config 값이 시스템 프롬프트에 비격리 삽입 → 프롬프트 인젝션 가능 | `workflow-assistant-stream.service.ts` → `buildSystemPrompt()` | config 값에 길이 상한 또는 `<workflow_context>` 태그로 지시문 섹션과 분리 |
| 3 | Testing | `mapGoogleFinishReason()`, `classifyStreamError()` — pure function임에도 단위 테스트 없음 | `google.client.ts` L28–53 | 분기별 단위 테스트 추가 |
| 4 | Testing | `asString()`, `safeParse()` 배열 처리 변경에 대한 회귀 테스트 없음 | `workflow-assistant-stream.service.ts` | `safeParse('[1,2,3]') === {}` 등 명시적 케이스 추가 |
| 5 | Correctness | `stream()` 내 동일 millisecond에 여러 `functionCall` 처리 시 `Date.now()` 기반 ID 충돌 가능 (`chat()`에도 동일 패턴 중복) | `google.client.ts` L237, L164 | `randomUUID()` 로 교체 또는 `generateToolCallId()` private 헬퍼 추출 |
| 6 | Correctness | `abort` 후 `done` 이벤트 emit 의도가 불명확 — `error` 후 `return`하는 패턴과 불일치 | `google.client.ts` stream() 하단 | `'aborted'` 시 early return 처리 또는 의도를 주석으로 명시 |
| 7 | Correctness | `openQuestions`를 `as string[]`로만 캐스팅, 요소 레벨 타입 검증 없어 오염된 데이터 DB 저장 가능 | `workflow-assistant-stream.service.ts` `buildPlanFromArgs()` | `.filter((q): q is string => typeof q === 'string')` 적용 |
| 8 | Correctness | `buildChatInputs()`에서 마지막 메시지가 `assistant` role일 경우 미검증 — Gemini API는 마지막이 `user`여야 함 | `google.client.ts` `buildChatInputs()` | 사전 검증 후 early return 또는 error yield |
| 9 | Concurrency | 동일 세션 동시 요청 시 `loadMessages` → `appendMessage` 시퀀스가 비원자적 — LLM context 오염 가능 | `workflow-assistant-stream.service.ts` `streamMessage()` | 세션 단위 직렬화(인메모리 큐 or Redis lock) |
| 10 | Maintainability | `streamMessage()` 단일 메서드에 세션 조회·LLM 설정·히스토리 조립·스트림 루프·툴 분기·에러 처리·DB 저장 집중 (~270줄) | `workflow-assistant-stream.service.ts` `streamMessage()` | `buildLlmMessages()`, `processToolCall()`, `runStreamLoop()` 등으로 분리 |
| 11 | Performance | `embed()` 에서 텍스트마다 순차 API 호출 — N개 텍스트 시 지연 선형 증가 | `google.client.ts` `embed()` | `Promise.all()` 병렬화 (rate limit 존재 시 `p-limit` 병행) |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `classifyStreamError` 에러 분류 로직이 각 provider 클라이언트에 분산, 공통 추상화 없음 | `google.client.ts` L51–53 | `llm/utils/classify-error.ts` 공통 유틸로 추출 |
| 2 | Architecture | `asString`, `safeParse` 가 파일 로컬 유틸로 선언 — 향후 복사 위험 | `workflow-assistant-stream.service.ts` 하단 | 두 번째 사용 시점에 `src/common/utils/` 로 이동 |
| 3 | Architecture | `stream()` usage 누적이 "마지막 청크에 전체값" Gemini API 가정에 암묵적 의존 | `google.client.ts` L205–213 | 가정을 주석으로 명시하거나 `Math.max()` 방어 코드 추가 |
| 4 | Dependency | `usageMetadata.thoughtsTokenCount` 및 `sendMessageStream`의 `signal` 옵션이 SDK 버전 종속적 | `google.client.ts` L175, L222 | `package.json`의 `@google/generative-ai` 버전 범위(`^`) 고정 검토 |
| 5 | Correctness | `stream()` done 이벤트의 `finishReason: 'aborted'`가 `ChatStreamEvent` 유니온에 포함 여부 불명확 | `google.client.ts` done yield 구간 | `ChatStreamEvent['done'].finishReason`에 `'aborted'` 명시 또는 `'stop'`으로 정규화 |
| 6 | Correctness | `safeParse` 배열 폴백이 `{}` 반환 시 하위 `asString()` 모두 fallback 사용 → 잘못된 tool 호출 무음 실행 | `workflow-assistant-stream.service.ts` `safeParse()` | 배열 케이스에서 `null` 반환 후 호출 측 스킵 처리 고려 |
| 7 | Correctness | `classifyStreamError`의 `message.includes('429')` 방식 — 오탐 가능성(`'4291'` 등) | `google.client.ts` L51–53 | `\b429\b` 정규식 또는 SDK 에러 타입 직접 검사 |
| 8 | Maintainability | `startChatSession()` 반환 타입이 암시적 — SDK 버전 변경 시 조용히 타입 변경 가능 | `google.client.ts` L127 | `ChatSession` 등 명시적 반환 타입 선언 |
| 9 | Performance | `buildChatInputs()`에서 동일 배열을 `filter()` 2회 순회 | `google.client.ts` `buildChatInputs()` | 단일 `for...of` 순회로 `systemParts`·`nonSystem` 동시 분류 |
| 10 | Documentation | `stream()` 메서드에 JSDoc 없음 (인터페이스에도 없다면 계약 문서화 필요) | `google.client.ts` L192 | `LLMClient` 인터페이스 파일에 `stream()` 계약 문서 확인·추가 |
| 11 | Documentation | `classifyStreamError`의 문자열 기반 감지 한계를 설명하는 주석 없음 | `google.client.ts` L51–53 | 1줄 주석 추가 권장 |
| 12 | Scope | `safeParse` 배열 가드, `toShadowSnapshot` 캐스팅 단순화, 다수 포맷팅 정렬이 기능 변경과 혼재 | `workflow-assistant-stream.service.ts` | 독립 버그픽스·포맷팅은 별도 커밋으로 분리 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Testing | **HIGH** | `stream()` 전체 미테스트, `google.client.spec.ts` untracked |
| Security | **MEDIUM** | API 에러 메시지 노출, 프롬프트 인젝션 경로 |
| Requirement | **LOW** | abort/done 불일치, 마지막 메시지 role 미검증 |
| Performance | **LOW** | `embed()` 순차 호출, tool call ID 생성 중복 |
| Side Effect | **LOW** | tool call ID 충돌, `asString` 숫자 처리 변경 |
| Maintainability | **LOW** | `streamMessage()` 과도한 책임 집중, `openQuestions` 검증 누락 |
| Architecture | **LOW** | 에러 분류 분산, usage 누적 암묵적 가정 |
| Concurrency | **LOW** | 동일 세션 동시 요청 시 context 오염 가능 |
| Documentation | **LOW** | `stream()` JSDoc 없음, `classifyStreamError` 주석 없음 |
| Scope | **LOW** | 독립 버그픽스·포맷팅이 기능 변경과 혼재 |
| Dependency | **LOW** | SDK 버전 종속 런타임 동작 (`signal`, `thoughtsTokenCount`) |
| API Contract | **NONE** | 외부 API 계약 변경 없음, breaking change 없음 |
| Database | **NONE** | DB 관련 코드 없음 |

---

## 발견 없는 에이전트

- **Database** — DB 쿼리·스키마·마이그레이션 관련 코드 없음
- **API Contract** — HTTP 엔드포인트·요청/응답 스키마 변경 없음, `stream()` 추가는 하위 호환

---

## 권장 조치사항

1. **[즉시] `google.client.spec.ts` 테스트 작성** — abort, tool_call finishReason override, usage fallback, 스트림 중 throw 시나리오 커버. 현재 untracked 상태로 머지 시 핵심 로직이 완전히 미검증.

2. **[즉시] API 에러 메시지 클라이언트 노출 차단** — `google.client.ts`와 `workflow-assistant-stream.service.ts` catch 블록에서 `error.message`를 SSE로 직접 전달하는 부분을 정적 문자열로 교체, 원문은 logger로만 기록.

3. **[단기] 프롬프트 인젝션 방어** — `buildSystemPrompt()`에 삽입되는 노드 config 값에 길이 상한 적용 또는 `<workflow_context>` 태그로 지시문 섹션과 격리.

4. **[단기] `openQuestions` 요소 레벨 타입 검증** — `as string[]` 캐스팅 대신 `.filter((q): q is string => typeof q === 'string')` 적용.

5. **[단기] tool call ID를 `randomUUID()`로 통일** — `chat()`·`stream()` 양쪽의 `Date.now() + Math.random()` 패턴을 `generateToolCallId()` private 헬퍼로 추출하고 `randomUUID()` 사용.

6. **[단기] `mapGoogleFinishReason()`, `classifyStreamError()` 단위 테스트 추가** — pure function이므로 비용 낮음.

7. **[중기] `streamMessage()` 책임 분리** — `buildLlmMessages()`, `processToolCall()`, `runStreamLoop()` 단위로 분리해 테스트 가능성 확보.

8. **[중기] 동일 세션 동시 요청 직렬화** — `sessionId` 키 기반 인메모리 요청 큐 또는 Redis lock 적용.

9. **[중기] `embed()` 병렬화** — `Promise.all()` 적용, rate limit 존재 시 `p-limit` 병행.

10. **[선택] `asString`, `safeParse` 공통 유틸 분리** — 두 번째 사용 시점에 `src/common/utils/` 로 이동.