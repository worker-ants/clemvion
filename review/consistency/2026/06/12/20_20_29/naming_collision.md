### 발견사항

- **[WARNING]** spec/4-nodes/7-trigger/providers/telegram.md 의 `isActiveExecution` 참조가 구 메서드명
  - target 신규 식별자: `HooksService.getActiveExecutionStatus` (구 `isActiveExecution` boolean → status-aware 확장으로 대체)
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/spec/4-nodes/7-trigger/providers/telegram.md:190` — "사용자의 다음 메시지는 새 execution 으로 시작 (`isActiveExecution` 이 cancelled 를 비활성 판정 — CCH-CV-03 (c))"
  - 상세: `hooks.service.ts` 에서 `isActiveExecution` 은 `getActiveExecutionStatus` 로 대체되어 삭제됐다. `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts:128` 와 `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/hooks/hooks.service.spec.ts:585` 도 comment 로만 남아 있어 직접 호출은 없다. 그러나 `telegram.md:190` 의 표 행이 아직 `isActiveExecution` 이라는 구 이름을 코드 참조처럼 인용하고 있어 검토자 혼선이 발생한다.
  - 제안: `telegram.md:190` 의 해당 표 셀을 `getActiveExecutionStatus` 로 갱신하거나, 메서드명 대신 "비-terminal status null 반환" 설명으로 교체.

- **[INFO]** `executionStillRunning` languageHints 키가 `language-hint-defaults.ts` 에 상수·EN 기본값 없이 인라인 KO 하드코딩
  - target 신규 식별자: `executionStillRunning` (CCH-CV-03 (b) 안내 키)
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/hooks/hooks.service.ts:835` — `config.languageHints?.executionStillRunning ?? '워크플로우가 처리 중입니다\\. 잠시만 기다려 주세요\\.'`
  - 상세: 다른 안내 키(`SESSION_EXPIRED_DEFAULTS`, `FORM_OPEN_LABEL_DEFAULTS`, `DEFAULT_LANGUAGE_HINTS` 의 CCH-ERR-* 6 키)는 모두 `language-hint-defaults.ts` 에 KO/EN 쌍 상수로 추출되어 3-level lookup helper 를 거친다. `executionStillRunning` 만 `hooks.service.ts` 에 KO 인라인 default 로만 존재하며 EN default 가 없다. `spec/5-system/15-chat-channel.md §4.1.1` 에는 `executionStillRunning` 의 기존 5 키 군(EN 기본값 화 범위 밖)이라는 주석이 있어 의도적 결정으로 읽히나, EN locale 설정 사용자에게 KO 메시지가 나가는 동작은 다른 키와 일관성이 없다.
  - 제안: `language-hint-defaults.ts` 에 `EXECUTION_STILL_RUNNING_DEFAULTS: Record<LanguageLocale, string>` 상수와 `resolveExecutionStillRunningMessage` helper 를 추가하거나, spec §4.1.1 에 "EN 기본값 미제공 — KO fallback 고정" 정책을 명시적으로 기재해 의도적 예외임을 문서화.

- **[INFO]** `rotate-bot-token` 응답 신규 필드 3종 (`triggerId`, `chatChannelHealth`, `botIdentity`) — 명명 충돌 없음 확인
  - target 신규 식별자: `triggerId`, `chatChannelHealth`, `botIdentity` (성공 응답 필드)
  - 기존 사용처: `triggerId` 는 execution 응답·EIA payload 에서 trigger UUID 를 가리키는 동일 의미로 사용 (`spec/2-navigation/14-execution-history.md:431`, `spec/5-system/14-external-interaction-api.md:479`). `chatChannelHealth` 는 trigger 엔티티 필드 (`spec/2-navigation/2-trigger-list.md:113`) 와 동일 의미. `botIdentity` 는 `config.chatChannel.botIdentity` 캐시와 동일 스키마.
  - 상세: 세 필드 모두 기존 사용처와 의미가 일치하며, 다른 의미로 충돌하는 사용처 없음. `TriggerChatChannelHealth` 타입은 `trigger.entity.ts:29` 에 이미 정의되어 있고 `triggers.service.ts:869` 에서 정확히 재사용된다.
  - 제안: 충돌 없음, 변경 불필요.

### 요약

이번 변경(`spec/5-system/15-chat-channel.md` CCH-CV-03 구현 완료 갱신 + `triggers.service.ts` / `hooks.service.ts` / `chat-channel.controller.ts` 코드 수정)이 도입하는 신규 식별자 중 실질적 충돌은 없다. 가장 주목할 사항은 `isActiveExecution` → `getActiveExecutionStatus` 리네임이 코드에서는 완료됐으나 `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/spec/4-nodes/7-trigger/providers/telegram.md:190` 에 구 메서드명이 남아 있는 spec 참조 오류로, 검토자 혼선을 유발할 수 있어 WARNING 수준이다. `executionStillRunning` 키가 `language-hint-defaults.ts` 에서 EN default 없이 인라인으로만 관리되는 점은 다른 키와의 일관성 미흡이지만 spec §4.1.1 의 "기존 5 키" 범위 밖 주석이 의도적 결정을 암시하므로 INFO 수준이다.

### 위험도

LOW

STATUS: SUCCESS
