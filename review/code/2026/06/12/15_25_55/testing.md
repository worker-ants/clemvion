# Testing Review

## 발견사항

### **[INFO]** 테스트 삭제 — 검증 책임 이관 명시, 적절한 처리
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.controller.spec.ts` 54-59행(삭제)
- 상세: `@Headers('x-workspace-id')` 수동 체크를 `@WorkspaceId()` 데코레이터로 교체함에 따라 "X-Workspace-Id 미전달 401" 케이스 테스트가 제거되었다. NestJS param decorator는 Nest의 파이프라인 안에서만 동작하므로 직접 생성자 호출 단위테스트에서 실행될 수 없다. 삭제는 올바른 판단이며, JSDoc 주석에 이관 대상(`workspace.decorator.spec.ts`)이 명확히 문서화되어 있다.
- 제안: 현 상태 유지. 이관 설명 JSDoc이 충분히 명확하다.

### **[INFO]** `workspace.decorator.spec.ts` 커버리지 — 이관된 책임 충분히 커버
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-cleanup-45ffef/codebase/backend/src/common/decorators/workspace.decorator.spec.ts`
- 상세: 데코레이터 spec이 다음 6개 케이스를 모두 커버한다: 헤더 존재 시 반환, 헤더 우선순위, JWT fallback, 두 소스 모두 없을 때 BadRequestException, user 미정의 시 BadRequestException, user null 시 BadRequestException. 이 케이스들은 controller spec에서 제거된 `UnauthorizedException` 검증보다 더 완전하다(JWT fallback 추가). 코드 `WORKSPACE_ID_REQUIRED` 확인은 `toThrow(BadRequestException)`으로만 검증되며 error body의 `code` 필드는 단언하지 않으나, `BadRequestException` 타입 확인으로 충분한 경우가 일반적이다.
- 제안: 선택사항으로 `expect(() => factory(...)).toThrow(expect.objectContaining({ response: expect.objectContaining({ code: 'WORKSPACE_ID_REQUIRED' }) }))` 형태로 에러 코드까지 단언하면 코드 문자열 드리프트를 방지할 수 있다. 현재 수준은 허용 가능.

### **[INFO]** controller spec 잔여 케이스 4개 — 적절한 격리와 가독성
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.controller.spec.ts` 전체
- 상세: 잔여 4개 케이스(정상·newBotToken 누락·비문자열·서비스 throw 전파)는 모두 `beforeEach`에서 독립 인스턴스를 생성하므로 테스트 간 상태 공유가 없다. `jest.Mocked<Pick<...>>` 사용으로 관련 메서드만 mock하는 최소 범위 mock 패턴을 지킨다. 테스트 설명은 한국어로 의도를 명확히 표현한다.
- 제안: 없음.

### **[INFO]** `workspaceId` 빈 문자열(`''`) 케이스 — controller 단위에서 미검증(허용 가능)
- 위치: `chat-channel.controller.spec.ts`
- 상세: 구 코드는 `if (!workspaceId)` 체크로 빈 문자열도 차단했다. `@WorkspaceId()` 데코레이터로 교체된 이후 빈 문자열 헤더의 처리는 `workspace.decorator.ts:15`의 `request.headers['x-workspace-id'] || request.user?.workspaceId` 표현식에 위임된다. 빈 문자열(`''`)은 falsy이므로 `WORKSPACE_ID_REQUIRED` 400을 던진다. 이 경로는 `workspace.decorator.spec.ts`에 명시적 케이스가 없다.
- 제안: `workspace.decorator.spec.ts`에 헤더가 빈 문자열인 케이스(`{ 'x-workspace-id': '' }`)를 추가하면 falsy 처리를 명시적으로 확인할 수 있다. 현재 `||` 연산자의 자연스러운 동작에 의해 커버되지만 명시적 단언이 없다는 점은 작은 커버리지 갭이다.

### **[INFO]** 문서 변경(`.mdx`, `spec`) — 테스트 불필요
- 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx`, `triggers.mdx`, `spec/5-system/15-chat-channel.md`
- 상세: 에러 코드 명칭 `WORKSPACE_REQUIRED` → `WORKSPACE_ID_REQUIRED` 변경은 문서/spec 일관성 수정이다. 프론트엔드 문서 파일의 에러 코드 문자열이 실제 백엔드 에러 코드와 일치하는지를 자동으로 검증하는 스냅샷 또는 e2e 테스트는 이 리뷰 범위 내에서 확인되지 않는다. 그러나 이는 선재 상태이며 이번 PR 변경 범위 밖이다.
- 제안: 없음(이번 변경 범위 밖).

### **[INFO]** `plan/in-progress` plan 문서 — 테스트 체크리스트 항목 확인
- 위치: `plan/in-progress/chat-channel-workspace-code-unify.md`
- 상세: plan 문서에서 `TEST WORKFLOW (lint·unit·build·e2e) — 전부 PASS (unit 40·e2e 188/32 suites, 회귀 0)` 체크가 완료 표시되어 있다. 단위 테스트 수(40개)와 e2e 통과(188/32 suites)가 기록되어 있어 테스트 회귀가 없음을 확인할 수 있다.
- 제안: 없음.

## 요약

이번 변경의 핵심은 `chat-channel.controller.ts`에서 `@Headers('x-workspace-id')` 수동 체크를 공용 `@WorkspaceId()` 데코레이터로 교체한 것이다. 테스트 측면에서 처리는 정확하다: NestJS param decorator는 프레임워크 파이프라인에서만 동작하므로 직접 생성자 호출 단위테스트에서 실행 불가능하고, 검증 책임은 `workspace.decorator.spec.ts`로 적절히 이관되었다. 이관받은 `workspace.decorator.spec.ts`는 6개 케이스로 원래 controller spec보다 더 완전한 커버리지(JWT fallback 포함)를 제공한다. 유일한 소규모 갭은 빈 문자열 헤더 케이스가 decorator spec에 명시적 단언 없이 암묵적으로 커버된다는 점이나, 이는 현재 구현의 `||` 연산자 동작 특성상 문제가 없다. 잔여 controller 테스트 4개는 격리·가독성·mock 범위 모두 적절하다.

## 위험도

NONE
