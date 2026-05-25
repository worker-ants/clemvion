# 보안(Security) 리뷰 결과

검토 대상: Phase 2 cont — workflow-resumable-execution (BullMQ 전환, rehydration 구현, WS ack 필드 확장)
검토일: 2026-05-25

---

## 발견사항

### [WARNING] `execution-engine.service.ts` — 에러 메시지에 내부 식별자 노출
- **위치**: `rehydrateAndResume` 내 `RehydrationError` 생성 구문 전반 (diff 파일 5, `+1408~+1440` 라인 대역)
- **상세**: `executionId`, `nodeExecutionId`, `execution?.status` 등의 내부 DB row 식별자가 `RehydrationError` 의 메시지 문자열에 직접 포함된다. 이 에러는 `this.logger.warn(...)` 을 통해 서버 로그에 기록되며, 구조화 로그가 외부 모니터링 서비스(Datadog, ELK 등)로 전달될 경우 UUID/상태 값이 로그 외부에 유출될 수 있다. 현재 코드에서 이 메시지가 클라이언트에게 직접 반환되지는 않으나, 향후 에러를 그대로 WS ack 에 포함시키는 리팩토링 시 정보 노출 위험이 현실화된다. 또한 BullMQ dead-letter job 의 `failedReason` 필드에도 이 메시지가 그대로 저장된다.
- **제안**: 로그에는 구조적 필드(`executionId`, `nodeExecutionId`)를 별도 파라미터로 분리 기록하고(`logger.warn('...', { executionId, nodeExecutionId })`), 에러 메시지 자체는 코드 분류명만 포함하도록 분리한다. BullMQ job 실패 이유가 외부 관리 UI(BullMQ Board 등)에서 열람될 가능성을 고려하면 더욱 중요하다.

---

### [WARNING] `websocket.gateway.ts` — 에러 분기에서 구체적인 인프라 상태 노출
- **위치**: `handleSubmitForm`, `handleClickButton`, `handleSubmitMessage`, `handleEndConversation` 핸들러 (diff 파일 7, `+1824~+1828`, `+1858~+1866`, `+1903~+1911`, `+1947~+1955` 라인 대역)
- **상세**: `jobId === null` 일 때 클라이언트에 반환하는 에러 메시지가 `'Continuation enqueue failed (Redis unavailable)'` 로 고정되어 있다. 이 메시지는 클라이언트에 내부 인프라 구성 요소(Redis)의 장애 상태를 직접 노출한다. 공격자가 이 메시지를 관찰하면 시스템이 Redis 를 사용하며 현재 Redis 가 불가용 상태임을 파악할 수 있다. WS 이벤트는 인증된 사용자에게만 전달되므로 즉각적 위험은 낮지만, OWASP A05(Security Misconfiguration) / A04(Insecure Design) 의 불필요한 정보 노출에 해당한다.
- **제안**: 클라이언트 대면 에러 메시지를 `'Continuation could not be queued. Please try again.'` 과 같이 인프라 상세를 제거한 형태로 변경하고, Redis 장애 여부는 서버 로그에서만 확인 가능하도록 분리한다.

---

### [INFO] `continuation-bus.service.ts` / `execution-engine.service.ts` — `__no_node_exec__` sentinel 을 통한 rehydration 의도적 우회
- **위치**: `continuation-bus.service.ts`의 publish 로직; `execution-engine.service.ts` `rehydrateAndResume` (diff 파일 2, 5)
- **상세**: `nodeExecutionId` 가 `'__no_node_exec__'` sentinel 일 때 `rehydrateAndResume` 는 즉시 `RESUME_CHECKPOINT_MISSING` 으로 Execution 을 cancelled 마킹하고 종료한다. 이 sentinel 은 publisher 측이 DB lookup 에 실패했을 때 자동 삽입되며, 이 값을 악의적으로 조작하면 특정 Execution 을 의도적으로 CANCELLED 상태로 전환할 수 있다. 그러나 WS gateway 의 인증/인가 검증(`client.userId`, `client.workspaceId`, Authorization 체크)이 통과한 후에만 BullMQ 에 publish 가 일어나므로, 이 sentinel 을 BullMQ 에 직접 주입하려면 인증된 Redis 접근이 필요하다. Redis 자체에 대한 무단 접근이 전제되어야 하므로 현재 신뢰 경계(authenticated WS client) 에서는 INFO 수준이다.
- **제안**: BullMQ consumer 측(`continuation-execution.processor.ts`)에서 job payload 의 `nodeExecutionId` 에 대한 형식 검증(UUID 형식 또는 허용된 sentinel 목록 whitelist)을 추가해 방어 깊이를 확보하면 좋다.

