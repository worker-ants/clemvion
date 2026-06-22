# Testing Review — refactor(triggers): M-8 1단계 API 레이어 추출

## 발견사항

### **[WARNING]** `lib/api/triggers.ts` 유닛 테스트 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` (신설 파일, 전체)
- 상세: 프로젝트는 API 레이어 모듈을 유닛 테스트하는 명확한 관례를 가지고 있다. `lib/api/__tests__/model-configs.test.ts`는 `modelConfigsApi`의 각 함수에 대해 URL 경로·파라미터·응답 역직렬화(envelope 정규화)를 개별적으로 검증한다. 신설된 `triggersApi`는 같은 위치(`lib/api/__tests__/triggers.test.ts`)에 동등한 수준의 유닛 테스트가 없다. 특히 `getById`의 workflow 중첩 평탄화 로직(`raw.workflowId ?? raw.workflow?.id ?? ""`)과 `rotateNotificationSecret`·`revokeInteractionToken`의 `res.data.data` 접근 패턴은 응답 envelope shape 에 민감하여 회귀 위험이 높다.
- 제안: `lib/api/__tests__/triggers.test.ts` 신설. `model-configs.test.ts` 패턴을 답습하여 각 함수별로 (1) 올바른 URL/HTTP verb/파라미터 전달 여부, (2) 응답 정규화 로직(특히 `getById`의 workflow 평탄화, `rotateNotificationSecret`/`revokeInteractionToken`의 data 언래핑), (3) API 에러 전파 여부를 검증한다.

### **[WARNING]** `getById` workflow 평탄화 엣지 케이스 미커버
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` L273–L284 (`getById` 함수)
- 상세: `workflowId: raw.workflowId ?? raw.workflow?.id ?? ""` 는 세 가지 backend shape을 처리한다 — (a) `workflowId` 최상위 필드 존재, (b) `workflow.id` 중첩, (c) 둘 다 없어 빈 문자열 폴백. 마찬가지로 `workflowName` 도 `raw.workflow?.name ?? raw.workflowName ?? ""` 3-way 폴백이다. 기존 `trigger-detail-drawer.test.tsx`는 컴포넌트 레벨 통합 테스트라 mock이 `apiClient.get`을 직접 가로채므로 이 평탄화 로직을 통과하지 않는다. (drawer 테스트의 `apiGetMock`은 `triggersApi.getById` 내부 로직 전체를 우회함.)
- 제안: `triggers.test.ts` 에서 (a) `workflowId` 있고 `workflow` 없음, (b) `workflow.id` 있고 `workflowId` 없음, (c) 둘 다 없음, (d) 둘 다 있을 때 `workflowId` 우선 여부를 각각 검증하는 케이스를 추가한다.

### **[WARNING]** `rotateNotificationSecret` / `revokeInteractionToken` 응답 언래핑 테스트 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` L297–L313
- 상세: 두 함수는 `res.data.data.secret` / `res.data.data.token` 형태의 이중 래핑 응답을 처리한다. `trigger-detail-drawer.test.tsx`에서는 `apiClient.post`를 `vi.fn()`으로 완전히 모킹하고 반환값을 사용하지 않아 이 언래핑 로직이 전혀 테스트되지 않는다. backend 가 `data` 래핑을 변경하거나 응답 shape 가 달라질 경우 런타임에서만 발견된다.
- 제안: `triggers.test.ts` 에서 `{ data: { data: { secret: "s", rotatedAt: "..." } } }` 형태의 mock 응답을 주고 반환값이 올바르게 언래핑되는지 검증한다.

### **[INFO]** 기존 drawer/page 테스트는 `apiClient` 직접 모킹 방식을 유지
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/components/triggers/__tests__/trigger-detail-drawer.test.tsx` L20–27, `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/app/(main)/triggers/__tests__/triggers-page.test.tsx` L22–29
- 상세: 두 테스트 파일 모두 `vi.mock("@/lib/api/client")` 로 `apiClient`를 직접 모킹한다. `triggersApi`는 내부적으로 `apiClient`를 사용하므로, 이 모킹은 여전히 유효하다. 따라서 컴포넌트 동작 검증(어떤 URL/파라미터로 요청을 보내는지)은 계속 동작하며 회귀는 없다. 다만 이 방식은 `triggersApi` 자체의 로직(envelope 정규화, 평탄화)은 검증하지 않는다.
- 제안: 현행 테스트는 그대로 유지해도 무방하다. `triggersApi` 자체 유닛 테스트(`__tests__/triggers.test.ts`)로 보완하는 것이 관례에 부합한다.

### **[INFO]** `triggers-page.test.tsx` 내 `triggersApi.create` / `update` 직접 검증 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/app/(main)/triggers/__tests__/triggers-page.test.tsx`
- 상세: 현재 페이지 테스트는 pagination, RBAC, auth column 에 집중하며 `createMutation`, `toggleMutation`의 실제 호출 검증은 없다. 이는 리팩토링 전 상태에서도 동일하므로 이번 변경의 회귀는 아니다. 단, `triggersApi.create` 호출 시 `endpointPath: crypto.randomUUID()` 포함 여부나 chatChannel 조건부 포함 로직은 커버되지 않는다.
- 제안: 중요도에 따라 선택적으로 추가. 우선순위는 `WARNING` 항목들보다 낮다.

### **[INFO]** `handleCreate` 클라이언트 사이드 검증 로직 테스트 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/app/(main)/triggers/page.tsx` L457–L494 (`handleCreate` 함수)
- 상세: Slack signing secret (hex 32) / Discord public key (hex 64) 정규식 검증 로직이 클라이언트에 있으나 이 경로를 직접 커버하는 테스트가 없다. 정규식 자체는 `@workflow/chat-channel-validation` 패키지에서 왔으므로 패키지 레벨에서 테스트될 수 있으나, `handleCreate` 내의 분기 로직(provider !== "telegram" 이면 plaintext 검사, regex test 실패 시 다른 toast 메시지)은 미커버 상태다.
- 제안: `triggers-page.test.tsx` 또는 별도 파일에서 slack/discord provider 선택 후 잘못된 형식의 signing secret 입력 시 toast.error 발생 여부를 검증하는 케이스를 추가한다.

## 요약

이번 리팩토링은 `triggers/page.tsx`와 `trigger-detail-drawer.tsx`의 `apiClient` 직접 호출을 신설된 `lib/api/triggers.ts`로 추출하는 behavior-preserving 변경이다. 기존 컴포넌트 레벨 테스트(5 suites / 54 tests)는 `@/lib/api/client`를 모킹하는 구조 덕분에 무수정으로 계속 동작한다는 점에서 회귀 위험은 낮다. 그러나 신설된 `triggersApi` 모듈 자체에 대한 유닛 테스트가 없다는 점이 주요 갭이다. 특히 `getById`의 workflow 중첩 평탄화 로직과 `rotateNotificationSecret`/`revokeInteractionToken`의 이중 envelope 언래핑은 프로젝트의 기존 API 레이어 테스트 관례(`model-configs.test.ts`)에 비추어 커버가 필요한 부분이다. `lib/api/__tests__/triggers.test.ts` 신설로 이 갭을 메우는 것을 권장한다.

## 위험도

LOW
