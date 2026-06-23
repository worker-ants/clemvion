# Requirement Review — C-2 클러스터5 chat-channel↔triggers forwardRef 순환 해소

## 발견사항

### [WARNING] `rotateBotToken` 에 `@Roles('editor')` 누락

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/triggers/triggers.controller.ts` 라인 226–249
- 상세: `TriggersController` 의 모든 상태 변경 엔드포인트(`create`, `update`, `remove`, `rotateNotificationSecret`, `revokePerTriggerToken`)는 `@Roles('editor')` 가드를 선언하고 있다. 그러나 이번에 이전된 `rotateBotToken` (`POST /api/triggers/:id/chat-channel/rotate-bot-token`)에는 `@Roles('editor')`가 없다. 이전 `ChatChannelController` 도 동일하게 `@Roles('editor')`가 없었으므로 **기존에도 존재하던 버그**이나, `TriggersController` 이전 시 다른 mutation 엔드포인트와의 일관성을 고려해 추가할 기회가 있었다.
  - spec `15-chat-channel.md §5.4` 에러 표에는 `403 FORBIDDEN` 케이스가 정의되어 있지 않고, spec 이 editor 권한을 명시 요구하지는 않는다. 그러나 bot token 회전은 명백한 상태 변경 작업(보안 자원 변경)이며, 현재 뷰어 권한 사용자가 호출 가능하다.
  - 동일 패턴인 `rotateNotificationSecret`(HMAC secret 회전)은 `@Roles('editor')` 적용 중.
- 제안: `@Roles('editor')` + `@ApiForbiddenResponse` 를 추가해 다른 mutation 엔드포인트와 일관성 유지. spec에도 에러 표에 `403 FORBIDDEN` 케이스를 추가해야 하나 spec 수정은 `project-planner` 위임.

---

### [WARNING] `triggerId` 파라미터에 `ParseUUIDPipe` 누락

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/triggers/triggers.controller.ts` 라인 234 — `@Param('id') triggerId: string`
- 상세: `TriggersController` 의 모든 다른 엔드포인트는 `@Param('id', ParseUUIDPipe) id: string`으로 UUID 유효성을 파이프에서 검증한다. `rotateBotToken`만 `@Param('id') triggerId: string`으로 원형 문자열을 직접 받는다. 이는 기존 `ChatChannelController`에서도 동일하게 존재하던 상태였으나, 이전 시 수정 기회가 있었다. UUID 형식이 아닌 값이 들어오면 서비스 레이어에서 처리하게 되어 일관성이 낮다.
- 제안: `@Param('id', ParseUUIDPipe) triggerId: string`으로 변경. spec은 trigger id가 UUID임을 전제하므로 파이프 추가는 방어적이고 일관적인 처리다.

---

### [INFO] 테스트 커버리지 — `@Roles('editor')` 미적용 상태 테스트 없음

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/triggers/triggers.controller.spec.ts`
- 상세: 단위 테스트 4건은 기능 흐름(정상/BadRequest/에러 전파)을 잘 커버하고 있다. 그러나 403 권한 검사는 NestJS 가드 레이어에 있어 컨트롤러 단위 테스트 범위 밖이므로 현재 테스트 설계 자체의 결함은 아니다. e2e 레벨에서 viewer 권한으로 호출 시 403 반환 여부 테스트가 없음은 주목할 만하나 이번 리뷰 범위(behavior-preserving 이전)에서 요구되는 사항은 아님.

---

### [INFO] spec fidelity — spec 문서 경로·앵커 동기화 정확성 확인

- 위치: `spec/5-system/15-chat-channel.md` 라인 341, `spec/conventions/user-guide-evidence.md`, `spec/data-flow/0-overview.md` 라인 대응
- 상세: 커밋 메시지에서 언급된 spec-impl 앵커 동기화 항목들을 검토한 결과:
  - `15-chat-channel.md §5.4` 에러 표의 `INVALID_BOT_TOKEN` 링크 → `triggers.controller.ts` 로 갱신됨 (정확).
  - `15-chat-channel.md §7 file-tree`에서 `chat-channel.controller.ts`, `chat-channel-token-rotator.service.ts` 항목이 제거됨 (정확; 파일이 `triggers/` 로 이전).
  - `data-flow/0-overview.md §4` 큐 카탈로그 `chat-channel-token-rotator` 등록 모듈 → `chat-channel.module.ts`에서 `triggers.module.ts`로 갱신됨 (정확).
  - `user-guide-evidence.md` ImplAnchor `file` 속성 → `triggers.controller.ts`로 갱신됨 (정확).
  - `data-flow/14-chat-channel.md` 코드 진입점 경로 → `triggers/chat-channel-token-rotator.service.ts`로 갱신됨 (정확).
  - `impl-anchor-existence.test.ts` canonical 앵커 → `triggers.controller.ts`로 갱신됨 (정확).
  - 모든 경로 동기화가 코드 이동과 일치한다.

---

### [INFO] `newBotToken` 빈 문자열 처리 — 올바름

- 위치: 라인 238 — `if (!body?.newBotToken || typeof body?.newBotToken !== 'string')`
- 상세: `!body?.newBotToken`은 `undefined`, `null`, 빈 문자열(`""`) 모두를 거부한다. 빈 문자열 bot token이 허용되지 않아야 하므로 이 검증은 올바른 엣지 케이스 처리이다.

---

### [INFO] `ChatChannelTokenRotatorService` 에러 swallow 정책 — spec 일치 확인

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts` 라인 846–858
- 상세: `handleHourly()`에서 `cleanupRotatedChatChannelTokens` 예외를 삼키고(`catch` + warn 로깅) 재throw하지 않는다. 이는 `NotificationSecretRotatorService`와 동일한 패턴이며, spec CCH-SE-04-C가 매시간 반복 실행으로 재시도를 보장하므로 의도된 설계다. 테스트도 이를 명시적으로 검증한다.

---

## 요약

이 변경은 `chat-channel↔triggers` 양방향 forwardRef 순환을 해소하는 behavior-preserving 리팩터링이다. 핵심 기능인 `rotateBotToken` 엔드포인트 이전, `ChatChannelTokenRotatorService` 이전, 모듈 단방향화, spec/앵커 동기화 모두 의도한 기능을 올바르게 구현하고 있다. 단, `rotateBotToken`에 `@Roles('editor')` 가드와 `ParseUUIDPipe`가 누락되어 있는데, 이는 기존 `ChatChannelController`에서도 존재하던 상태를 그대로 이전한 결과이나 `TriggersController` 내 다른 mutation 엔드포인트와 일관성이 어긋난다. 두 항목 모두 보안/방어적 관점에서 수정이 권장된다. spec 자체는 해당 권한 요구를 명시하지 않아 spec 위반은 아니지만 동일 컨트롤러 패턴에 비해 불일치하다.

## 위험도

LOW

STATUS: SUCCESS
