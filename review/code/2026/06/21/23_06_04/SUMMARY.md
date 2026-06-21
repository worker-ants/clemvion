# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `processMultiTurnMessage`에서 조건 도구 호출이 `toolCallCount`에 산입되어 spec §7.1과 `executeSingleTurn` 동작 모두와 불일치하는 기능적 버그가 존재하며, 테스트 커버리지 및 유지보수성 측면의 경고가 다수 발견됨. 전반적으로 god-handler 분할 목표는 달성했으나 후속 정리가 필요한 상태.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `processMultiTurnMessage`의 `conditionToolCalls` 루프에서 `toolCallCount++` 실행 — spec §7.1 "meta.toolCalls 조건 도구 제외" 및 `executeSingleTurn` 동작(카운터 증가 없음, 주석 명시)과 명백히 불일치. `maxToolCalls` 예산 조기 소진 및 `meta.toolCalls` 부정확 노출 유발 | `ai-turn-executor.ts` line 2153 | `conditionToolCalls` 루프에서 `toolCallCount++` 제거. `executeSingleTurn`과 동일하게 deferral tool_result 회신만 수행 |
| 2 | 아키텍처 | `AiTurnExecutor`가 `process.env.AI_RETRY_STATE_TTL_MINUTES`를 비즈니스 로직 내부에서 직접 읽음 — 인프라/설정 관심사 혼입, NestJS `ConfigService` 주입 경로 우회, 현재 단위 테스트에서 비기본값 분기 미커버 | `ai-turn-executor.ts` L615-623 `resolveRetryStateTtlMinutes` | 생성자에 `retryStateTtlMinutes: number` 선택 인자 추가 또는 `ConfigService` 주입으로 변경 |
| 3 | 유지보수성 | `processMultiTurnMessage` 단일 메서드가 750줄에 form_submit 파싱·bypass·user push·자동메모리 재주입·물리 압축·LLM 호출·tool 루프(3분기)·render_form blocking·누적 토큰·waiting/ended·pendingFormBlock·_resumeState 조립까지 처리 — 순환 복잡도 과도 | `ai-turn-executor.ts` L2127~2882 | `_resolveFormInteraction`·`_runToolLoop`·`_buildResumeStatePayload` 최소 세 단위로 추출 |
| 4 | 유지보수성 | `executeSingleTurn`과 `processMultiTurnMessage`의 condition/normal tool 처리 블록 대규모 중복 — spec 변경 시 두 경로를 동시에 수정해야 하는 coupling | `ai-turn-executor.ts` L1369~1911, L2449~2687 | `_processNonProviderToolCalls` 공유 헬퍼로 추출 |
| 5 | 유지보수성 | `MAX_TURN_DEBUG_HISTORY = 50` 상수가 메서드 본문 내부에 인라인 선언 — 모듈 레벨 상수 블록과 불일치 | `ai-turn-executor.ts` line 2741 | 파일 상단 상수 블록으로 이동 |
| 6 | 유지보수성 | `sanitizeToolError` 내 하드코딩 `200`이 `TOOL_RESULT_PREVIEW_CHARS`와 수치 동일하나 별도 명명 상수 없음 | `ai-turn-executor.ts` L541 | `TOOL_ERROR_MESSAGE_MAX_CHARS = 200`으로 분리 선언 |
| 7 | 테스팅 | `capFormDataBytes` — spec §12.7 바이트 cap 로직 담당 복잡한 순수 함수임에도 `ai-turn-executor.spec.ts`에 직접 단위 테스트 없음. 멀티바이트 UTF-8 경계 등 엣지 케이스 미검증 | `ai-turn-executor.spec.ts` | 직접 단위 테스트 추가 (cap 미만·cap 초과 string·cap 초과 비-string 최소 3케이스) |
| 8 | 테스팅 | `processMultiTurnMessage`의 form_submitted/bypass/fallback 분기가 executor 레벨에서 직접 테스트되지 않음 — `delete state.pendingFormToolCall` state mutation도 미검증 | `ai-turn-executor.spec.ts` | executor 직접 구성 후 각 분기 격리 테스트, state 클리어 부작용 검증 포함 |
| 9 | 테스팅 | `resolveRetryStateTtlMinutes` 환경변수 엣지 케이스(non-numeric, negative, zero fallback)가 executor 레벨 직접 테스트 없음. `process.env` cleanup `afterEach`도 없음 | `ai-turn-executor.spec.ts` `endMultiTurnConversation` describe | 환경변수 케이스 추가 + cleanup `afterEach` 포함 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec frontmatter `code:`에 `ai-turn-executor.ts`, `ai-condition-evaluator.ts`, `ai-memory-manager.ts` 미등재 — M-1 1·2·3단계 신설 파일이 실질 구현체임에도 `ai-agent.handler.ts`만 등재. plan `02-architecture.md §M-1` 인지 항목 | `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter | spec frontmatter `code:` 배열에 세 파일 추가 (project-planner 위임) |
| 2 | 보안 | `userMessage`가 LLM context에 길이 제한 없이 직접 삽입됨 — `formData`에는 cap이 있으나 일반 chat 메시지에는 미적용 | `ai-turn-executor.ts` `processMultiTurnMessage` L2289 | 일반 chat 메시지에도 최대 길이(예: 32KB) cap 적용 |
| 3 | 보안 | `sanitizeToolError` 첫 줄에 민감 정보(DB 연결 문자열 등) 포함 가능성 — 200자 truncate는 있으나 URL 형태 패턴 마스킹 없음 | `ai-turn-executor.ts` L534-542 | `://` 포함 문자열 또는 자격증명 패턴 regex 마스킹 추가 |
| 4 | 보안 | `process.env.AI_RETRY_STATE_TTL_MINUTES` 상한 없음 — 극단적으로 긴 TTL 설정 가능 | `ai-turn-executor.ts` L614-622 | `Math.min(parsed, 1440)` 상한 clamp 추가 |
| 5 | 성능 | `buildTools` 내 toolProvider 순차 `for...of` 실행 — MCP 등 I/O 비용 provider 다수 구성 시 latency 누적 | `ai-turn-executor.ts` L3308-3343 | `Promise.all`로 병렬화 |
| 6 | 성능 | `resolveRetryStateTtlMinutes()` 매 `buildRetryState` 호출마다 `process.env` 파싱 | `ai-turn-executor.ts` L614-622 | 모듈 최상위 상수로 캐싱 |
| 7 | 성능 | LLM 호출 직전 `messages: [...messages]` 스프레드 복사 — 루프 반복마다 메모리 할당 (디버그 trace 목적 트레이드오프) | `ai-turn-executor.ts` L1529, L1759, L2422, L2664 | 대형 컨텍스트 운영 시 메모리 비용 모니터링 |
| 8 | 아키텍처 | `state: Record<string, unknown>` 비구조화 결합 — resume state as-cast 필드 접근, 타입 안전성 없음 | `ai-turn-executor.ts` `processMultiTurnMessage`, `endMultiTurnConversation` | `ResumeState` interface 또는 Zod schema 정의, M-1 완료 후 점진 적용 |
| 9 | 부작용 | `delete state.pendingFormToolCall` — 호출자 객체 직접 변이, 함수 시그니처만 보면 변이 사실 미인지 가능 | `ai-turn-executor.ts` L2241, L2266 | 지역 변수 spread 사본 사용 또는 `_resumeState` 조립 시 키 생략 방식 채택 |
| 10 | 문서화 | `multiTurnPortForEndReason`/`buildRetryState` JSDoc 블록 순서 오류 — IDE hover·자동 문서에서 잘못된 메서드에 문서 결합 | `ai-turn-executor.ts` L3075-3086 | JSDoc을 해당 메서드 선언 바로 위로 이동 |
| 11 | 문서화 | `executeSingleTurn`, `executeMultiTurn`, `processMultiTurnMessage` 공개 메서드에 메서드 레벨 JSDoc 미부착 | `ai-turn-executor.ts` | `@param`·`@returns`·side-effect 요약 JSDoc 추가 |
| 12 | 문서화 | `AI_RETRY_STATE_TTL_MINUTES` 신규 환경변수가 중앙 env 문서에 미등록 | `.env.example` 또는 spec §7.9 | 환경변수 목록 문서에 등록 |
| 13 | 테스팅 | `RagAccumulator` `skipReason` 판정 로직·`kb_unsearchable` 경계값 직접 단위 테스트 없음 | `ai-turn-executor.ts` `RagAccumulator` L790~900 | `kb_unsearchable` 경계값 추가 통합 테스트 권장 |
| 14 | 테스팅 | `buildMultiTurnFinalOutput` 테스트가 단일 `it`에 3개 포트 검증 — 실패 시 어느 포트인지 즉시 파악 어려움 | `ai-turn-executor.spec.ts` L235~377 | `it.each` 또는 개별 `it` 분리 |
| 15 | 범위 | `ToolCallTrace` 인터페이스가 handler에서 executor로 이동, handler re-export 없음 — 빌드 통과로 영향 없음 확인 | `ai-turn-executor.ts` L495-506 | 현행 유지 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | conditionToolCalls에서 toolCallCount++ 오산입(spec §7.1 불일치), SPEC-DRIFT: spec frontmatter code 미등재 |
| maintainability | MEDIUM | processMultiTurnMessage 750줄 과다 복잡도, tool 루프 2중 중복, 인라인 상수, 마법 숫자 |
| testing | MEDIUM | capFormDataBytes 직접 단위 테스트 누락, form_submitted 분기 executor 직접 테스트 없음, TTL 환경변수 테스트 없음 |
| architecture | LOW | process.env 직접 접근(레이어 혼입), Record<string, unknown> resume state 비구조화 |
| security | LOW | userMessage 길이 제한 없음, sanitizeToolError 첫 줄 민감 정보 가능성, TTL 상한 없음 |
| performance | LOW | buildTools toolProvider 순차 실행(병렬화 기회), resolveRetryStateTtlMinutes 매 호출 파싱 |
| side_effect | LOW | state 직접 변이(delete state.pendingFormToolCall) |
| documentation | LOW | JSDoc 블록 순서 오류, 핵심 공개 메서드 JSDoc 미부착, AI_RETRY_STATE_TTL_MINUTES 외부 문서 미등록 |
| concurrency | LOW | 무상태 설계 확인됨, delete state.pendingFormToolCall in-place mutation(실질 위험 낮음) |
| scope | NONE | 의도된 범위 내, 불필요한 변경 없음 |
| api_contract | NONE | 외부 API 계약 변경 없음 |
| user_guide_sync | NONE | 노드 schema·UI·에러 코드 변경 없음, 동반 갱신 대상 없음 |

