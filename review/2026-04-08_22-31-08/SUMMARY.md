# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 핵심 분기에 대한 테스트 누락(CRITICAL)과 보안·아키텍처·사이드이펙트 다수의 WARNING이 복합적으로 존재하여 프로덕션 배포 전 반드시 해소 필요

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `custom-node.tsx` AI Agent 동적 포트 로직 테스트 전무 — 계획 문서에 명시되었으나 미작성. 조건 포트·기본 포트·id 필터링 등 모든 분기 미커버 | `frontend/src/components/editor/canvas/__tests__/custom-node.test.tsx` | `ai_agent` 타입 포트 렌더링 시나리오(single_turn/multi_turn, 조건 없음, id 빈 항목 필터 등) 테스트 추가 |
| 2 | 테스트 | `execution-engine.service.ts` 조건 라우팅 분기(`else if 'port' in resultObj`) 테스트 전무 — 핸들러가 `{ port, data }` 반환 후 서비스가 이를 올바르게 처리하는지 검증 없음 | `execution-engine.service.spec.ts` (미존재) | AI 에이전트가 조건을 반환할 때 올바른 포트로 라우팅되는 통합 테스트 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | Prompt Injection — `c.prompt` 값이 sanitization 없이 LLM 시스템 프롬프트에 직접 삽입됨. 악의적 입력으로 LLM 행동 조작 가능 | `ai-agent.handler.ts` — `buildConditionSystemPromptSuffix()` | prompt 필드 최대 길이 제한 및 특수 패턴(`[`, `]`, 과도한 개행) 필터링; `validate()`에서 검증 추가 |
| 2 | 보안 | LLM 응답 tool 이름으로 포트 라우팅 결정 — 프롬프트 인젝션 성공 시 허용되지 않은 포트로 워크플로우 흐름 조작 가능 | `execution-engine.service.ts`, `ai-agent.handler.ts` — `classifyToolCalls()` | `applyPortSelection` 또는 라우팅 단계에서 허용된 포트 목록 대비 화이트리스트 검증 추가 |
| 3 | 보안 | JSON.parse 후 `args.reason` 타입만 캐스팅 — 매우 긴 문자열·중첩 객체·프로토타입 오염 가능 키 미검증 | `ai-agent.handler.ts` — `extractConditionReason()` | `args.reason`이 string이고 합리적 길이(예: 500자) 이하인지 검증 후 사용 |
| 4 | 보안 | condition `id` 형식 미검증 — UUID가 아닌 예약어(`out`, `error`, `__proto__`)와 충돌 시 분류 로직 오작동 가능 | `ai-agent.handler.ts` — `validate()`, `buildTools()` | `validate()`에서 UUID 형식 정규식 검증 및 예약 포트 이름 충돌 방지 로직 추가 |
| 5 | 아키텍처·유지보수 | 도구 호출 루프 로직 3중 복제 — `classifyToolCalls` → 조건/일반 분기 → 메시지 빌드 → 재귀 LLM 호출 패턴이 세 곳에 동일하게 중복; 수정 시 세 곳 동기화 필요 | `ai-agent.handler.ts` — `executeSingleTurn`, `executeMultiTurn` first-turn loop, `processMultiTurnMessage` | `runToolCallLoop()` 추상 메서드로 추출하여 세 경로에서 공유 |
| 6 | 아키텍처·API | 조건 결과 출력 구조 불일치 — single_turn은 `inputTokens/outputTokens`, multi_turn(`buildConditionOutput`)은 `totalInputTokens/totalOutputTokens`; 소비자가 두 경로를 다르게 처리해야 함 | `ai-agent.handler.ts` — `executeSingleTurn` 인라인 반환 vs `buildConditionOutput` | `buildConditionOutput`을 single_turn에도 통일 적용하거나 공통 `ConditionRoutedOutput` 인터페이스 정의 |
| 7 | 아키텍처 | 조건 라우팅 감지에 덕 타이핑 사용(`'port' in resultObj && 'data' in resultObj`) — 암묵적 레이어 계약으로 구조 변경 시 조용히 오작동 가능 | `execution-engine.service.ts` L926 | `PortRoutedResult` discriminated union 도입(`__type: 'port_routed'`); 서비스에서 `__type` 필드로 명시적 판별 |
| 8 | 사이드이펙트 | `buildTools` 도구 이름 변경 — `tool_{short-uuid}` → full UUID. 저장된 워크플로우나 외부 시스템이 구 형식 참조 시 호환성 파괴 | `ai-agent.handler.ts` — `buildTools()` | 마이그레이션 가이드 작성 또는 fallback 여부 문서화 |
| 9 | 사이드이펙트 | `applyPortSelection` 반환값 null 체크 부재 — null/undefined 반환 시 런타임 에러 없이 null이 저장될 수 있음 | `execution-engine.service.ts` — 조건 분기 내 `applyPortSelection` 호출부 | `applyPortSelection` 반환값 null 체크 추가 |
| 10 | 사이드이펙트 | `processMultiTurnMessage`에서 `state.messages` 직접 mutate 가능성 — 호출자 측 state 오염 위험 | `ai-agent.handler.ts` — `processMultiTurnMessage` | 진입 시 `messages`를 `[...state.messages]`로 복사하여 사용하는지 확인 및 보장 |
| 11 | 사이드이펙트 | `executeSingleTurn` Case 1(조건-only)에서 `toolCallCount` 미반영 — 조건 도구 호출이 metadata에 0으로 기록됨 | `ai-agent.handler.ts` — `executeSingleTurn` 조건 전용 분기 | 조기 반환 전 `toolCallCount += classification.conditionToolCalls.length` 반영 |
| 12 | 요구사항 | 혼합 도구 호출(Case 2) 반복 시 무한 루프 위험 — LLM이 계속 혼합 호출을 반복하면 `maxToolCalls`에 의해서만 종료; 조건 deferral 횟수 별도 제한 없음 | `ai-agent.handler.ts` — `executeSingleTurn`, `executeMultiTurn` while 루프 | deferral 횟수 추적하여 N회 초과 시 조건 발동 또는 경고 처리 |
| 13 | 테스트 | `ConditionsSection` 컴포넌트 테스트 전무 — 추가/삭제/수정/UUID 생성/빈 상태 렌더링 등 모든 인터랙션 미커버 | `frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx` | `ai-configs.test.tsx` 신규 작성 |
| 14 | 테스트 | 혼합 툴 호출(Case 2) 테스트에서 deferral 메시지의 `toolCallId` 및 메시지 히스토리 구조 미검증 | `ai-agent.handler.spec.ts` — Case 2 테스트 | 두 번째 `llmService.chat` 호출 시 전달되는 `messages` 인자의 tool response 구조 assertion 추가 |
| 15 | 테스트 | `classifyToolCalls` 엣지 케이스 미테스트 — conditions 빈 배열, toolCalls 빈 배열, maxToolCalls 한도 도달 시 동작 미커버 | `ai-agent.handler.spec.ts` | `describe('classifyToolCalls - edge cases')` 블록 추가 |
| 16 | 성능 | `classifyToolCalls` 중첩 선형 탐색 O(n×m) — `conditionIds` Set 생성 후 `conditions.findIndex`를 conditionToolCalls마다 반복 | `ai-agent.handler.ts` — `classifyToolCalls()` | `Map<id, index>` 활용하여 단일 패스로 개선; `conditionCallIds = new Set(...)` 으로 tool loop 내 `Array.some`도 O(1)로 개선 |
| 17 | 유지보수 | 한국어 하드코딩 문자열 — LLM 프롬프트·tool 응답 메시지가 한국어 고정; 영어 모델 사용 시 품질 영향 가능 | `ai-agent.handler.ts` — `buildConditionSystemPromptSuffix`, deferral 응답 메시지 (L201, L432, L599 등) | 상수로 파일 상단에 추출하여 변경 위치 단일화; 향후 locale 설정 대응 고려 |
| 18 | 유지보수 | `ConditionDef` 타입 3중 중복 정의 — 백엔드 핸들러, 프론트엔드 컴포넌트, config 패널에 각각 인라인 정의 | `ai-agent.handler.ts`, `ai-configs.tsx`, `custom-node.tsx` | 단기: `frontend/src/types/condition.ts`로 공유 타입 추출; 장기: 백엔드-프론트 공유 타입 레이어 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 조건 개수 제한 없음 — 수백 개 등록 시 LLM context limit 초과 또는 DoS 벡터 가능 | `ai-agent.handler.ts` — `validate()`, `ai-configs.tsx` — `addCondition()` | 최대 조건 수(예: 20개) 제한을 validate()와 UI 양쪽에 추가 |
| 2 | 보안 | tool arguments가 LLM context에 재노출 — API 키 등 민감 필드 포함 시 로그·multi-turn history에 유출 가능 | `ai-agent.handler.ts` — tool 실행 결과 메시지 | tool arguments LLM 재전달 시 민감 필드 마스킹 정책 고려 |
| 3 | 테스트 | `extractConditionReason` JSON 파싱 실패(invalid JSON) 케이스 미테스트 | `ai-agent.handler.ts` — `extractConditionReason()` catch 블록 | `should return empty string when condition arguments is invalid JSON` 테스트 추가 |
| 4 | 테스트 | `buildConditionSystemPromptSuffix` 내용 검증 불완전 — `'조건'` 포함 여부만 확인; 각 조건의 id·prompt 포함 여부 미검증 | `ai-agent.handler.spec.ts` | condition의 `id`와 `prompt`가 system message에 포함되는지 assertion 추가 |
| 5 | 아키텍처 | 포트 ID 상수 미공유 — `"timeout"`, `"user_ended"`, `"max_turns"`, `"error"` 문자열이 프론트·백에 하드코딩; 포트 이름 변경 시 자동 감지 불가 | `custom-node.tsx`, `node-definitions/index.ts` | `AI_AGENT_PORTS` 공유 상수 파일 정의 |
| 6 | API 계약 | 조건 배열 순서가 우선순위를 결정하는 계약이 문서화되지 않음 | `ai-agent.handler.ts` — `classifyToolCalls()` | 조건 설정 스키마 또는 JSDoc에 "배열 순서 = 우선순위" 명시 |
| 7 | API 계약 | single_turn 정상 반환(`{ response, metadata }`)과 조건 반환(`{ port, data }`)의 구별이 암묵적 shape 판별에 의존 — 타입 시스템 밖 | `ai-agent.handler.ts` — `executeSingleTurn` 정상 반환 경로 | 명시적 판별 유니온(`{ kind: 'condition', ... } \| { kind: 'normal', ... }`)으로 계약 타입화 |
| 8 | 동시성 | 혼합 케이스(Case 2)에서 condition tool이 `maxToolCalls` 한도를 불필요하게 소모 — condition deferral도 `toolCallCount++`에 포함 | `ai-agent.handler.ts` — tool loop (세 곳) | condition tool은 `toolCallCount` 증가에서 제외; 일반 도구만 카운트 |
| 9 | 문서화 | `plan/ai-agent-conditions.md` 파일이 완료 후에도 TODO 상태로 미정리 — CLAUDE.md 지침 위반 | `plan/ai-agent-conditions.md` | 구현 완료 상태로 갱신하거나 제거 |
| 10 | 문서화 | `applyPortSelection` 참조 주석 부재 — `port`/`data` 구조가 어디서 정의되는지 연결고리 없음 | `execution-engine.service.ts` L926 | `// See AiAgentHandler.buildConditionOutput for shape` 형태 참조 주석 추가 |
| 11 | 유지보수 | `ToolCall` 인터페이스 로컬 중복 정의 + `as ToolCall[]` 강제 캐스팅 — 타입 안전성 미보장 | `ai-agent.handler.ts` L11~15 | LLM 클라이언트 인터페이스에 `ToolCall` 타입 정의하고 재사용; `ChatResponse`에 `toolCalls` 필드 구체화 |
| 12 | 유지보수 | 테스트 내 `ResultTimeline` props 6곳에 동일하게 중복 인라인 구성 | `result-timeline.test.tsx` | `defaultProps` 헬퍼 객체를 상단에 정의하고 스프레드 사용 |
| 13 | 의존성 | `crypto.randomUUID()` HTTPS/localhost 전용 — HTTP 개발 환경 또는 SSR 컨텍스트에서 예외 가능성 | `ai-configs.tsx` — `addCondition()` | 현 환경에서 문제 없으나, Node.js 버전 호환성 확인; 필요 시 폴백 로직 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | **HIGH** | custom-node 동적 포트 테스트, 서비스 조건 라우팅 통합 테스트, ConditionsSection UI 테스트 전무 |
| security | **MEDIUM** | Prompt Injection(c.prompt → 시스템 프롬프트 직접 삽입), LLM 응답 기반 포트 라우팅, condition id 미검증 |
| architecture | **MEDIUM** | 도구 호출 루프 3중 복제, 덕 타이핑 레이어 계약, ConditionDef 타입 분산, single/multi 출력 불일치 |
| maintainability | **MEDIUM** | 툴콜 루프 3중 복제, single/multi 조건 결과 구조 불일치, 한국어 하드코딩, ToolCall 타입 중복 |
| side_effect | **MEDIUM** | buildTools 도구 이름 Breaking Change, state.messages 직접 변이, applyPortSelection null 미처리 |
| api_contract | **MEDIUM** | single/multi 조건 metadata 스키마 불일치, 도구 이름 규칙 변경, 우선순위 계약 미문서화 |
| requirement | **MEDIUM** | 혼합 호출 deferral 무한 루프 위험, 서비스 레이어 조건 처리 통합 테스트 부재 |
| performance | **LOW** | classifyToolCalls O(n×m) 탐색, tool loop Array.some 중복 탐색 |
| concurrency | **LOW** | condition tool의 toolCallCount 불필요 소모, state.messages 동시 변이(기존 구조 상속) |
| scope | **LOW** | result-timeline.test.tsx가 조건 기능과 무관하나 테스트 통과 필수 수정 |
| documentation | **LOW** | JSDoc 파라미터 누락, 한국어 하드코딩 의도 미문서화, plan 파일 미정리 |
| dependency | **NONE** | 새 외부 의존성 없음, 기존 패키지만 활용 |
| database | **NONE** | 데이터베이스 관련 코드 없음 |

