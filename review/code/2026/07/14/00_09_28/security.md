# 보안(Security) 코드 리뷰

리뷰 대상: `plan eia-command-waiting-surface-guard` F-2 — chat-channel 표면 불일치(409 `STATE_MISMATCH`) 시 사용자 안내 발송 기능. 7개 파일(백엔드 구현 2 + 테스트 2 + 문서 2 + spec 1).

## 발견사항

- **[INFO]** 운영자 override(`languageHints.surfaceMismatch`)는 MarkdownV2-safety·placeholder 화이트리스트 검증 대상 밖
  - 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts` `resolveSurfaceMismatchMessage()` / `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` `LanguageHintsPlaceholderValidator` (`FAILURE_HINT_KEYS` = CCH-ERR-* 6 키 한정, `surfaceMismatch` 미포함, diff 범위 밖 기존 파일 확인)
  - 상세: `resolveSurfaceMismatchMessage`는 override 문자열을 그대로 `adapter.sendMessage`에 raw로 전달하며(`applyPlaceholders` 미호출, 렌더러 escape 미적용), DTO 레벨에서도 `surfaceMismatch` 키는 placeholder 화이트리스트·길이·MarkdownV2 안전성 검증을 받지 않는다(`sessionExpired`/`formOpenLabel` 등 기존 형제 키와 동일한 기존 아키텍처 패턴이라 이 PR이 새로 만든 갭은 아님). 운영자가 telegram MarkdownV2 특수문자(`. ! - ( ) [ ]` 등)를 포함한 override 를 설정하면 `adapter.sendMessage` 가 400 을 받아 안내 발송이 실패하고, `sendSurfaceMismatchNotice` 의 catch 가 이를 warn 로그로 swallow 한다 — 즉 CCH-ERR-04 "silently swallow 금지" 취지로 도입한 기능 자체가 운영자 설정 실수로 다시 조용히 실패할 수 있다. 익스플로잇 가능한 취약점은 아니며(공격자가 아니라 신뢰된 운영자의 자기 설정 문제), 기능적 신뢰성 이슈에 가깝다.
  - 제안: 필수는 아니나, `surfaceMismatch` override 에도 MarkdownV2 특수문자 검사(또는 최소 길이 제한)를 DTO validator 로 확장하면 CCH-ERR-04 대칭 목표를 더 견고히 지킬 수 있다. 보안 등급 상 차단 사유는 아님.

- **[INFO]** 신규 알림 경로도 기존 per-chat rate limit 범위 내에 있음을 확인 (정보성 — 문제 아님)
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `handleChatChannelWebhook` — `chatChannelRateLimiter.consume()` (기존 코드, diff 상단) → 이후 `forwardToInteractionService` → `sendSurfaceMismatchNotice`
  - 상세: 표면 불일치 상황을 의도적으로 반복 유발(예: form 대기 중 자유 텍스트 반복 발송)해 `adapter.sendMessage` 호출을 강제하는 저강도 소모성 트래픽 시나리오를 검토했으나, `parseUpdate` 직후 확정되는 CCH-NF-03 분당 rate-limit(기본 60/min, `rateLimitPerMinute` 트리거 설정) 검사가 이 forwarding 분기보다 먼저 실행되므로 신규 경로가 별도의 미제한 증폭 벡터를 열지 않는다.
  - 제안: 없음 (확인 목적의 기록).

- **[INFO]** 로그에 provider 에러 메시지·conversationKey 그대로 기록 (기존 파일 전반의 기존 패턴, 신규 아님)
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `sendSurfaceMismatchNotice` catch 블록 — `` `surfaceMismatch 안내 sendMessage 실패 (conversationKey=${update.conversationKey}): ${err instanceof Error ? err.message : String(err)}` ``
  - 상세: `err.message`(외부 provider SDK/HTTP 응답에서 유래) 와 `conversationKey`(telegram chat id 등)를 서버 로그에 그대로 남긴다. 동일 파일의 `maybeNotifyIgnored`/`sendExecutionStillRunningNotice`/`markChatChannelRateLimited` 등 기존 catch 블록과 동일한 관례이며, 이번 diff 가 새로 도입한 패턴이 아니다. 로그가 내부 접근 통제하에 있다는 전제하에 위험도는 낮음.
  - 제안: 없음 (기존 관례 일관성 확인 목적).

- **[INFO]** 테스트 파일의 더미 토큰/시크릿은 명백한 fixture 값
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts` — `SECRET_TOKEN = 'secret-token-abc'`, `SECRET_TOKEN_REF = 'secret://triggers/t1/inbound-signing'`, `'super-secret'`, `Bearer secret-xyz`, `Bearer xyz`, `iext_test` 등 (모두 diff 범위 밖 기존 테스트 fixture, 신규 테스트는 이를 재사용만 함)
  - 상세: 실제 크리덴셜 패턴(BotFather 토큰 형식 `\d{6,}:[A-Za-z0-9_-]{30,}`, JWT, AWS key 등)과 무관한 명백한 placeholder 문자열이며 `secret-store` mock 경로(`secret://...`)를 사용해 실제 시크릿이 커밋되지 않았음을 보여준다. 하드코딩된 시크릿 문제 아님.
  - 제안: 없음.

## 요약

이번 변경은 chat-channel inbound 명령이 대기 노드의 인터랙션 표면과 맞지 않아 409 `STATE_MISMATCH` 로 거부될 때, 종전에 로그만 남기던 것에서 사용자에게 best-effort 안내를 추가로 발송하는 기능이다. 안내 문구는 사용자 입력이 아닌 고정 default(KO/EN) 또는 운영자 config 값이며, 사용자가 보낸 원문 텍스트(`update.command.text`)는 안내 메시지에 전혀 반영되지 않으므로 인젝션 벡터가 없다. 발송 실패는 예외 없이 catch+warn 로 swallow 되어 webhook 재시도 루프를 유발하지 않으며, 신규 알림도 기존 CCH-NF-03 per-chat rate-limit 범위 안에 있어 별도의 증폭/DoS 벡터를 열지 않는다. 시크릿 하드코딩, 인증/인가 우회, SQL/XSS/커맨드 인젝션, 안전하지 않은 암호화, 민감정보 에러 노출 등 CRITICAL/WARNING 급 이슈는 발견되지 않았다. 유일한 관찰점은 `surfaceMismatch` 운영자 override 가 (형제 키들과 마찬가지로) MarkdownV2 안전성·placeholder 검증 대상 밖이라는 것인데, 이는 신뢰된 운영자의 자기 설정 실수로 인한 기능적 신뢰성 저하일 뿐 외부 공격자가 악용 가능한 보안 취약점은 아니다.

## 위험도

NONE
