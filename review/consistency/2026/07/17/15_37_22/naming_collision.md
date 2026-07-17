# 신규 식별자 충돌 검토 — spec/7-channel-web-chat/

검토 모드: `--impl-done` (scope=`spec/7-channel-web-chat/`, diff-base=`origin/main`)
검증 SoT: HEAD 워킹트리 절대경로 `/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003` (git 명령·Read 모두 이 경로 기준으로 재확인).

## 0. 실제 diff 범위 확인 (선행)

`git diff origin/main..HEAD -- spec/7-channel-web-chat/` 로 실측한 결과, 이번 라운드의 실제 변경은
**`1-widget-app.md` 1개 파일 13행 추가·3행 삭제**뿐이다(0/2/3/4/5-*.md, `_product-overview.md` 는 origin/main
과 동일). 변경 내용은 `execution.replay_unavailable` SSE 이벤트의 위젯 소비 배선이 "리스너 등록만 됨(no-op)"
에서 "서버 emit·리스너·소비 분기 모두 구현됨"으로 서술을 갱신하고, 스냅샷이 이미 terminal 인 경우의 처리
(세션 정리 + `[ended]` + host `conversationEnded` 통지)를 명문화한 것이다. 이 diff 가 사용하는 모든 식별자
(`execution.replay_unavailable`, `handleEiaEvent`, `seedWaitingFromStatus`, `conversationEnded`,
`EIA §Rationale R-replay-unavailable`, `use-widget-eager-start.test.ts` 의 두 테스트 제목)는 **모두 기존에
이미 존재/구현된 이름을 재사용**한 것으로 실측 확인됐다(`codebase/channel-web-chat/src/widget/use-widget.ts`,
`spec/5-system/14-external-interaction-api.md:1247`). 즉 **이번 diff 자체는 신규 식별자를 도입하지 않는다** —
diff 관점에서는 신규 식별자 충돌 위험이 없다.

아래는 diff 뿐 아니라 prompt 에 전문이 포함된 `spec/7-channel-web-chat/` 영역 전체(0~5 + `_product-overview.md`,
status 모두 `implemented`)를 대상으로 6개 점검 관점을 코드베이스 실측(`git -C <worktree> grep`, `Read`)으로
재검증한 결과다 — 과거 라운드에서 도입된 식별자가 이번에도 여전히 충돌 없이 유지되는지 확인하는 목적.

## 1. 요구사항 ID 충돌

- `id:` frontmatter — `web-chat-architecture`/`web-chat-widget-app`/`web-chat-sdk`/`web-chat-auth-session`/
  `web-chat-security`/`web-chat-admin-console` 6개 전수 확인, `spec/` 전역에서 유일(중복 없음). `4-security.md`
  는 basename 이 다른 영역과 겹칠 잠재 위험을 이미 자체 인지하고 `id:` 를 `web-chat-security` 로 분리해뒀고,
  실측 결과 현재 저장소에 다른 `4-security.md` 파일 자체가 없어 실질 충돌은 없음(§4 참고).
- `NAV-WC-01`~`NAV-WC-06` — 정의처는 `spec/2-navigation/_product-overview.md` 1곳뿐이고
  `5-admin-console.md`·`0-overview.md` 는 참조만 한다. 전역 `NAV-*` ID 재검사 결과 중복 없음.
- `spec/7-channel-web-chat/*.md` 가 인용하는 `EIA-*`(RL-07/NF-03/IN-02/IN-12/AU-04)·`WH-*`(SC-01/SC-05/SC-09/EP-02/NF-02)
  ID 는 전부 `14-external-interaction-api.md`/`12-webhook.md` 에 정의된 기존 ID 를 참조만 하며, channel-web-chat
  이 자체 `WC-XX-NN` 스킴을 새로 발행하지 않음(패턴 검색 0건) — 요구사항 ID 네임스페이스 오염 없음.
