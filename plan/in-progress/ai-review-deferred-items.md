# AI Review Deferred Items — 후속 PR 백로그

## 배경

ai-review 2026-05-06_17-27-43 에서 발견된 51건 중 본 PR (Phase 1 quality + 후속 조치) 에서 처리하지 못한 23건의 후속 처리 백로그. 자세한 내용은 `review/2026-05-06_17-27-43/SUMMARY.md` + `RESOLUTION.md`.

## 현재 상태 (2026-05-08)

본 plan 작성(2026-05-06) 이후 23건 deferred 항목 모두 **미진행**. 이후 commit 들 (`4a481984`, `d187131f`, `a73242bd`, `daeaa1f3`, `a659c631`, `67f232fd`, `b69b72a3`, `cec5bdf2`, `5a15b313`, `1ebdc8a4`) 은 ai-agent / workflow-assistant / compose / migration 등 별도 영역으로, 본 백로그의 engine 항목과 직접 매칭되지 않는다.

각 PR 완료 시 본 문서의 해당 항목을 제거하고, 모든 항목 처리 완료 시 본 문서 자체를 `plan/complete/` 로 `git mv`.

---

## 남은 작업

진행되지 않은 23건 전체. 우선순위 분류와 권장 PR 분할을 함께 정리한다.

### P0 — Security / Correctness (즉시 별도 PR)

- **CRIT #5 (timeout 경로 테스트)** — `executeSync` 의 timeout 분기 테스트. graph traversal hang 셋업 필요.
- **WARN #4** — RUNNING ↔ WAITING_FOR_INPUT 상태 전이 트랜잭션. `DataSource` 주입 + 영향 범위 전수 검토.
- **WARN #2** — `executionPathChain` 분산 환경 대응. 별도 테이블 / 낙관적 잠금 / Redis pub-sub. 인프라 결정 + DB 스키마 변경.

### P1 — Architecture (큰 리팩토링, 별도 PR 단위)

- **CRIT #2** — `runExecution` / `executeInline` ~200줄 중복 추출. 안전한 추출은 며칠 작업급.
- **CRIT #3** — OCP 위반 node type 문자열 분기 → Strategy 패턴 / NodeHandler 메타데이터. 26개 핸들러 영향.
- **WARN #25** — `waitForAiConversation` 280줄 분해 (`emitWaitingForInput` / `handleAiMessage` / `handleAiEndConversation` / `finalizeAiNode`).
- **WARN #15** — `pendingContinuations` Map → Redis pub/sub. 수평 확장 인프라.
- **WARN #16** — `forwardRef(WebsocketService)` → `IExecutionEventEmitter` 추상화.
- **WARN #17 (Arch)** — `executeInline` 의 `manual_trigger` 외 트리거 타입 처리. spec 결정 필요.
- **WARN #26** — 매직 스트링 → enum/상수. 광범위 변경.

### P2 — Performance / Testing 모더레이트

- **WARN #12** — `planContainerBody` filter 결과 캐시. ForEach/Loop/Map 컨테이너 한정.
- **WARN #21** — `endAiConversation` 종료 흐름 전체 테스트 (큰 fixture).
- **WARN #22** — `buildConversationConfigFromOutput` 단위 테스트.
- **WARN #24** — container runtime `setTimeout(r, 200)` → `flushPromises()` 통일.

### P3 — INFO 일괄 정리

- **INFO #1, #2** — NodeHandler return 타입 단일화. 광범위 영향.
- **INFO #4** — `EngineRuntimeContext` 분리. 인터페이스 큰 변경.
- **INFO #5** — `adaptHandlerReturn` credential runtime 마스킹.
- **INFO #6, #7, #8** (Performance) — 작은 최적화. 일괄 PR.
- **INFO #2, #3, #4** (Performance — `indexOf` / `[...messages]` / `turnDebugHistory` 스프레드) — 메모리 최적화 일괄.
- **INFO #6, #7** (Side Effect — `ragThreshold` 범위 / `getSources` 참조 노출) — 작은 정리.
- **INFO #9, #10, #11** (Concurrency) — 작은 정리.
- **INFO #12** — JSDoc 보강 (`executeNode`, `NodeHandler`, `ExecutionEngineService`).
- **INFO #14, #15, #16** (Testing) — mockHandler shape, `(service as any)` 패턴, `Partial<Node>` factory.
- **INFO #17** — executeInline trigger pass-through 정리.
- **INFO #19** — executeSync findOneBy 인메모리 활용.

---

## PR 분할 권장

