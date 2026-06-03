# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 테스트 커버리지 갭(live 이벤트 경로 `startedAt` 전파 검증 없음)과 `toolStatusMapFromItems`의 `startedAt` 미전파(live→스냅샷 교체 시 tool timestamp 유실 가능), user-guide docs 동반 갱신 누락이 핵심 위험. 기능 구현 자체는 하위 호환적이고 아키텍처적으로 타당하다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | Critical 발견사항 없음 | — | — |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | Testing | `tool_call_started`/`tool_call_completed`의 `startedAt` 전파 로직에 대한 전용 테스트 없음. legacy(startedAt 미동봉) 폴백, completed에서의 reconcile 등 3경로 미검증 | `use-execution-events.test.ts` L1430–1530 | `startedAt` 동봉/미동봉, `completed` reconcile 3 케이스를 각각 추가 |
| W2 | Testing | `toolStatusMapFromItems`가 `startedAt`을 수집하지 않아 `ai_message` 스냅샷 교체 시 tool timestamp 유실 — 이 버그를 드러내는 회귀 테스트도 없음 | `conversation-utils.ts` L596–610; `conversation-utils.test.ts` | `toolStatusMapFromItems`에 `startedAt: item.timestamp` 추가 + 독립 유닛 테스트 작성 |
| W3 | Requirement | spec §9.12 표시 규약이 `"time"` 포맷 지정, 구현은 `"time-seconds"` 사용 — spec 텍스트와 literal 불일치 | `conversation-timeline-item.tsx`, `result-timeline.tsx`, `conversation-inspector.tsx`, `executions/[executionId]/page.tsx` | spec §9.12를 `"time-seconds"`로 수정(project-planner 위임)하거나 구현을 `"time"`으로 되돌림 |
| W4 | Maintainability | timestamp + durationMs 인라인 렌더 패턴이 5~7곳에 중복 복사됨. 포맷 변경 시 모두 수정 필요 | `conversation-inspector.tsx` 4곳, `result-timeline.tsx` 1곳, `conversation-timeline-item.tsx`, `executions/[executionId]/page.tsx` | `TimestampAndDuration`/`ItemTimingBadge` 공유 컴포넌트로 추출 |
| W5 | Maintainability | `new Date(callStartedAt).toISOString()` 변환 표현이 백엔드 4곳에 중복 | `ai-agent.handler.ts` 내 4개 지점 | `toIso(ms: number): string` 헬퍼 함수 추출 |
| W6 | Maintainability | 익명 인라인 타입 리터럴 중복 — `use-execution-events.ts`(2곳)와 `ai-agent.handler.ts`(2곳)에서 `startedAt?/finishedAt?` 포함 인라인 타입을 각각 재정의, `LlmCallEntry`와 비동기화 | `use-execution-events.ts` ~L445/555; `ai-agent.handler.ts` ~L1194/1970 | 인라인 타입을 `LlmCallEntry` 또는 명명된 인터페이스로 통합 |
| W7 | User Guide Sync | 실행·디버깅 흐름 변경에 대응하는 user-guide docs 갱신 누락. 타임라인 FieldTable에 "발생 시각" 항목 미등재 | `docs/05-run-and-debug/run-results.mdx` + `.en.mdx` | FieldTable에 발생 시각 항목 추가; §멀티턴 AI 에이전트 소절 1~2문장 추가; 영문 동반 갱신 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | Testing | `ai-agent.handler.spec.ts` — `startedAt`/`finishedAt` ISO8601 형식 및 `startedAt <= finishedAt` 불변 조건 미검증 | `ai-agent.handler.spec.ts` L2712–2723 | `toMatch(/^\d{4}-\d{2}-\d{2}T/)` + 시간 순서 불변 조건 assert 추가 |
| I2 | Testing | `execution-engine.service.spec.ts` — `startedAt`/`finishedAt` 미동봉(legacy) 입력 backward-compat 케이스 없음 | `execution-engine.service.spec.ts` | `startedAt` 없는 입력에서 `undefined` 반환 + 예외 미발생 케이스 추가 |
| I3 | Testing | `date.test.ts` — `time-seconds` 포맷의 `ko-KR` locale 테스트 없음 | `date.test.ts` L2838–2844 | `formatDate(..., "time-seconds", "ko")` 케이스 추가 |
| I4 | Testing | 프론트엔드 컴포넌트(`conversation-inspector.tsx`, `result-timeline.tsx`, `conversation-timeline-item.tsx`) — timestamp 렌더 변경에 대한 컴포넌트 테스트 없음 | 각 컴포넌트 `__tests__` | timestamp+durationMs 있음/없음/단독 3케이스 렌더 테스트 추가 |
| I5 | Architecture | `toolStatusMapFromItems`에서 `startedAt` 미전파 — live→history 전환 시 tool 발생 시각 유실 (영속 경로인 `toolStatusMapFromDebug`로 보완되나 비대칭) | `conversation-utils.ts` `toolStatusMapFromItems` | `startedAt: item.timestamp` 추가로 두 경로 대칭화 |
| I6 | Architecture | 타임스탬프 필드 쌍(`startedAt?/finishedAt?`)이 5개 이상 독립 인터페이스에 분산 복제 | 백엔드 `LlmCallRecord`, 프론트 `LlmCallEntry`/`TurnToolCallEntry`, WS payload 2개 등 | 공유 타입 패키지 또는 `TimingFields` intersection 도입 검토 |
| I7 | Architecture | `use-execution-events.ts` 인라인 타입과 `websocket.service.ts` 공식 payload 타입 구조 이중화 — 수동 동기화 부담 | `use-execution-events.ts` L611–628 | SYNC 주석 유지; 중장기 공유 패키지 이동 검토 |
| I8 | Performance | `formatDate` 호출이 리렌더 경로에 추가됨 — live 실행 중 WS 이벤트마다 리렌더 시 `toLocaleTimeString` 비용 누적 가능 | 렌더 컴포넌트 다수 | 성능 문제 관찰 시 `useMemo` 또는 LRU 캐시 도입 |
| I9 | Performance | `finishedAt = new Date().toISOString()` — `durationMs` 계산과 별도 `Date.now()` 호출로 1ms 수준 오차 (spec 명시 허용) | `ai-agent.handler.ts` tool/LLM 완료 지점 | `const finishedAtMs = Date.now(); durationMs = finishedAtMs - startedAt; finishedAtIso = new Date(finishedAtMs).toISOString()` 패턴으로 단일 캡처 권장 |
| I10 | Side Effect | `tool_call_started` timestamp 소스가 클라이언트 수신 시각 → 서버 스탬프 우선으로 변경(의도된 변경, 폴백 보존) | `use-execution-events.ts` `tool_call_started` 핸들러 | 현행 유지 |
| I11 | API Contract | `ToolCallCompletedPayload`의 `startedAt`/`finishedAt`이 둘 다 absent 또는 둘 다 present 불변식 미강제 | `websocket.service.ts` L122–124 | discriminated union 또는 문서화로 페어링 불변식 명시 |
| I12 | Documentation | `finishedAt` 필드가 타입에 존재하나 렌더 레이어에서 미사용 — 목적(wire 완전성/미래 표시용) 미문서화 | `LlmCallEntry`, `ToolStatusInfo` | `finishedAt` JSDoc에 "현재 UI는 startedAt만 소비; wire 완전성 및 미래 표시용" 한 줄 추가 |
| I13 | Requirement | spec §9.12 `system_error` turn 발생 시각 출처 "노드 finishedAt" 폴백이 구현에 미반영 — spec 모호성 또는 구현 누락 | `threadTurnsToConversationItems` system_error 케이스 | project-planner와 의도 확인; 필요시 폴백 로직 추가 |
| I14 | Maintainability | `durationMs != null` vs `!== undefined` 혼용 | `conversation-inspector.tsx`, `result-timeline.tsx` vs `use-execution-events.ts` | `0`이 유효 값인 수치 필드는 `!= null`로 통일 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | N/A (출력 파일 없음 — 재시도 필요) | — |
| performance | LOW | 렌더 경로 `toLocaleTimeString` 누적 가능(INFO); `toolStatusMapFromItems` `startedAt` 미전파(INFO) |
| architecture | LOW | `toolStatusMapFromItems` `startedAt` 미전파로 live→history 전환 시 시각 유실 가능(INFO); 타입 분산 복제(INFO) |
| requirement | LOW | spec §9.12 `"time"` vs 구현 `"time-seconds"` 불일치(WARNING); `toolStatusMapFromItems` 미전파(WARNING) |
| scope | NONE | 모든 변경이 명시된 작업 범위 내 |
| side_effect | LOW | 모든 변경 하위 호환; timestamp 소스 변경은 의도된 동작 |
| maintainability | LOW | 렌더 패턴 5중 중복(WARNING); 인라인 타입 중복(WARNING); toIso 변환 4중 중복(WARNING) |
| testing | MEDIUM | live 이벤트 `startedAt` 전파 전용 테스트 없음(WARNING); `toolStatusMapFromItems` 버그 + 테스트 없음(WARNING) |
| documentation | LOW | 렌더 패턴 인라인 확산(WARNING, 문서화 결함 아님); JSDoc 전반 양호 |
| concurrency | NONE | 실질적 동시성 결함 없음; `finishedAt` 1ms 오차 spec 허용 |
| api_contract | LOW | 모든 추가 optional — breaking change 없음 |
| user_guide_sync | LOW | `run-results.mdx` + `.en.mdx` 타임라인 FieldTable 갱신 누락(WARNING) |

