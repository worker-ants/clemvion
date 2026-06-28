# 성능(Performance) 리뷰 결과

## 발견사항

### 파일 1: `http-exception.filter.spec.ts`
- **[INFO]** 테스트 파일 — 성능 영향 없음
  - 위치: 전체 파일
  - 상세: 테스트 spec 변경이라 런타임 성능에 직접 영향 없음. 각 테스트마다 `new GlobalExceptionFilter()` 인스턴스를 생성하나 단위 테스트 범위 내이며 허용 가능.
  - 제안: 없음

---

### 파일 2: `client-ip.spec.ts`
- **[INFO]** 테스트 파일 — 성능 영향 없음
  - 위치: 전체 파일
  - 상세: `null` → `undefined` 반환형 통일에 대한 테스트 갱신. 테스트 자체에 성능 이슈 없음.
  - 제안: 없음

---

### 파일 3: `client-ip.ts`
- **[INFO]** `extractClientIpFromHeaders` 반환형 `null` → `undefined` 변경
  - 위치: 반환문 `return undefined;` (라인 64)
  - 상세: 반환형 통일로 호출부에서 `?? undefined` 제거 가능. 런타임 성능에 실질적 차이 없음.
  - 제안: 없음

- **[INFO]** `normalize()` 함수의 정규식 — 호출마다 리터럴 생성
  - 위치: `normalize()` 함수, `/^::ffff:(\d{1,3}...)$/i` 패턴
  - 상세: 현재 정규식 리터럴은 JS 엔진이 컴파일 시점에 캐싱하므로 호출마다 재컴파일되지 않는다. 실제 성능 문제 없음.
  - 제안: 없음

---

### 파일 4: `executions.service.ts`
- **[INFO]** `getStatusById` — select 컬럼 최소화로 성능 양호
  - 위치: `getStatusById()` (신규 추가 메서드)
  - 상세: `select: ['id', 'status']` 로 필요한 컬럼만 조회. 전체 Execution 엔티티(inputData, outputData 등 대용량 JSONB 포함)를 로드하지 않아 효율적.
  - 제안: 없음

- **[INFO]** `snapshotCache` LRU — `getStatusById` 는 캐시를 우회
  - 위치: `getStatusById()` vs `findById()` 의 `snapshotCache`
  - 상세: `getStatusById` 는 매번 DB를 조회한다. `HooksService.getActiveExecutionStatus` 는 웹훅 수신마다 호출되므로, 동일 executionId 에 대해 짧은 시간 내 반복 호출이 있을 경우 불필요한 DB 왕복이 발생할 수 있다. 다만 이 호출 목적은 "현재 live status" 확인이므로 캐시하면 stale 위험이 생겨 의도적으로 캐시 제외가 타당하다.
  - 제안: 현재 설계 유지. 필요 시 TTL 수 초의 짧은 캐시(예: Redis) 도입은 별도 이슈로 검토.

- **[WARNING]** `reRun` 내 `JSON.stringify` 두 번 호출 — 비교 비용
  - 위치: `reRun()` 메서드, `inputModified` 계산 블록 (라인 약 1138~1144)
  - 상세: `JSON.stringify(executionInput.parameters)` 와 `JSON.stringify(original.inputData.parameters)` 를 비교하는데, `inputData` 가 대용량 JSON 이면 직렬화 비용이 크다. 단, `useOriginal === true` 인 경우 이 블록은 `!useOriginal && ...` 조건으로 실행되지 않으므로 실제 실행 경로는 `useOriginal=false` 일 때만이다. 빈번한 호출이 아닌 사용자 액션(re-run)이므로 허용 가능 수준이나, 대용량 inputData 가 있는 경우 약간의 지연 발생 가능.
  - 제안: 현재 수준 허용. 향후 최적화가 필요하면 deep-equal 라이브러리 대신 해시 비교 고려.

- **[INFO]** `findById` 내 `loadParentWorkflowNames` 직렬 호출
  - 위치: `findById()` 내 트랜잭션 클로저, `parentName` 조회 블록
  - 상세: `nodeExecutions` + `executionPath` 는 `Promise.all` 로 병렬화되어 있으나, `parentExecutionId` 가 있는 경우의 `loadParentWorkflowNames` 는 그 다음에 직렬로 실행된다. 단건 execution 이고 `parentExecutionId` 가 있을 때만 추가 DB 왕복이 1회 발생한다. 이미 기존 코드이며 이번 변경에서 도입된 것은 아님.
  - 제안: 기존 코드이므로 이번 변경 범위에서는 무시. 별도 개선 이슈 가능.

---

### 파일 5: `hooks.service.spec.ts`
- **[WARNING]** 테스트 `beforeEach` 에서 매번 IIFE 실행으로 mock 객체 재생성
  - 위치: `ExecutionsService` provider `useValue` IIFE (라인 약 1618~1633 / 1736~1751)
  - 상세: `beforeEach` 마다 `Test.createTestingModule` 을 다시 호출하며, IIFE 로 `executionRepository` 객체와 `getStatusById` 클로저를 매번 생성한다. 단위 테스트 환경이라 실제 성능 문제는 없으나, 각 테스트마다 새 클로저가 생성되어 `executionRepository.findOne` mock 을 per-test 제어하려면 반드시 `execRepo.findOne.mockResolvedValue(...)` 로 외부에서 설정해야 한다.
  - 제안: 현재 구조 허용. 테스트 격리 목적에 부합하며 성능 영향 미미.

