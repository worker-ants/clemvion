# Cross-Spec 일관성 Check — `spec/7-channel-web-chat/`

- 검토 모드: `--impl-done` (scope=`spec/7-channel-web-chat/`, diff-base=`origin/main`)
- 실제 diff 범위(HEAD 워크트리 `webchat-boot-single-flight-8c92b4`, `merge-base(origin/main, HEAD)` 대비):
  `codebase/channel-web-chat/src/lib/widget-state.ts`(+test) · `codebase/channel-web-chat/src/widget/use-widget.ts`(+test)
  · `spec/7-channel-web-chat/2-sdk.md`(frontmatter `code:` 4줄 추가, 본문 변경 없음).
  → 이번 diff 자체는 client-local 상태기계(`booting`/`ended` 가드) 리팩터와 spec frontmatter 증거 경로 추가뿐이라 cross-spec
  표면 변경은 사실상 없음. 요청 scope(`spec/7-channel-web-chat/` 전체)에 따라 6개 target 문서
  (`0-architecture` · `1-widget-app` · `2-sdk` · `3-auth-session` · `4-security` · `5-admin-console`) 전체를 다른
  spec 영역과 대조했다.

## 검증 방법

target 이 인용하는 타 영역 spec 앵커(EIA `5-system/14-external-interaction-api.md`, Webhook `12-webhook.md`,
실행 엔진 `4-execution-engine.md`, Conversation Thread / Interaction-Type-Registry conventions, AI Agent
`4-nodes/3-ai/1-ai-agent.md`, Presentation 공통 `4-nodes/6-presentation/0-common.md`, 데이터 모델
`1-data-model.md`, 사용자/워크스페이스 `2-navigation/9-user-profile.md`, 트리거 목록 `2-navigation/2-trigger-list.md`,
Chat Channel `15-chat-channel.md`, 인증 `1-auth.md`, API 규약/Swagger 컨벤션, 에러 처리 `3-error-handling.md`,
WebSocket 프로토콜 `6-websocket-protocol.md`, `data-flow/**`) 약 20개 파일을 HEAD 워크트리 절대경로에서 직접 열어
target 의 인용문(값·필드명·상태값·요구사항 ID·권한 등급)과 원문을 라인 단위로 대조했다.

## 발견사항

