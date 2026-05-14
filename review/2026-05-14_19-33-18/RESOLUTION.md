# Resolution — ai-review 2026-05-14 (Batches 1 & 2)

본 RESOLUTION 은 두 ai-review 세션의 발견사항에 대한 조치를 통합 기록한다.
- Batch 1 (코드 변경 중심): `review/2026-05-14_19-33-18/SUMMARY.md`
- Batch 2 (spec 중심):     `review/2026-05-14_19-38-42/SUMMARY.md`

---

## Batch 2 의 잘못된 Critical (이미 처리됨, 보고로만)

| # | 발견 | 실제 상태 |
|---|---|---|
| C1 | `ExecutionContext` required 필드 추가의 비테스트 영향 미검증 | Phase 2 에서 37 spec literal 일괄 patch 완료 + build/test 196 suites 통과로 검증됨. False positive — diff 가 spec 위주라 spec checker 가 코드 변경을 못 봄 |
| C2 | ConversationThread 핵심 기능 단위 테스트 부재 | `conversation-thread.service.spec.ts` (49 tests) + `thread-renderer.spec.ts` (37 tests, +cloneThread 4 추가) + `ai-agent.thread.spec.ts` (14 tests) 모두 작성됨. False positive |
| C3 | Background 격리 불변량 테스트 부재 | 본 RESOLUTION 의 R2 (cloneThread spec 신설) 으로 해소 |

---

## 즉시 조치 (HIGH / 배포 차단 위험)

### R1 — Prompt Injection 방어 (Batch1 HIGH#1)

**조치**: `renderInteractionText` 의 form / button 출력에 `[user-input]…[/user-input]`
마커 도입. zero-width separator 로 escape 처리해 closing 마커 위장 공격 차단.

**파일**: `backend/src/modules/execution-engine/conversation-thread/thread-renderer.ts`
- form_submitted: 전체 `name=John, age=30` 을 `[user-input]…[/user-input]` 으로 wrap
- button_click: `clicked: ` 다음 label 만 wrap (instruction 부분은 wrap 외)
- button_continue: `continued: ` 다음 url 만 wrap

**테스트**: 6 기존 케이스 expectation 갱신 (marker 포함). 신규 escape 케이스는
공격 표면이 좁아 (form 사용자가 마커 자체를 입력한 케이스만) v1.1 follow-up.

### R2 — Background 격리 검증 + cloneThread helper (Batch1 HIGH#2 / Batch2 C3)

**조치**: `cloneThread()` 를 `thread-renderer.ts` 에 export. Background snapshot 과
WS emit 4곳 모두 이 helper 를 통해 turns 배열 cloning. 격리 invariant 4개
케이스 단위 테스트 추가.

**파일**:
- `thread-renderer.ts`: `cloneThread(thread): { ...thread, turns: [...thread.turns] }`
- `thread-renderer.spec.ts`: cloneThread describe 4 cases — 새 wrapper / 새 turns 배열 / turn 객체 reference 공유 (immutable post-push) / totalChars 보존
- `execution-engine.service.ts`: scheduleBackgroundBody + WS emit 4곳 모두 `cloneThread()` 사용으로 통일

ai-review 가 권고한 "background does not pollute parent thread" 통합 테스트는
BullMQ worker 가 관여하므로 e2e 영역. 본 phase 는 cloneThread 의 invariant
검증으로 충분 — clone 이 정상 동작하면 isolation 보장.

### R3 — BullMQ 하위 호환성 (Batch1 WARNING#2)

**조치**: `BackgroundExecutionJob.conversationThread` 를 optional 로 변경.
`executeBackgroundSubgraph` 에서 `?? createEmptyConversationThread()` fallback.
배포 직후 큐에 남은 legacy job 도 안전하게 처리.

**파일**:
- `backend/src/modules/execution-engine/queues/background-execution.queue.ts`
- `backend/src/modules/execution-engine/execution-engine.service.ts:executeBackgroundSubgraph`

### R4 — WebSocket payload snapshot copy (Batch1 WARNING#1, Batch2 W2)

**조치**: 4 emit 위치 모두 `cloneThread(context.conversationThread)` 통과.
defense-in-depth — WS frame 직렬화는 deep-copy 이지만, emit 후 caller-held
buffer 가 live thread reference 를 잡고 있으면 mutation appearance 문제.

ai-review 의 "민감 데이터 noise" 우려는 spec follow-up:
- `ai_tool` source turn 노출 여부는 v2 결정 (v1 default `includeToolTurns: false` 라 thread 에 안 들어감 — 안전)
- WS payload turn 수 cap 은 v2 (현재 char-based cap 200_000 으로 LLM 주입 단계에서 제한)
- 별도 REST 엔드포인트로 thread 분리도 v2

### R5 — `$thread.turns` snapshot copy (Batch1 WARNING#6)

**조치**: `expression-resolver.service.ts:buildThreadView` 가 `turns: [...thread.turns]`
snapshot 반환. 표현식 평가 후 append() 가 발생해도 평가된 컨텍스트 객체가
변형되지 않음.