- **PR-A (P0 Security)**: CRIT #5 timeout + WARN #4 트랜잭션 (~1일).
- **PR-B (P0 분산)**: WARN #2 + WARN #15 (인프라 결정 후 ~3일). → **상세 계획은 아래 §"PR-B 상세 계획" 참조** (2026-05-08 결정).
- **PR-C (P1 Engine 리팩토링)**: CRIT #2 + WARN #25 (~5일).
- **PR-D (P1 OCP)**: CRIT #3 (~3일).
- **PR-E (P1 Event 추상화)**: WARN #16 + WARN #26 (~2일).
- **PR-F (P2 Testing 보강)**: WARN #21, #22, #24 + INFO #14~16 (~2일).
- **PR-G (P3 일괄 정리)**: INFO 항목들 일괄 (~1일).

---

## PR-B 상세 계획 — WARN #2 + #15 수평 확장 인프라 (2026-05-08 결정)

### 배경 / 결정 사항

ai-review 후속 항목 중 분산 환경 결정이 필요했던 두 건을 단일 PR (PR-B) 로 진행한다. 본 PR 의 결과로 **2 인스턴스 + LB 환경에서 워크플로 실행이 정상 동작**해야 한다.

- **수평 확장 시점**: 본 PR 범위에서 즉시 도입.
- **WARN #15 방향**: **Redis pub/sub** (ioredis 5.10.1 + BullMQ 가 이미 도입돼 있어 신규 의존성 없음).
- **WARN #2 방향**: **별도 `execution_node_log` append-only 테이블**.

### 핵심 발견

1. `execution_path` 컬럼은 이미 PostgreSQL `array_append()` 로 **DB 수준 atomic** 하게 추가되고 있다 (`execution-engine.service.ts:1391-1413`). 즉 WARN #2 의 "read-modify-write 데이터 손실" 표현은 부정확하며, 실제 문제는 **인스턴스 간 순서 비결정성**이다.
2. Redis 인프라 (ioredis, redis.config.ts, BullMQ, health check) 는 **이미 프로젝트에 구성**되어 있다. WARN #15 의 pub/sub 도입은 신규 의존성이 아니라 기존 자원의 확장 활용이다.

### 미결 결정 (구현 직전 재확인)

- **`recoverStuckExecutions` 다중 인스턴스 안전성** — 추천: SET NX 분산 lock + `startedAt < now() - 30분` 보수적 mark.
- **`Execution.executionPath` 컬럼 처리** — 추천: 컬럼 제거 + DTO 채울 때 `execution_node_log` 조회로 대체 (단일 source of truth, DTO 시그니처는 유지).

---

### Part A — `execution_node_log` 테이블 (WARN #2)

**스키마** (`backend/migrations/V035__execution_node_log.sql`)

```sql
CREATE TABLE execution_node_log (
  id           BIGSERIAL PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES execution(id) ON DELETE CASCADE,
  node_id      UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX execution_node_log_execution_id_id_idx
  ON execution_node_log (execution_id, id);

-- 데이터 이행
INSERT INTO execution_node_log (execution_id, node_id)
SELECT e.id, p.node_id
FROM execution e, UNNEST(e.execution_path) WITH ORDINALITY AS p(node_id, ord)
ORDER BY e.id, p.ord;

ALTER TABLE execution DROP COLUMN execution_path;
```

- `id` 가 BIGSERIAL → INSERT 순서가 곧 실행 순서 (PostgreSQL sequence 는 동시성 안전).
- 인덱스 `(execution_id, id)` 로 워크플로별 순서 조회가 sequential scan 없이 진행.
- `ON DELETE CASCADE` 로 execution row 정리 시 자동 삭제.

**엔티티 신규**: `backend/src/modules/execution-engine/entities/execution-node-log.entity.ts`

**서비스 변경** (`execution-engine.service.ts`)
- L283-301 — `executionPathChain` Map **삭제** (sequence 가 동시성 보장하므로 직렬화 큐 불필요).
- L1369-1378 — cleanup 의 promise drain 블록 **삭제**.
- L1387-1415 `appendExecutionPath` — `array_append` UPDATE → `executionNodeLogRepository.insert({ executionId, nodeId })` 단일 호출로 교체. 에러 처리 (warn log) 만 유지.
- L421/844/950 — `executionPath: []` 초기값 제거 (컬럼 자체 사라짐).

**조회 측 변경 (DTO 호환)**
- `executions.service.ts:251` — `executionPath: execution.executionPath ?? []` → `execution_node_log` 에서 `(execution_id, id)` 정렬 쿼리로 노드 ID 배열 채우기.
- `execution-response.dto.ts:87` — `executionPath: string[]` 시그니처 유지 (외부 API 호환).

**엔티티 (`executions/entities/execution.entity.ts:78-84`)**
- `executionPath` 컬럼 정의 제거. `synchronize: false` 이므로 마이그레이션 SQL 이 단일 진실 소스.

