파일 쓰기 권한이 필요합니다. 아래는 완성된 통합 보고서입니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `execution.ai_message` WebSocket 페이로드의 파괴적 변경(requestPayload/responsePayload 제거), 시스템 프롬프트 필터링 누락, terminal emit 분기 동기화 미검증이 복합적으로 존재

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `llmCalls[].requestPayload.messages`에 `role: 'system'` 항목이 필터 없이 WebSocket 클라이언트로 전송됨. `buildConversationConfigFromOutput`은 시스템 메시지를 명시 제거하지만 신규 helper는 원시 llmCalls를 그대로 spread함 | `buildAiMessageDebugFromResumeState` | 각 `requestPayload.messages`에서 `role === 'system'` 항목 제거 sanitizer 적용 |
| 2 | Security | `responsePayload` 원시 데이터 무필터 전송 — 모델 버전, usage 상세, stop_reason 등 내부 메타데이터 노출 | `buildAiMessageDebugFromResumeState` | 필요한 필드만 선택 추출하거나 workspace admin 전용 권한 필터 추가 |
| 3 | API Contract / Breaking Change | `waiting_for_input` 분기의 `execution.ai_message`에서 `requestPayload`, `responsePayload`, 단일 `durationMs` 3개 필드 제거 후 `llmCalls[]`로 대체. 프론트엔드가 flat 필드를 직접 참조하면 런타임 silent regression | `execution-engine.service.ts:1704–1706` 삭제 라인 | `frontend/`에서 `requestPayload`·`responsePayload` grep 확인 후 동시 마이그레이션 |
| 4 | API Contract / Testing | terminal emit 분기가 이번 diff에 미포함. 주석과 spec 모두 "두 분기 동일 shape"을 명시하지만 코드 레벨 검증 불가 | `execution-engine.service.ts` diff 범위 밖 terminal 분기 | terminal 분기도 `buildAiMessageDebugFromResumeState` 사용 여부 확인 또는 이번 PR에 포함 |
| 5 | Testing | `waiting_for_input` emit 경로의 실제 WebSocket 이벤트 shape 검증하는 통합 테스트 부재 | `execution-engine.service.spec.ts` | `emitExecutionEvent` spy 통합 테스트 추가 — `llmCalls`·`durationMs` 존재, 구 필드 부재 assert |
| 6 | Requirement | `llmCalls: null`일 때 `null !== undefined`가 `true`이므로 `result.llmCalls = null` 세팅됨. 반환 타입 `llmCalls?: unknown[]` 위반 | `execution-engine.service.ts:177–178` | `if (Array.isArray(llmCalls))` 가드로 교체. `llmCalls: null` 테스트 케이스 추가 |
| 7 | Architecture / Dependency | `Record<string, unknown>` + `as unknown[]` unsafe cast — `turnDebugHistory` 필드명 변경 시 컴파일 에러 없이 조용히 `{}` 반환 | `buildAiMessageDebugFromResumeState` 시그니처·본문 | `TurnDebugEntry`, `LlmCallRecord` 인터페이스 정의 후 타입 교체 |
| 8 | Performance | tool-loop가 있는 턴에서 `llmCalls[].requestPayload`에 누적 messages 히스토리 전체 포함 → O(n²) WebSocket 페이로드 성장 | `execution-engine.service.ts:1704` emit 호출부 | `requestPayload.messages` delta만 포함하거나 debug 정보를 옵트인 채널로 분리 |
| 9 | Performance | `llmCalls` 배열 크기 제한 없음. MCP 연속 호출 시 단일 WebSocket 프레임 크기 초과 가능 | `buildAiMessageDebugFromResumeState` | 최대 항목 수 제한(예: 20개) 또는 lite 요약 필드 축약 전송 |
| 10 | Concurrency | `llmCalls` 배열 얕은 참조 반환. 재생 버퍼가 JS 객체 형태로 저장할 경우 이후 AI 턴의 llmCalls 추가가 버퍼된 페이로드를 소급 변경 가능 | `result.llmCalls = llmCalls` | `result.llmCalls = [...llmCalls]` shallow copy 적용 또는 버퍼 저장 방식 명시적 확인 |
| 11 | Maintainability | `...buildAiMessageDebugFromResumeState(resumeState)` spread 주입으로 emit 호출부에서 어떤 필드가 페이로드에 포함되는지 즉시 파악 불가 | `execution-engine.service.ts`, `waiting_for_input` 분기 emit | 추출 결과를 중간 변수로 명명하거나 반환 타입을 named interface로 정의 |
| 12 | Documentation | `requestPayload`/`responsePayload`/`lastTurnDurationMs` 3개 필드 제거 배경(turnDebugHistory 통합)이 주석에 미기술 | `execution-engine.service.ts:1687–1704` | 인라인 주석 한 줄: `// lastTurnRequest/Response/durationMs는 turnDebugHistory 단일 엔트리와 중복이므로 통합` |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `llmCalls: []` 빈 배열 케이스의 의도된 동작(포함 vs 생략) 미문서화 | `execution-engine.service.spec.ts` | `llmCalls: []` 케이스 추가하여 동작 명시 |
| 2 | Testing | `totalDurationMs: 0` 경계값, `turnDebugHistory: null` 케이스 테스트 없음 | `execution-engine.service.spec.ts` | 각 케이스 추가 |
| 3 | Documentation / Spec | `llmCalls` 배열 항목 타입(requestPayload, responsePayload, durationMs) 스키마 표 미정의 | `spec/5-system/6-websocket-protocol.md` | `llmCalls` 항목 스키마 소형 테이블 추가 |
| 4 | Documentation / Spec | 최상위 `durationMs`(턴 전체)와 `llmCalls[].durationMs`(단일 LLM 호출) 의미 차이가 JSON 예시에서 구분 불명확 | `spec/5-system/6-websocket-protocol.md` JSON 예시 | 예시 주석에 "최상위 = 턴 총 소요시간, 배열 내 = 단일 LLM 요청 소요시간" 명시 |
| 5 | Documentation / Spec | `metadata.inputTokens`가 per-turn인지 대화 전체 누적인지 불명확 | `spec/5-system/6-websocket-protocol.md` JSON 예시 | `// 대화 전체 누적 토큰` 주석 추가 |
| 6 | Maintainability | `totalDurationMs`(입력) → `durationMs`(출력) 필드명 변환이 함수 본문에 암묵적으로 묻혀 있음 | `buildAiMessageDebugFromResumeState` | JSDoc 또는 인라인 주석에 매핑 명시 |
| 7 | Maintainability | `llmCalls?: unknown[]` 반환 타입이 item 구조를 감춤 | `buildAiMessageDebugFromResumeState` 반환 타입 | `LlmCallRecord` 인터페이스를 공유 위치에 정의 |
| 8 | Architecture | 순수 변환 함수 3개가 2000줄 서비스 파일에 공존 (SRP 경계) | `execution-engine.service.ts` 상단부 | 단기 현행 유지, 복잡도 증가 시 `ai-message.mapper.ts` 분리 고려 |
| 9 | Scope | 테스트 describe 블록 3줄 블록 주석이 CLAUDE.md "코드가 하는 일을 설명하는 주석 금지" 규약 위반 소지 | `execution-engine.service.spec.ts:3215–3219` | "spec §4.4 참조" 한 줄로 축약 |
| 10 | Maintainability / Spec | `llmCalls` 동작 설명이 이벤트 목록 표 셀과 §4.4 본문에 중복 기술 | `spec/5-system/6-websocket-protocol.md` | 표 셀에 "see §4.4" 참조만 남기고 본문에서 한 번만 기술 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | MEDIUM | 시스템 프롬프트·responsePayload 원시 데이터 무필터 WebSocket 전송 |
| Testing | MEDIUM | waiting_for_input emit 통합 테스트 부재, 구 필드 제거 회귀 테스트 없음 |
| API Contract | MEDIUM | requestPayload/responsePayload 제거 breaking change, terminal 분기 동기화 미검증 |
| Architecture | MEDIUM | 페이로드 파괴적 변경, terminal 분기 대칭 코드 레벨 미증명, 타입 erasure |
| Requirement | MEDIUM | llmCalls: null 런타임 버그(null !== undefined 통과), terminal 분기 동기화 미검증 |
| Performance | LOW | O(n²) 페이로드 성장, llmCalls 배열 크기 무제한 |
| Concurrency | LOW | llmCalls 참조 공유(재생 버퍼 저장 방식에 따라 소급 변경 위험) |
| Maintainability | LOW | spread 주입으로 호출부 가독성 저하, totalDurationMs→durationMs 암묵적 매핑 |
| Dependency | LOW | Record<string, unknown> 암묵적 내부 계약, terminal 분기 포함 여부 미확인 |
| Scope | LOW | requestPayload/responsePayload 제거 프론트엔드 영향 확인 필요 |
| Side Effect | LOW | durationMs 소스 변경(lastTurnDurationMs → totalDurationMs) 동치 검증 필요 |
| Documentation | LOW | waiting_for_input 필드 제거 배경 미기술, spec llmCalls 항목 타입 표 미정의 |
| Database | NONE | 데이터베이스 변경 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| Database | 변경된 코드 세 파일 모두 DB 계층과 무관 |

