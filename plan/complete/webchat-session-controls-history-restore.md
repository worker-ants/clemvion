---
worktree: webchat-session-history-0e9639
started: 2026-07-09
owner: developer
status: in-progress
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  - spec/7-channel-web-chat/1-widget-app.md
  - spec/7-channel-web-chat/3-auth-session.md
---

# 웹채팅 위젯 — 세션 컨트롤(새 대화/종료) + 새로고침 히스토리 복원

임베드형 웹채팅 위젯의 두 사용자 리포트를 해소한다.

## 문제

1. **세션 컨트롤 부재**: 대화 중 "대화 종료"·"새 대화(신규 세션)"를 실행할 UI 가 없다.
   `newChat` 액션·`NEW_CHAT` reducer·`end_conversation` 명령 타입은 이미 존재하나, 패널의
   "새 대화 시작" 버튼은 `phase === "ended"` 에서만 노출된다(`panel.tsx`). 대화 중 종료·재시작 경로 없음.
   → 스펙(`1-widget-app §3.1`)은 이미 정의 — **구현 갭**.

2. **새로고침 히스토리 미복원**: 대화 중 새로고침 후 재open 시 과거 메시지가 안 보인다. 2겹 원인:
   - **(백엔드)** `InteractionService.getStatus()` 가 `conversationThread` 를 응답 `context` 에서
     의도적 제외(EIA R17 "SSE replay 권위"). 5분 인메모리 버퍼 만료·서버 재시작·인스턴스 스위치 시 복원 불가.
     전체 thread 는 `Execution.conversation_thread` jsonb(V084)에 durable 영속돼 있으나 미노출.
     웹채팅 `1-widget-app §3.1` 은 이미 "getStatus snapshot(현재 conversationThread)으로 폴백" 을 약속 →
     EIA R17 과 cross-spec 모순.
   - **(프런트)** 위젯 `conversation.ts` `roleOf` 가 `turn.role` 만 본다. 실제 wire(WS §4.4.5)의
     `conversationThread.turns[i]` 는 백엔드 5-source(`ai_user`/`ai_assistant`/...) 형태로 `role` 필드가 없어
     복원 시 모든 turn 이 `assistant` 로 렌더된다. 위젯 테스트가 실제 백엔드가 보내지 않는 `role` 형태를
     먹여 통과 중(잘못된 계약).

## 사용자 결정 (2026-07-09)

- 세션 컨트롤: **새 대화 + 대화 종료 둘 다** 헤더에 노출.
- 실행 전 **가벼운 확인**(인라인 confirm).

## 작업

### A. 스펙 재조정 (planner)
- `14-external-interaction-api.md` §5.3 + R17: getStatus 가 `waiting_for_input` 시 durable
  `Execution.conversation_thread` 를 `context.conversationThread` 로 노출(reload 복원, buffer 무관).
  SSE 는 `seq`·라이브 증분 이벤트 권위 유지.
- `7-channel-web-chat/1-widget-app.md` §2/§3.1: 헤더 세션 컨트롤(새 대화/종료+confirm) 명문화,
  메시지 리스트 source→(user/assistant) 매핑 정정(5-source ConversationTurn).
- `7-channel-web-chat/3-auth-session.md` §3.1: 복원 시퀀스 — getStatus 가 durable thread 반환.

### B. 백엔드 (developer)
- `interaction.service.ts` `getStatus()`: waiting 시 durable thread 를 context 에 동봉(buttons/form/ai 양 분기).
  SSE wire shape 과 동일(cloneThread 스냅샷). unit 테스트 추가.

### C. 프런트 (developer)
- `conversation.ts`: `roleOf` 를 백엔드 5-source→user/assistant 매핑(+ `turn.role` override 호환). `eia-types.ts`
  `ConversationTurn.source` 타입 확장. 테스트를 실제 wire shape 으로 정정.
- `use-widget.ts`: `endConversation` 액션(awaiting+ai_conversation→`end_conversation`, else `cancel`),
  optimistic teardown+ENDED. 액션 노출.
- `panel.tsx`/`widget-app.tsx`: 헤더 세션 컨트롤 + 인라인 confirm.

## 검증
- [x] 백엔드 unit (getStatus thread) — interaction.service.spec 32 passed (신규 4건: ai/buttons/null/COMPLETED)
- [x] 프런트 unit (roleOf 매핑, 세션 컨트롤, endConversation, race guard) — web-chat 269 passed
- [x] consistency-check --spec — BLOCK: NO (WARNING #1·INFO #1·#2 반영, 나머지 pre-existing)
- [x] /ai-review 라운드1 (18_44_10) — Critical 0, WARNING 8 전량 반영 + INFO 다수(RESOLUTION.md)
- [x] /ai-review 라운드2 (19_06_55, fresh) — Critical 0, WARNING 3(side_effect·doc·concurrency[journal 복원])
      전량 반영: **booting 을 세션 컨트롤 노출에서 제외**(중복 webhook·미발사 cancel 동시 해소) + JSDoc 링크
      정정 + 저비용 INFO(Set<TurnSource>·상수화·주석) — RESOLUTION 2 참조. 반영분 커버 위해 라운드3 fresh review.
- [x] race guard(startGenRef) — streaming 초기 in-flight start 무효화(리뷰 반영)
- [~] e2e — **스킵(정당)**: 변경은 getStatus 의 additive read-only 필드(durable thread 노출)로 실행
      엔진 상태전이·park/resume 로직 무변경. external-interaction e2e 는 getStatus context/conversationThread
      를 단언하지 않아 회귀 경로 없음. 프런트(web-chat)는 vitest 전용(e2e 없음). 단위테스트로 충분.

## 잔여/후속
- 복원된 thread turn 의 presentation shape(백엔드 `PresentationPayload {type,toolCallId,renderedAt,payload}`)는
  위젯 렌더 envelope(`{config,output}`)와 달라 별도 매핑 필요 — 텍스트 히스토리 복원 범위 밖, 후속 검토.
- host `resetSession`(newChat)-during-booting 중복 webhook 엣지 — pre-existing(원래 newChat 도 startedRef 재개방),
  본 PR 은 UI 경로만 booting 제외로 차단. host-API 엣지 GC/가드는 backlog(planner).
- durable thread REST redaction·새 대화 orphan GC — 방어심화 backlog(R17/spec WARNING 명문).
