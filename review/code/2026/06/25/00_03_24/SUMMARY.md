# Code Review 통합 보고서

**대상 커밋**: bf91ebfff2b61a7ecb9981447c1b5a73327f3094
**변경 유형**: `refactor(ai-agent): C-2 1차 — executeSingleTurn setup 단계 §6.1 메서드 분해`
**리뷰 일시**: 2026-06-25

---

## 전체 위험도

**LOW** — behavior-preserving 리팩토링으로 기능 정확성은 유지됨. WARNING 2건은 모두 문서/테스트 수준의 수정 가능한 결함이며 즉각적인 런타임 위험은 없음.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `buildSingleTurnMessages` JSDoc 및 caller 주석에 §6.1 단계 번호 오기재 — "단계 1.5·1.7" 로 표기되어 있으나 해당 메서드는 단계 1.7(`ai_user` push)만 수행. 단계 1.5(memory injection)는 `applySingleTurnMemoryInjection`에서 수행. 이번 리팩토링의 핵심 목표(spec 추적성을 위한 §6.1 단계 번호 명기)를 부분적으로 훼손. | `ai-turn-executor.ts` 라인 971~974 JSDoc, 라인 1137~1138 caller 주석 | JSDoc 및 caller 주석을 "§6.1 단계 1.7 — 초기 messages 조립 + ConversationThread `ai_user` push (spec §2.2, LLM 호출 전)." 로 수정 |
| 2 | testing | `buildSingleTurnSystemPrompt`의 §11.4 ordering 3개 분기(KB_TOOL_GUIDANCE, condition suffix, PRESENTATION_TOOLS_GUIDANCE)가 executor 레벨에서 테스트되지 않음. handler spec 간접 커버만 존재하여 executor 직접 변경 시 회귀 탐지 능력 부족. | `ai-turn-executor.spec.ts` `executeSingleTurn` describe 블록 | knowledgeBases/conditions/presentationTools 각 케이스에 대해 `llmService.chat` 호출 시 system content에 해당 guidance 문자열 포함 여부를 단언하는 테스트 3종 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | `buildSingleTurnMessages` 메서드가 `build*` 이름과 달리 ConversationThread에 `ai_user` turn을 push하는 side effect를 보유 — CQS(Command-Query Separation) 경계 | `buildSingleTurnMessages` 정의부 | 메서드명을 `buildAndRegisterSingleTurnMessages`로 변경하거나 JSDoc에 `@sideEffect pushAiThreadTurn` 명시 |
| 2 | architecture | `applySingleTurnMemoryInjection` args 객체가 9개 필드를 묶어 ISP 관점에서 비대 — 향후 memoryManager 인터페이스 분리 시 value object로 정의 권장 | `applySingleTurnMemoryInjection` 시그니처 | 현 단계 조치 불요. 향후 named value object 타입 정의 검토 |
| 3 | architecture | `executeSingleTurn` 내 `messages`·`finalSystemPrompt`가 `let` 재할당 방식으로 파이프라인 연결 — 순서 의존성이 컴파일 타임에 탐지되지 않음 | `executeSingleTurn` 내 `let` 재할당 블록 | 현 PR 조치 불요. JSDoc/주석으로 ordering 의존성 설명 유지 |
| 4 | architecture | tool-loop 응집도가 `executeSingleTurn`에 여전히 잔류 — 2차 PR(`processMultiTurnMessage` 분해) 예정 | `executeSingleTurn` 전체 | 2차 PR에서 tool-loop 추출로 SRP 완성 |
| 5 | maintainability | `applySingleTurnMemoryInjection` 반환 타입 annotation 누락 — 다른 두 메서드(`buildSingleTurnSystemPrompt: string`, `buildSingleTurnMessages: ChatMessage[]`)와 불일치 | `applySingleTurnMemoryInjection` 시그니처 | `Promise<{ messages: ChatMessage[]; finalSystemPrompt: string; memoryMeta: ...; singleTurnInjection: ... }>` 또는 named interface `SingleTurnMemoryInjectionResult` 추가 |
| 6 | maintainability | `applySingleTurnMemoryInjection` args 타입 블록 내 `//` 라인 주석 혼입 — JSDoc `/** */` 관례와 불일치 | args 타입 선언 블록 | `/** */` JSDoc 또는 메서드 JSDoc 본문으로 이동 |
| 7 | maintainability | `maxToolCalls` 기본값 `10`이 인라인 매직 넘버 — 파일 상단 다른 상수들과 불일치 | `executeSingleTurn` 내 `\|\| 10` | `const DEFAULT_MAX_TOOL_CALLS = 10;` 파일 상단에 추가 |
| 8 | requirement | `applySingleTurnMemoryInjection` JSDoc 단계 표기 "§6.1 단계 1.3 · [5]" — §11.4 ordering 번호 `[5]` 혼용, 1.5 누락 | `applySingleTurnMemoryInjection` JSDoc 라인 1001 | "§6.1 단계 1.3 · 1.5 — persistent memory recall + ConversationThread/Memory 주입"으로 수정 |
| 9 | requirement | spec §6.1 순서(1.3→1.5→1.7)와 실제 실행 순서(1.7→1.3/1.5) 역전이 주석에 미명시 — 기능적 영향 없으나 독자 혼란 가능 | `executeSingleTurn` caller 주석 라인 1138~1149 | caller 주석에 "ai_user push가 memory injection보다 앞서 실행되는 이유: getThreadExcludingNode 필터로 주입 결과에 영향 없음" 한 줄 명기 |
| 10 | side_effect | `applySingleTurnMemoryInjection` 반환값을 caller가 명시적으로 반영하지 않으면 원본 변수가 미갱신되는 잠재적 패턴 — 현재 구현은 올바르게 처리 | `executeSingleTurn` 내 `messages = memInjection.messages` 블록 | 반환 타입을 named type으로 선언하거나 JSDoc에 "반환값으로 caller 변수를 반드시 갱신해야 한다" 명기 |
| 11 | testing | `buildSingleTurnMessages`의 `ai_user` push 타이밍(LLM 호출 전 정확히 1회) 회귀 테스트 부재 | `ai-turn-executor.spec.ts` | `conversationThreadService` mock 주입 후 `appendAiUserMessage`가 `llmService.chat` 이전에 정확히 1회 호출됨을 jest 호출 순서로 검증 |
| 12 | testing | `buildSingleTurnMessages`의 빈 `userPrompt`/`systemPrompt` 엣지 케이스 미테스트 | `ai-turn-executor.spec.ts` | `userPrompt: ''` 및 `systemPrompt: ''` 케이스 추가 — messages 배열에 해당 role 항목 부재 단언 |
| 13 | testing | `llmService.chat` mock이 전달된 messages 내용을 검증하지 않음 — 메시지 조립 오류를 테스트가 탐지 불가 | `ai-turn-executor.spec.ts` beforeEach | `expect(mockLlmService.chat).toHaveBeenCalledWith(expect.objectContaining({ messages: expect.arrayContaining([...]) }), ...)` 형태 단언 추가 |
| 14 | documentation | `applySingleTurnMemoryInjection` 내 `appliedScope: 'none'` 설정 근거 인라인 주석 삭제 — JSDoc에 흡수되었으나 본문 독자 가독성 저하 | `applySingleTurnMemoryInjection` 내 해당 블록 | `// 자동 전략은 contextScope 계열 무효 — contextInjection meta 미echo (spec §5).` 한 줄 복원 |
| 15 | documentation | `buildSingleTurnMessages` 내 `pushAiThreadTurn` 호출부 인라인 주석 제거 | `buildSingleTurnMessages` 내 `this.pushAiThreadTurn(...)` | `// ConversationThread push (spec §2.2 — single-turn ai_user, 단계 1.7).` 복원 |
| 16 | documentation | spec 단계 번호와 실행 순서 역전에 대한 주석 안내 부재 | `executeSingleTurn` 내 `applySingleTurnMemoryInjection` caller 주석 | "단계 번호는 spec §6.1 기준이며 실행 순서는 buildSingleTurnMessages(1.5) 후 본 메서드(1.3) 순" 안내 추가 |
| 17 | performance | `buildSingleTurnSystemPrompt` 내 `new Date()` 생성과 `executeSingleTurn` 내 `Date.now()` 분산 — 기능 영향 없음, 기존 패턴 유지 | `buildSingleTurnSystemPrompt` 내 `now: new Date()` | 필수 수정 아님. 타임스탬프 통일 원하면 `singleTurnStartedAt` 재활용 검토 |
| 18 | scope | review/ 산출물 파일들 EOF 개행 누락 (`\ No newline at end of file`) — diff 가독성·마크다운 파서 호환성 영향 | `review/consistency/2026/06/24/23_43_01/` 하위 6개 파일 | 산출물 생성 스크립트에서 파일 말미 개행 문자 보장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 경계 전면 보존. 프롬프트 인젝션 경계·sanitizeToolError·formData byte cap·tool_result preview 제한 모두 유지 |
| performance | NONE | 중간 객체 2개 추가는 LLM 네트워크 I/O 대비 무시 가능. 알고리즘 복잡도·블로킹 I/O 변화 없음 |
| concurrency | NONE | 공유 accumulator caller scope 유지. 순차 await 체인 보존. 암묵적 변이 없음 |
| scope | NONE | 단일 파일 내부 변경. 공개 인터페이스 불변. review/ 산출물은 의무 포함 |
| architecture | LOW | CQS 경계(buildSingleTurnMessages side effect), args 객체 비대, 파이프라인 재할당 패턴 — 의식적 결정으로 문서화됨 |
| requirement | LOW | buildSingleTurnMessages JSDoc §6.1 단계 오기재(WARNING). 나머지는 문서 명확화 INFO |
| side_effect | LOW | buildSingleTurnMessages의 ConversationThread push가 시그니처에 미노출. 기존 behavior 보존 |
| maintainability | LOW | applySingleTurnMemoryInjection 반환 타입 누락, args 타입 내 주석 스타일 불일치 |
| testing | LOW | §11.4 ordering 3분기 executor 레벨 커버리지 갭(WARNING). 기존 7388건 + e2e 214건 회귀 방어는 정상 |
| documentation | LOW | 반환 타입 미명시, 인라인 주석 일부 삭제, 실행 순서 역전 안내 부재 |

