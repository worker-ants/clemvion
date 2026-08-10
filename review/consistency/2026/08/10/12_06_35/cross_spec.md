# Cross-Spec 일관성 검토 — `spec/7-channel-web-chat/2-sdk.md`

## 검토 방법 메모
전달된 `_prompts/cross_spec.md` 번들은 컨텍스트 예산 초과로 `spec/0-overview.md`·`3-auth-session.md`·`1-widget-app.md` 세
파일을 제외한 **모든 관련 spec 이 "본문 생략됨(의도된 절단)" 상태**였다(예: EIA·webhook·chat-channel·admin-console·security·
architecture·execution-engine·ai-agent·presentation-common·conversation-thread 등 target 이 직접 참조하는 문서 전부).
번들만으로는 실질적 cross-spec 검토가 불가능해, 아래 대상 파일들을 저장소에서 **직접 읽어** 대조했다:

- `spec/7-channel-web-chat/{0-architecture,4-security,5-admin-console}.md` (전문)
- `spec/5-system/14-external-interaction-api.md` §4·§5.1~§5.6·§7.3·EIA-IN-02/12·EIA-AU-04/06·EIA-RL-06/07·EIA-NF-03
- `spec/5-system/4-execution-engine.md` §1.1·§7.4 (waiting_for_input → cancelled "타임아웃" 예약)
- `spec/4-nodes/3-ai/1-ai-agent.md` §6.2·§7.10·§12.5 (multi_turn·PresentationPayload·render_form)
- `spec/4-nodes/6-presentation/0-common.md` §10.4·§10.6 (1MB cap·blocking vs display-only)
- `spec/conventions/conversation-thread.md` §1.1·§1.2·§2.1·§9.1·§9.3~§9.5 (source 5값·turn.presentations 범위·2-way 말풍선 스코프 예외)
- `spec/2-navigation/2-trigger-list.md` (editor+ RBAC·endpointPath 생성 규약)
- `spec/5-system/15-chat-channel.md` (`languageLocale` 필드)

## 발견사항

발견된 CRITICAL·WARNING 없음. 대조한 전 영역에서 target(`2-sdk.md`) 및 같은 폴더의 `3-auth-session.md`/`1-widget-app.md`
가 인용하는 사실관계(엔드포인트 shape·상태 전이·RBAC·필드명)가 참조 대상 spec 본문과 **정확히 일치**했다. 구체적으로 대조한 지점:

- **API 계약**: `POST /api/hooks/:path` 202 shape, `interact`/`cancel` 의 `InteractAckDto {executionId, accepted, currentStatus}`
  (EIA §5.1·§5.4 — cancel ack shape 은 최근 정정된 버전과 일치), `GET /:id` 의 `{status, currentNode, context}` 2-variant
  union·`conversationThread` present-when-available (EIA §5.3), `refresh-token` 200/401 (EIA §5.5), `embed-config` 응답
  shape (4-security §3-①) 모두 target 의 인용과 일치.
- **요구사항 ID**: `EIA-IN-02`(retry_last_turn 내부 전용)·`EIA-IN-12`(410 Gone, 명령 전용)·`EIA-AU-04`(종료 시 즉시 invalidate)·
  `EIA-RL-07`(idle-wait backstop, `WebChatIdleReaperService`)·`WH-SC-01`(공개 webhook 무인증) 등, target 이 인용하는 ID 는
  전부 EIA/webhook spec 원문과 같은 의미로 정의돼 있고 다른 영역에서 재사용/충돌하는 동명 ID 도 없음.
- **상태 전이**: `waiting_for_input → cancelled` "타임아웃" 사유가 `4-execution-engine.md` §1.1/§7.4 에 이미 예약돼 있고,
  §7.4 는 EIA-RL-07 을 명시적으로 그 구현으로 cross-ref — target(`1-widget-app.md` R9)의 서술과 정합.
- **presentation 페이로드**: AI Agent §7.10 의 `PresentationPayload{type,toolCallId,renderedAt,payload,truncation?}` 타입과
  Presentation 공통 §10.4/§10.6 의 `{config,output}` envelope·1MB tail-truncate 메타(`itemsTruncated`/`rowsTotalCount` 등)가
  target 이 인용한 필드명과 1:1 일치.
- **conversation thread 매핑**: `conversation-thread.md` §1.1(backend 5-source enum)·§2.1(`turn.presentations[]` 는
  `source:'ai_assistant'` 한정)·§9 서두 "임베드형 채널 위젯 스코프 예외"(2-way 말풍선 축약, `presentation_user`/`ai_user`→user,
  `ai_assistant`/`ai_tool`/`system`→assistant) 가 `1-widget-app.md` §2 표와 정확히 같은 매핑을 명시 — 위젯이 규약을
  독자적으로 재정의한 것이 아니라 convention 이 이미 승인한 스코프 예외임을 확인.
- **locale vs languageLocale**: `15-chat-channel.md` §4.1 의 서버 발신 메시지 언어 `languageLocale` 과 target 의 위젯 UI
  렌더 언어 `locale` 은 이름이 비슷하나 target 이 스스로 "별개" 라고 명시 구분하고 있고, 실제로도 서로 다른 계층(서버 알림
  문구 vs 클라이언트 chrome 렌더)의 필드라 충돌 없음.
- **RBAC**: `5-admin-console.md` §7(생성/삭제/편집 = editor+, 조회/미리보기/이력 = viewer+)이 `2-trigger-list.md` 의
  트리거 생성/삭제 `editor`+ 규약과 정확히 일치. 신규 권한 구조를 도입하지 않고 기존 Trigger RBAC 를 그대로 재사용.
- **계층 책임**: `0-architecture.md` §R2("client consumer 로 한정 — EIA·신규 트리거 유형·facade 미신설")·§5.3(M2 BYO-UI =
  `@workflow/sdk` 직접 사용)이 target §2 의 "위젯 SDK 코어로의 `@workflow/sdk` 직접 배선은 비목표, M2 는 그 경로로 충족"
  서술과 정합 — 계층 경계 재정의 없음.
- **Trigger 등록 페이로드**: EIA §4 의 `interaction.appearance{locale,primaryColor,position,headerTitle,welcomeText,
  suggestions,disclaimer}` (flat) ↔ target `BootConfig`(nested `welcome{text,suggestions}`/`launcher{suggestions}`)의
  형태 차이는 `5-admin-console.md` §4 가 "저장 포맷(flat) ↔ BootConfig(nested) 변환" 으로 명시적으로 문서화한 의도된
  매핑이며, 두 문서 다 `appearance.zIndex` 는 콘솔 저장 대상 밖(스니펫 직접 편집 전용)이라는 점까지 일치시켜 두었다 — 충돌
  아님.

## 요약
`spec/7-channel-web-chat/2-sdk.md`(및 함께 번들된 같은 영역 `3-auth-session.md`/`1-widget-app.md`)는 EIA·webhook·security·
admin-console·architecture·execution-engine·AI Agent·presentation 공통·conversation-thread convention·chat-channel·
trigger-list 등 target 이 실제로 인용하는 모든 외부 spec 영역과 API shape·요구사항 ID·상태 전이·RBAC·계층 책임 면에서
일치했다. 자동 번들 예산 초과로 자동 조립 컨텍스트만으로는 검증이 불가능했으나, 관련 원본 spec 파일을 직접 대조해 확인한
결과 CRITICAL·WARNING 급 모순은 발견되지 않았다. 이 문서는 이미 여러 차례의 drift 수정 이력(Rationale 각 R 항목에 명시)을
거쳐 참조 무결성이 비교적 성숙한 상태로 보인다.

## 위험도
NONE
