# 동시성(Concurrency) 리뷰

### 발견사항

- **[INFO]** `reactive_401` + `removeOnComplete: { age: 0 }` 의 race window 잔존
  - 위치: `cafe24-api.client.ts` — `refreshViaQueue` 의 `removeOnComplete` 분기
  - 상세: `reactive_401` 으로 enqueue 된 job 이 완료된 직후(`age:0` 이므로 즉시 제거) 동일 pod 혹은 다른 pod 에서 거의 동시에 새 `reactive_401` add 가 발생하면, 이미 제거된 completed job 과의 dedup 은 불가능하므로 두 worker 가 **각각 refresh 를 실행**할 수 있다. 이 경우 refresh_token rotation race(두 번째 refresh 가 이미 소비된 refresh_token 으로 Cafe24 를 호출 → 실패) 위험이 waiting/active 범위 안에서만 보호된다. 다만 spec 주석 및 plan Rationale 에서도 이 trade-off 가 명시적으로 인지·기술되어 있으며("같은 시점의 cross-pod reactive_401 동시성은 jobId dedup 으로 여전히 보호(BullMQ waiting/active 상태 job 동일 jobId 반환)") 의도된 설계 범위 내이다. 만약 Cafe24 의 refresh_token rotation 이 엄격히 1회 사용 후 무효화되는 경우, 두 reactive_401 job 이 waiting 상태에서 겹치지 않고 순차 실행될 경우 두 번째 refresh 가 실패할 수 있다.
  - 제안: 이미 설계 인지 사항이므로 추가 조치는 선택적이나, `reactive_401` 에 대해 글로벌 분산 lock(예: Redis SET NX + TTL 단기 잠금) 또는 retry 후 Cafe24 재인증 요청 흐름을 마지막 안전망으로 추가하는 것을 중장기적으로 검토할 수 있다.

- **[INFO]** `parseJwtExp` 는 순수 동기 함수 — 동시성 이슈 없음
  - 위치: `jwt-exp.ts`
  - 상세: 함수 내 공유 상태 없음, 외부 I/O 없음, Buffer 는 Node.js 에서 스레드 안전. 멀티 pod 환경에서 병렬 호출되어도 race condition 발생 불가.
  - 제안: 해당 없음.

- **[INFO]** `parseTokenExpiresAt` — `Date.now()` 의 비원자성은 허용 범위
  - 위치: `integration-oauth.service.ts` — `parseTokenExpiresAt` 내 `new Date(Date.now() + expiresIn * 1000)`
  - 상세: JWT exp 경로(최우선)는 `Date.now()` 가 불필요하므로 기존보다 개선. fallback 인 `expiresIn` / 2h default 경로는 여전히 `Date.now()` 를 사용하나, 이는 토큰 만료 시각 추정값이므로 수 ms 의 비결정성은 허용 범위 내.
  - 제안: 해당 없음.

- **[INFO]** `refreshViaQueue` 의 `await queue.add(...)` + `await job.waitUntilFinished(...)` 시퀀스 — 이중 await 누락 없음
  - 위치: `cafe24-api.client.ts` — `refreshViaQueue`
  - 상세: 두 비동기 호출 모두 올바르게 `await` 적용. 동기 조건 분기(`removeOnComplete`) 는 `await` 이전에 완료되므로 문제 없음.
  - 제안: 해당 없음.

- **[INFO]** BullMQ job dedup(`jobId = integrationId`) 은 코드 변경으로 그대로 유지
  - 위치: `cafe24-api.client.ts` — `queue.add` 옵션의 `jobId: integration.id`
  - 상세: cross-pod thundering herd 방지 핵심인 `jobId` dedup 이 신규 `reactive_401` 분기에서도 동일하게 유지되어, waiting/active 상태에서의 멀티 인스턴스 race 보호가 훼손되지 않음.
  - 제안: 해당 없음.

---

### 요약

이번 변경의 핵심은 Cafe24 JWT `exp` claim 을 만료 시각 SoT 로 격상하고, `reactive_401` source 신설로 워커 short-circuit 을 차등 적용한 것이다. 동시성 관점에서 대부분의 설계는 양호하다. `parseJwtExp` 는 순수 함수로 동시성 이슈가 없고, BullMQ jobId dedup 기반의 cross-pod race 보호는 신규 경로에서도 유지된다. `reactive_401` 에 `removeOnComplete: { age: 0 }` 를 적용한 것은 stale completed job dedup 문제를 해소하는 의도된 trade-off 이며, spec 및 plan Rationale 에도 해당 race window 가 명시적으로 기술되어 있어 의도된 설계 범위 내이다. 중장기적으로 refresh_token rotation 이 엄격 1회인 환경에서 동시 reactive_401 가 순차 실행될 경우의 실패 가능성을 모니터링할 필요는 있으나, 현재 구조에서 Critical/Warning 수준의 동시성 결함은 발견되지 않는다.

### 위험도

LOW