---

### [INFO] `continuation-bus.service.spec.ts` — 테스트 코드 내 Lua script 문자열 하드코딩
- **위치**: `createFakeRedis()` 의 `eval` mock 구현 (diff 파일 1, `+146~+155` 라인 대역)
- **상세**: `script.includes("call('get', KEYS[1]) == ARGV[1]")` 로 실제 서비스 코드의 Lua 스크립트 일부를 문자열 비교로 식별한다. 이는 테스트 코드이므로 프로덕션 보안에 직접 영향은 없다. 그러나 실제 서비스의 Lua 스크립트가 변경되면 테스트가 묵묵히 통과하되 lock 해제 검증이 무효화되는 위험이 있다. lock 소유권 검증 실패 시 다른 인스턴스의 lock 을 강제 해제하는 시나리오가 테스트에서 누락된다.
- **제안**: eval mock 에서 Lua 스크립트 문자열 매칭 의존도를 줄이거나, 스크립트 문자열을 상수로 추출해 서비스 코드와 공유함으로써 드리프트를 방지한다.

---

### [INFO] `execution-engine.service.ts` `resumeFromCheckpoint` — `setImmediate` 기반 resolver fire 의 timing race
- **위치**: `resumeFromCheckpoint` 의 resolver fire scheduler (diff 파일 5, 잘린 부분 `firePayload` 함수 대역)
- **상세**: `setImmediate` polling 으로 `pendingContinuations` 키를 확인 후 payload 를 fire 하는 구조에서, rehydration 완료 직전에 동일 `executionId` 에 대한 두 번째 BullMQ job(중복 enqueue)이 동시에 pick up 되면 두 resolver 가 동일 pending entry 에 경쟁할 수 있다. BullMQ 의 jobId deduplication(`jobId: executionId:nodeExecutionId:seq`)이 동일 seq 의 중복을 막지만, seq 가 다른 retry job 은 통과할 수 있다. 이는 idempotency 문제이며 보안 취약점은 아니나, 실행 결과가 두 번 resolve 되는 경우 downstream 로직에 예상치 못한 부수효과를 줄 수 있다.
- **제안**: `pendingContinuations.delete(executionId)` 를 `resolve` 호출 직전에 수행해 이미 처리된 경우 두 번째 resolver 가 noop 이 되도록 보장한다(현재도 이 패턴은 적용된 것으로 보이나, rehydration 경로에서 동일하게 보장되는지 확인 필요).

---

### [INFO] `websocket.gateway.spec.ts` — `formData: { approved: true }` 테스트 데이터의 의미론적 부담
- **위치**: `handleSubmitForm` Phase 2.5 성공 케이스 테스트 (diff 파일 6, `+1743~+1753` 라인 대역)
- **상세**: 테스트 fixture 에서 `approved: true` 를 form 데이터로 사용한다. 이는 테스트 환경에서만 동작하는 mock 이므로 보안 영향은 없다.
- **제안**: 해당 없음.

---

## 요약

이번 변경의 핵심은 Redis pub/sub 기반 Continuation Bus 를 BullMQ 영속 큐로 교체하고, 인스턴스 재시작 후 워크플로 재개를 위한 rehydration 로직을 구현한 것이다. 보안 관점에서 중대한 취약점(인젝션, 하드코딩 시크릿, 인증 우회, SQL 인젝션 등)은 발견되지 않았다. 주요 위험은 두 가지 WARNING 으로 요약된다: (1) `RehydrationError` 메시지에 내부 DB 식별자와 상태 값이 포함되어 서버 로그 및 BullMQ job 실패 이유에 노출되는 정보 유출, (2) WS ack 에러 메시지가 `'Redis unavailable'` 을 직접 명시해 클라이언트에게 인프라 구성 요소를 노출하는 문제. 두 사항 모두 인증된 사용자 범위 내의 이슈이므로 즉각적 공격 경로는 좁으나, 방어 심층(Defense in Depth) 원칙 상 개선이 권장된다. 암호화, 의존성 보안, 세션 관리, 입력 새니타이징 측면에서는 기존 패턴이 잘 유지되어 있다.

---

## 위험도

LOW
