## 발견사항

### **[WARNING]** `IntegrationsService.logUsage` — 비보호 Read-Modify-Write 경쟁 조건
- **위치**: `integrations.service.ts:508-522` (신규 추가 블록 포함)
- **상세**: `findOne` → 엔티티 수정 → `save` 사이에 락이 없다. 동일 Integration에 대해 MCP 도구 호출이 동시에 여러 건 발생하면 아래 시나리오가 실현될 수 있다.

  ```
  [타임라인]
  T0: 성공 호출 A: findOne → {status: 'connected'}
  T1: 실패 호출 B: findOne → {status: 'connected'}
  T2: 실패 호출 B: save    → {status: 'error', statusReason: 'auth_failed'}
  T3: 성공 호출 A: save    → {status: 'connected'}  ← auth_failed 상태 덮어씀
  ```

  결과적으로 `MCP_AUTH_FAILED` 상태 전환이 유실된다. TypeORM `save(entity)`는 읽은 시점의 스냅샷 전체를 덮어쓰므로 T2에서 기록한 `status='error'`가 T3에서 복구(overwrite)된다.
- **제안**: 엔티티 전체 save 대신 조건부 UPDATE 쿼리로 대체. 예:

  ```typescript
  // 현재
  integration.status = 'error';
  integration.statusReason = 'auth_failed';
  await this.integrationRepository.save(integration);

  // 개선: 상태는 조건부 쿼리, lastUsedAt/lastError는 별도 처리
  await this.integrationRepository.update(
    { id: params.integrationId },
    { status: 'error', statusReason: 'auth_failed' },
  );
  ```

  또는 TypeORM `@Version` 필드를 이용한 낙관적 잠금(optimistic locking)을 적용한다.

---

### **[INFO]** `McpToolProvider.logUsage` — "best-effort"이지만 critical path를 차단
- **위치**: `mcp-tool-provider.ts:365-395` (`logUsage` private 메서드, `execute` 내 호출부)
- **상세**: 주석과 JSDoc에 "Best-effort", "usage tracking must never break tool execution"이라고 명시했지만 실제 구현은 `await this.logUsage(...)` — 즉, DB 쓰기가 완료될 때까지 도구 결과 반환이 블로킹된다. DB 응답이 느리거나 커넥션 풀이 고갈된 상황에서는 모든 MCP 도구 호출 응답 레이턴시가 직접 영향을 받는다. `IntegrationsService.logUsage` 내부에서도 `usageLogRepository.save` → `integrationRepository.save`를 순차 await하므로 총 두 번의 DB I/O가 직렬로 삽입된다.
- **제안**: 진정으로 fire-and-forget이 목표라면 반환값을 버리는 방식으로 호출:

  ```typescript
  // critical path 비차단
  void this.logUsage(ctx, entry, callStartedAt, 'success').catch((e) => {
    McpToolProvider.logger.warn(`MCP usage logging failed: ${...}`);
  });
  return this.successResult(call.id, result);
  ```

  단, 이 경우 테스트에서 `logUsage` 호출 검증 시 `await` 타이밍 조정이 필요하다.

---

### **[INFO]** Multi-turn resume — nodeExecutionId 귀속 편향 (설계 결정, 경쟁 조건 아님)
- **위치**: `ai-agent.handler.ts:763-769` (추가된 주석 블록)
- **상세**: resume turn의 MCP 호출 로그가 원래 waiting NodeExecution에 귀속된다. 직접적인 동시성 버그는 아니며 설계 결정으로 주석에 명시되어 있다. 단, 다수의 multi-turn 실행이 동시에 resume될 경우 `state.nodeExecutionId`가 서로 다른 실행의 로그 레코드를 잘못 참조할 가능성이 없는지 state 직렬화 지점을 추가 확인할 것을 권고한다.

---

## 요약

변경의 핵심인 `IntegrationsService.logUsage`의 auth 상태 전환 로직이 낙관적/비관적 잠금 없이 read-modify-write 패턴으로 구현되어, 동일 Integration에 대해 동시 MCP 도구 호출이 발생할 경우 `MCP_AUTH_FAILED` 상태 전환이 유실될 수 있는 경쟁 조건이 존재한다. 실제 발생 빈도는 낮지만(동일 Integration에 대한 동시 호출 + 저장 순서 역전이 모두 맞아야 함) 구조적 결함이므로 조건부 UPDATE 쿼리 또는 낙관적 잠금으로 해소가 권장된다. 그 외 `await`로 인한 best-effort 의도 불일치는 성능·정확성 양면에서 저위험이나 주석과 구현의 불일치를 해소할 필요가 있다.

## 위험도
**MEDIUM**