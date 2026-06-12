# Side Effect Review

## 발견사항

### [INFO] 파라미터 데코레이터 교체 — 예외 타입 및 에러 코드 변경 (의도된 변경)
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts`, `rotateBotToken` 메서드 시그니처 (파라미터 3번째)
- 상세: `@Headers('x-workspace-id')` → `@WorkspaceId()` 데코레이터 교체로 workspaceId 부재 시 던지는 예외가 `UnauthorizedException(code='WORKSPACE_REQUIRED', 401)` 에서 `BadRequestException(code='WORKSPACE_ID_REQUIRED', 400)` 으로 변경된다. 이는 의도된 동작(spec §5.4 및 plan 문서에 명시)이지만, 이 엔드포인트를 호출하는 기존 클라이언트(프론트엔드, 외부 스크립트, e2e 등)가 `401 WORKSPACE_REQUIRED` 를 하드코딩하여 분기하고 있다면 런타임 동작이 바뀐다.
- 제안: 현재 변경은 의도적이며 spec 과 user-docs, plan 이 모두 동기화되어 있다. 추가 부작용 없음. 단, 외부 SDK나 클라이언트 코드에서 해당 에러코드를 switch/if 로 분기하는 위치가 있다면 별도 확인 권장.

### [INFO] `@WorkspaceId()` 데코레이터의 JWT fallback 경로 추가 — 기존 헤더 전용 동작에서 확장
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-cleanup-45ffef/codebase/backend/src/common/decorators/workspace.decorator.ts` line 14-15
- 상세: 이전에는 `X-Workspace-Id` 헤더만 확인했으나, 이제 `request.user?.workspaceId` (JWT 클레임) 도 fallback으로 사용한다. 이 동작은 `chat-channel.controller.ts` 뿐만 아니라 이 데코레이터를 이미 사용 중인 **다른 모든 컨트롤러**에도 동일하게 적용된다. 만약 다른 컨트롤러에서 JWT workspaceId 가 잘못된 값을 운반하는 상황이 있었다면, 이전에는 헤더 누락으로 `WORKSPACE_ID_REQUIRED` 를 던졌겠지만 이제 JWT 값으로 통과될 수 있다.
  - 단, 이 변경은 이번 diff 에 포함되어 있지 않다(`workspace.decorator.ts` 는 변경 파일 목록에 없음). 데코레이터가 이미 현재 상태(`request.user?.workspaceId` fallback 포함)로 존재한다고 가정하면, chat-channel.controller 에서 이 데코레이터를 채택하는 것 자체는 해당 fallback 동작을 이 endpoint 에 새로 적용하는 부작용이다.
- 제안: 수용 가능. JWT workspaceId fallback 은 공용 데코레이터의 canonical 동작이며, chat-channel 에서 이를 수용하지 않던 것이 버그였다(plan 문서 기재).

### [INFO] 테스트 커버리지 축소 — `UnauthorizedException` 경로 제거
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.controller.spec.ts`, 삭제된 테스트 케이스 (`실패 — X-Workspace-Id 미전달 시 UnauthorizedException`)
- 상세: 기존 테스트에서 `workspaceId=''` 를 직접 전달하여 `UnauthorizedException` 을 검증하던 케이스가 제거되었다. 테스트 파일 주석에 명시된 대로, 새 구조에서는 `@WorkspaceId()` 가 Nest 파라미터 파이프라인에서만 동작하여 직접 호출 단위테스트로는 검증이 불가하므로 `workspace.decorator.spec.ts` 에서 검증된다. 이 검증 책임 이관 자체는 의도된 것이나, `workspace.decorator.spec.ts` 가 실제로 `WORKSPACE_ID_REQUIRED` 경로를 충분히 커버하는지 별도 확인이 필요하다.
- 제안: `workspace.decorator.spec.ts` 존재가 확인되어 있으므로 실질적 부작용은 없다. 수용.

### [INFO] 공개 API 계약 변경 — `WORKSPACE_REQUIRED` (401) → `WORKSPACE_ID_REQUIRED` (400)
- 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` 및 `triggers.en.mdx`, `spec/5-system/15-chat-channel.md §5.4`
- 상세: user-docs 와 spec 의 에러코드 목록이 동기화되어 `WORKSPACE_REQUIRED` → `WORKSPACE_ID_REQUIRED`, HTTP status 401 → 400 으로 수정되었다. 이는 구현 변경과 일관된 문서 갱신이다. 단순 문서 부작용(렌더링 등)은 없다.
- 제안: 정상. 부작용 없음.

### [INFO] spec `botIdentity.teamId` 필드 추가 — 기존 DB 스키마와의 정합
- 위치: `spec/5-system/15-chat-channel.md §4.1` `botIdentity` JSON 예제
- 상세: `teamId` 필드가 `botIdentity` 오브젝트 예제에 추가되었다. spec 상의 변경이며 `optional` 로 표시되어 있다. 실제 DB JSONB 컬럼에는 이미 자유 필드가 허용되는 구조이므로 기존 row 에 영향이 없다.
- 제안: 영향 없음.

### [INFO] spec `EiaAiMessageEvent` → `EiaEvent` 명칭 정정 — 참조 명칭 변경
- 위치: `spec/5-system/15-chat-channel.md §8 (Rationale 섹션)` 변경 라인
- 상세: `CCH-MP-01` 보강 설명에서 `EiaAiMessageEvent` 가 `EiaEvent` 의 `execution.ai_message` variant 로 명칭이 정정되었다. spec 내 참조 표현 정합 목적이며 동작 변경 없음.
- 제안: 영향 없음.

### [INFO] plan 파일 추가 및 complete 이동 — 부작용 없음
- 위치: `plan/in-progress/chat-channel-workspace-code-unify.md` (신규), `plan/complete/code-node-isolated-vm.md` (신규 — complete/ 이동)
- 상세: plan 추적 파일 추가 및 완료 이동이다. 코드 동작에 영향이 없다.
- 제안: 영향 없음.

---

## 요약

이번 변경의 핵심 부작용은 `rotateBotToken` 엔드포인트에서 workspaceId 부재 시 반환하는 HTTP 상태코드(401→400)와 에러코드(`WORKSPACE_REQUIRED`→`WORKSPACE_ID_REQUIRED`)의 변경이다. 이는 의도된 변경이며 spec, user-docs, plan 이 모두 일관되게 동기화되어 있다. `@WorkspaceId()` 데코레이터 채택으로 JWT `workspaceId` fallback 이 이 엔드포인트에도 적용되는 사소한 동작 확장이 발생하지만, 이 또한 plan 문서에서 "JWT fallback 버그 동시 해소"로 명시된 의도된 개선이다. 전역 상태 변경, 파일시스템 부작용, 의도치 않은 네트워크 호출, 이벤트·콜백 변경, 환경 변수 읽기·쓰기 등의 부작용은 발견되지 않았다. 테스트 커버리지 축소는 검증 책임 이관(컨트롤러 단위 → 데코레이터 단위)으로 정당화된다.

## 위험도

LOW