- **[INFO]** `getStatusById` mock 이 `executionRepository.findOne()` 에 위임
  - 위치: `getStatusById` jest.fn 구현 (라인 약 1625~1630 / 1743~1749)
  - 상세: mock `getStatusById` 가 내부적으로 `executionRepository.findOne()` 를 호출하는 비동기 클로저다. 실 구현과 동일한 추상화 수준이지만 mock 내부에서 또 비동기 호출을 하는 구조는 불필요한 간접 계층이다. 다만 기존 23개 테스트의 `execRepo.findOne.mockResolvedValue(...)` 설정을 그대로 재활용하기 위한 의도적 설계이므로 적절하다.
  - 제안: 없음

---

### 파일 6: `hooks.service.ts`
- **[INFO]** `extractClientIpFromHeaders(input.headers) ?? undefined` → `extractClientIpFromHeaders(input.headers)` 단순화
  - 위치: 라인 약 2524, 2543, 2552 (diff 기준)
  - 상세: `?? undefined` 제거로 불필요한 nullish coalescing 연산 1회 제거. 마이크로 최적화이나 코드 명확성 개선.
  - 제안: 없음 (이미 개선됨)

- **[INFO]** `getActiveExecutionStatus` — private bracket access 제거로 캡슐화 개선
  - 위치: `getActiveExecutionStatus()` (라인 약 2560~2578)
  - 상세: `this.executionsService['executionRepository']?.findOne?.(...)` 형태의 private 접근을 `this.executionsService.getStatusById()` 공개 API 호출로 교체. bracket access 방식은 TypeORM DI 프록시에서 undefined 가능성이 있어 optional chaining(`?.`)이 필요했으나, 공개 메서드로 교체하면서 이 방어 코드가 제거되었다. 성능 관점에서 동등하며 가독성 향상.
  - 제안: 없음

- **[INFO]** `handleChatChannelWebhook` 내 `clientIp` 추출 중복
  - 위치: `handleWebhook()` 의 `clientIp` 추출 (라인 ~2737) + `handleChatChannelWebhook()` 내 동일 추출 (라인 ~2847)
  - 상세: `handleWebhook` 이 `chatChannelCfg` 존재 시 `handleChatChannelWebhook` 에 위임하므로, chat-channel 경로에서는 `handleWebhook` 의 `clientIp` 추출 코드(라인 ~2737)에 도달하지 않는다. 즉 두 메서드가 각각 독립적으로 `extractClientIpFromHeaders` 를 호출한다. 이 함수는 O(1) 헤더 룩업이라 성능 부담은 없으며, 현재의 분리된 메서드 구조상 불가피한 중복이다.
  - 제안: 없음 (기존 아키텍처 패턴 유지)

- **[WARNING]** `handleChatChannelWebhook` — `getActiveExecutionStatus` 가 매 인바운드 메시지마다 DB 조회
  - 위치: `handleChatChannelWebhook()` 내 `getActiveExecutionStatus` 호출 (라인 ~2948)
  - 상세: `state?.executionId` 가 존재하면 매 웹훅 인바운드마다 `ExecutionsService.getStatusById` → DB SELECT 1회 발생. 동일 `executionId` 에 대해 짧은 시간 내 여러 메시지가 오는 busy conversation 에서는 반복적인 DB 왕복이 누적된다. 현재 `WAITING_FOR_INPUT` 상태인 execution 은 상태가 자주 바뀌지 않으므로 짧은 TTL(예: 1~2초) 인메모리 캐시가 효과적일 수 있다.
  - 제안: 필요 시 `HooksService` 내 `Map<executionId, { status, cachedAt }>` 형태의 TTL 캐시 도입 검토. 단, execution 상태 변경 시 캐시 무효화 연동 필요. 현재 트래픽 수준에서는 DB 인덱스(PK)로 충분할 가능성이 높아 선제 최적화는 불필요.

---

## 요약

이번 변경의 핵심은 (1) `extractClientIpFromHeaders` 반환형 `null` → `undefined` 통일, (2) `HooksService` 의 private bracket access(`this.executionsService['executionRepository']`) 를 `ExecutionsService.getStatusById` 공개 메서드로 캡슐화, (3) 테스트 보강이다. 성능 관점에서 주목할 개선 사항은 `getStatusById` 가 `select: ['id', 'status']` 로 최소 컬럼만 조회한다는 점이며, 기존 full-entity 로드 대비 JSONB 컬럼(inputData, outputData) 전송 비용을 절감한다. 주요 잠재적 성능 우려는 `handleChatChannelWebhook` 내 `getActiveExecutionStatus` 가 매 인바운드마다 DB를 조회한다는 점이나, PK 조회라 현재 규모에서는 허용 가능하다. 나머지 변경은 불필요한 `?? undefined` 연산 제거 등 마이크로 최적화 수준이다.

## 위험도

LOW