- **[INFO]** `2-sdk.md` frontmatter 에 도입된 라인번호 기반 pseudo-anchor `§110`
  - target 위치: `spec/7-channel-web-chat/2-sdk.md` frontmatter `code:` 블록 6행(이번 diff 로 신규 추가) —
    `# §110 \`wc:boot\` 재전송 계약(...)의 위젯 측 구현.`
  - 충돌 대상: 없음(모순은 아님) — 다만 참조 스타일이 나머지 spec 트리 전체의 관례와 다르다.
  - 상세: 실측 확인 결과 `§110` 은 실제 마크다운 heading 이 아니라 **`2-sdk.md` 파일의 110번째 줄**(`wc:boot`
    재전송 단락이 시작하는 물리 줄 번호)을 가리키는 코드 주석 관례다(`use-widget.ts`·`use-widget-eager-start.test.ts`
    12곳에서 동일하게 사용). 이번 diff 로 이 관례가 처음으로 spec 파일 자체(frontmatter comment)에도 들어왔다.
    `spec/7-channel-web-chat/**`·`spec/5-system/**` 등 검토한 다른 모든 cross-ref 는 예외 없이 heading 기반 앵커
    (`§3`, `§4.1`, `§R6`, `#41-webhook-호출-응답-확장` 등)를 쓴다 — 이 문서가 실제로 계속 편집되는(같은 파일이 이번
    작업 세션 중에도 19:28 수정) 활성 spec 이라는 점을 고려하면, 향후 이 단락 앞에 몇 줄만 추가/삭제돼도 `§110` 은
    조용히 엉뚱한 줄을 가리키게 되고 heading 앵커와 달리 markdown 링크 검사로도 걸러지지 않는다. YAML 주석이라
    렌더링에는 영향 없고 기능적 모순도 아니라 CRITICAL/WARNING 대상은 아니다.
  - 제안: 코드 주석 관례(`use-widget.ts` 등)는 유지하더라도, spec 파일 자체에는 heading 기반 참조(예: "§3 `wc:boot`
    재전송" 또는 앵커 `#3-host--iframe-postmessage-프로토콜`)를 쓰는 쪽을 권장. 급하지 않음 — 다음 `2-sdk.md` 편집
    시 동기화 권장.

- **[INFO]** `[12-webhook §3.2 WH-SC-01]` 인용이 현재 `12-webhook.md` 구조와 어긋남
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §1("공개 위젯 = webhook 인증 없음") · `4-security.md`
    §1 표("webhook 호출" 행) · §Rationale R2 — 총 3곳에서 `12-webhook §3.2 WH-SC-01` 을 인용.
  - 충돌 대상: `spec/5-system/12-webhook.md` 의 실제 heading 구조.
  - 상세: `12-webhook.md` 의 실제 `### 3.2` heading 은 **"기존 Trigger CRUD API"**(인증과 무관한 내용, 12-webhook.md:206)이고,
    target 이 실제로 가리키려는 `WH-SC-01`(`auth_config_id IS NULL` 인증 없음 옵션)은 번호 없는 `### 요구사항` >
    `#### 인증 및 보안` 절(12-webhook.md:59-73)에 있다. 즉 `§3.2` 라는 절 번호는 현재 문서 구조상 실재하지 않는
    위치를 가리킨다. 링크 자체는 파일 전체(`../5-system/12-webhook.md`)로만 걸려 있어 클릭 시 깨지지는 않지만,
    본문 prose 의 절 번호는 독자를 혼동시킨다. **이 drift 는 target 이 새로 만든 것이 아니다** — `EIA`
    (`14-external-interaction-api.md:163`)도 동일하게 `"기존 [Spec Webhook §3.2 인증·§3.4 관리]"` 로 인용하고 있어,
    `12-webhook.md` 가 과거 번호 매김 섹션(`3.1~3.4`) 구조에서 현재의 `### 요구사항`/`#### 인증 및 보안` 비-번호
    구조로 리팩터되면서 여러 소비 문서의 절 번호 인용이 함께 갱신되지 못한 전역적(pre-existing) drift 로 보인다.
  - 제안: `12-webhook.md` 를 SoT 로 하는 후속 spec 동기화 패스에서 `§3.2`/`§3.4` 식 인용을 실제 heading 또는 요구사항
    ID(`WH-SC-01` 등) 단독 인용으로 정정 권장. target 만의 문제가 아니므로 이번 PR 을 막을 사유는 아님.

## 검증 완료 — 충돌 없음 확인 항목 (참고)

아래는 CRITICAL/WARNING 후보로 의심했으나 원문 대조 결과 정확히 일치해 문제 없음을 확인한 주요 항목들이다(향후
재검토 시 중복 조사 방지 목적으로 기록):

- **데이터 모델**: `Workspace.settings.interactionAllowedOrigins` — `1-data-model.md` §2.2 정의가 target
  `4-security.md` §2/§3, `1-widget-app.md`, EIA §8.5 의 서술과 완전히 일치(편집 권한 Admin+, `PATCH
  /api/workspaces/:id/settings`, 5분 캐시 등). 신규 엔티티/필드 충돌 없음.
- **API 계약**: EIA `POST /api/hooks/:path`→`202`, SSE `GET .../stream`, `POST .../interact`, `POST .../cancel`(§5.4,
  `interact command:cancel` 과 동치·`EIA-IN-05`), `POST .../refresh-token`, `GET .../:id`(§5.3, `200`+terminal도 응답,
  `404 EXECUTION_NOT_FOUND`) 모두 target 인용과 필드명·상태코드 1:1 일치. `{ data }` 래핑(`TransformInterceptor`)도
  webhook §3.1/API 규약 §5.1 과 일치.
- **SSE wire 필드 매핑**: `waitingNodeId`/최상위 `interactionType`/`nodeOutput.conversationConfig`/`buttonConfig`/
  `conversationThread`, `ai_message.message`(not `text`) — EIA §6.2/§6.5 의 "SSE wire 형태 주의" 콜아웃과 target
  `0-architecture.md` §3 주석이 정확히 동일한 6항목을 열거.
- **요구사항 ID**: `EIA-IN-02`(`retry_last_turn` 미노출) · `EIA-IN-12`(410 Gone, 명령 전용) · `EIA-AU-04`(jti blacklist)
  · `EIA-RL-07`/`R19`(idle-wait backstop, `WebChatIdleReaperService`) · `WH-SC-01/05/09` · `NAV-WC-01~06` 모두
  target 의 인용 문맥과 원본 정의가 일치하며, target 이 이 ID 들을 다른 의미로 재정의하지 않음. `WEBCHAT_IDLE_TIMEOUT`
  에러코드 네임스페이스는 `EIA §R19` 가 "Chat Channel 의 `CHANNEL_*` 와의 네이밍 혼동을 피하기 위해 의도적으로
  `WEBCHAT_` prefix" 라고 명시 — 충돌 아닌 의도된 사전 조율.
- **상태 전이**: `Execution.status` 서버 상태기계(`4-execution-engine.md` §1.1)와 위젯의 클라이언트 로컬 UI phase
  (`collapsed/panel/booting/streaming/awaiting_user_message/ended`)는 별개 네임스페이스로 명확히 분리 서술되며 혼동
  없음. `waiting_for_input → cancelled` "타임아웃" 사유 예약(§1.1)과 `§7.4` 무기한 보존 불변식 모두 `EIA-RL-07`/target
  `R9` 서술과 정확히 부합(서버측도 "이미 예약한 타임아웃 사유의 구현" 이라고 동일하게 명시).
- **RBAC**: `9-user-profile.md` §4.2 역할 매트릭스(Owner/Admin 워크스페이스 설정) · §4.3(임베드 허용 도메인 Admin+)와
  `4-security.md`/`5-admin-console.md` §7 의 권한 서술(Admin+ CORS 설정, `editor`+ 트리거 CRUD, `viewer`+ 조회)이
  `2-trigger-list.md` 의 기존 `RoleGate` 패턴과 정확히 일치. `trigger-list R-15`(`endpointPath` 는 공개 UUID, 비밀
  아님)도 `5-admin-console.md` §7 의 "viewer+에게 스니펫 노출해도 비밀 누출 아님" 근거와 부합.
- **계층 책임**: `0-architecture.md §R2`("client-consumer 로 한정, 신규 트리거 유형·facade 미신설")가 EIA §R10(단일
  sink)·§R18("§6.1 5종 webhook 화이트리스트는 변경 없다") 과 정합. `5-admin-console.md §R1`(신규 엔티티 없이 기존
  Trigger 재사용)도 동일 원칙의 반복 적용으로 일관.
- **다른 영역과의 명명 충돌 없음**: `locale`(위젯 UI 언어, `2-sdk.md §4`) vs `languageLocale`(Chat Channel 서버 발신
  메시지 언어, `15-chat-channel.md §4.1`) — 두 필드는 서로 다른 Trigger 계열(공개 웹챗 vs chat-channel 어댑터)에
  속하며 target 이 명시적으로 "별개" 라고 구분해 실제로도 코드/스키마상 충돌 없음.
- **conversation-thread 컨벤션과의 정합**: `conversation-thread.md §9.1` 자체가 "임베드형 채널 위젯은 §9.1/§9.2 강제
  규약을 따르지 않고 `presentation_user`·`ai_user`→user / `ai_assistant`·`ai_tool`·`system`→assistant 2-way 로 축약"
  이라고 target(`1-widget-app.md §2`)을 이름으로 명시 cross-reference — target 의 서술과 문자 그대로 일치. `§2.1`
  ("durable thread 의 `presentations[]` 는 `source: ai_assistant` 한정")도 target `R8` 서술과 정확히 대응하며 상호
  링크까지 걸려 있다.
- **PresentationPayload 계약**: AI Agent `§7.10` 의 `{type, toolCallId, renderedAt, payload, truncation?}` 타입과
  `truncation.{itemsTruncated|rowsTruncated|itemsTotalCount|rowsTotalCount}` 가 target `R8`/§2 표의 서술과 완전
  일치. Presentation 공통 `§10.4`(1MB cap)·`§10.6`(blocking vs display-only)·`§12.5`(`pendingFormToolCall:
  {toolCallId, formConfig}`) 도 마찬가지.
- **`webchat-idle-reaper` 배선**: `EIA §3.4 EIA-RL-07`/`§R19` 뿐 아니라 `3-error-handling.md`·`6-websocket-protocol.md`
  ·`16-system-status-api.md`·`data-flow/15-external-interaction.md`·`data-flow/3-execution.md`·`data-flow/0-overview.md`
  6개 문서가 모두 동일한 메커니즘(`WebChatIdleReaperService`, 분당 repeatable, `cancelledBy='timeout'` +
  `error.code='WEBCHAT_IDLE_TIMEOUT'`)을 독립적으로 일관 서술 — target 과의 괴리 없음.
- **`§110` 계약의 실제 동작 검증**(부수 확인): `use-widget.ts` `applyConfig`/`establishConfig` 를 직접 열람해
  "재전송은 config 만 갱신하고 세션은 건드리지 않는다"(`sessionEstablished() ? null : loadSession(...)`)는 실측
  코드가 `2-sdk.md` §3 "wc:boot 재전송" 서술("동일 triggerEndpointPath 재부팅은 진행 중 execution 을 중복 시작하지
  않는다")과 정확히 일치함을 확인. (impl-diff 성격의 확인이라 본문 채점에는 반영하지 않음 — 참고용.)

## 요약

`spec/7-channel-web-chat/` 는 EIA·Webhook·실행 엔진·Conversation Thread/Interaction-Type-Registry 컨벤션·AI
Agent·Presentation 공통·데이터 모델·사용자/워크스페이스·Chat Channel·인증·API 규약 등 20개에 가까운 타 영역 spec
문서를 인용하지만, 원문 대조 결과 필드명·상태값·요구사항 ID·권한 등급·엔드포인트 계약이 예외 없이 정확히
일치했다. 여러 피인용 문서(`conversation-thread.md`, `14-external-interaction-api.md`, `1-auth.md` 등)가 오히려
target 을 이름으로 명시 cross-reference 하며 동일한 결정을 반복 서술하고 있어, 이 영역은 이미 여러 차례의
cross-spec 조율 라운드(다수의 "결정 2026-07-XX", "impl-prep cross_spec WARNING 반영" 흔적)를 거쳐 매우 높은
정합 상태에 있다. 이번 diff 자체(`use-widget.ts`/`widget-state.ts` client-local 상태기계 정리 + `2-sdk.md`
frontmatter 증거 경로 4줄)는 cross-spec 표면을 확장하지 않는 좁은 변경이라 신규 충돌 위험이 낮다. 발견된 2건은
모두 절 번호 인용 스타일에 관한 INFO 수준 사안(라인번호 기반 `§110` pseudo-anchor의 취약성, `12-webhook.md`
구조 개편 이후 갱신되지 않은 `§3.2` 인용 — 후자는 target 고유 문제가 아니라 EIA 등에도 있는 전역적 drift)이며
데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 실질적 모순은 발견되지 않았다.

## 위험도

LOW
