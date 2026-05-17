# 성능(Performance) 리뷰

## 발견사항

### 파일 6: execution-engine.service.ts

- **[WARNING]** `executeInline` 내 디버그 로그에서 반복 O(N) 연산
  - 위치: `executeInline` 루프 내 (전체 파일 컨텍스트 약 3220번째 줄 `availableLabels` 계산)
  - 상세: 매 노드 실행마다 `[...subNodeMap.entries()].filter(...).map(...)` 로 전체 노드 맵을 순회해 O(N) 연산을 수행한다. 노드 수가 많고 루프 반복이 많은 경우(back-edge 순환 포함) 누적 비용이 O(N²)에 근접할 수 있다. 또한 이 계산 결과는 `logger.log` (INFO 레벨)에만 쓰이므로 프로덕션에서도 실행된다.
  - 제안: 계산 자체를 `if (this.logger.isLevelEnabled('debug'))` 같은 레벨 가드 뒤로 이동하거나, INFO 레벨 로그라면 제거하거나 DEBUG로 강등한다. 혹은 `nodeOutputCache` 키 Set을 별도로 유지해 O(1)로 체크 가능하게 한다.

- **[WARNING]** `runExecution` 에서 그래프 로드 후 workflow 를 재조회 (`findOneBy`)
  - 위치: `runExecution` 내부 (전체 파일 컨텍스트 약 3537번째 줄 `this.workflowRepository.findOneBy`)
  - 상세: `runExecution`의 호출자(`execute`, `executeSync`, `executeAsync`)는 이미 `workflowRepository.findOneBy`를 호출해 workflow 존재 여부를 확인한다. `runExecution` 내부에서 동일한 workflowId로 재조회가 발생하는데, 이는 `workspaceId`를 컨텍스트에 주입하기 위함이다. 불필요한 DB 왕복이 발생한다.
  - 제안: 호출자가 이미 로드한 `workflow` 객체(또는 최소한 `workspaceId`)를 `runExecution` 에 파라미터로 전달해 추가 SELECT를 제거한다.

- **[WARNING]** `executeInline` 내 `executionRepository.findOneBy` 호출
  - 위치: `executeInline` 루프 진입 전 (전체 파일 컨텍스트 약 3088번째 줄)
  - 상세: `executeInline`은 부모 실행 컨텍스트 내에서 호출되므로, 이미 `savedExecution` 객체가 메모리에 있다. 그러나 `executeInline`은 `executionId`만 받아 내부에서 `findOneBy`로 재조회한다. Sub-Workflow가 여러 번 인라인 호출될 경우 매 호출마다 DB 왕복이 발생한다.
  - 제안: `InlineExecutionOptions`에 `execution?: Execution` 필드를 추가하거나, 적어도 `startedAt`(현재 사용 목적)을 직접 전달해 SELECT를 제거한다.

- **[INFO]** `PARALLEL_ENGINE=v1` 분기에서 `gatherNodeInput` 중복 호출
  - 위치: `runExecution` 의 parallel dispatch 분기 (전체 파일 컨텍스트 약 3680번째 줄)
  - 상세: parallel 노드에서 `gatherNodeInput(nodeId, ...)` 가 루프 상단(일반 노드 공통 경로)과 `dispatchKind === 'parallel'` 분기 내부에서 두 번 호출된다. 입력 데이터가 동일하므로 중복 연산이다.
  - 제안: 첫 번째 호출 결과를 변수에 저장하고 재사용한다.

- **[INFO]** `ContainerBodyPlan.nodeMap` 캐싱은 긍정적이나 주석으로만 문서화됨
  - 위치: `ContainerBodyPlan` 인터페이스 정의 (전체 파일 컨텍스트 약 2373번째 줄)
  - 상세: 이미 INFO #6 주석으로 ForEach 1,000 아이템 시 `new Map(allNodes)` 재생성 비용을 plan 단위 1회로 캐시함을 기록했다. 올바른 최적화이며 성능상 이슈 없다. 다만 실제 `nodeMap`을 plan에 채우는 구현부가 누락되면 null/undefined 접근 위험이 있으므로 초기화 경로 검토를 권장한다.

- **[INFO]** `llmDefaultConfigCache` 정리 — prefix 기반 Map 순회
  - 위치: `runExecution` finally 블록 (주석: "같은 executionId prefix 의 항목을 일괄 삭제")
  - 상세: 캐시 정리 시 Map 전체를 순회해 prefix 매칭으로 삭제하는 패턴은 실행 중 동시 진행 건수가 많을수록 O(N) 순회 비용이 증가한다. 현재는 `executionId` 가 UUID 형식이라 충돌 가능성은 낮지만, key 설계 변경 시 주의가 필요하다.
  - 제안: 실행 종료 시 해당 executionId 접두 키를 별도 Set으로 추적해 O(k)(k=해당 실행의 캐시 항목 수)로 정리하거나, executionId 단위 Map-of-Map 구조로 전환한다.

