# 요구사항(Requirement) 리뷰

## 발견사항

### [INFO] [SPEC-DRIFT] `languageHints.executionStillRunning` 기본 문구 — spec 예시가 plain text, 코드는 MarkdownV2 pre-escaped
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/hooks/hooks.service.ts` (sendExecutionStillRunningNotice, ~L1365)
- 상세: spec/5-system/15-chat-channel.md §4.1 `languageHints` 예시 (line 220) 는 `"워크플로우가 처리 중입니다. 잠시만 기다려 주세요."` (plain text) 를 기재하고 있고, CCH-CV-03 행 (line 67) 의 default 문구 설명도 이와 동일하다. 코드는 `'워크플로우가 처리 중입니다\\. 잠시만 기다려 주세요\\.'` (`.` → `\.` MarkdownV2 pre-escape) 를 사용한다. 이는 `maybeNotifyIgnored` · `/help` 핸들러 등 동일 파일의 다른 default 문구들과 일관성이 있으며 Telegram MarkdownV2 출력을 위해 의도적으로 pre-escape 한 것이다. 코드 동작은 옳고 spec 예시가 아직 pre-escape 표기를 반영하지 않은 상태.
- 제안: 코드 유지. `spec/5-system/15-chat-channel.md §4.1` languageHints 예시 행 (`executionStillRunning` 값) 에 MarkdownV2 pre-escape 주석을 추가하거나 CCH-CV-03 default 문구 서술에 "MarkdownV2 send 경로이므로 실제 코드 기본값은 `.` 를 `\\.` 로 pre-escape" 를 명시. spec 갱신은 `project-planner` 위임.

### [INFO] `button_callback` 이 CCH-CV-03 (b) 분기에 포함됨 — spec 명시적 언급 없음
- 위치: `hooks.service.ts` L507–518
- 상세: CCH-CV-03 (b) 분기 (`activeStatus !== WAITING_FOR_INPUT` 이면 안내 + ignored) 가 적용되는 command kind 목록에 `button_callback` 이 포함되어 있다. spec CCH-CV-03 행의 (b) 설명은 "채널에 … 안내 메시지 발송 + update 무시"라고만 기술하며 분기 진입 조건이 적용되는 command kind 를 명시적으로 열거하지 않는다. `button_callback` 이 running 중 도달했을 때 `executionStillRunning` 안내를 발송하는 것은 스펙 정신과 일치하나 spec 본문에 command kind 매트릭스가 없다. 코드 구현이 합리적이며 되돌리는 것이 오답인 경우이므로 SPEC-DRIFT 로 분류.
- 제안: 코드 유지. spec CCH-CV-03 (b) 행에 "(b) 분기가 적용되는 command kind = `text_message`, `button_callback`, `contact_share`, `file_upload` — `open_form_modal`·`form_submission` 은 별도 분기 처리"를 명시. spec 갱신은 `project-planner` 위임.

### [INFO] `getActiveExecutionStatus` 에서 `executionsService['executionRepository']` private 필드 접근 — 기존 패턴 유지
- 위치: `hooks.service.ts` L1338–1343
- 상세: `this.executionsService['executionRepository']` 는 TypeScript bracket notation 으로 private 필드에 접근한다. 이 패턴은 이번 변경에서 신규 도입된 것이 아니라 기존 `isActiveExecution` 로부터 승계된 것이며, 해당 repository 메서드를 공개 API 로 추출하지 않은 설계 결정의 연속이다. 기능 완전성에는 문제 없고 test 에서도 해당 패턴으로 mock 이 구성된다.
- 제안: 없음 (기존 기술 부채 유지, 별도 리팩터링 이슈).

### [INFO] CCH-NF-03 (rate-limit enforcement) 잔여 미구현 — plan 에 명시됨
- 위치: `plan/in-progress/spec-sync-chat-channel-gaps.md` 체크박스
- 상세: `rateLimitPerMinute` 분당 enforcement / chat 단위 큐 / 폭주 시 `chat_channel_health=degraded` 갱신 로직은 본 PR 범위에서 명시적으로 제외("잔여 — 별 PR")되어 있다. spec `CCH-NF-03` 행에도 "미구현 (Planned)" 으로 유지됨. plan 의 scope 결정과 일치하며 이번 변경에서 CCH-NF-03 관련 코드 변경은 없다.
- 제안: 없음 (후속 PR 에서 처리 예정, plan 상태 정상).

---

## 요약

4개 변경 파일(hooks.service.ts / hooks.service.spec.ts / triggers.service.ts / triggers.service.spec.ts / chat-channel.controller.ts / chat-channel.controller.spec.ts)은 두 요구사항을 완전히 구현하고 있다. CCH-CV-03 (b) 분기는 `isActiveExecution` 을 `getActiveExecutionStatus` 로 확장해 `running`/`pending` 상태를 `waiting_for_input` 과 정확히 구분하며, `sendExecutionStillRunningNotice` 가 채널 안내를 best-effort 발송(실패 시 throw 없이 warn + 무시)하고 `{ executionId: 'ignored' }` 로 단락한다. DB 예외 시 null(비활성) 로 처리해 새 execution 을 시작하는 failsafe 동작, `sendMessage` 실패 시 ignored 반환 동작이 테스트로 검증된다. §5.4 `rotateBotToken` 반환 타입은 `triggerId` / `chatChannelHealth` / `botIdentity` 3필드로 확장되고 controller 반환 타입도 서비스 타입에 연동된다. spec/5-system/15-chat-channel.md 의 CCH-CV-03 행과 §5.4 성공 응답 예시는 동일 커밋에서 갱신되었다. CRITICAL/WARNING 수준의 요구사항 미충족이나 spec 위반은 없으며, 발견사항은 모두 INFO(spec 예시 unescaped 표기, command kind 매트릭스 미명시, 기존 private 필드 접근 패턴 유지)이다.

## 위험도

NONE
