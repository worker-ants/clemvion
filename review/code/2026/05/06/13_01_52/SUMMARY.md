파일 쓰기 권한이 필요합니다. 아래는 완성된 통합 보고서입니다.

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — `endMultiTurnConversation` 테스트 전무, `buildConditionOutput` single_turn 경로의 mode 오염, `conversationHistory` 미구현 silent gap, 다수의 보안 설계 결함이 복합적으로 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `endMultiTurnConversation` 메서드(엔진이 직접 호출하는 public API)에 테스트가 단 하나도 없음. 잘못된 state 구조 입력 시 런타임 오류 가능 | `handler.ts:1086–1110` | `user_ended / error / max_turns / condition` 각 endReason, 빈 messages, 선택 키 누락 시나리오 테스트 추가 |
| 2 | Documentation / API Contract | `aiAgentNodeOutputSchema` 주석이 "legacy bare object (no config/output wrapper)"라고 명시하지만 핸들러는 `{ config, output: { result: {...} }, meta }` 중첩 구조를 반환. 프론트엔드 자동완성 경로 불일치(`output.response` vs 실제 `output.result.response`) | `schema.ts:372–426` | 주석과 스키마 필드를 실제 출력 구조로 갱신. `metadata` → `meta` 필드명도 함께 교정 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Testing / API Contract / Side Effect | `buildConditionOutput`이 `executeSingleTurn` 경로에서도 `config.mode: 'multi_turn'`을 하드코딩 반환. 단일 턴 조건 라우팅 테스트가 `config.mode`를 검증하지 않아 미탐지 | `handler.ts:1190–1191`, 호출 `L509` | `buildConditionOutput`에 `mode` 파라미터 추가 또는 호출자에서 `'single_turn'` 주입. 테스트에 `result.config.mode` 검증 추가 |
| 2 | Requirement | `conversationHistory: 'none'\|'last_n'\|'full'` / `historyCount` UI 위젯 노출되나 핸들러 구현 전무 — silent feature gap | `schema.ts:323–351` | 핸들러에 구현하거나 `hidden: true` 처리 후 미구현 명시 |
| 3 | Security | `sanitizeToolError` 주석은 "Strip base64/token-shaped substrings"이나 실제 구현은 첫 줄+200자 truncation만 수행. DB 연결 문자열 등 자격증명이 LLM 컨텍스트·WS·meta에 노출 가능 | `handler.ts:64–72` | 자격증명 패턴 regex 마스킹 추가 또는 주석을 실제 구현 수준으로 수정 |
| 4 | Security | `workspaceId` falsy 시 빈 문자열 `''`로 실행 계속(fail-open). 크로스-워크스페이스 데이터 접근 가능 | `handler.ts:420, 701` | `if (!workspaceId) throw new Error('Missing workspaceId')` fail-closed 처리 |
| 5 | Security | `maxToolCalls`/`maxTurns` 스키마에 상한 제약 없음. `maxTurns: 0 = unlimited` 허용으로 무제한 LLM 비용 유발 가능 | `schema.ts:281–294, 354–367` | `max(50)` / `max(100)` 상한 추가 |
| 6 | Security | Condition prompt가 이스케이프 없이 시스템 프롬프트에 직접 삽입. 워크플로 작성자의 프롬프트 인젝션 가능 | `handler.ts:1302–1307` | 신뢰 경계 명확화. XML 태그 등으로 삽입 범위 한정 |
| 7 | Security | `tool_call_started` WS 이벤트가 raw LLM arguments를 길이 제한 없이 브로드캐스트. `tool_call_completed`는 200자 제한하나 started는 미적용 | `handler.ts:276–287` | `arguments`에도 `previewContent()` 또는 별도 길이 제한 적용 |
| 8 | Security | `aiAgentNodeConfigSchema.passthrough()`로 미정의 config 필드가 무음 통과 | `schema.ts:369` | `.strict()` 전환 또는 화이트리스트 기반 필드 읽기 |
| 9 | Architecture / Maintainability | `executeSingleTurn`(L492–623)과 `processMultiTurnMessageInner`(L877–1010)에 tool loop 로직 ~130줄 구조적 중복. 정책 변경 시 두 곳 동기화 필요 | `handler.ts:492–623`, `877–1010` | `private async runToolLoop(params)` 추출 |
| 10 | Architecture | `ConditionDef` 타입이 handler.ts interface와 schema.ts Zod schema로 이중 정의 | `handler.ts:91–95`, `schema.ts:71–93` | handler.ts interface 제거, schema.ts에서 `z.infer<typeof conditionDefSchema>` export |
| 11 | Architecture | `_resumeState: { ...state, ... }` 스프레드로 미지 필드 암묵적 전파. feature-out 필드 누적이 이미 현재 상태에서 관찰됨 | `handler.ts:1063` | 상태 타입 interface 명시 후 필드 명시적 나열 |
| 12 | Architecture | `buildMultiTurnFinalOutput` public / `buildConditionOutput` private 비대칭. 테스트-구현 직접 결합의 신호 | `handler.ts:1112, 1167` | `private buildOutput(...)` 하나로 통합. 테스트는 공개 인터페이스로 검증 |
| 13 | Architecture | `AiAgentHandler` 단일 클래스에 LLM·도구·WS·RAG·조건·출력·provider 생명주기 1,370줄 집중 | `handler.ts` 전체 | ToolLoopRunner 전략 패턴 분리, 출력 빌더 순수 함수 모듈 추출 |
| 14 | Architecture | WebSocket 서비스 직접 임포트 — 도메인 레이어가 인프라 레이어에 직접 의존 (DIP 위반) | `handler.ts:22–27` | `AgentEventEmitter` 인터페이스 도입, WebsocketService를 어댑터로 주입 |
| 15 | Performance | LLM이 한 응답에 여러 KB 도구를 동시 요청해도 `for...of + await` 순차 처리. 테스트명 "parallel kb_ tool calls"와 구현 불일치 | `handler.ts:552–573`, `939–964` | `await Promise.all(calls.map(...))` 병렬화. 결과 push는 toolCallId 정렬 |
| 16 | Performance | `buildTools`의 provider 초기화도 순차 실행 | `handler.ts:1325–1338` | `await Promise.allSettled(providers.map(...))` 병렬화 |
| 17 | Performance | `classifyToolCalls`가 tool loop 내 매 이터레이션마다 `condNameToCondition` Map 재구성. conditions는 실행 중 불변 | `handler.ts:493, 879, 1232–1235` | 루프 진입 전 1회만 Map 생성 후 파라미터로 전달 |
| 18 | Requirement | `conditions` 배열 내 중복 ID 미검증. 중복 시 Map에 마지막 조건만 남아 예상치 못한 포트로 라우팅 | `schema.ts:456–495` | `new Set(ids).size !== ids.length` 검사 추가 |
| 19 | Requirement | `maxToolCalls` 도달 후 루프 탈출 시 LLM content가 null이면 `response: null` 반환. 관련 테스트 미검증 | `handler.ts:491–623, 626` | 루프 탈출 후 content null 시 fallback 문자열 삽입 |
| 20 | Testing | single_turn은 조건 tool `toolCallCount` 미증가, multi_turn은 증가 — 비대칭 미테스트 | `handler.ts:575–585`, `966–976` | multi_turn 혼합 시나리오 toolCallCount 누적 검증 테스트 추가 |
| 21 | Testing | Provider `buildTools` 예외 시 warn-and-continue 동작 미테스트 | `handler.ts:1326–1338` | `mockRejectedValue`로 실패 후 다른 provider 도구 정상 등록 검증 |
| 22 | Testing | `adaptHandlerReturn` 회귀 테스트가 `waiting_for_input` shape만 커버 | `spec.ts:588–603` | `ended` shape 및 single_turn 출력에도 검증 추가 |
| 23 | Testing | 단일 `it`에서 `handler.execute` 2회 호출, mock 누적 상태로 두 assertion이 비독립 | `spec.ts:137–164` | 두 개의 독립적인 `it` 블록으로 분리 |
| 24 | Concurrency | MCP provider 세션 상태가 인스턴스에 유지되는 경우, 동시 실행 시 A의 cleanup이 B의 활성 세션 해제 위험 | `handler.ts:388–401` | per-request factory 격리 또는 executionId 키 기반 세션 맵 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Dependency | `toolName()` 함수와 `normalTools` 블록이 feature-out으로 도달 불가한 dead code | `handler.ts:110–112, 1341–1353` | `normalTools` 블록을 `[]`로 교체하여 의도 명확화 |
| 2 | Performance | `conditions.indexOf(cond)` — Map lookup 이후 다시 O(n) 선형 탐색 | `handler.ts:1263` | Map 구성 시 `{ cond, index }` 함께 저장하여 O(1) 처리 |
| 3 | Performance | `[...messages]` 스냅샷이 루프 매 이터레이션마다 O(n) 복사 | `handler.ts:467–469 등` | lazy copy 또는 메시지 수 임계치 초과 시에만 스냅샷 |
| 4 | Performance | `turnDebugHistory` 매 턴마다 전체 배열 스프레드 복사 | `handler.ts:899, 1028` | 불변 제약 없다면 push-to-mutable 전환 |
| 5 | Requirement | `endReason: 'out' as const`가 multi_turn endReason 유니온에 미포함 | `handler.ts:652` | `'completed'` 등으로 통일하고 유니온에 포함 |
| 6 | Requirement | `ragThreshold`(0–1), `ragTopK`(1+) 스키마 범위 제약 없음 | `schema.ts:199–221` | `min`/`max` 추가 |
| 7 | Security | `processMultiTurnMessage` userMessage 길이 검증 없음 | `handler.ts:784` | 서비스 정책 기반 최대 길이 제한 |
| 8 | Side Effect | `RagAccumulator.getSources()`가 내부 배열 참조를 직접 반환 | `handler.ts:165` | `return [...this.sources]` 얕은 복사본 반환 |
| 9 | Documentation | single_turn(미증가) vs multi_turn(증가) 비대칭에 multi_turn 측 주석 없음 | `handler.ts:575, 966` | multi_turn 경로에 증가 이유 한 줄 주석 추가 |
| 10 | Documentation | `aiAgentNodeOutputSchema`의 `metadata` 필드명이 실제 출력 키 `meta`와 불일치 | `schema.ts:411–424` | `metadata` → `meta` 교정 |
| 11 | Documentation | `AiAgentHandler` 클래스 레벨 JSDoc 부재 | `handler.ts:241` | 두 모드 흐름, provider 인터페이스, WS optional 의존성 한 단락 JSDoc |
| 12 | Documentation | `buildMultiTurnFinalOutput` public 메서드 JSDoc 부재 | `handler.ts:1112` | `turnDebug` vs `turnDebugHistory` 역할 차이 JSDoc 추가 |
| 13 | Documentation | spec의 "Stage 5" 마이그레이션 주석이 완료 후 문맥 없는 노이즈가 됨 | `spec.ts:512, 808, 1524` | CONVENTIONS §N 참조 또는 현재 기대 동작 설명으로 교체 |
| 14 | Maintainability | `processMultiTurnMessage` 테스트마다 동일한 state 객체를 인라인 반복 선언 | `spec.ts:628–1139` | `baseMultiTurnState` 공유 픽스처 + spread override 도입 |
| 15 | Scope | `turnConfig`에 feature-out된 `toolNodeIds`, `toolOverrides`가 여전히 전달됨 | `handler.ts:839–841` | 이후 정리 PR에서 제거 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Testing | HIGH | `endMultiTurnConversation` 테스트 전무, `buildConditionOutput` mode 버그 미탐지 |
| Requirement | HIGH | `conversationHistory` silent feature gap, single_turn 조건 출력 mode 오류 |
| Security | MEDIUM | sanitizeToolError 구현-주석 불일치, workspaceId fail-open, 상한 부재, prompt injection |
| Architecture | MEDIUM | God Object(1,370줄), tool loop 중복, ConditionDef SSOT 위반, 상태 스프레드 |
| Performance | MEDIUM | provider 도구 호출 순차 처리, conversationHistory 미구현으로 전체 메시지 전송 |
| Documentation | MEDIUM | aiAgentNodeOutputSchema 구조 불일치로 자동완성 오작동, 클래스 JSDoc 부재 |
| API Contract | MEDIUM | 출력 스키마-실제 구조 불일치, single_turn 조건 mode 오염 |
| Maintainability | MEDIUM | tool loop 중복, config 파싱 보일러플레이트, 출력 meta 조립 중복 |
| Concurrency | LOW | MCP provider 세션 공유 위험, provider 도구 직렬 처리 |
| Side Effect | LOW | buildConditionOutput mode 오염, getSources() 내부 참조 노출 |
| Dependency | LOW | toolName() dead code, 테스트-실행엔진 cross-module 의존 |
| Scope | LOW | feature-out 범위 내 일관성 편차 (허용 가능 수준) |
| Database | NONE | 해당 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 비고 |
|----------|------|
| Database | DB 쿼리/트랜잭션/마이그레이션 코드 없음 |