- `GET /api/hooks/:endpointPath/embed-config` 신설로 인한 "POST 전용" 규약(WH 관례) 예외는
  `12-webhook.md:437`(본문 SoT)에서도 명시적으로 "본 SoT 의 스코프 밖" 예외로 상호 인용돼 있어, 규약 ID 충돌이
  아니라 **양방향 cross-ref 로 합의된 예외**임을 확인.

## 2. 엔티티/타입명 충돌

`ChatInstance`/`BootConfig`/`WidgetEvent`/`Unsubscribe`(2-sdk.md), `EmbedConfigDto`/`EmbedConfigService`
(4-security.md), `WebChatAppearanceDto`(5-admin-console.md), `PublicWebhookThrottleGuard`/
`PublicWebhookQuotaService`/`UNIDENTIFIED_IP_BUCKET`(4-security.md), `WebChatIdleReaperService`(EIA-RL-07 인용),
`GENERIC_ERROR_MESSAGE` 를 `codebase/` 전수 검색(`grep -rn`, `dist/`·`node_modules/` 제외)한 결과 각각
정의처 1곳 + 소비처만 있고, 다른 도메인에 동명이의로 쓰이는 사례 없음. 예: `*Guard`/`*RateLimit*`/`*Quota*`/
`*Reaper*` 클래스 전수 나열 결과 `InteractionRateLimitGuard`(EIA)·`ChatChannelRateLimiterService`(Chat Channel)·
`WsRateLimiterService`(WS)·`UserThrottlerGuard`(일반 API) 등은 모두 도메인 접두어로 구분되어 있고
`PublicWebhookThrottleGuard`/`PublicWebhookQuotaService`/`WebChatIdleReaperService` 와 이름이 겹치지 않음.

## 3. API endpoint 충돌

`GET /api/hooks/:endpointPath/embed-config`, `POST /api/hooks/:path`, `GET/POST /api/external/executions/:id/*`,
`PATCH /api/workspaces/:id/settings`, `POST/PATCH/DELETE/GET /api/triggers[/:id[/history]]` 를 확인한 결과
전부 기존 EIA/webhook/trigger 표면을 **재사용**하고 있고, channel-web-chat 이 동일 path 를 다른 의미로
재정의하는 사례는 없음. `embed-config` sub-route 는 §1 에 기술한 대로 webhook spec 본문에 예외로 상호 등재돼
있어 향후 다른 sub-route 추가 시 "POST 전용" 규약과 충돌할 위험까지 미리 문서화됨.

## 4. 이벤트/메시지명 충돌

- postMessage `wc:*` prefix(`wc:boot`/`wc:command`/`wc:ready`/`wc:resize`/`wc:event`) — `codebase/` 전수 검색
  결과 channel-web-chat/web-chat-sdk 외부에서 `'wc:` 로 시작하는 message-type 사용 0건. 다른 채널(OAuth popup 등)과
  겹치지 않음을 코드 레벨로 확인(문서가 스스로 "타 채널·OAuth popup 메시지와 혼용 방지"라고 밝힌 의도가 실측과 일치).
- `ChatInstance.on(event)` 의 `open`/`close`/`message`/`unread`/`conversationStarted`/`conversationEnded` —
  `spec/` 전역에서 동명 이벤트가 다른 의미로 정의된 곳 없음.
- SSE `execution.*`(`waiting_for_input`/`ai_message`/`message`/`replay_unavailable`/`completed`/`failed`/`cancelled`)
  는 전부 EIA 가 SoT 로 정의한 기존 이벤트를 channel-web-chat 이 소비만 하는 구조 — 신규 발행이 아님.

## 5. 환경변수·설정키 충돌

- `WEB_CHAT_WIDGET_ORIGINS`(backend) — `codebase/backend/.env.example:44`, `main.ts:203`,
  `common/cors/web-chat-cors.ts` 에서 일관되게 정의·소비. 다른 CORS 관련 env(`CORS_ORIGINS`/`FRONTEND_URL`) 와
  분리된 별도 키로, 기존 키를 오버로드하지 않음.
