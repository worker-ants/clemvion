# Testing Review

## 발견사항

### **[INFO]** `SSE_SEQ_PLACEHOLDER` 상수 — 테스트에서 리터럴 `0` 으로 직접 검증 중
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` line 475
- 상세: 기존 테스트 `expect(r).toMatchObject({ seq: 0, ... })` 는 `SSE_SEQ_PLACEHOLDER` 가 도입된 이후에도 리터럴 `0` 을 그대로 사용한다. 상수가 나중에 다른 값으로 변경되면 테스트가 실제 동작을 검증하지 못하고 숫자 하드코딩이 된다. 다만 현실적으로 이 값이 바뀔 가능성은 매우 낮고 테스트 자체는 동작 중이므로 심각하지 않다.
- 제안: 필요하다면 `import { SSE_SEQ_PLACEHOLDER }` 방식으로 상수를 export 하고 테스트에서 참조하거나, 현 상태를 명시적 주석으로 문서화.

### **[INFO]** `getStatus` — `form`, `ai_conversation` interactionType 케이스 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` — `describe('InteractionService.getStatus')` 블록
- 상세: 현재 `getStatus` 테스트는 `buttons` 노드(`interactionType: 'buttons'`) 케이스 1개와 `nodeExec null` 케이스만 커버한다. 변경 코드의 핵심 경로인 `rawInteractionType` → `interactionType` 화이트리스트 검증(`form`, `ai_conversation`)은 테스트가 없다. 특히 아래 두 갭이 존재한다:
  1. `interactionType: 'form'` 케이스 — `context.nodeOutput` 로 동봉되는 경로
  2. `interactionType: 'ai_conversation'` 케이스 — `context.nodeOutput` 로 동봉되는 경로
  3. `meta.interactionType` 이 `'form'|'buttons'|'ai_conversation'` 이외의 값(`'unknown_type'`, `null`, `undefined`)일 때 `interactionType: null` + `context: null` 로 설정되는 경로
- 제안: 위 케이스 3가지를 `interaction.service.spec.ts` 에 추가.

### **[INFO]** `@Index(['executionId', 'status'])` — TypeORM 엔티티 데코레이터 단위 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts`
- 상세: `node-executions/entities/` 디렉터리에 별도 `.spec.ts` 파일이 없다. `@Index` 데코레이터는 TypeORM 메타데이터에만 영향을 주므로 단위 테스트로 의미 있는 검증이 어렵다. DB 통합 테스트 없이도 JSDoc 의 "Flyway V095 이미 커버, 중복 DDL 없음" 명시로 의도가 충분히 전달되어 있다. 회귀 위험은 낮음.
- 제안: 현 상태 유지 허용. 다만 향후 스키마 검증 통합 테스트 추가 시 포함.

### **[INFO]** `seedWaitingFromStatus` JSDoc 변경 — 프론트엔드 단위 테스트 커버리지 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` lines 276–323
- 상세: `seedWaitingFromStatus` 의 핵심 동작(getStatus 응답으로 buttons 표면 시드)은 `use-widget-eager-start.test.ts` 에서 integration 수준으로 이미 검증된다. `form`, `ai_conversation` 표면 시드 경로나 `getStatus` 실패 시 soft-fail 동작은 별도 테스트가 없으나, JSDoc 에 "soft-fail" 정책이 명시되고 백엔드 `getStatus` 단위 테스트에서 각 interactionType 이 커버되면 충분히 대체 가능하다.
- 제안: soft-fail(`console.warn` 후 계속 진행) 케이스를 프론트엔드 테스트에 1개 추가하면 명시적 계약이 더 명확해진다.

### **[INFO]** `external-interaction.module.ts` JSDoc 변경 — 모듈 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/backend/src/modules/external-interaction/external-interaction.module.ts`
- 상세: 이번 변경은 JSDoc 주석의 의존성 목록 갱신(`ExecutionToken, NodeExecution` 추가 명기)이므로 런타임 동작 변경이 없다. 별도 테스트 추가 불필요.

---

## 요약

이번 변경(SSE_SEQ_PLACEHOLDER 상수 추출, rawInteractionType 리네임, @Index 데코레이터 추가, JSDoc 보강)은 대부분 리팩터링·문서화 성격이라 기존 테스트 회귀 위험이 낮다. `interaction.service.spec.ts` 의 `getStatus` 테스트는 `buttons` 케이스를 커버하지만 `form`, `ai_conversation`, 알 수 없는 interactionType(→ null) 세 경로가 빠져 있어 변경 코드(`rawInteractionType` 화이트리스트 검증)의 3/4 분기가 테스트되지 않는다. 프론트엔드 쪽 `seedWaitingFromStatus` 의 soft-fail 케이스도 미커버 상태다. 두 갭 모두 현재 코드 정확성에 영향을 주지는 않으나, 향후 interactionType 처리 로직 변경 시 회귀를 잡지 못할 수 있다.

## 위험도

LOW

STATUS: OK
