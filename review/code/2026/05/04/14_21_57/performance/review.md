## 발견사항

---

### **[WARNING]** `logUsage` await가 MCP 도구 호출 핫패스를 블로킹

- **위치:** `mcp-tool-provider.ts` — `execute()` 내 3개 호출 지점 (isError 분기, 성공 분기, catch 분기)
- **상세:**
  ```typescript
  await this.logUsage(ctx, entry, callStartedAt, 'success');
  return this.successResult(call.id, result);
  ```
  `logUsage` → `IntegrationsService.logUsage` 내부에서 DB 3-hit이 순차 실행된다.
  ```
  usageLogRepository.save()      ← Write 1
  integrationRepository.findOne() ← Read
  integrationRepository.save()   ← Write 2 (lastUsedAt + 조건부 status flip)
  ```
  DB round-trip 하나당 1~5ms 기준으로 매 도구 호출에 최소 **3~15ms**의 직렬 지연이 추가된다. `maxToolCalls=10` 기본값 기준으로 에이전트 실행당 최대 **150ms** 누적. LLM turn 사이클(도구 호출 → 결과 → 다음 LLM turn)은 이 대기 시간을 고스란히 직렬로 부담한다.

  `IntegrationsService.logUsage`는 이미 내부에서 `catch`로 모든 예외를 삼키는 best-effort 설계다. `McpToolProvider.logUsage` 역시 `catch`로 한 번 더 감싼다. 이 구조에서 `await`는 내결함성에 기여하지 않고 오직 지연만 추가한다.

- **제안:** fire-and-forget으로 전환한다. `MCP_AUTH_FAILED` status flip은 비동기로 이루어져도 현재 실행에는 영향 없다.
  ```typescript
  // 현재
  await this.logUsage(ctx, entry, callStartedAt, 'success');
  return this.successResult(call.id, result);

  // 변경
  void this.logUsage(ctx, entry, callStartedAt, 'success');
  return this.successResult(call.id, result);
  ```
  `McpToolProvider.logUsage` 내부도 동일하게 적용:
  ```typescript
  void this.integrationsService.logUsage({...});
  ```

---

### **[INFO]** `IntegrationsService.logUsage` 내 순차 DB 3-hit — 병렬화 여지

- **위치:** `integrations.service.ts` `:493–523` (`logUsage` 메서드)
- **상세:** 아래 세 연산 중 1번과 2번은 서로 독립적이므로 `Promise.all`로 병렬화 가능하다.
  ```
  1. usageLogRepository.save(log)      ← log 생성 (integrationId 참조만 필요)
  2. integrationRepository.findOne()   ← integration 엔티티 조회 (log 저장 완료 불필요)
  3. integrationRepository.save(integration) ← 2번 결과에 의존
  ```
  이번 diff에서 추가된 로직(`MCP_AUTH_FAILED` 분기)은 기존 순차 패턴 위에 올라탔으므로, 이 구조적 이슈는 신규 변경에 의해 악화된 것은 아니다. 다만 `McpToolProvider`에서 호출 빈도가 늘어나는 만큼 병렬화 효과가 이전보다 커진다.
- **제안:**
  ```typescript
  const [, integration] = await Promise.all([
    this.usageLogRepository.save(this.usageLogRepository.create({...})),
    this.integrationRepository.findOne({ where: { id: params.integrationId } }),
  ]);
  if (!integration) return;
  // ... 필드 변경 ...
  await this.integrationRepository.save(integration);
  ```

---

### **[INFO]** 메타 도구(`executeMeta`)에는 `logUsage` 미적용 — 활동 통계 누락

- **위치:** `mcp-tool-provider.ts` — `executeMeta()` 메서드
- **상세:** `list_resources`, `read_resource`, `list_prompts`, `get_prompt`는 `execute()`에서 `routeMetaTool`로 분기된 뒤 `executeMeta`를 통해 처리되며, 이 경로에는 `logUsage`가 없다. 메타 도구 호출이 많은 에이전트의 경우 활동 탭의 호출 횟수·성공률 통계가 과소 집계된다.
- **제안:** 정책적 결정 사항이므로 즉각 수정보다는 스펙/주석에 명시하는 것으로 충분하다. 메타 도구 로깅이 필요하다면 `executeMeta` 시작 지점에 `callStartedAt`을 캡처하고, 반환 직전 fire-and-forget으로 추가한다.

---

### **[INFO]** 인증 실패 감지 정규식 — 성능 영향 없음 (참고)

- **위치:** `mcp-tool-provider.ts` — `execute()` catch 블록
  ```typescript
  const isAuthFailure = /\b40[13]\b|unauthori[sz]ed|forbidden/i.test(message);
  ```
- **상세:** 소스 코드에 정규식 리터럴로 작성되어 있으므로 V8이 코드 로딩 시 1회 컴파일한다. 예외 경로에서만 실행되므로 성능 영향 없음. 다만 MCP SDK 에러 메시지 포맷에 의존하는 heuristic이므로 false-negative 가능성은 있다 (이는 성능이 아닌 정확도 이슈).

---

## 요약

이번 변경의 핵심 성능 리스크는 **`await this.logUsage()`가 MCP 도구 호출 반환을 블로킹**하는 부분이다. `logUsage`는 설계 상 best-effort이고 에러를 이중으로 삼키는 구조임에도 `await`가 붙어 있어 에이전트가 도구 결과를 LLM에 전달하기 전에 매번 2~3개의 DB round-trip을 기다리게 된다. `maxToolCalls` 기본값 기준으로 실행당 최대 150ms의 직렬 지연이 발생할 수 있으며, fire-and-forget으로 전환하면 제로 코스트로 제거 가능하다. 나머지 이슈(순차 DB 3-hit 병렬화, 메타 도구 미로깅)는 기존 설계의 연장선으로 즉각적인 블로커는 아니다.

## 위험도

**MEDIUM** — 에이전트 실행 지연에 직접 영향을 주지만 정확성이나 안전성에는 영향 없음.