---

## 권장 조치사항

1. **[즉시] `endMultiTurnConversation` 테스트 추가** — 4가지 endReason + 경계값 시나리오 커버
2. **[즉시] `buildConditionOutput` mode 버그 수정** — `mode` 파라미터 추가, 호출자에서 `'single_turn'` 주입, 테스트 검증 추가
3. **[즉시] `aiAgentNodeOutputSchema` 구조 정합** — 스키마를 `output.result.*` / `meta.*` 실제 구조로 갱신, `metadata` → `meta` 교정
4. **[단기] `workspaceId` fail-closed 처리** — falsy 시 즉시 throw
5. **[단기] `maxToolCalls`/`maxTurns` 상한 추가** — `max(50)` / `max(100)` 제약으로 비용 증폭 방지
6. **[단기] `conversationHistory` 구현 또는 hidden 처리** — UI-동작 silent gap 해소
7. **[단기] `sanitizeToolError` 개선** — 주석 의도를 구현하거나 주석을 현실 수준으로 수정
8. **[중기] tool loop `runToolLoop` 추출** — ~130줄 중복 제거, `conditionToolCalls` 카운터 정책 통일
9. **[중기] provider 도구 호출 병렬화** — `Promise.all`로 multi-KB 레이턴시 개선
10. **[중기] `ConditionDef` SSOT 정리** — handler.ts interface 제거, schema.ts에서 `z.infer` export
11. **[중기] 중복 condition ID 검증 추가** — `validateAiAgentConfig`에서 Set 비교
12. **[중기] `_resumeState` 명시적 필드 구성** — `...state` 스프레드 제거, 명시적 나열