### 파일 1/3: V055/V056 마이그레이션

- **[INFO]** `dismissed_at IS NULL` partial index 전략은 성능 측면에서 적절함
  - 위치: V056 SQL (전체 파일)
  - 상세: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ... WHERE dismissed_at IS NULL` 패턴은 dismissed 행이 인덱스에서 제외되어 visible 알림 수가 dismissed보다 적을수록 인덱스 크기와 스캔 비용이 감소한다. `CONCURRENTLY`로 잠금 없이 생성하고 기존 인덱스를 `DROP CONCURRENTLY`로 교체하는 순서도 운영 중 테이블 잠금을 회피한다. 성능 관점에서 올바른 접근이다.
  - 제안: 추후 dismissed_at이 채워진 행을 영구 삭제(hard delete)하거나 아카이브 테이블로 이동하는 정책이 도입되면, dismissed_at IS NOT NULL 행의 적재 증가에 따른 테이블 bloat도 모니터링 대상으로 추가한다.

### 파일 8: integration-action-required-notifier.service.ts

- **[INFO]** `recipients` 배열로 `userRepository.find({ where: { id: In(recipients) } })` 호출 — 적절한 배치 처리
  - 위치: `notify` 메서드 (전체 파일 전반부)
  - 상세: 수신자 목록을 먼저 수집한 뒤 `In(recipients)` 단일 쿼리로 배치 조회하고 Map으로 인덱싱한다. N+1 문제가 없다. recipients가 0인 경우 조기 반환해 불필요한 DB 호출도 없다. 성능 관점에서 문제 없다.

### 파일 11: integration-oauth.service.ts (삭제된 `parseTokenExpiresAt`)

- **[WARNING]** `parseTokenExpiresAt` 함수 삭제로 인한 Cafe24 `expires_at` 처리 누락
  - 위치: `normalizeTokenResponse` 함수 내 변경 (diff 약 1669번째 줄)
  - 상세: 변경 전 `parseTokenExpiresAt`은 `expires_in` 없을 때 Cafe24의 `expires_at` ISO string을 파싱하고 없으면 2h 기본값을 사용했다. 변경 후는 `expires_in`만 읽고 없으면 null을 반환한다. Cafe24 API는 `expires_in` 대신 `expires_at`을 반환하므로, `tokenExpiresAt`이 null이 되어 `Cafe24ApiClient.ensureFreshToken`의 proactive refresh 경로가 동작하지 않는다. 이는 2h TTL 경과 후 첫 호출에서 401 오류로 이어지는 성능 저하(재인증 강제)의 원인이 된다. 이 변경이 의도적인 revert인지 확인이 필요하다.
  - 제안: `parseTokenExpiresAt`의 로직(또는 그 일부)을 `normalizeTokenResponse` 인라인으로 복원하거나, Cafe24 전용 `expires_at` 파싱 경로를 유지한다. spec/data-flow/8-notifications.md 및 관련 spec에서 이 변경의 의도를 확인한다.

### 파일 9: integration-expiry-scanner.service.spec.ts / 파일 4: alerts-evaluator.service.spec.ts

- **[INFO]** mock surface 동기화용 `dismiss`/`dismissAll` 추가 — 성능 영향 없음
  - 위치: 각 `beforeEach` 내 notificationsService mock
  - 상세: 테스트 mock에 `dismiss: jest.fn()`, `dismissAll: jest.fn().mockResolvedValue({ affected: 0 })` 를 추가하는 변경으로 성능과 무관하다.

---

## 요약

이번 변경에서 가장 주목할 성능 이슈는 **`execution-engine.service.ts`** 에 집중된다. `executeInline` 루프 내 매 노드마다 O(N) 순회로 `availableLabels`를 계산하는 INFO 레벨 로그가 프로덕션에서 실행되며, `runExecution`과 `executeInline` 양쪽에서 이미 보유한 데이터를 재조회하는 불필요한 DB SELECT가 존재한다. DB 측에서는 V056의 partial index 전환이 dismissed 행 제외로 인덱스 크기를 줄이는 올바른 최적화다. 반면 `integration-oauth.service.ts`에서 `parseTokenExpiresAt`을 제거하며 Cafe24의 `expires_at` 처리 경로도 삭제된 것은 proactive token refresh를 비활성화해 실질적인 성능 저하(주기적 401 재인증)를 일으킬 수 있는 WARNING 수준 이슈다. 나머지 변경(테스트 mock 동기화, 타입 확장, 주석 정리)은 성능에 영향이 없다.

## 위험도

MEDIUM
