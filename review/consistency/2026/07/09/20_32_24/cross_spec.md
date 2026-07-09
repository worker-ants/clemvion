# Cross-Spec 일관성 검토 — spec/7-channel-web-chat/ (webchat-session-history, impl-done)

## 발견사항

없음 — CRITICAL/WARNING 급 cross-spec 충돌을 발견하지 못했다.

검토한 변경 범위(origin/main..HEAD):
- `spec/7-channel-web-chat/1-widget-app.md` — 헤더 세션 컨트롤(새 대화/대화 종료), 새로고침 히스토리 복원, turn `source`→role 매핑
- `spec/7-channel-web-chat/2-sdk.md` — `wc:event conversationEnded.data.reason` 을 열린 문자열로 명문화
- `spec/7-channel-web-chat/3-auth-session.md` — §3.1 재로드 복원 시퀀스에 durable `conversationThread` 동봉 반영
- `spec/5-system/14-external-interaction-api.md` — `getStatus`(§5.3) 가 `waiting_for_input` 시 `context.conversationThread` durable 스냅샷 동봉(§R17 재조정)
- `spec/conventions/conversation-thread.md` — `Execution.conversation_thread` 컬럼의 "소비처 갱신" 절 추가(rehydration-only → +SSE waiting emit +getStatus REST read-only)

아래는 참고용 확인 사항(비차단, INFO 미만 — 명시 항목화하지 않음):

- **상태 전이**: 신규 헤더 "새 대화"/"대화 종료" 컨트롤이 참조하는 `waiting_for_input` 무기한 보존 불변식은
  `spec/5-system/4-execution-engine.md` §7.4(예: L929 "status='waiting_for_input' 은 무기한 보존")와 정확히 일치한다.
  "대화 종료"의 `end_conversation`(nodeId 확정 시) vs `cancel`(그 외) 분기도 `14-external-interaction-api.md` §5.1 의
  `end_conversation | nodeId, reason? | AI Agent/Information Extractor(multi turn)` 정의·`cancel | reason? | (전체 execution)`
  정의와 정합한다.
- **데이터 모델**: `TurnSource` 위젯측 5값 확장(`presentation_user`/`ai_user`/`ai_assistant`/`ai_tool`/`system`)은
  `spec/conventions/conversation-thread.md` §1.1 의 backend `ConversationTurnSource` 5값과 값·매핑(user↔`presentation_user`/`ai_user`,
  assistant↔나머지) 이 정확히 일치한다.
- **API 계약**: `getStatus` 응답에 새로 실리는 `context.conversationThread` 는 WS §4.4.5(`execution.waiting_for_input`)의
  `conversationThread` 와 동일 wire shape(`id`/`nextSeq`/`turns[]`/`totalChars`, turn shape 은 conversation-thread §1.2)으로,
  두 표면 간 형식 drift가 없다. `spec/data-flow/15-external-interaction.md`·`14-chat-channel.md` 는 `getStatus` 응답
  필드를 나열하는 매핑 표를 두지 않아 stale 화될 대상이 없다.
- **권한/RBAC**: 신규 역할·권한 분기 없음(헤더 컨트롤은 위젯 내부 UI 상태 전이일 뿐 EIA 인증 모델에 변화 없음).
- **계층 책임**: `getStatus` 필드 확장은 이미 SSE `waiting_for_input` 으로 공개 중이던 `conversationThread` 를 동일
  REST 엔드포인트에 read-only 로 재노출한 것으로, `0-architecture.md` §R2(신규 트리거 유형·facade 미신설)·EIA §R10
  단일 sink 정책을 위반하지 않는다(신규 엔드포인트·신규 sink 없음).
- **경미(INFO 미만, 조치 불요)**: `spec/1-data-model.md` §2.13 `Execution.conversation_thread` 행은 이번 소비처 확장
  (EIA `getStatus` REST 노출)을 직접 서술하지 않고 `conversation-thread.md §4·§8.4` 로 위임하는데, 그 위임 대상 문서는
  이번 diff 로 이미 갱신되어 있다(`§4·§8.4` 뒤에 "소비처 갱신 (2026-07-09)" 절 추가) — 데이터 모델 문서의 관례(상세는
  convention 문서가 SoT)와 일치하므로 별도 조치 불필요.

## 요약

이번 변경(위젯 헤더 세션 컨트롤 + `getStatus` REST 를 통한 새로고침 히스토리 복원)은 `spec/7-channel-web-chat/**`,
`spec/5-system/14-external-interaction-api.md`, `spec/conventions/conversation-thread.md` 세 영역에 걸쳐 있으나 모두
상호 참조·Rationale(EIA §R17 재조정, conversation-thread "소비처 갱신")로 명시적으로 연결되어 있고, 상태 전이 불변식
(`waiting_for_input` 무기한 보존)·interact 명령 의미론(`end_conversation`/`cancel`)·turn source enum 5값·SSE-REST wire
shape 이 각 SoT 문서와 정확히 일치한다. 데이터 모델·API 계약·요구사항 ID·RBAC·계층 책임 어느 관점에서도 기존 spec
영역과의 직접 모순은 발견되지 않았다.

## 위험도
NONE
