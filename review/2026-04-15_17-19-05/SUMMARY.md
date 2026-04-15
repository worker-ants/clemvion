파일 쓰기 권한이 필요합니다. 권한을 승인해 주시면 `SUMMARY.md`를 저장하겠습니다. 그 전에 통합 보고서 내용을 먼저 공유드립니다.

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** - WebSocket 스냅샷 전환 과정에서 실행 소유권 인가 검증 누락(IDOR)과 민감 데이터 노출 위험이 식별됨

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / API Contract / Side Effect / Requirement | **실행 스냅샷 전송 시 소유권 인가 검증 누락 (IDOR)** — `emitExecutionSnapshot`이 `findById(executionId)` 호출 시 요청자 userId를 전달하지 않아, 인증된 임의 사용자가 타인의 실행 ID만 알면 전체 스냅샷(nodeExecutions, inputData 포함)을 수신 가능 | `websocket.gateway.ts` — `emitExecutionSnapshot()` | `findById(executionId, userId)` 형태로 소유권 검증. `client.userId`는 핸들러에서 이미 접근 가능 |
| 2 | Security | **채널 구독 자체에 접근 제어 없음** — `execution:*` 채널 `join()` 시 소유권 검증 없어, 이후 `broadcastToChannel()` 기반 노드 이벤트도 타인이 수신 가능 | `websocket.gateway.ts` — `handleSubscribe()` | 채널 구독 시 소유자 확인 후 `join()` 허용 |
| 3 | Security / Performance | **`inputData`·`interactionData`가 WS 이벤트 페이로드에 노출** — API 키, 비밀번호, PII 포함 가능한 데이터가 `NODE_STARTED` / `NODE_COMPLETED` / `NODE_FAILED` 이벤트에 추가되어 채널 구독자 전체에 브로드캐스트. 스냅샷과 중복 전송 | `execution-engine.service.ts` — 모든 `emitNodeEvent` 호출부 | `inputData`는 스냅샷 이벤트에서만 전달하거나 `sanitizeInputForBroadcast` 유틸로 마스킹 |
| 4 | Concurrency / Requirement | **스냅샷과 실시간 WS 이벤트 간 경쟁 조건** — 구독 직후 `node.completed` 이벤트가 스냅샷보다 먼저 도착하면, 뒤늦게 도착한 스냅샷이 `running`으로 덮어써 `completed → running` 상태 역행 발생. `handleSnapshot`이 `shouldUpdateStatus` 우선순위 체크를 거치지 않음 | `use-execution-events.ts` — `handleSnapshot` 내 `updateNodeStatus` 호출 | 스냅샷 노드 처리 시 `shouldUpdateStatus(currentStatus, mapNodeStatus(ne.status))` 적용하여 높은 우선순위 상태 보호 |
| 5 | Requirement | **실행 중 페이지 재진입 시 `running` 상태 미갱신** — 스토어 `prevStatus === "idle"` 상태에서 `execution.status === "running"` 스냅샷 수신 시 어떤 분기에도 해당하지 않아 실행 상태가 `"idle"`로 남음 | `use-execution-events.ts` — `handleSnapshot` 분기 로직 | `if (execution.status === "running" && prevStatus === "idle") { startExecution(execution.id); }` 분기 추가 |
| 6 | Side Effect / Concurrency / Requirement | **재연결·재구독 시 스냅샷 중복 적용** — `clientSubs.add(channel)` 이전에 `emitExecutionSnapshot`이 호출되어 스냅샷 중복 전송. `addNodeResult` 반복 호출 시 nodeResults 중복 적재 가능 | `websocket.gateway.ts` — `handleSubscribe`, `use-execution-events.ts` — `handleSnapshot` | `if (!clientSubs.has(channel))` guard를 `emitExecutionSnapshot` 앞에 배치. `handleSnapshot` 진입 시 terminal 상태이면 조기 반환 |
| 7 | Side Effect / Dependency | **REST 폴링 제거로 인한 fallback 소실** — WS 연결이 끊기지 않은 채 스냅샷만 유실된 경우 복구 경로 없음 | `use-execution-events.ts` — `pollExecutionStatus` 제거 | 스냅샷 수신 타임아웃 감지 후 단발 REST fallback 호출 로직 추가 검토 |
| 8 | Testing | **`emitExecutionSnapshot` 성공 경로 테스트 없음** — `findById`가 기본값 `mockRejectedValue`로 설정되어 실패 케이스만 묵시적 검증 | `websocket.gateway.spec.ts` | `findById` 성공 시 `client.emit('execution.snapshot', ...)` 호출 여부 검증 테스트 추가 |
| 9 | Testing | **새 필드(`input`, `finishedAt`, `interactionData`) 전달 경로 테스트 없음** — WS 이벤트 페이로드에 실제로 포함되는지 검증하는 단위 테스트 부재 | `execution-engine.service.ts` — 모든 `emitNodeEvent` 호출부 | `emitNodeEvent` mock capture를 통해 `input` 필드 포함 여부 검증 |
| 10 | Testing | **`ai_conversation` 대기 상태 스냅샷 rehydration 테스트 누락** | `use-execution-events.test.ts` | `interactionType: "ai_conversation"` 스냅샷으로 `pauseForConversation` 호출 여부 검증 테스트 추가 |
| 11 | Testing | **`running` 상태 스냅샷 수신 시 무변경 경로 테스트 누락** | `use-execution-events.test.ts` | `running` 스냅샷 수신 후 `status` 불변 검증 테스트 추가 |
| 12 | API Contract / Architecture | **`execution.snapshot` 전용 DTO 없음 — REST 계약과 묵시적 결합** — REST DTO 변경 시 WS 계약이 자동 변경되는 불안정한 의존 구조 | `websocket.gateway.ts` — `emitExecutionSnapshot` | `ExecutionSnapshotPayload` DTO 정의하여 REST DTO와 분리 |
| 13 | Architecture | **`WebsocketGateway` SRP 위반** — Gateway가 `ExecutionsService` 직접 의존하여 스냅샷 조회·직렬화 책임까지 담당 | `websocket.gateway.ts` | 스냅샷 조회 책임을 `WebsocketService`로 이동 |
| 14 | Performance / Database | **구독 시마다 전체 Execution DB 조회 발생 (캐싱 없음)** — 다수 클라이언트 구독 또는 빈번한 재연결 시 중복 JOIN 쿼리 | `websocket.gateway.ts` — `handleSubscribe` → `emitExecutionSnapshot` | 짧은 TTL 인메모리 캐시 또는 inflight deduplication 적용 |
| 15 | Performance / Database | **개별 노드 이벤트에 대용량 `inputData` 중복 전송** — 스냅샷에 포함된 데이터를 노드 이벤트마다 브로드캐스트 | `execution-engine.service.ts` — 노드 이벤트 emit | 노드 이벤트에서 `inputData` 제외하거나 크기 상한(64KB) 적용 |
| 16 | Architecture | **`forwardRef` 과잉 사용** — 실제 순환 의존이 없는 단방향 의존에도 적용되어 진짜 순환 탐지를 어렵게 함 | `websocket.module.ts`, `websocket.gateway.ts` | 실제 순환 여부 확인 후 불필요하면 일반 `imports`로 교체 |
| 17 | Maintainability | **이벤트 페이로드 구성 코드가 7개+ 위치에 중복** — 필드 추가/수정 시 누락 위험 높음 | `execution-engine.service.ts` — 다수의 `emitNodeEvent` 호출부 | `buildNodeEventPayload(node, nodeExec)` 헬퍼 함수로 추출 |
| 18 | Maintainability | **`interactionType` 분기 로직이 두 핸들러에 중복** — `handleWaitingForInput`과 `handleSnapshot` 양쪽에 동일 로직 존재 | `use-execution-events.ts` | `resolveWaitingState(waitingNode, storeActions)` 순수 함수로 추출 |
| 19 | Maintainability | **`handleSnapshot`만 `useCallback` 패턴 미사용** — 다른 핸들러와 구조적 일관성 불일치 | `use-execution-events.ts:504` | `useCallback`으로 추출하고 deps 배열에 명시적으로 포함 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability / Scope | **`EXECUTION_SNAPSHOT` enum이 실제 emit에서 미사용** — 문자열 리터럴로 직접 emit | `websocket.service.ts:16`, `websocket.gateway.ts` | emit 지점에서 enum 상수 사용으로 통일 |
| 2 | Maintainability / Requirement | **`finishedAt`·`interactionData` 수신 후 스토어에 미저장** — 전달은 되지만 소비되지 않는 dead data | `use-execution-events.ts` — `handleNodeCompleted`, `handleNodeFailed` | 스토어에 저장하거나 타입 정의에서 제거 |
| 3 | Maintainability | **`finishedAt?.toISOString?.()` 이중 옵셔널 체이닝 과잉 방어** | `execution-engine.service.ts` — 모든 `finishedAt` 추가 위치 | `nodeExec.finishedAt?.toISOString()` 으로 단순화 |
| 4 | API Contract | **`inputData` 타입 캐스팅 불안정** — 배열/원시값도 `Record<string, unknown>`으로 강제 캐스팅 | `execution-engine.service.ts:2731` | `inputData: unknown`으로 타입 확대 또는 정규화 |
| 5 | Performance | **`localeCompare`를 ISO 타임스탬프 정렬에 사용** — 단순 비교 연산자로 충분 | `use-execution-events.ts` — `handleSnapshot` 내 `sort` | `<` / `>` 연산자로 교체 |
| 6 | Security | **`executionId` UUID 형식 검증 없음** — 임의 문자열이 `findById()`에 전달될 수 있음 | `websocket.gateway.ts` — `channel.slice(...)` | 추출 후 UUID 형식 검증 추가 |
| 7 | Security | **스냅샷 오류가 `debug` 레벨로만 로깅** — 인가 실패 보안 감사 불가 | `websocket.gateway.ts` — catch 블록 | `ForbiddenException`은 `warn` 레벨로 구분 로깅 |
| 8 | Documentation | **`execution.snapshot` 이벤트 페이로드 스키마 미반영** | `spec/` — WebSocket 이벤트 스펙 문서 | spec 문서에 신규 이벤트 추가 |
| 9 | Database | **`node_execution(execution_id)` 인덱스 존재 여부 확인 필요** | TypeORM 엔티티 / 마이그레이션 | `@Index(['executionId'])` 선언 여부 확인 |
| 10 | Database | **`inputData` JSONB 저장으로 행 크기 증가** — 대용량 데이터 시 TOAST 발생 | `execution-engine.service.ts` — `createNodeExecution` | 크기 상한 설정 또는 외부 스토리지 참조 URI 저장 검토 |
| 11 | Testing | **`getHandler` undefined 시 런타임 에러 위험** | `use-execution-events.test.ts:49-54` | `expect(handler).toBeDefined()` 선행 검증 추가 |
| 12 | Testing | **`findById` 기본값 의도 미문서화** | `websocket.gateway.spec.ts:53` | 의도 주석 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | **HIGH** | IDOR 취약점(스냅샷 인가 누락), inputData/interactionData 민감 데이터 WS 노출 |
| api_contract | **MEDIUM** | 스냅샷 인가 누락, 전용 DTO 부재로 REST/WS 계약 결합 |
| concurrency | **MEDIUM** | 스냅샷-이벤트 경쟁 조건, 재연결 중복 적용 |
| testing | **MEDIUM** | emitExecutionSnapshot 성공 테스트 누락, ai_conversation 분기 미검증 |
| performance | **MEDIUM** | 구독 시마다 캐싱 없는 전체 Execution 쿼리, inputData 중복 전송 |
| maintainability | **MEDIUM** | 페이로드 구성 코드 7개+ 위치 중복, enum 미사용 |
| side_effect | **MEDIUM** | 인가 누락, REST fallback 소실, 재구독 중복 스냅샷 |
| requirement | **MEDIUM** | running 상태 재진입 미갱신, 재연결 중복 적용 |
| architecture | **LOW** | Gateway SRP 위반, forwardRef 남용 |
| database | **LOW** | 구독 시 중복 쿼리 부하, inputData JSONB 행 크기 증가 |
| dependency | **LOW** | forwardRef 양방향 순환 가능성, 스냅샷 미수신 fallback 부재 |
| scope | **LOW** | INFO 수준 발견만 (범위 이탈 없음 확인) |
| documentation | **LOW** | enum 주석 부재, spec 문서 미갱신 |

