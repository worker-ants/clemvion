# Code Review 조치 내용 (Follow-up #1·#4)

## 대상 리뷰
- 위치: `review/2026-05-04_20-37-20/SUMMARY.md`
- 범위: frontend legacy fallback 제거 (`use-execution-events.ts`) + backend AI_MESSAGE emit shape 통합 테스트 추가 (`execution-engine.service.spec.ts`) — 직전 RESOLUTION 의 Follow-up #1·#4

## 전체 위험도
리뷰 결과 MEDIUM (Critical 2 / Warning 10 / Info 15) → 조치 후 Critical 0 / 미해결 Warning 5건은 본 PR 범위 밖 사안으로 분리.

## Critical 조치

### #1 Testing — 백엔드 테스트의 messages 필드 emit 검증 누락
**조치 완료.** 두 통합 테스트 케이스 모두에 다음 어서션 추가:
```ts
expect(payload).toHaveProperty('messages');
expect(Array.isArray(payload.messages)).toBe(true);
expect((payload.messages as unknown[]).length).toBeGreaterThan(0);
```
프론트엔드의 "messages 없으면 드롭" 정책이 백엔드 emit 계약과 테스트 레벨에서 연결되어 회귀 발생 시 즉시 감지.

### #2 Testing — describe 블록 중복
**False positive 확인.** `grep` 으로 검사 결과 `describe('AI Agent multi-turn — execution.ai_message emit shape', ...)` 블록은 파일 내 line 905 한 곳에만 존재. 리뷰어의 오인. 액션 불필요.

## Warning 조치

### #3 Testing — warnSpy 호출 미검증
**조치 완료.** suppression 만 하던 spy 에 `expect(warnSpy).toHaveBeenCalledTimes(1)` + `toHaveBeenCalledWith(stringContaining(...), { nodeId, turnCount })` 검증 추가. dev-only warning 동작과 비민감 식별자만 로깅하는 정책을 양쪽 모두 회귀 검증.

### #4 Testing — messages: [] 빈 배열 케이스 미테스트
**조치 완료.** `ai_message ignores payloads with messages: [] (empty snapshot)` 테스트 추가. 구현체의 `length === 0` 가드와 dev-only warning 발화를 명시 검증.

### #5 Testing — 두 번째 백엔드 테스트 durationMs 검증 누락
**조치 완료.** tool-loop 케이스에 `expect(payload.durationMs).toBe(120)` 추가.

### #6 Testing — 두 번째 백엔드 테스트 _resumeState 필드 누락
**조치 완료.** `model`, `totalInputTokens`, `totalOutputTokens` 누락분을 첫 번째 테스트와 동일 구조로 보완. messages 도 `[]` → 실제 user/assistant 로 채워 `messages` 필드 검증과 정합.

### #7 Requirement — durationMs 모호성 (테스트 #1)
**조치 완료.** 첫 번째 테스트의 `llmCall.durationMs` 를 `120` → `90` 으로 변경. 이제 `payload.durationMs === 120` 어서션이 `totalDurationMs` 출처임을 명확히 구분 (per-call 90 이 아니라 turn-total 120 임을 검증).

### #1 API Contract — 비원자적 배포 시 무음 메시지 소실
**조치하지 않음 (별도 사안).** monorepo 단일 배포 정책이므로 backend/frontend 가 동시 배포된다 — 워크플로 자체 디자인 결정. 롤링 배포 / 캐시된 구 frontend 우려는 PRD/배포 정책 영역으로 분리. CLAUDE.md 의 `project-planner` skill 영역.