---

## 발견 없는 에이전트
- **database** — 변경 범위에 DB 관련 코드 없음
- **dependency** — 새 외부 의존성 추가 없음; 기존 패키지만 활용

---

## 권장 조치사항

1. **[CRITICAL] 테스트 추가** — `custom-node.test.tsx`에 `ai_agent` 동적 포트 렌더링 테스트, `execution-engine.service.spec.ts`에 조건 라우팅 통합 테스트, `ai-configs.test.tsx` 신규 작성
2. **[WARNING] 보안 강화** — `buildConditionSystemPromptSuffix`에 `c.prompt` 길이·패턴 검증; `validate()`에 condition id UUID 형식 검증 및 예약어 충돌 방지; 포트 라우팅 화이트리스트 검증 추가
3. **[WARNING] 조건 출력 구조 통일** — `executeSingleTurn`의 인라인 조건 반환을 `buildConditionOutput` 재사용으로 통일하여 metadata 키 불일치 해소
4. **[WARNING] 덕 타이핑 계약 제거** — `PortRoutedResult` discriminated union(`__type: 'port_routed'`) 도입으로 서비스-핸들러 간 계약 명시화
5. **[WARNING] 툴콜 루프 중복 제거** — `runToolCallLoop()` 메서드 추출하여 `executeSingleTurn`, `executeMultiTurn`, `processMultiTurnMessage` 공유
6. **[WARNING] 혼합 호출 deferral 무한 루프 방지** — deferral 횟수 추적 및 한도 초과 시 처리 로직 추가
7. **[WARNING] `applyPortSelection` null 안전성** — 반환값 null 체크 추가; `toolCallCount` 정확성 수정(condition tool 제외)
8. **[INFO] 한국어 상수화 및 `ConditionDef` 타입 공유** — 하드코딩 문자열을 상수로 추출; 프론트엔드 공유 타입 파일 생성
9. **[INFO] `plan/ai-agent-conditions.md` 정리** — 완료 상태로 갱신하거나 삭제
10. **[INFO] 조건 개수 제한** — `validate()`와 UI 양쪽에 최대 조건 수(예: 20개) 제한 추가