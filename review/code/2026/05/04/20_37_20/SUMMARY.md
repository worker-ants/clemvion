파일 쓰기 권한이 없어서 SUMMARY.md를 저장하지 못했습니다. 아래에 통합 보고서 전문을 출력합니다.

---

# Code Review 통합 보고서

> 리뷰 대상
> - `backend/src/modules/execution-engine/execution-engine.service.spec.ts`
> - `frontend/src/lib/websocket/__tests__/use-execution-events.test.ts`
> - `frontend/src/lib/websocket/use-execution-events.ts`

---

## 전체 위험도

**MEDIUM** — `execution.ai_message` 레거시 fallback 제거의 방향성은 올바르나, 백엔드 테스트의 `messages` 필드 누락 검증 및 비원자적 배포 시 무음(silent) AI 메시지 소실 위험이 핵심 리스크.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing / Requirement | 백엔드 테스트가 `messages` 필드 emit 자체를 검증하지 않음. 프론트엔드는 `messages` 없는 페이로드를 완전 드롭하는데, 백엔드가 이를 실제로 전송하는지 확인하는 어서션이 없어 계약이 테스트 수준에서 연결되지 않음 | `execution-engine.service.spec.ts` — 두 테스트 케이스 모두 | `expect(payload).toHaveProperty('messages')`, `expect(Array.isArray(payload.messages)).toBe(true)`, `expect(payload.messages.length).toBeGreaterThan(0)` 추가 |
| 2 | Testing / Side Effect | 동일한 `describe('AI Agent multi-turn — execution.ai_message emit shape')` 블록이 파일 내 두 번 존재. 같은 테스트가 중복 실행되고 `beforeEach` mock 리셋이 다른 describe 블록에 간섭할 수 있음 | `execution-engine.service.spec.ts` — Template 이후 원본 블록 | 두 블록 중 하나만 남기고 나머지 제거 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API Contract / Requirement / Side Effect | 비원자적 배포 시 AI 응답 무음 소실 위험. 롤링 배포 중 구 버전 백엔드 + 신 버전 프론트 공존 구간에서 AI 대화가 UI에 전혀 표시되지 않음 | `use-execution-events.ts` — `handleAiMessage` early-return 조건 | 배포 원자성을 CI/CD 정책으로 명문화하거나, 최소 한 sprint 동안 deprecated 경고와 함께 fallback 유지 |
| 2 | API Contract / Security / Requirement | 프로덕션에서 계약 위반 페이로드가 무음 드롭됨. `NODE_ENV !== "production"` 분기로 경고가 개발 전용이라 운영 중 `messages` 누락 시 감지 불가 | `use-execution-events.ts` — L319–327 | Sentry 등 에러 트래킹에 프로덕션에서도 기록. 또는 최소 `console.error`로 레벨 격상 |
| 3 | Testing / Documentation | `warnSpy`가 경고를 suppress하지만 실제 호출 여부를 검증하지 않음. "dev-only warning" 동작이 깨져도 테스트 통과 | `use-execution-events.test.ts` — `ai_message ignores payloads` 테스트 | `expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[ws] execution.ai_message without messages snapshot"), expect.anything())` 추가 |
| 4 | Testing | `messages: []`(빈 배열) 케이스 미테스트. 구현체는 `length === 0`도 드롭하지만 테스트는 `messages` 키 자체가 없는 경우만 검증 | `use-execution-events.test.ts` | `messages: []` 페이로드 전달 후 `conversationMessages` 길이가 0인지 검증하는 케이스 추가 |
| 5 | Testing / Requirement | 두 번째 백엔드 테스트에서 `durationMs` 검증 누락. tool-loop 경로의 `durationMs` 회귀 탐지 불가 | `execution-engine.service.spec.ts` — `preserves the full llmCalls sequence...` | `expect(payload.durationMs).toBe(120)` 추가 |
| 6 | Testing / Requirement | 두 번째 백엔드 테스트의 `_resumeState`에 `model`, `totalInputTokens`, `totalOutputTokens` 필드 누락. 서비스가 이 필드에 접근 시 `undefined` 직렬화 또는 런타임 에러 가능 | `execution-engine.service.spec.ts` — 두 번째 `makeAiAgentHandler` 인스턴스 | `_resumeState`에 누락 필드 추가 |
| 7 | Requirement | 첫 번째 테스트의 `durationMs` 검증이 모호함. `llmCall.durationMs`와 `totalDurationMs` 모두 `120`으로 동일해 어느 소스에서 채우는지 테스트로 구분 불가 | `execution-engine.service.spec.ts` — 첫 번째 테스트 | 두 값을 의도적으로 다르게 설정(예: `llmCall.durationMs: 90`, `totalDurationMs: 120`) |
| 8 | Security | `llmCalls` 배열 내부에 raw LLM 요청/응답 페이로드(`requestPayload`, `responsePayload`)가 여전히 브라우저로 전달됨. 시스템 프롬프트·내부 tool 정의 등 민감 정보 노출 경로 | `use-execution-events.ts` — `handleAiMessage` + 백엔드 테스트 | 서버 측 전송 전 redact 처리. 클라이언트에는 메타데이터(모델명, 토큰 수, `durationMs`)만 노출 |
| 9 | Architecture / Documentation | 스펙 참조(`spec/5-system/6-websocket-protocol.md §4.4`)가 세 파일에 기재됐으나 실존 여부 미확인. 파일 부재 시 세 곳이 동시에 stale reference가 됨 | 세 파일 모두 주석 | 실재 여부 확인 후 없다면 신규 작성 |
| 10 | Architecture | `NodeHandler` 인터페이스가 멀티턴 메서드를 포함하지 않아 `as unknown as NodeHandler & { ... }` 이중 캐스팅 강제. 인터페이스-구현 불일치가 타입 시스템 밖으로 숨겨짐 | `execution-engine.service.spec.ts` — `makeAiAgentHandler` 반환부 | `MultiTurnNodeHandler extends NodeHandler` 서브인터페이스 정의 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `console.warn`에 전체 `payload` 객체 출력 — `llmCalls`(raw 요청/응답) 포함. SSR 경로나 로그 집계 도구 확장 시 민감 정보 유출 위험 | `use-execution-events.ts` — L322–328 | `payload.nodeId`, `payload.turnCount` 등 비민감 식별자만 로그에 포함 |
| 2 | Security | `messages` 및 `llmCalls` 배열 크기 상한 없음. 비정상적으로 큰 배열 시 브라우저 메모리 소진 및 렌더링 지연 | `use-execution-events.ts` — `handleAiMessage` | 최대 길이 가드 추가 |
| 3 | Security | AI 생성 `content` 필드가 WebSocket 핸들러 수준에서 sanitize 없이 스토어 저장. XSS 방어가 렌더링 컴포넌트에 위임 | `use-execution-events.ts` → `messagesToConversationItems(...)` | 렌더링 컴포넌트의 텍스트 노드 처리 여부 주기적 감사 |
| 4 | API Contract | WebSocket 채널/이벤트명에 버전 정보 없음. 구형 캐시된 JS 번들과의 혼용 시나리오에서 페이로드 스키마 변경이 무음 계약 파기로 이어질 수 있음 | `use-execution-events.ts` — `execution:${executionId}` 채널 | 페이로드에 `schemaVersion` 필드 추가 또는 채널 네임스페이스 버저닝 고려 |
| 5 | Concurrency | Zustand read-then-write 비원자 패턴. 현재 단일 스레드 환경에서는 안전하나 Web Worker 이식 시 취약점 | `use-execution-events.ts` — `handleAiMessage` 콜백 | `setState(state => ...)` 함수형 업데이트로 read-write를 단일 트랜잭션으로 묶는 리팩토링 고려 |
| 6 | Concurrency | `handleAiMessage`에 `cancelledRef.current` 가드 없음. `handleSnapshot`과 불일치 | `use-execution-events.ts` — `handleAiMessage` 진입부 | `if (cancelledRef.current) return;` 가드 추가 |
| 7 | Concurrency | `flushPromises()` 기반 테스트가 `setTimeout`/`setInterval` 경로를 보장하지 않음. 간헐적 실패 가능성 | `execution-engine.service.spec.ts` — 신규 두 테스트 케이스 | `jest.useFakeTimers()` + `jest.runAllTimersAsync()` 조합으로 교체 |
| 8 | Performance | `handleAiMessage` 호출마다 `toolStatusMapFromItems`가 전체 `conversationMessages` 순회 후 새 Map 생성(O(n)). 장시간 세션에서 점진적 비용 증가 | `use-execution-events.ts` — `toolStatusMapFromItems(previousItems)` | store 슬라이스에 `toolCallId → status` Map을 별도 인덱스로 유지해 O(1) 조회 (중장기 과제) |
| 9 | Performance | `new Map([[turn, {...}]])` — 단일 엔트리 Map을 매 AI 메시지마다 할당 | `use-execution-events.ts` — `debugByTurn` 생성 구간 | `messagesToConversationItems` API 시그니처를 Map 대신 배열·객체를 받도록 변경 |
| 10 | Maintainability | `NODE_ENV !== "production"` 조건이 `"test"` 환경도 포함해 테스트 실행 시 `console.warn` 발화. `warnSpy` 없이 관련 케이스 추가 시 테스트 노이즈 | `use-execution-events.ts` — invalid payload early-return 분기 | `NODE_ENV === "development"`로 변경하거나 주입 가능한 logger 인터페이스로 분리 |
| 11 | Testing | `turnDebugHistory` 비어 있을 때(`llmCalls` 없음) 경로 미테스트 | `execution-engine.service.spec.ts` | `turnDebugHistory: []`인 케이스 추가 |
| 12 | Testing | 프로덕션 모드에서 `console.warn` 비발생 테스트 없음 — 브랜치 커버리지 갭 | `use-execution-events.ts` — L329 | `vi.stubEnv('NODE_ENV', 'production')` 패턴으로 케이스 추가 |
| 13 | Side Effect | `warnSpy`가 `try` 블록 내부에서 생성됨. `vi.spyOn` 예외 시 `finally`에서 TypeError 발생 가능성 (매우 낮음) | `use-execution-events.test.ts` | `vi.spyOn(...)` 라인을 `try` 블록 밖으로 이동 |
| 14 | Documentation | 제거된 flat 필드(`requestPayload`, `responsePayload`)에 대한 마이그레이션 주석 없음 | `use-execution-events.ts` — `handleAiMessage` 내부 타입 정의 | `llmCalls` 배열 위에 `// requestPayload / responsePayload: 제거됨 — llmCalls 배열로 통합 (§4.4)` 추가 |
| 15 | Scope | `llmCalls` 타입 정의의 멀티라인 포맷팅 변경이 실질 변경과 혼재해 diff 가독성 소폭 저하 | `use-execution-events.ts` diff | 포맷팅 변경은 별도 커밋으로 분리 (강제 사항 아님) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Requirement | MEDIUM | 백엔드 테스트의 `messages` 필드 emit 검증 누락, `durationMs` 테스트 모호성 |
| Testing | MEDIUM | describe 블록 중복, `messages: []` 케이스 미테스트, `warnSpy` 호출 미검증 |
| Side Effect | MEDIUM | describe 블록 이중 삽입, 프로덕션 무음 드롭 |
| API Contract | MEDIUM | 비원자적 배포 시 AI 메시지 소실, 프로덕션 모니터링 부재 |
| Architecture | LOW | 이벤트 페이로드 공유 타입 부재, `NodeHandler` 인터페이스 불일치 |
| Security | LOW | `llmCalls` 내 raw LLM 페이로드 브라우저 전송, `console.warn` 민감 데이터 |
| Concurrency | LOW | Zustand read-write 비원자 패턴, `cancelledRef` 미확인 |
| Documentation | LOW | `warnSpy` 어서션 누락, 스펙 참조 실존 미확인 |
| Performance | LOW | `toolStatusMapFromItems` O(n) 반복 생성 |
| Maintainability | LOW | `NODE_ENV !== "production"` 가드 테스트 노이즈, 이중 캐스팅 |
| Scope | LOW | 포맷팅 변경이 실질 변경과 혼재 |
| Dependency | NONE | 신규 외부 패키지 없음, 내부 의존성 범위 축소 |
| Database | NONE | 해당 없음 (DB 관련 코드 없음) |