---

### Part B — Redis pub/sub Continuation Bus (WARN #15)

**핵심 설계** — Promise resolver 는 인스턴스에 머무르고, 이벤트만 분산.

Promise 의 `resolve / reject` 는 직렬화 불가능하므로 Redis 에 저장하지 않는다. 대신:

1. 각 인스턴스는 **자기가 호스팅 중인** 실행에 대해서만 로컬 `pendingContinuations` Map 유지.
2. `continueExecution / cancelWaitingExecution / continueButtonClick / continueAiConversation / endAiConversation` 진입점은 **항상 Redis 에 publish**.
3. 모든 인스턴스가 시작 시 단일 채널 `execution:continuation` 을 subscribe → 메시지 수신 시 로컬 Map 에 키가 있으면 resolve, 없으면 무시.

**왜 "항상 publish" 패턴**
- WebSocket 게이트웨이 호출은 LB 가 어떤 인스턴스로 보낼지 모르는 상태로 들어온다. "내 Map 에 있으면 직접, 없으면 publish" 로직은 race window 가 생긴다.
- 항상 publish + 자기 자신 포함 모든 인스턴스 수신 → 정확히 한 인스턴스만 hit. 단순.
- Redis pub/sub round-trip 은 ms 단위라 사용자 체감 지연 무시 가능.

**메시지 스키마**

```ts
type ContinuationMessage = {
  type: 'continue' | 'cancel' | 'button_click' | 'ai_message' | 'ai_end_conversation';
  executionId: string;
  payload?: unknown;
};
```

**신규 컴포넌트**: `backend/src/modules/execution-engine/continuation/continuation-bus.service.ts`

```ts
@Injectable()
export class ContinuationBusService implements OnModuleInit, OnModuleDestroy {
  private publisher: Redis;
  private subscriber: Redis;
  private readonly handlers = new Map<ContinuationType, (msg: ContinuationMessage) => void>();

  async onModuleInit() {
    // pub/sub 모드는 connection 분리 필수
    this.publisher = new Redis({ host, port });
    this.subscriber = new Redis({ host, port });
    await this.subscriber.subscribe(CHANNEL);
    this.subscriber.on('message', (_ch, raw) => this.dispatch(JSON.parse(raw)));
  }

  publish(msg: ContinuationMessage) { return this.publisher.publish(CHANNEL, JSON.stringify(msg)); }
  on(type: ContinuationType, handler: (msg: ContinuationMessage) => void) { this.handlers.set(type, handler); }

  async onModuleDestroy() { await this.subscriber.quit(); await this.publisher.quit(); }
}
```

**`ExecutionEngineService` 변경**
- `pendingContinuations` Map 자체는 **유지** — resolver 보관용.
- 생성자에 `ContinuationBusService` 주입. `onModuleInit` 에서 5개 메시지 타입 핸들러 등록 (각 핸들러는 로컬 Map 에 키가 있을 때만 resolve).
- `continueExecution(id, formData)` (L1597-1604) → `this.bus.publish({type:'continue', executionId:id, payload:formData})`. **즉시 throw 제거** (다른 인스턴스 가능성).
- 같은 패턴으로 L1609-1615 `cancelWaitingExecution`, L1621-1628 `continueButtonClick`, L1635-1647 `continueAiConversation`, L1652-1659 `endAiConversation` 변경.
- "No pending continuation" 에러는 단일 인스턴스 어디에서도 정확히 판단 불가 → 폐기. WAITING_FOR_INPUT DB 상태 검증은 publish **이전**에 1회 수행 (publisher 측 책임).

**Recovery (`recoverStuckExecutions`, L351-378)**

다중 인스턴스에서 **다른 인스턴스가 정상 실행 중인 WAITING_FOR_INPUT** 을 새로 띄운 인스턴스가 FAIL 시키면 안 된다.

추천 패턴 — SET NX 분산 lock + 시간 임계값:

```ts
const ok = await redis.set('exec:recover:lock', instanceId, 'NX', 'EX', 60);
if (!ok) return;  // 다른 인스턴스가 처리 중
// startedAt < now() - 30분 인 것만 FAIL — 진행 중인 정상 대기는 보존
```

30 분 임계값은 spec 에 명시. 사용자 입력 대기가 30 분 넘으면 stale 로 간주.

---

### Part C — Spec 문서 갱신

`spec/5-system/4-execution-engine.md` 에 §"분산 실행 (Multi-instance)" 절 추가:
- `execution_node_log` append-only 모델 + 순서 보장 메커니즘
- Redis pub/sub continuation bus 시퀀스 다이어그램 + 채널 / 메시지 스키마
- WAITING_FOR_INPUT recovery 의 30 분 임계값 + 분산 lock 정책