## 발견 없는 에이전트

- **api_contract**: 외부 HTTP API/REST 계약 변경 없음 — 순수 내부 리팩터링 확인
- **user_guide_sync**: 노드 schema·UI 필드·에러 코드·출력 포트 shape 변경 없음 — 유저 가이드 동반 갱신 대상 없음
- **scope**: 의도된 범위 벗어난 변경 없음, backward-compat re-export 처리 정상

## 권장 조치사항

1. **[즉시 수정]** `processMultiTurnMessage` conditionToolCalls 루프에서 `toolCallCount++` 제거 — spec §7.1 준수 및 `executeSingleTurn`과 동작 일치 보장 (`ai-turn-executor.ts` L2153)
2. **[즉시 수정]** `MAX_TURN_DEBUG_HISTORY = 50` 인라인 상수를 파일 상단 상수 블록으로 이동, `TOOL_ERROR_MESSAGE_MAX_CHARS = 200` 분리 선언 (`ai-turn-executor.ts` L2741, L541)
3. **[테스트 보강]** `ai-turn-executor.spec.ts`에 `capFormDataBytes` 직접 단위 테스트, form_submitted/bypass 분기 executor 직접 테스트, TTL 환경변수 엣지 케이스 추가
4. **[아키텍처 개선]** `resolveRetryStateTtlMinutes`를 executor 외부에서 호출해 값 주입하는 방식으로 변경 (ConfigService 또는 생성자 인자)
5. **[문서화]** JSDoc 블록 순서 수정(`multiTurnPortForEndReason`), `AI_RETRY_STATE_TTL_MINUTES` 환경변수 외부 문서 등록
6. **[spec 갱신, project-planner 위임]** `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 배열에 `ai-turn-executor.ts`, `ai-condition-evaluator.ts`, `ai-memory-manager.ts` 추가 (SPEC-DRIFT)
7. **[중기]** `processMultiTurnMessage` 분할 (`_resolveFormInteraction`, `_runToolLoop`, `_buildResumeStatePayload`), tool 루프 중복 헬퍼 추출 — M-1 후속 또는 M-2 단계에서 처리
8. **[중기]** `buildTools` toolProvider 순차 실행을 `Promise.all` 병렬화, `ResumeState` interface/Zod schema 도입

## 라우터 결정

라우터 선별 실행 (`routing_status=done`):

- **실행** (12명): security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract, user_guide_sync
- **제외** (2명):

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 제외 결정 |
  | database | 라우터 제외 결정 |

- **강제 포함(router_safety)**: maintainability, requirement, scope, security, side_effect, testing (6명)