### 발견사항

- **[WARNING]** `logUsage`의 read-modify-write 패턴에서 lost update 발생 가능
  - 위치: `integrations.service.ts` — `logUsage` 메서드, `findOne` → 필드 수정 → `save` 흐름
  - 상세: `findOne`으로 엔티티를 로드한 뒤 `lastUsedAt`, `status`, `statusReason`, `lastError`를 in-memory에서 수정하고 TypeORM `save()`로 전체 엔티티를 덮어쓴다. 동일 integration에 대해 두 MCP 호출이 동시에 진행될 때, 한 쪽(success)이 `findOne`을 통해 `status='connected'` 상태의 엔티티를 로드한 뒤, 다른 쪽(MCP_AUTH_FAILED)이 먼저 `status='error'`로 저장을 마쳐도, success 쪽이 나중에 `save()`를 호출하면 `status='connected'`로 되돌아간다. 이번 변경의 핵심 동작(auth 실패 시 통합 상태를 `error`로 전환)이 무음으로 취소될 수 있다.
  - 제안: 전체 엔티티 save 대신 원자적 update 사용.
    ```typescript
    // success 경로
    await this.integrationRepository.update(
      { id: params.integrationId },
      { lastUsedAt: new Date() },
    );
    // failed 경로
    const patch: Partial<Integration> = {
      lastUsedAt: new Date(),
      lastError: { code: ..., message: ..., at: ... },
    };
    if (params.error?.code === 'MCP_AUTH_FAILED') {
      patch.status = 'error';
      patch.statusReason = 'auth_failed';
    }
    await this.integrationRepository.update({ id: params.integrationId }, patch);
    ```
    이렇게 하면 UPDATE SQL이 지정된 컬럼만 SET하므로 다른 컬럼에 대한 concurrent write와 충돌하지 않는다.

---

- **[WARNING]** `usageLogRepository.save`와 `integrationRepository.update`가 트랜잭션 없이 분리 실행
  - 위치: `integrations.service.ts` — `logUsage` try 블록 내 두 DB 연산
  - 상세: usageLog 삽입이 성공한 뒤 integration 업데이트 직전에 프로세스가 죽거나 DB 연결이 끊기면, 로그 레코드는 존재하지만 `lastUsedAt`·`status` 갱신은 누락된다. 특히 `status='error'` 전환이 누락되면 UI가 인증 실패를 감지하지 못하는 사용자-가시 결함이 된다. 단, 전체 try/catch가 오류를 삼키므로 호출자에는 영향 없다.
  - 제안: 두 연산을 하나의 트랜잭션으로 묶거나, 더 현실적으로는 `integration.status` 업데이트를 우선순위로 두고 usageLog 삽입을 fire-and-forget 비동기 큐로 분리하는 설계를 검토. 현재 구조에서 최소 조치는 `DataSource.transaction()`으로 감싸는 것.

---

- **[INFO]** MCP 도구 호출 건당 2회 DB 라운드트립 발생
  - 위치: `mcp-tool-provider.ts` — `logUsage` private 메서드 → `integrations.service.logUsage` → usageLog insert + integration findOne+save
  - 상세: AI Agent가 한 턴 내에서 MCP 도구를 N번 호출하면 `2N`회의 동기 DB I/O가 직렬로 발생한다. 단일 실행에서 `maxToolCalls=10`이면 최대 20회. 현재 허용 범위이나, `logUsage`가 현재 await로 tool 실행 경로에 걸려 있어 DB 응답 지연이 LLM turn 지연으로 직결된다.
  - 제안: `logUsage` 호출을 fire-and-forget(`void this.logUsage(...)`)으로 전환하거나, 짧은 주기로 배치 플러시하는 비동기 큐를 도입하면 tool call 레이턴시에서 DB I/O를 분리할 수 있다. "usage tracking must never break tool execution"이라는 주석과 `swallow` 정책이 이미 비동기 처리를 의도하는 신호로 읽힌다.

---

- **[INFO]** `integrationRepository.findOne`에 `workspaceId` 조건 누락
  - 위치: `integrations.service.ts` — `logUsage` 내 `findOne({ where: { id: params.integrationId } })`
  - 상세: 다른 메서드(`findById`, `requireEntity`)는 `where: { id, workspaceId }` 이중 조건을 사용하지만 `logUsage`는 `id`만으로 조회한다. 실행 엔진이 이미 권한 검증을 마친 뒤 호출하므로 악용 가능성은 낮지만, 방어 일관성 차원에서 workspaceId 조건을 추가하는 것이 좋다.
  - 제안: `logUsage` params에 `workspaceId`를 추가하거나, 위의 `update({ id }, patch)` 방식으로 바꾸면 findOne 자체가 불필요해진다.

---

### 요약

이번 변경의 핵심은 MCP 인증 실패 시 `integration.status`를 `'error'`로 전환하는 것인데, 구현이 TypeORM의 전체 엔티티 `save()`에 의존하는 read-modify-write 패턴을 사용해 동시 호출 시 lost update 가능성이 있다. 특히 성공 호출과 인증 실패 호출이 동시 진행되면 성공 쪽의 save가 `status='error'` 전환을 조용히 덮어쓸 수 있어, 기능 핵심 동작의 신뢰성을 저해한다. 이를 `update()` 기반 원자적 패치로 교체하면 이 문제와 전체 엔티티 덮어쓰기 위험을 동시에 해소할 수 있다. 그 외 usageLog 삽입과 integration 업데이트의 비트랜잭션 분리, 도구 호출 경로의 동기 DB I/O는 정확성보다 신뢰성·성능 측면의 경고 사항이다.

### 위험도

**MEDIUM**