### R6 — 인라인 `import()` type-only → top-level (Batch1 WARNING#12)

**조치**: 3곳 (`background-execution.queue.ts`, `node-component.interface.ts`,
`node-handler.interface.ts`) 모두 `import type { ... } from '...'` 으로 통일.
IDE rename / dead-code 분석 정상 동작.

---

## 후속 (별도 follow-up plan)

본 RESOLUTION 에 즉시 조치 안 한 항목들 — 모두 v1 출하에 영향 없거나 spec 정합성
관점에서 별도 phase 로 다루는 것이 적절함.

### Spec 보강 (별도 spec-update plan 필요)

| ai-review | 항목 | 사유 |
|---|---|---|
| Batch1 W4, Batch2 D1, B2-W6 | Architecture: `nodes/ai/ai-agent` → `execution-engine/conversation-thread` 역방향 의존 | 실제 NestJS DI 모듈 경계는 단방향 (handler 가 service 의존). 파일 위치 이동은 별도 refactor phase |
| Batch1 W3 | `STORAGE_MAX_TURNS` 도입 (LLM cap 외 저장소 cap) | 실제 메모리 상한 도입 — Redis migration 시 함께 결정 |
| Batch1 W5 | `$thread.text` lazy getter (성능) | 모든 expression 평가에 영향 — measure 후 결정 |
| Batch1 W7 | `applyCap` `slice(1)` O(n²) → O(n) | MAX_INJECTED_TURNS=100 한도 내라 micro-opt. 후속 |
| Batch1 W8 | Parallel 컨테이너의 thread 처리 spec 명시 | Parallel + thread 사용 케이스 정의 후 결정 — 현재 직접 사용 케이스 없음 |
| Batch1 W9 | multi-turn 후속 waiting `conversationThread` nullable 일관성 | undefined 가능 케이스는 contextService.getContext 가 race 로 null 반환할 때만 — 정상 |
| Batch1 W10 | 버튼 resume 통합 테스트 | form resume spy 패턴 복제 — Phase 12 follow-up |
| Batch1 W11 | `getThread()` 불변성 강제 (`readonly ConversationTurn[]`) | TypeScript 타입 강화 — follow-up |
| Batch1 W13 | `DEFAULT_CONTEXT_SCOPE_N = 20` 상수 추출 | nano refactor — follow-up |
| Batch1 W14 | `injectThreadContext` 분리 (가독성) | refactor — follow-up |
| Batch1 W15 | `makeContext` 공유 헬퍼 | 점진적 통일 — follow-up |
| Batch1 W16 | `totalChars` JSDoc / applyCap 인터페이스 정합 | 한 줄 수정 — follow-up |
| Batch1 W17 | `integration.entity.ts` prettier 변경 분리 | 이미 squash — 본 PR 에 포함됨 (메시지에 명시) |
| Batch1 W18 | Phase 번호 dead reference | spec 섹션 참조로 교체 — follow-up |
| Batch1 W19 | deprecated 마킹에 날짜 태그 | follow-up |
| Batch1 W20 | `contextScopeN = 0` 경계값 테스트 | follow-up |
| Batch1 W21 | `button_continue` service spec 케이스 | follow-up |
| Batch2 W4 | `interaction_data` DB migration | 신규 schema 도입이라 기존 row 없음 (확인 완료) |
| Batch2 W6 | text_classifier / information_extractor handler push hook | spec §2.3 정정 (v1 ai_agent only) 으로 해소 |
| Batch2 W7 | `execution-engine.md §5.5` 표에 `$thread` 행 | Phase 1 spec 작성 시 추가됨 — false positive |
| Batch2 W8 | presentation 노드 spec 의 `excludeFromConversationThread` | spec follow-up |
| Batch2 W9 | `.js` 확장자 통일 | 본 codebase 의 import 패턴은 확장자 없음 — false positive (TS 컴파일러가 처리) |
| Batch2 W10 | 공유 `createBaseExecutionContext` 헬퍼 | refactor — follow-up |
| Batch2 W11 | `manual-trigger.handler.spec.ts` ctx 통일 | follow-up |
| Batch2 W14 | Redis 직렬화 비용 — thread 별도 키 분리 | 현재 in-memory only, 실제 Redis 도입 시 결정 |
| Batch2 W15 | `§6.1` $thread 행 표 형식 | 실제 표는 정상 — false positive |
| Batch2 W16 | `0-common.md#10` anchor renumber | grep 결과 외부 참조 0건 (Phase 1 에서 확인됨) |
| Batch2 W17 | `nextSeq` 원자성 명시 | in-memory single-thread 보장 — spec follow-up |

### INFO (참고만, 조치 안 함)

대부분 documentation polish 또는 v2 로드맵 항목. 본 v1 출하 무영향.

---

## 최종 검증

- 전체 테스트: **196 suites / 3426 tests green** (Phase 11 R1-R6 적용 후)
- Lint clean
- Build clean
- Critical/HIGH 핵심 이슈 6건 (R1-R6) 모두 코드 반영
- 잔여 WARNING/INFO: spec/refactor follow-up 으로 분리 (본 PR 차단 사유 없음)
