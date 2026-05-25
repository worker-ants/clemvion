# 보안(Security) 리뷰 — chat-channel-template-render-outbound

**검토 일시**: 2026-05-25  
**대상 파일**: 파일 1–13 (chat-channel dispatcher, renderer, types, 문서 파일)  
**검토자 역할**: 보안 전문 코드 리뷰어

---

## 발견사항

### [INFO] `nodeOutput` 의 `Record<string, unknown>` 을 렌더러로 그대로 전달 — 타입 경계 부재

- **위치**: `chat-channel.dispatcher.ts` `case 'execution.node.completed':` 블록 (라인 ~244)
- **상세**: `output = (p.output ?? {}) as Record<string, unknown>` 로 캐스트한 값을 검증 없이 `ChatChannelInternalEvent.output` 에 그대로 실어 보낸다. 이 `output` 은 이후 `renderPresentationByType` 내에서 `nodeOutput.rendered` (template), `nodeOutput.payload` (carousel/table/chart) 를 문자열로 추출해 채널 메시지 본문으로 사용된다. 실행 엔진이 신뢰 경계 안쪽(in-process)에서 emit 하는 구조이므로 외부 사용자 직접 인젝션 경로는 없다. 그러나 AI Agent 가 `render_template` 도구를 통해 생성한 임의 텍스트가 `output.rendered` 에 들어오므로, LLM 생성 콘텐츠가 채널 메시지 본문 그대로 전달된다는 사실을 설계상 가정으로 명확히 해두어야 한다.
- **제안**: 현 v1 fallback 정책(텍스트 평탄화)에서는 실질 인젝션 위험이 낮으나, 향후 v2 SSR/HTML 렌더링으로 격상 시 `output.rendered` 내 HTML/Markdown 내용이 XSS 또는 Markdown 인젝션 경로가 될 수 있다. 지금 단계에서 `rendered` 값의 최대 길이(예: DISCORD_TEXT_LIMIT 2000자) 상한 검사를 추가하고, 확장 시 새니타이징 포인트가 필요하다는 주석을 코드에 남길 것을 권장한다.

---

### [INFO] `chunkText(rendered)` 에서 Telegram MarkdownV2 escape 적용 여부 불명확

- **위치**: `telegram-message.renderer.ts` `renderPresentationByType` 함수 `case 'template':` 블록 (라인 ~843–853)
- **상세**: `case 'template'` 에서 추출한 `rendered` 문자열은 `renderText(rendered)` 로 전달된다. Telegram renderer 의 `renderText` 가 내부적으로 `escapeMarkdownV2` 를 호출하는지 여부가 diff 내에 표시되지 않았다. 만약 `renderText` 가 escape 없이 raw 텍스트를 그대로 사용한다면, AI 또는 템플릿 노드가 생성한 콘텐츠 중 `.`, `!`, `(`, `)` 등 MarkdownV2 특수 문자가 포함될 경우 Telegram API 오류 또는 의도치 않은 서식 적용이 발생할 수 있다. 단, 테스트 파일 `telegram-message.renderer.spec.ts` 의 `'가능해요\\.'` 케이스(라인 553)가 escape 가 적용됨을 간접 확인해주므로 실제 경로에서는 escape 가 이루어지는 것으로 보인다.
- **제안**: `renderText` 구현에서 `escapeMarkdownV2` 호출이 항상 이루어지는지 unit 테스트로 명시적으로 보장한다. 현재 스펙 테스트가 이를 검증하고 있으므로 추가 위험은 낮다.

---

### [INFO] Discord / Slack renderer 의 `chunkText(rendered)` — XSS/mrkdwn 인젝션 가능성 (v1 낮음, v2 주의)

- **위치**: `discord-message.renderer.ts` 및 `slack-message.renderer.ts` `renderPresentationByType` 함수 `case 'template':` (각각 라인 ~369–384, ~493–507)
- **상세**: Slack `chunkText` 는 mrkdwn 형식으로 전달되며, Discord 는 markdown 형식이다. 템플릿 노드의 `rendered` 콘텐츠가 `*bold*`, `~strike~`, `<@user>` 같은 Slack mrkdwn 특수 구문이나 Discord `@everyone`, `@here` 등을 포함하는 경우 v1 에서도 의도치 않은 멘션 또는 서식 발생이 가능하다. 특히 Discord `@everyone` 멘션이 포함된 템플릿 본문이 그대로 전달되면 채널 전체 알림을 유발할 수 있다. `escapeSlackMrkdwn` 함수는 `renderWaitingForInput` 경로에서는 사용되지만 `chunkText` 경로에서는 적용되지 않을 수 있다.
- **제안**: `renderPresentationByType` 의 `case 'template'` 에서 `chunkText` 에 넘기기 전 Discord 에는 멘션 escape(`@everyone`, `@here` → 비활성화 형태), Slack 에는 `escapeSlackMrkdwn` 적용을 고려한다. 최소한 `@everyone` / `@here` 포함 여부 검사를 추가할 것을 권장한다.

