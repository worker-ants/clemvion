# 보안(Security) 리뷰 결과

검토 대상: chat-channel-gaps (CCH-CV-03(b) + §5.4 rotate 응답 확장)
검토 파일: chat-channel.controller.ts/spec.ts, hooks.service.ts/spec.ts, triggers.service.ts/spec.ts, plan/in-progress/spec-sync-chat-channel-gaps.md, review/consistency SUMMARY

---

## 발견사항

### [INFO] 브래킷 인덱스 접근으로 private 리포지터리 우회
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` — `getActiveExecutionStatus` 메서드 (구 `isActiveExecution` 포함)
- 상세: `this.executionsService['executionRepository']` 와 같이 문자열 키로 private 멤버에 접근하는 패턴은 이전 구현에서부터 계속 유지되고 있다. 이번 변경 자체가 이 패턴을 도입한 것은 아니나, `isActiveExecution` → `getActiveExecutionStatus` 리팩터링으로 이 접근 패턴이 그대로 존속된다. TypeScript의 접근 제어를 우회하므로 내부 구현 변경 시 런타임 오류가 조용히 발생할 수 있다. 보안 직결 이슈는 아니나 의도치 않은 내부 상태 노출/불일치 위험이 있다.
- 제안: `ExecutionsService`에 `getExecutionStatus(executionId: string): Promise<ExecutionStatus | null>` 와 같은 공개 메서드를 추가하고 해당 경로를 사용한다. 이번 PR 범위를 벗어날 수 있으므로 후속 리팩터링 과제로 등록 권장.

### [INFO] 로거에 conversationKey 노출
- 위치: `hooks.service.ts` — `sendExecutionStillRunningNotice`, `maybeNotifyIgnored`, `reNoiseFormModal`, `handleFormStep` 등 다수의 `logger.warn` 호출
- 상세: `conversationKey` (채널 대화 식별자, 실제로는 Telegram chat_id / Slack channel_id 등 외부 식별자)가 warning 로그에 평문으로 기록된다. 이 패턴은 신규 추가된 `sendExecutionStillRunningNotice` 에도 동일하게 적용되었다. 운영 로그가 외부에 노출될 경우 채널 ID와 사용자 활동 패턴이 함께 누출될 수 있다.
- 제안: 로그에 conversationKey를 포함할 경우 앞 일부만(예: 처음 6자 + `***`) 마스킹하거나, `[REDACTED]` 처리를 권장한다. 단, 운영 가시성과의 트레이드오프가 있으므로 내부 정책에 따라 판단한다.

### [INFO] 에러 메시지 문자열이 외부 예외에서 직접 추출되어 로그에 기록
- 위치: `hooks.service.ts` — `sendExecutionStillRunningNotice` (신규), `maybeNotifyIgnored`, `reNoiseFormModal`, `handleFormStep`의 catch 블록
- 상세: `err instanceof Error ? err.message : String(err)` 패턴으로 외부 API(Telegram, Slack, Discord 등) 응답에서 파생된 에러 메시지를 로그에 그대로 기록한다. 외부 API 에러 응답에 토큰이나 민감한 설정값이 포함될 경우 로그에 유출될 수 있다. 이 패턴은 이번에 신규 추가된 `sendExecutionStillRunningNotice`에서도 동일하게 반복된다.
- 제안: 외부 API 호출 에러를 로그에 기록할 때 `err.message`를 그대로 사용하는 대신, 민감 정보(토큰, 인증 헤더 등)가 포함될 수 있는 응답을 필터링하거나, 에러 코드·상태코드 수준만 기록하는 것을 고려한다.

### [INFO] `newBotToken` 포맷 검증 부재
- 위치: `chat-channel.controller.ts` — `rotateBotToken` 메서드 (라인 227 부근)
- 상세: 현재 검증은 `!body?.newBotToken || typeof body?.newBotToken !== 'string'` 으로 존재 여부와 문자열 여부만 확인한다. Telegram bot token 형식(`<bot_id>:<token_string>`)에 대한 포맷 검증이 없어, 임의의 문자열이 downstream의 `TriggersService.rotateBotToken`으로 전달된다. 이번 변경(반환 타입 확장)과 직접 연관된 신규 취약점은 아니지만 기존부터 있던 검증 갭이다.
- 제안: 정규식(`/^\d+:[A-Za-z0-9_-]{35,}$/`)으로 최소한의 포맷 검증을 추가한다. 단, 실제 유효성은 Telegram API 호출에서 검증되므로 INFO 등급으로 분류.

### [INFO] `extractClientIp`의 X-Forwarded-For 헤더 신뢰
- 위치: `hooks.service.ts` — `extractClientIp` 함수 (라인 1738 부근)
- 상세: 이번 변경과 무관하나 리뷰 범위에 포함된 파일에 존재한다. CF-Connecting-IP가 없을 경우 `X-Forwarded-For`의 첫 번째 IP를 신뢰한다. Cloudflare를 반드시 통과하지 않는 경로로 직접 요청이 들어올 경우 X-Forwarded-For 스푸핑이 가능하다. `ip_whitelist` 검증에 사용되므로 인증 우회 위험이 있다.
- 제안: Cloudflare를 통한 요청만 허용하는 네트워크 레벨 제어(방화벽)가 있다면 INFO 수준으로 충분하다. 그렇지 않다면 WARNING으로 상향 고려. 인프라 구성에 따라 판단 필요.

### [INFO] `isSlackUrlVerification` 핸들러에서 `challenge` 값 무검증 반환
- 위치: `hooks.service.ts` — 라인 1085~1089 부근
- 상세: 이번 변경과 무관하나 리뷰 범위에 포함되어 있다. `challenge` 문자열을 Slack이 보낸 값 그대로 응답에 포함한다. 길이 제한 외의 내용 검증이 없어 이론상 응답 조작에 악용될 수 있으나, 이미 `verify()` (인바운드 서명 검증)를 통과한 뒤에만 도달하므로 실질 위험은 낮다.
- 제안: `challenge` 값에 대해 alphanumeric+하이픈 수준의 포맷 검증 추가를 고려. 현 구조상 낮은 위험.

---

## 요약

이번 변경(CCH-CV-03(b) `getActiveExecutionStatus` 도입 + §5.4 rotate-bot-token 응답 3필드 확장)은 보안 관점에서 새로운 취약점을 도입하지 않는다. 신규 추가된 `sendExecutionStillRunningNotice`는 기존 `maybeNotifyIgnored`와 동일한 패턴을 사용하며, 에러 로그에 외부 API 오류 메시지를 그대로 포함하는 INFO 수준의 정보 노출 패턴이 반복된다. `rotatedBotToken` 응답 확장(`triggerId`, `chatChannelHealth`, `botIdentity` 추가)은 내부 서비스 간 응답이며 외부로 직접 노출되지 않으므로 정보 과다 노출 위험이 없다. 기존 코드에서 이어지는 `executionRepository`의 bracket-access 패턴, X-Forwarded-For 신뢰, bot token 포맷 무검증 등은 이번 변경이 악화시키지는 않았으나 INFO 수준으로 기록한다.

---

## 위험도

LOW