- `NEXT_PUBLIC_WIDGET_CDN_BASE`(frontend) — `codebase/frontend/.env.example:53`,
  `src/lib/web-chat/widget-base.ts` 에서 정의·소비. `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WEBHOOK_BASE_URL` 과
  별도 키(R4 에서 의도적으로 분리한 이유까지 명문화돼 있음).
- `Workspace.settings.interactionAllowedOrigins` — `spec/1-data-model.md:95` 에 정의된 **기존** 키를
  EIA CORS(§8.5)와 channel-web-chat 임베드 allowlist(§3)가 "단일 진실 원칙"으로 **의도적으로 공유**한다.
  새 키를 만들지 않고 기존 키를 재사용한 것이므로 충돌이 아니라 올바른 통합 사례.

## 6. 파일 경로 충돌

- `spec/7-channel-web-chat/{0-5}.md` 넘버링 — `spec/` 최상위 디렉터리 목록(`2-navigation`/`3-workflow-editor`/
  `4-nodes`/`5-system`/`data-flow`/`conventions`) 및 최상위 파일(`0-overview.md`/`1-data-model.md`/`6-brand.md`)
  실측 결과 `7-` 접두는 유일하며, R3 rationale 의 "7 은 2~5 다음 자리" 서술도 (6 은 폴더가 아니라 파일이라는 점까지)
  정확함.
- 코드 경로(`codebase/channel-web-chat/**`, `codebase/packages/web-chat-sdk/**`,
  `codebase/backend/src/modules/hooks/embed-config*`, `codebase/backend/src/modules/web-chat-cors/**`,
  `codebase/backend/src/modules/triggers/dto/web-chat-appearance.dto.ts`,
  `codebase/frontend/src/{app/(main)/w/[slug]/web-chat,components/web-chat,lib/web-chat}/**`) 전부 실제
  존재하며 다른 영역과 경로가 겹치지 않음. 사이드바 라우트 `/web-chat`(순서 5)도 `_layout.md §2.2` 표에서
  `/dashboard`~`/docs` 12개 항목과 경로·순서 중복 없이 유일.

## 발견사항

- **[INFO]** 짧은 라벨 `M1`/`M2` 가 서로 무관한 두 spec 문서에서 재사용됨
  - target 신규 식별자: `spec/7-channel-web-chat/0-architecture.md §5`(및 `2-sdk.md`·`4-security.md`·
    `5-admin-console.md`·`2-navigation/_product-overview.md` NAV-WC-06)의 **`M1`(Hosted iframe, 주력) /
    `M2`(BYO-UI/headless)** — 위젯 사용 모드를 가리키는 공식 레이블로, 여러 문서에 걸쳐 반복 인용됨.
  - 기존 사용처: `spec/5-system/17-agent-memory.md:82,190`, `spec/data-flow/13-agent-memory.md:65,116` 의
    괄호 각주 `(M1)`/`(M2)` — Agent Memory 도메인에서 "enqueue-acceptance 반환 계약" 등 특정 결정을 가리키는
    지역 각주 표기.
  - 상세: 두 용법 모두 `spec/` 전역 검색(`grep -n "\bM1\b\|\bM2\b"`)에 걸리는 동일 토큰이다. 다만 channel-web-chat
    의 M1/M2 는 여러 문서에서 교차 인용되는 **공식 명명 레이블**인 반면, agent-memory 의 M1/M2 는 해당 문단
    내부에만 쓰이는 **지역 각주**이고 두 도메인 간 상호 참조가 전혀 없어 실제 독자가 혼동할 가능성은 낮다.
    다만 "M1"/"M2" 같은 2자 토큰은 전역 검색(grep) 기반 도구·문서 내비게이션에서 우연히 같이 걸릴 수 있다.
  - 제안: 실질 위험은 낮으므로 channel-web-chat 쪽 변경은 불필요. 다만 agent-memory 문서를 차후 손볼 기회가
    있으면 그 지역 각주를 `(결정 M1)`처럼 자기 문서 스코프임을 명시하거나 별도 표기(`§주1` 등)로 바꿔 전역
    토큰 재사용을 줄이는 것을 권장(본 target 의 결함은 아님).

