# 요구사항(Requirement) Review — chat-channel WorkspaceId 통일

## 발견사항

### [INFO] [SPEC-DRIFT] spec/5-system/15-chat-channel.md §5.4 — 라인 레퍼런스 낡음
- 위치: `spec/5-system/15-chat-channel.md` line 339 (worktree 기준)
- 상세: 스펙 §5.4 실패 응답 표에서 `INVALID_BOT_TOKEN` 행의 라인 참조가 `chat-channel.controller.ts:52` 로 기재되어 있다. 현재 컨트롤러에서 `code: 'INVALID_BOT_TOKEN'` 은 line 52, `throw new BadRequestException` 은 line 51 이다. 코드 구조 변경(6줄 삭제) 이후에도 행 번호가 유지되어 정합하나, 향후 파일 변경 시 드리프트 가능성이 있어 INFO 수준으로 기록한다.
- 제안: 코드 유지. spec 의 라인 번호 앵커는 향후 정기 업데이트 대상.

### [INFO] 삭제된 테스트 커버리지 — UnauthorizedException 케이스
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.controller.spec.ts` (삭제된 diff hunk)
- 상세: "X-Workspace-Id 미전달 시 UnauthorizedException" 테스트가 제거되었다. 제거 이유는 `@WorkspaceId()` 데코레이터가 NestJS param 파이프라인에서 실행되어 컨트롤러 직접 호출 단위테스트로는 검증 불가능하기 때문이다. 해당 케이스의 커버리지는 `workspace.decorator.spec.ts` 의 "should throw BadRequestException when no workspace ID is available" 등 6개 테스트로 이관되어 있음을 확인하였다. 커버리지 공백 없음.
- 제안: 현 상태 유지.

### [INFO] spec/5-system/15-chat-channel.md §5.4 `WORKSPACE_ID_REQUIRED` 업데이트 완료 확인
- 위치: worktree `spec/5-system/15-chat-channel.md` line 341
- 상세: diff(파일 7)가 가리키는 spec 변경(`401 WORKSPACE_REQUIRED` → `400 WORKSPACE_ID_REQUIRED`)이 worktree 파일에 반영되어 있음을 grep 으로 확인하였다. 코드(`workspace.decorator.ts` — `BadRequestException`, code `WORKSPACE_ID_REQUIRED`)·spec·user-docs(triggers.mdx / triggers.en.mdx) 세 곳이 모두 일치한다. 정합성 PASS.

---

## 개별 점검 관점 결과

### 1. 기능 완전성
- `@WorkspaceId()` 데코레이터는 `X-Workspace-Id` 헤더 우선, 없으면 JWT `workspaceId` fallback 으로 workspace ID 를 추출하며 부재 시 `BadRequestException({ code: 'WORKSPACE_ID_REQUIRED' })` 를 발행한다. 컨트롤러가 이를 세 번째 파라미터로 받아 `TriggersService.rotateBotToken(triggerId, workspaceId, body.newBotToken)` 에 위임한다. 기능 흐름 완전.

### 2. 엣지 케이스
- `body.newBotToken` 이 `null`, `undefined`, 비-string(숫자 등) 인 경우 모두 `!body?.newBotToken || typeof body.newBotToken !== 'string'` 조건으로 포착되어 `INVALID_BOT_TOKEN` 400 반환. 테스트에도 비-string 케이스(`123 as unknown as string`) 포함 확인.
- workspace ID 누락: 데코레이터가 담당. `workspace.decorator.spec.ts` 에서 header 없음, user undefined, user null, JWT 없음 등 다변 경우 커버.

### 3. TODO/FIXME
- 없음. 제거.

### 4. 의도와 구현 간 괴리
- JSDoc 코멘트와 구현 일치. "본 controller 는 input validation 만 처리. workspaceId 는 공용 `@WorkspaceId()` 데코레이터가 … 해석·검증 (부재 시 `WORKSPACE_ID_REQUIRED` 400)" 이 정확히 구현을 반영.

### 5. 에러 시나리오
- `newBotToken` 누락/비-string → `INVALID_BOT_TOKEN` 400
- workspace ID 부재 → `WORKSPACE_ID_REQUIRED` 400 (데코레이터 발행)
- `TriggersService.rotateBotToken` throw → 그대로 전파 (테스트 "TriggersService 가 throw 하면 그대로 전파" 확인)

### 6. 데이터 유효성
- `body?.newBotToken` optional chaining + truthy + 타입 체크 조합. `{}`(비어있는 body), `{ newBotToken: '' }`(빈 문자열), `{ newBotToken: 123 }`(숫자) 모두 `INVALID_BOT_TOKEN` 처리됨. 테스트 케이스 "실패 — newBotToken 미전달" 및 "실패 — newBotToken 이 비문자열" 로 커버.

### 7. 비즈니스 로직
- CCH-SE-04 "Bot token rotation API" 요구사항: workspaceId 기반 권한 위임(서비스 계층), 6단계 오케스트레이션 위임 — 모두 컨트롤러 책임 범위 밖 `TriggersService` 에 위임되어 올바르게 분리.
- JWT fallback 누락 버그 해소: 기존 수동 `@Headers('x-workspace-id')` 는 JWT workspaceId fallback 이 없었으나, `@WorkspaceId()` 데코레이터 전환으로 정상 해소.

### 8. 반환값
- 성공 경로: `this.triggersService.rotateBotToken(...)` 결과(`{ rotatedAt: string }`)를 그대로 반환. 모든 경로에서 반환 또는 throw 가 명확히 정의됨.

### 9. Spec Fidelity
- **spec/5-system/15-chat-channel.md §5.4** (worktree): line 341 이 `| 400 | WORKSPACE_ID_REQUIRED | … 공용 @WorkspaceId() 데코레이터 …` 로 업데이트되어 코드와 일치.
- **spec/5-system/3-error-handling.md §1.3** line 47: `WORKSPACE_ID_REQUIRED` — 400, `common/decorators/workspace.decorator.ts` 발행 — 코드와 일치.
- **user-docs triggers.mdx / triggers.en.mdx**: 에러코드 목록 `WORKSPACE_ID_REQUIRED` 로 업데이트 확인.
- 구코드가 사용하던 `WORKSPACE_REQUIRED` / `401 UnauthorizedException` 는 `3-error-handling.md` 에 정의된 코드가 아니었으며(`WORKSPACE_ID_REQUIRED` 만 §1.3 에 있음), 이번 변경으로 canonical 코드 체계에 합류.

---

## 요약

이번 변경은 `chat-channel.controller.ts` 의 workspaceId 추출 방식을 수동 헤더 읽기(`@Headers('x-workspace-id')` + `UnauthorizedException WORKSPACE_REQUIRED 401`)에서 공용 `@WorkspaceId()` 데코레이터(`BadRequestException WORKSPACE_ID_REQUIRED 400`)로 교체하여 canonical 에러 코드 체계와 JWT fallback 기능을 동시에 확보한다. spec(`15-chat-channel.md §5.4`), user-docs(ko/en), 테스트(불가 케이스 제거 + 데코레이터 spec 으로 이관)가 모두 일관되게 업데이트되었다. 기능 완전성·엣지 케이스·비즈니스 로직·반환값 관점에서 누락이나 결함이 없다. spec fidelity 는 세 층(spec/code/user-docs)이 정합 상태.

---

## 위험도

NONE
