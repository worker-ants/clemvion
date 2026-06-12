# Testing Review

## 발견사항

### **[INFO]** isSwaggerEnabled 테스트 블록 중복 선언
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-security-286de9/codebase/backend/src/common/config/production-guards.spec.ts` — diff 추가분과 전체 파일 컨텍스트
- 상세: diff 에 추가된 `describe('isSwaggerEnabled (04 M-1)', ...)` 블록이 전체 파일에 **두 번** 존재한다. diff 패치가 올바르게 적용된다면 이 중복은 사라지겠지만, 전체 파일 컨텍스트를 보면 두 블록이 모두 남아 있다. Jest 는 중복 `describe` 를 오류로 처리하지 않고 단순히 두 배로 실행하므로, 실제로 실행하면 동일 테스트 케이스가 두 번 리포트된다. 의도된 상태인지 확인이 필요하다.
- 제안: `production-guards.spec.ts` 전체 파일에서 `describe('isSwaggerEnabled ...` 블록이 하나만 남아 있는지 확인하고, 중복이 있으면 제거한다.

### **[INFO]** 타이밍 기반 테스트의 CI 불안정성 잠재 위험
- 위치:
  - `condition-evaluator.util.spec.ts` — `elapsed < 100` (ms)
  - `transform.handler.spec.ts` — `elapsed < 1000` (ms)
  - `filter.handler.spec.ts` — `elapsed < 1000` (ms)
- 상세: `Date.now()` 차이로 실행 시간을 검증하는 테스트 세 개가 추가되었다. 이 패턴은 CPU 부하가 높은 CI 러너나 Docker-in-Docker 환경에서 임계값을 초과해 간헐적으로 실패할 수 있다. `condition-evaluator` 의 경우 임계값이 100ms 로 가장 타이트하다. 가드가 compileUserRegex 에서 **동기적으로 즉시 반환**하므로 실제 ReDoS hang 여부를 타이밍이 아닌 **`r.regex === null`** 로 검증하는 것이 더 안정적이다. 현재 테스트도 이미 `r.regex === null` 을 검증하고 있으므로, 타이밍 어서션은 "hang 방지를 별도로 보여주는" 문서적 역할만 한다.
- 제안: 타이밍 어서션을 제거하거나 충분히 관대한 값(예: `< 5000`)으로 완화하고, 핵심 계약(`r.regex === null`, `result.output.text === input`, `invalidRegexPatterns` 포함)은 현재처럼 유지한다. 또는 `jest.setTimeout` 없이 `--testTimeout` 을 낮춰 타임아웃으로 hang 을 잡는 방식도 검토 가능하다.

### **[INFO]** workflow 채널 authorizer — DB 오류 시 throw 패턴 미검증
- 위치: `websocket.gateway.spec.ts` — 새로 추가된 workflow 채널 테스트
- 상세: `kb:` 채널과 `background:run:` 채널에는 "서비스가 예외를 throw 할 때도 거부로 처리된다(DB 오류 fail-safe)"를 검증하는 테스트가 명시적으로 존재한다(`'should reject kb channel when verifyDocumentOwnership throws'`, `'should reject background:run channel when verifyBackgroundRunOwnership throws'`). 그러나 새로 추가된 `workflow:` 채널은 `findById` 가 throw 하는 케이스를 커버하고 있지만, 이 테스트의 목적이 "DB 오류 fail-safe"인지 "소유권 불일치"인지 이름만으로는 구분되지 않는다. `mockRejectedValueOnce(new Error('Workflow not found'))` 메시지가 "not found" 이므로 두 의미가 혼재한다.
- 제안: 현재 "ownership check fails" 테스트를 유지하면서, DB 연결 오류(`new Error('PG connection refused')`)를 별도로 throw 하는 케이스를 추가하거나, 테스트 이름을 `'should reject workflow channel when findById throws (IDOR or DB error)'` 처럼 의도를 명확히 한다. 기능적 결함은 없지만 가독성/의도 표현 개선 사항이다.

### **[INFO]** notifications 채널 — userId 미설정 소켓 케이스 테스트 없음
- 위치: `websocket.gateway.spec.ts` — notifications 채널 신규 테스트
- 상세: 추가된 두 테스트(`matching user` / `different user`)는 `userId` 가 올바르게 설정된 소켓을 전제한다. 그러나 `websocket.gateway.ts` 의 authorizer 구현부를 보면 `const userId = enriched.userId ?? '';` 로 빈 문자열을 할당하고, `!!userId && targetUserId === userId` 로 검증한다. `userId` 가 빈 문자열인 소켓이 `notifications:` 채널을 구독 시도하면 거부되어야 하는데 이 케이스가 테스트되지 않는다.
- 제안: 아래 케이스를 추가한다.
  ```typescript
  it('should reject notifications channel when userId is not set on socket', async () => {
    const { socket } = createMockSocket({ id: 'client-1' });
    (socket as Socket & { workspaceId?: string; userId?: string }).workspaceId = 'ws-1';
    // userId 미설정 — enriched.userId === undefined → '' → !!'' === false
    getSubscriptions().set('client-1', new Set());
    const result = await gateway.handleSubscribe(
      { channel: 'notifications:user-1' }, socket,
    );
    expect(result.data.success).toBe(false);
  });
  ```

### **[INFO]** compileUserRegex — 빈 문자열 패턴 테스트 없음
- 위치: `condition-evaluator.util.spec.ts` — `compileUserRegex (ReDoS guard)` describe 블록
- 상세: `compileUserRegex('')` 는 `safe-regex('')`가 `true` 를 반환하고 `new RegExp('')` 도 유효하므로 `{ regex: /(?:)/ }` 를 반환한다. 이 동작이 의도된 것인지(빈 패턴은 모든 입력에 매치) 명시적으로 문서화·검증되지 않았다.
- 제안: `it('accepts empty pattern (matches everything)')` 테스트를 추가해 의도를 명시한다.

### **[INFO]** main.ts setupSwagger 함수 — 직접 단위 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-security-286de9/codebase/backend/src/main.ts` — `setupSwagger` 분리
- 상세: `setupSwagger` 를 별도 함수로 추출한 것 자체는 테스트 용이성 향상에 기여한다. 그러나 `main.ts` 의 `bootstrap` 함수 전체는 NestJS 앱을 실제로 생성하므로 단위 테스트가 현실적으로 어렵다. `isSwaggerEnabled` 게이팅 계약은 `production-guards.spec.ts` 에서 단위 테스트되고 있어 핵심 로직 검증은 충분하다. `setupSwagger` 자체(DocumentBuilder 구성)는 e2e 또는 integration 테스트로만 커버 가능하며, 현재 범위에서 추가 요구는 없다.
- 제안: INFO 수준. 현 구조로 충분. 향후 Swagger 옵션이 복잡해질 경우 `setupSwagger` 를 별도 모듈로 분리해 스냅샷 테스트를 고려할 수 있다.

## 요약

이번 변경은 전반적으로 테스트 커버리지가 우수하다. 04 M-1(`isSwaggerEnabled`), 04 M-3(ReDoS — `compileUserRegex`), 04 M-6(IDOR — workflow/notifications 채널 authorizer) 모두 순수 함수·의존성 주입 구조로 단위 테스트가 가능하도록 설계되었고, 실제 테스트가 추가되었다. `production-guards.spec.ts` 는 env 맵 주입 패턴으로 모든 분기를 실 부팅 없이 검증하며, websocket authorizer 테스트는 mock 교체로 거부/승인 양방향을 독립적으로 검증한다. 주요 발견은 INFO 수준이며: ① `isSwaggerEnabled` 블록 중복 (diff 적용 후 실파일 확인 필요), ② 타이밍 기반 hang 방지 어서션의 CI 환경 취약성, ③ notifications 채널의 `userId` 미설정 엣지 케이스 테스트 누락, ④ workflow 채널 fail-safe 케이스 명확성이다. CRITICAL·WARNING 수준의 문제는 발견되지 않았다.

## 위험도

LOW