---

### [INFO] `_retry_state.json` 파일에 절대 경로 포함 (정보 노출)

- **위치**: `review/consistency/2026/05/25/16_53_45/_retry_state.json`, `review/consistency/2026/05/25/17_05_36/_retry_state.json`, `review/consistency/2026/05/25/17_13_11/_retry_state.json`
- **상세**: 리뷰 메타데이터 파일에 `/Volumes/project/private/clemvion/` 같은 로컬 파일 시스템 절대 경로가 그대로 저장되어 있다. 이 파일들이 공개 저장소나 공유 환경에 커밋될 경우 로컬 사용자 경로 구조 및 프로젝트 위치가 노출된다.
- **제안**: `_retry_state.json` 은 `.gitignore` 에 추가하거나, 경로를 저장소 루트 기준 상대 경로로 저장하는 방식으로 변경한다. 현재 이 파일들이 리뷰 산출물로서 `review/` 아래 체크인되는 설계라면, 절대 경로 대신 환경 변수 또는 상대 경로 형태를 사용하도록 내부 도구를 개선한다.

---

### [INFO] 하드코딩된 시크릿 없음 확인

- **위치**: 전체 diff 파일 1–13
- **상세**: API 키, 토큰, 비밀번호 등 하드코딩된 시크릿은 발견되지 않았다. 테스트 데이터에 사용된 문자열(`'trig-1'`, `'wf-1'` 등)은 기능 테스트용 픽스처로 민감 정보가 아니다.

---

### [INFO] 인증/인가 변경 없음 확인

- **위치**: 전체 diff 파일 1–13
- **상세**: 이번 변경은 이벤트 변환(dispatcher)과 렌더링(renderer) 레이어만 수정한다. 채널 메시지 전송의 인증(Telegram Bot Token, Discord Webhook URL, Slack API Token 등)은 기존 `ChatChannelAdapter.sendMessage` / `setup` 경로에서 처리되며, 이번 diff 에서 해당 경로에 변경이 없다. 인증/인가 우회 취약점은 관찰되지 않았다.

---

### [INFO] SQL/커맨드 인젝션 해당 없음

- **위치**: 전체 diff 파일 1–13
- **상세**: 이번 변경은 순수 이벤트-메시지 변환 로직으로, 데이터베이스 쿼리나 OS 커맨드 실행 경로가 없다. SQL/커맨드 인젝션 취약점 해당 없음.

---

## 요약

이번 변경(chat-channel template/presentation 노드 outbound 렌더링)은 보안 관점에서 전반적으로 위험 수준이 낮다. 신규 이벤트 구독 경로(`execution.node.completed`)는 in-process Subject 구독이므로 외부 사용자가 직접 이벤트를 조작할 수 없으며, 하드코딩된 시크릿이나 인증/인가 우회 취약점은 없다. 주요 주의 사항은 두 가지다. 첫째, AI Agent 또는 템플릿 노드가 생성한 임의 텍스트(`output.rendered`)가 채널 메시지 본문으로 전달되는 경로에서, Discord/Slack의 `@everyone`/`@here` 멘션이나 Slack mrkdwn 특수 구문이 escape 없이 그대로 전달될 가능성이 있다. 이는 현재 v1 텍스트 fallback 정책 하에서는 낮은 위험이지만 v2 SSR/HTML 격상 시 XSS 또는 멘션 인젝션 취약점으로 확대될 수 있다. 둘째, `_retry_state.json` 파일에 로컬 절대 경로가 포함되어 있어 저장소 공유 시 환경 정보가 노출된다. 나머지 발견사항은 모두 INFO 수준이며 즉각적인 차단이 필요한 취약점은 없다.

---

## 위험도

LOW