---

## 발견 없는 에이전트
없음 (13개 에이전트 모두 발견사항 보고)

---

## 권장 조치사항

### 즉시 처리 (보안·기능 결함)
1. **[WARNING #1, #2] IDOR 취약점 해결** — `emitExecutionSnapshot` 및 `handleSubscribe`에서 실행 소유권 검증 추가
2. **[WARNING #3] 민감 데이터 노출 범위 축소** — 노드 이벤트에서 `inputData`·`interactionData` 제거 또는 마스킹
3. **[WARNING #5] 페이지 재진입 시 `running` 상태 미갱신 버그 수정** — `prevStatus === "idle"` 시 `startExecution()` 분기 추가
4. **[WARNING #4] 스냅샷-이벤트 경쟁 조건 해결** — `handleSnapshot` 노드 상태 갱신에 `shouldUpdateStatus` 적용
5. **[WARNING #6] 재구독 중복 스냅샷 방지** — `clientSubs.has(channel)` guard를 `emitExecutionSnapshot` 호출 이전에 위치

### 단기 처리 (테스트·품질)
6. **[WARNING #8–11] 누락 테스트 추가** — 성공 경로, 새 필드 전달, `ai_conversation` rehydration, `running` 무변경 경로
7. **[INFO #1] EXECUTION_SNAPSHOT enum 실제 사용** — emit 지점에서 문자열 리터럴 대신 enum 상수 사용
8. **[WARNING #17, #18] 코드 중복 제거** — `buildNodeEventPayload`, `resolveWaitingState` 추출
9. **[WARNING #19] `handleSnapshot`을 `useCallback`으로 추출**

### 중기 처리 (아키텍처 개선)
10. **[WARNING #7] REST fallback 전략 수립** — 스냅샷 미수신 타임아웃 감지 후 단발 REST 조회
11. **[WARNING #12] 스냅샷 전용 DTO 정의** — REST/WS 계약 명시적 분리
12. **[WARNING #13, #16] 아키텍처 정리** — Gateway 도메인 조회 책임 분리, 불필요한 `forwardRef` 제거
13. **[WARNING #14, #15] 성능 보완** — 스냅샷 쿼리 캐싱, 노드 이벤트 페이로드 크기 제한
14. **[INFO #8] WebSocket 이벤트 스펙 문서 갱신**