---

### Critical files

**수정**
- `backend/src/modules/execution-engine/execution-engine.service.ts`
  - L283-301 (Map 정리), L351-378 (recovery), L421/844/950 (executionPath 초기값), L1369-1415 (append/cleanup), L1490/1597-1659 (continuation 진입점), L1767/2090 (pendingContinuations.set 사이트)
- `backend/src/modules/execution-engine/execution-engine.module.ts` — 새 entity / `ContinuationBusService` 등록
- `backend/src/modules/executions/entities/execution.entity.ts:78-84` — `executionPath` 컬럼 제거
- `backend/src/modules/executions/executions.service.ts:251` — `execution_node_log` 조회로 채우기
- `backend/src/modules/executions/dto/responses/execution-response.dto.ts:87` — 시그니처 유지 확인
- `backend/src/modules/execution-engine/execution-engine.service.spec.ts:148,159` — 픽스처 갱신
- `backend/src/modules/executions/executions.service.spec.ts:23,42` — 픽스처 갱신

**신규**
- `backend/src/modules/execution-engine/entities/execution-node-log.entity.ts`
- `backend/src/modules/execution-engine/continuation/continuation-bus.service.ts`
- `backend/src/modules/execution-engine/continuation/continuation-bus.service.spec.ts`
- `backend/migrations/V035__execution_node_log.sql`
- `spec/5-system/4-execution-engine.md` 절 추가

**참고 (재사용 패턴)**
- `backend/src/modules/health/health.service.ts:4-21` — ioredis 직접 인스턴스화 패턴 (동일 스타일)
- `backend/src/common/config/redis.config.ts` — host/port config
- `backend/src/modules/execution-engine/queues/background-execution.processor.ts` — BullMQ 사용 사례

---

### 검증

**단위 테스트**
1. `ContinuationBusService.spec.ts` — ioredis-mock 으로 publish→subscribe round-trip, 5 메시지 타입 디스패치, onModuleDestroy 정리.
2. `ExecutionEngineService.spec.ts` 보강
   - `appendExecutionPath` 가 `executionNodeLogRepository.insert` 한 번 호출
   - `continueExecution` 호출 시 `ContinuationBusService.publish` 가 `{type:'continue'}` 로 호출
   - bus 메시지 수신 시 로컬 Map 의 resolver 만 호출되고 키 없으면 무시
3. `recoverStuckExecutions` — SET NX 가 false 면 update 안 됨 / `startedAt < now()-30m` 만 update 대상.

**통합 테스트**
- `backend/test/` 의 e2e 패턴을 따라 단일 인스턴스 환경에서 form / button / ai-message / cancel 회귀 검증.

**수동 검증 (배포 전 필수)**
- 2 backend 인스턴스 + nginx LB + Redis 띄우기 (`PORT=4000` / `PORT=4001`)
- 시나리오 A — instance A 에서 워크플로 시작 → Form 노드 대기 → 클라이언트 WS 가 instance B 로 라우팅된 상태에서 form 제출 → instance A 에서 재개 (로그 확인)
- 시나리오 B — button click 이 instance B 로 라우팅 → instance A 정상 진행
- 시나리오 C — instance A 가 WAITING_FOR_INPUT 진행 중인데 instance B 신규 기동 → recover lock 으로 잘못 FAIL 시키지 않음
- 시나리오 D — 실행 완료 후 GET `/executions/:id` 응답의 `executionPath` 가 노드 ID 순서대로 반환

**회귀 위험 영역**
- `executionPath` 직접 사용하는 클라이언트 (`frontend/`) — DTO 시그니처 유지로 영향 0 이지만 grep 으로 재확인
- `executions.service.ts:251` — list 조회 시 N+1 발생 방지. 단건 조회 path 만 ExecutionNodeLog 채우고 list 응답은 path 생략 (기존 동작 유지) 또는 batch 조회

---

### 작업량 추정

- Part A (테이블 + entity + service rewire + migration + DTO 어댑터): ~1.5일
- Part B (ContinuationBus + service rewire + recovery 수정 + 테스트): ~2.5일
- Part C (spec 문서 + 수동 검증): ~0.5일
- **합계 ~4.5일** (백로그 추정 PR-B 3일 대비 +1.5일 — recovery 정교화 + 데이터 이행 비용)

### PR 분할

본 plan 은 단일 PR (PR-B) 로 진행. Part A 와 Part B 는 분리 가능하나 recovery 정책이 두 파트에 걸쳐 있어 분리 시 정합성 검증 비용이 더 크다. **단일 PR 권장**.
