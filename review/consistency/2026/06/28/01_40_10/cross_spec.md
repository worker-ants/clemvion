# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (구현 완료 후)
대상 영역: `spec/7-channel-web-chat/`
검토 기준 브랜치: `origin/main`
worktree: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-usewidget-split-5e9d26`

---

## 발견사항

### CRITICAL/WARNING 0건

이번 변경 세트(`webchat-usewidget-split`)는 **순수 코드 내부 리팩토링**이다. `use-widget.ts`의 토큰 갱신 로직과 보류 메시지 큐 로직을 각각 `use-token-refresh.ts` / `use-pending-message-queue.ts` 로 분리하는 것이 전부이며, `spec/7-channel-web-chat/` 6문서의 내용은 변경되지 않았다. 다른 `spec/**` 영역과의 직접 모순 또는 잠재 충돌은 발견되지 않았다.

---

### [INFO] `3-auth-session.md` frontmatter `code:` — 신규 훅 파일 2건 미포함

- target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-usewidget-split-5e9d26/spec/7-channel-web-chat/3-auth-session.md` frontmatter `code:` 목록
- 충돌 대상: 신규 파일 `codebase/channel-web-chat/src/widget/use-token-refresh.ts` · `use-pending-message-queue.ts`
- 상세: `3-auth-session.md` frontmatter 의 `code:` 에는 기존 `use-widget.ts` 가 등록돼 있다. 이번 리팩토링으로 토큰 갱신 책임(`TOKEN_REFRESH_LEAD_MS`, `refreshDelayMs`, `useTokenRefresh`)이 `use-token-refresh.ts` 로 이동했고, 보류 메시지 큐(`usePendingMessageQueue`)는 `use-pending-message-queue.ts` 로 분리됐다. `3-auth-session.md §3 step7` 의 "토큰 갱신" 계약의 코드 증거는 이제 `use-token-refresh.ts` 가 SoT 이다. frontmatter 에 누락되어도 기능·계약 충돌은 없으나 spec-impl-evidence 동기화 불완전.
- 제안: `3-auth-session.md` frontmatter `code:` 에 `codebase/channel-web-chat/src/widget/use-token-refresh.ts` 추가 권장. `use-pending-message-queue.ts` 는 C1(§R6) 큐 게이팅 구현으로 `1-widget-app.md` frontmatter 대상이 더 적합하나, 현재 `1-widget-app.md` 는 `codebase/channel-web-chat/**` glob 으로 포괄하므로 즉시 누락은 아니다. 비차단.

### [INFO] `use-widget.ts` 의 하위호환 re-export — spec 미언급이나 계약 충돌 없음

- target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-usewidget-split-5e9d26/codebase/channel-web-chat/src/widget/use-widget.ts` 상단 re-export 선언
- 충돌 대상: `spec/7-channel-web-chat/3-auth-session.md`
- 상세: `use-widget.ts` 가 `refreshDelayMs`·`TOKEN_REFRESH_LEAD_MS`·`TOKEN_REFRESH_MIN_DELAY_MS` 를 `use-token-refresh.ts` 에서 re-export 해 기존 import 경로를 보호한다. spec 에서 이 상수들의 구현 파일 위치를 규정하지 않으므로 계약 충돌 없음. 동작 동일성은 유지된다.
- 제안: 현 상태 유지. 비차단.

---

## 요약

`spec/7-channel-web-chat/` 전 영역 및 관련 cross-cutting spec(`1-data-model`, `5-system/14-external-interaction-api`, `5-system/12-webhook`, `2-navigation/9-user-profile`)을 대상으로 교차 검토한 결과, CRITICAL·WARNING 수준의 충돌은 발견되지 않았다. 이번 변경은 `use-widget.ts` God hook 을 세 파일로 분리하는 순수 코드 리팩토링이며, 데이터 모델(`Workspace.settings.interactionAllowedOrigins`)·API 계약(EIA endpoint·SSE wire 형식·terminal 이벤트)·RBAC(`viewer`+/`editor`+)·계층 책임(위젯 = EIA client-side consumer) 어느 축에서도 기존 spec 과의 모순이 없다. spec 문서는 변경되지 않았고, 모든 동작 규약(토큰 갱신 30분 lead · C1 큐 게이팅 · buttons/form 폐기)은 spec 기술대로 동일하게 유지된다. INFO 2건(frontmatter 동기화 권장·re-export 확인)은 비차단이다.

## 위험도

NONE