---

## 발견 없는 에이전트

- **Database** — 변경사항 전체가 WebSocket 프로토콜 레이어와 클라이언트 상태 관리에 국한
- **Dependency** — 신규 외부 패키지 없음. `addConversationMessage` 제거로 의존성 범위 오히려 축소

---

## 권장 조치사항

1. **[즉시] `describe` 블록 중복 제거** — `execution-engine.service.spec.ts` 내 동일한 블록이 두 번 존재. CI 리포트 신뢰도 직결 문제.

2. **[즉시] 백엔드 테스트에 `messages` 필드 emit 검증 추가** — `expect(payload).toHaveProperty('messages')` + 배열 여부 + 길이 > 0 어서션. 프론트엔드 "messages 없으면 드롭" 정책과 계약이 테스트로 연결되지 않는 Critical 갭.

3. **[즉시] `warnSpy` 어서션 추가** — suppress만 하고 발화 여부 미검증. `expect(warnSpy).toHaveBeenCalledWith(...)` 추가.

4. **[즉시] 두 번째 테스트 `_resumeState` 필드 보완** — `model`, `totalInputTokens`, `totalOutputTokens` 누락. 첫 번째 테스트와 동일 구조로 맞춤.

5. **[즉시] 두 번째 테스트 `durationMs` 검증 추가** — `expect(payload.durationMs).toBe(120)`. 첫 번째 테스트와 일관성 유지.

6. **[단기] 비원자적 배포 위험 명문화** — 배포 가이드에 원자적 배포 또는 전환 기간 정책 명시.

7. **[단기] 프로덕션 계약 위반 모니터링 추가** — Sentry 등에 `messages` 없는 페이로드 수신 기록. 현재 프로덕션에서 완전 무음.

8. **[단기] `spec/5-system/6-websocket-protocol.md §4.4` 실존 확인** — 세 파일 참조 스펙 섹션이 실재하고 이번 변경 내용을 반영하는지 확인. 없다면 신규 작성.

9. **[단기] `messages: []` 빈 배열 테스트 케이스 추가** — 구현체의 `length === 0` 조건이 테스트로 커버되지 않음.

10. **[중장기] `llmCalls` 내 민감 데이터 redact** — `requestPayload`/`responsePayload`가 `llmCalls` 배열 내부에서 브라우저로 전달됨. 서버 측 전송 전 redact 처리 또는 별도 디버그 전용 구조체로 분리.