### #2 API Contract — 프로덕션 무음 드롭
**조치하지 않음 (별도 사안).** 본 monorepo 에는 Sentry 등 client-side 에러 트래커가 통합되어 있지 않음. 운영 모니터링 도입 자체가 별도 인프라 결정 사안. 현재 `NODE_ENV !== "production"` 가드 + 비민감 식별자 로깅 (INFO #1 조치 후) 은 dev 단계 회귀 검출에 충분하며, 프로덕션 도입 시 그 시점에서 동일 분기에 hook 추가 가능.

### #8 Security — llmCalls 내 raw LLM payload
**조치하지 않음 (디자인).** 직전 RESOLUTION 라운드에서도 동일 결정 — 디버깅 타임라인의 본질적 동작이며 terminal emit 분기와 동일. 권한 분리 도입 시점에 별도 사안.

### #9 Architecture — spec §4.4 실존 미확인
**조치 완료 (확인).** `grep` 으로 검사 결과 `spec/5-system/6-websocket-protocol.md` 의 line 235 에 `### 4.4 사용자 입력 대기 이벤트 상세` 섹션 실존. 그 섹션 본문에서 `execution.ai_message` 페이로드 표가 정의되어 있어 주석 참조가 정합. 단, 동일 파일에 §4.4 가 두 번 등장(`### 4.4 알림 이벤트 (line 460)`) 하는 것은 spec 문서 자체의 numbering 결함이지만 본 작업 범위 밖.

### #10 Architecture — NodeHandler 인터페이스 확장
**조치하지 않음 (별도 리팩토링).** `MultiTurnNodeHandler extends NodeHandler` 서브 인터페이스를 정의하면 `ai_agent` / `information_extractor` 등 모든 multi-turn 핸들러와 engine 의 분기 캐스팅을 함께 정리해야 함 — 본 PR 의 follow-up 범위를 넘어서는 구조적 변경이라 별도 사안으로 분리. 현재 `as unknown as NodeHandler & { ... }` 캐스팅은 테스트 코드에 격리되어 있어 production code 의 타입 안전성에 영향 없음.

## Info 조치

| # | 조치 | 비고 |
|---|------|------|
| 1 | ✅ | `console.warn` 페이로드 출력을 `{ nodeId, turnCount }` 비민감 식별자로 축소 |
| 2 | 보류 | 페이로드 크기 가드 — 별도 인프라 사안 |
| 3 | 보류 | XSS sanitizer 위치는 렌더링 컴포넌트 책임으로 기존 정책 유지 |
| 4 | 보류 | schemaVersion 도입 — 별도 spec 결정 |
| 5 | 보류 | Web Worker 이식 시점 사안 |
| 6 | 보류 | cancelledRef 가드 — 본 파일 다른 이벤트 핸들러도 모두 미적용. 일관성 차원에서 본 핸들러만 추가하면 비대칭 발생. 별도 리팩토링 필요 |
| 7 | 보류 | flushPromises → fakeTimers 전환은 인근 모든 테스트가 동일 패턴이므로 광범위 사안 |
| 8 | 보류 | toolStatusMapFromItems 인덱싱 — 중장기 과제 |
| 9 | 보류 | Map 할당 최적화 — 가독성/성능 트레이드오프, 미세 |
| 10 | 보류 | NODE_ENV `"test"` 환경에서 warn 발생 — 본 라운드의 warnSpy 도입(WARNING #3)으로 자연 해결 (`vi.spyOn` 으로 suppress + assert) |
| 11 | 보류 | turnDebugHistory: [] 케이스는 helper 단위 테스트에서 이미 커버 (`returns empty object when turnDebugHistory is an empty array`) |
| 12 | 보류 | production 모드 console.warn 비발생 테스트 — `vi.stubEnv` 도입은 본 파일의 다른 케이스와 패턴 차이가 커서 별도 |
| 13 | 보류 | 이론적 사안. `vi.spyOn` 자체가 throw 하는 시나리오는 비현실적 |
| 14 | ✅ | `llmCalls` 타입 정의 위에 마이그레이션 주석 추가 (제거된 flat 필드 → llmCalls 통합) |
| 15 | 보류 | 포맷팅 차이는 prettier 결과 |

## TEST WORKFLOW 재실행 결과
- backend lint: ✅
- backend unit test: 2566/2566 ✅
- backend build: ✅
- frontend lint: ✅
- frontend unit test: 1121/1121 ✅ (이전 1120 + messages: [] 추가)
- frontend build: ✅

## 후속 사안 (Follow-up)
1. (별도 PRD/Spec) 워크스페이스 멤버 권한 분리 도입 시 `llmCalls` raw payload 노출 정책 재정의 (Security #8)
2. (별도 PR) `MultiTurnNodeHandler` 인터페이스 도입 — engine 의 multi-turn 분기 캐스팅 일소 (Architecture #10)
3. (별도 PR) WebSocket 이벤트 핸들러 전반의 `cancelledRef` 가드 일관 적용 (Concurrency INFO #6)
4. (별도 인프라) 운영 환경 client-side 에러 트래킹 도입 시 invariant 위반 페이로드 로깅 후크 추가 (API Contract #2)