---

## 발견 없는 에이전트

- **scope**: 모든 18개 파일이 명시된 Phase 1/2/3 범위에 정확히 대응. 불필요한 리팩토링·관련 없는 파일 수정 없음.
- **concurrency**: 락·공유 변경 가능 상태 경쟁·이벤트 루프 블로킹 등 실질적 동시성 결함 없음.

---

## 권장 조치사항

1. **[W2] `toolStatusMapFromItems` `startedAt` 전파 버그 수정** — `map.set(item.toolCallId, { ..., startedAt: item.timestamp })` 추가. live→ai_message 스냅샷 교체 시 tool timestamp 유실 방지. 수정 후 `conversation-utils.test.ts`에 유닛 테스트 추가.
2. **[W1] `use-execution-events.ts` `startedAt` 전파 테스트 추가** — `tool_call_started` startedAt 동봉/미동봉, `tool_call_completed` reconcile 3 케이스 검증.
3. **[W7] user-guide docs 갱신** — `run-results.mdx` + `.en.mdx` §타임라인 읽기 FieldTable에 "발생 시각" 항목 추가; §멀티턴 AI 에이전트 소절 1~2문장 추가.
4. **[W3] spec §9.12 vs 구현 포맷 불일치 해소** — spec `"time"` → `"time-seconds"` 수정(project-planner 위임) 또는 구현 롤백. 두 방향 중 하나 선택.
5. **[W4/W5/W6] 코드 중복 정리** — `ItemTimingBadge` 컴포넌트 추출(5개 인라인 패턴), `toIso` 헬퍼 추출(4개 변환), 인라인 타입 → `LlmCallEntry` 통합.
6. **[I1] ISO8601 형식·순서 불변 조건 테스트 강화** — `ai-agent.handler.spec.ts`에 형식 regex + `startedAt <= finishedAt` assert 추가.
7. **[I2] backward-compat 테스트 추가** — `execution-engine.service.spec.ts`에 `startedAt` 없는 legacy 입력 케이스 추가.
8. **[I9] `finishedAt` 단일 `Date.now()` 캡처 패턴 통일** — `durationMs`와 `finishedAtIso`를 같은 epoch에서 산출해 1ms 오차 제거.

---

## 라우터 결정

라우터가 선별 실행(`routing_status=done`).

- **실행** (12명): security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract, user_guide_sync
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)
- **제외** (2명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| dependency | 라우터 판단에 의해 제외 |
| database | 라우터 판단에 의해 제외 |

> **참고**: security reviewer가 ran 목록에 `success`로 포함되었으나 출력 파일(`security.md`)이 디스크에 존재하지 않아 내용을 확인할 수 없었다. security 항목은 재시도 필요 1건으로 처리됨.