- **[INFO]** `id:` frontmatter 의 basename-충돌 방지 주석은 ad hoc — 컨벤션 문서로 승격되지 않음
  - target 신규 식별자: `spec/7-channel-web-chat/4-security.md:2`의
    `id: web-chat-security  # basename \`4-security\` 와 의도적으로 다름 — 타 영역의 \`4-security\` 슬러그와
    충돌 방지 (영역 prefix \`web-chat-\` 로 전역 유일)`.
  - 기존 사용처: 없음 — 현재 저장소에 다른 `4-security.md` 가 없어 이번엔 실질 충돌이 없지만(§1 확인), 이
    "영역 prefix 로 id 를 유일하게 만든다"는 규칙 자체는 `spec/conventions/` 어디에도 명문화돼 있지 않다
    (frontmatter `id:` 명명 규칙을 다루는 convention 문서 부재를 확인).
  - 상세: 이 자체 방어는 잘 되어 있으나, 규칙이 이 문서의 주석 한 줄로만 존재해서 향후 다른 영역이 동일
    basename(`4-security.md`, `2-sdk.md` 등 흔한 이름)을 쓸 때 이번처럼 사람이 알아서 접두어를 붙이는지는
    보장되지 않는다.
  - 제안: `spec/conventions/` 에 "frontmatter `id:` 는 `<영역-prefix>-<slug>` 로 전역 유일해야 한다" 는 규칙을
    별도 convention 문서(또는 기존 문서 섹션)로 승격하면, 향후 신규 영역에서 동일 인시던트를 재발명하지 않아도
    된다. 급하지 않음(현재 충돌 없음).

## 요약

`spec/7-channel-web-chat/` 대상 신규 식별자 충돌 검토 결과, 이번 검토 라운드의 실제 diff(`1-widget-app.md`
13행)는 신규 식별자를 전혀 도입하지 않고 이미 구현된 이벤트/함수명(`execution.replay_unavailable`,
`handleEiaEvent`, `seedWaitingFromStatus`, `conversationEnded`)을 코드와 일치하도록 서술만 갱신했음을
실측으로 확인했다. 영역 전체(0~5 + `_product-overview.md`)를 대상으로도 요구사항 ID·엔티티/타입명·API
endpoint·이벤트명·환경변수/설정키·파일 경로 6개 관점을 `codebase/`·`spec/` 실측 grep 으로 전수 재검증했으며,
CRITICAL·WARNING 급 충돌은 발견되지 않았다 — frontmatter `id:`·`NAV-WC-*` ID·주요 타입명(`ChatInstance`/
`BootConfig`/`EmbedConfigDto` 등)·Guard/Service 클래스명·`wc:*` postMessage prefix·`WEB_CHAT_WIDGET_ORIGINS`/
`NEXT_PUBLIC_WIDGET_CDN_BASE` 환경변수·spec/코드 파일 경로가 모두 전역에서 유일하거나(신규), `interactionAllowedOrigins`
처럼 기존 키를 의도적으로 재사용하는 경우도 단일 진실 원칙에 부합하게 처리돼 있었다. `GET /api/hooks/:endpointPath/embed-config`
같은 POST-전용 규약의 예외도 webhook spec 본문에 상호 등재돼 있어 향후 독자가 규약 위반으로 오인할 여지를
없앴다. 유일하게 남는 항목은 실질 위험이 낮은 INFO 2건 — (1) `M1`/`M2` 라벨이 Agent Memory 문서의 무관한
지역 각주와 전역 토큰 검색에서 우연히 겹치는 점, (2) `id:` basename 충돌 방지 규칙이 컨벤션 문서로 승격되지
않고 이 문서의 주석 한 줄로만 존재하는 점 — 이며 둘 다 target 문서 자체의 결함이 아니라 향후 참고용 제안이다.

## 위험도

LOW