---

## 권장 조치사항

1. **[즉시] 시스템 프롬프트 필터링 추가** — `llmCalls` 각 항목의 `requestPayload.messages`에서 `role === 'system'` 항목 제거. `buildConversationConfigFromOutput`의 기존 filter 패턴 참조.
2. **[즉시] `llmCalls: null` 런타임 버그 수정** — `if (llmCalls !== undefined)` → `if (Array.isArray(llmCalls))`로 교체. `llmCalls: null` 테스트 케이스 추가.
3. **[즉시] 프론트엔드 breaking change 확인** — `frontend/`에서 `requestPayload`, `responsePayload` 직접 참조 여부 grep. 참조 존재 시 `llmCalls[last]` 구조로 동시 마이그레이션.
4. **[즉시] terminal emit 분기 동기화 확인** — terminal 경로가 이미 동일 shape 사용 여부 코드 확인. 미변경이라면 이번 작업에 포함.
5. **[단기] 통합 테스트 추가** — `emitExecutionEvent` spy로 `llmCalls`·`durationMs` 존재 및 구 필드 부재를 assert하는 통합 테스트 작성.
6. **[단기] 경계값 테스트 보완** — `llmCalls: null`, `llmCalls: []`, `totalDurationMs: 0`, `turnDebugHistory: null` 케이스 추가.
7. **[단기] Spec 보완** — `llmCalls` 항목 스키마 테이블, `durationMs` 의미 차이, `metadata.inputTokens` 누적값 표기 추가.
8. **[중기] 타입 안전성 개선** — `TurnDebugEntry`, `LlmCallRecord` 인터페이스 정의 후 unsafe cast 제거.
9. **[중기] 페이로드 크기 제한** — `llmCalls` 최대 항목 수 제한 또는 `requestPayload.messages` 히스토리 제외 방안 검토.