---

## 발견 없는 에이전트

- **concurrency**: 동시성·경쟁 조건·데드락·스레드 안전성 위험 요소 없음 — 해당 없음

---

## 권장 조치사항

1. **[WARNING-1] `buildSingleTurnMessages` JSDoc 단계 번호 수정** — JSDoc 및 caller 주석의 "단계 1.5·1.7"을 "단계 1.7"로 수정. spec 추적성이라는 이번 리팩토링의 핵심 목표를 복원하는 조치이므로 우선 처리.

2. **[WARNING-2] §11.4 ordering 분기 executor 테스트 추가** — `ai-turn-executor.spec.ts`에 knowledgeBases/conditions/presentationTools 3종 케이스 추가. executor 직접 변경 시 회귀 탐지 능력 확보.

3. **[INFO-5] `applySingleTurnMemoryInjection` 반환 타입 명시** — named interface `SingleTurnMemoryInjectionResult` 또는 인라인 객체 타입 추가로 세 추출 메서드 간 타입 일관성 확보.

4. **[INFO-8] `applySingleTurnMemoryInjection` JSDoc 단계 표기 수정** — `[5]` 제거, `1.5` 명시로 spec §6.1 단계 번호 체계 통일.

5. **[INFO-9] 실행 순서 역전 근거 주석 추가** — caller 주석에 ai_user push 선행 이유(`getThreadExcludingNode` 필터로 결과 동일) 한 줄 명기.

6. **[INFO-14,15] 인라인 주석 복원** — `appliedScope: 'none'` 근거 주석 및 `pushAiThreadTurn` 호출부 주석 복원.

7. **[INFO-7] `maxToolCalls` 매직 넘버 상수화** — 파일 상단 `DEFAULT_MAX_TOOL_CALLS = 10` 추가 (다음 리팩토링 기회).

8. **[INFO-18] 산출물 파일 EOF 개행 보장** — 산출물 생성 스크립트에서 trailing newline 처리 (저우선순위).

---

## 라우터 결정

라우터가 reviewer를 선별함 (`routing_status=done`).

- **실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency` (10명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외**: 4명

| 제외된 reviewer | 이유 |
|------------------|------|
| dependency | 의존성 추가/변경 없음 — 순수 내부 리팩토링 |
| database | DB 스키마·쿼리·마이그레이션 변경 없음 |
| api_contract | public API 시그니처 변경 없음 |
| user_guide_sync | 사용자 대면 기능 변경 없음 |