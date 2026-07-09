# Cross-Spec 일관성 검토 — `spec/7-channel-web-chat/` (webchat-session-history)

## 검토 대상 변경 요약 (참고)

`git diff origin/main -- spec/` 기준 실제 변경분:
- `spec/7-channel-web-chat/1-widget-app.md` — 헤더 세션 컨트롤("새 대화"/"대화 종료") 추가, 메시지 리스트가 `ConversationTurnSource` 5값을 user/assistant 말풍선으로 축약 렌더, 새로고침 복원이 `context.conversationThread` durable 스냅샷으로 전체 히스토리를 시드하도록 확장.
- `spec/7-channel-web-chat/2-sdk.md` — `wc:event conversationEnded.data.reason` 개방형 문자열 명세 추가.
- `spec/7-channel-web-chat/3-auth-session.md` — §3.1 재로드 복원 시퀀스가 durable `conversationThread` 동봉을 반영하도록 갱신.
- `spec/5-system/14-external-interaction-api.md` (§5.3, §R17) — `getStatus` 가 `waiting_for_input` 시 `context.conversationThread` durable 스냅샷을 REST 표면에도 노출하도록 재조정, 과거 "SSE 전용" 결정과의 모순을 명시적으로 인정·수정.
- `spec/conventions/conversation-thread.md` — `Execution.conversation_thread` 컬럼의 소비처를 (a) rehydration (b) SSE emit (c) `getStatus` REST 로 확장 기록.

target(7-channel-web-chat)과 함께 EIA·conversation-thread convention 문서가 **같은 커밋 계열에서 동반 갱신**됐고, `§R17`
Rationale 이 "웹채팅 §3.1 이 이미 이 계약을 전제해 생략과 모순이었다"를 스스로 지적·해소하는 형태라 이번 diff 는 오히려
기존 latent cross-spec 불일치(REST 표면 생략 vs 위젯의 buffer-만료 폴백 전제)를 해소한 사례에 가깝다.

## 발견사항

- **[INFO]** `conversation-thread.md §9.1` 의 "강제" 시각 매핑과 위젯의 2-way 축약 렌더 간 스코프 미명시
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §2 메시지 리스트 행 — "turn `source`(conversation-thread §1.1 백엔드 5값)를 말풍선 role 로 축약 렌더 — `presentation_user`·`ai_user`→user, `ai_assistant`·`ai_tool`·`system`→assistant"
  - 충돌 대상: `spec/conventions/conversation-thread.md` §9.1 "source 별 시각 매핑 (강제)" — `ConversationTurnSource` 값마다 서로 다른 아이콘·컨테이너·chip 을 **강제**로 요구(§9.2 "3중 신호").
  - 상세: 이번 diff 에서 위젯이 처음으로 `conversation-thread §1.1`(backend `ConversationTurnSource` 5값) taxonomy 를 직접 인용하며 렌더 근거로 삼기 시작했다. 값 매핑 자체는 정확하다(5값 전부 커버, 존재하지 않는 `system_error`—frontend 전용 6번째 값—는 배제해 올바름). 다만 `conversation-thread.md §9.1/§9.2`는 해당 시각 규약을 "강제"라 명시하고 "모든 노드의 conversation timeline 표시 UI"에 적용된다고 서술하는 반면, 위젯은 아이콘·chip·컨테이너 구분 없이 2-way 말풍선으로 단순 축약한다. 문서 타이틀("§9. 미리보기 UI 렌더 규칙")과 frontmatter `code:` 목록이 `codebase/frontend/src/components/editor/run-results/**` 만 나열해 실제로는 에디터 내부 preview 패널 한정으로 읽히지만, "모든 노드"라는 표현과 명시적 위젯 carve-out 부재가 향후 재독자에게 오인 소지를 남긴다.
  - 제안: (a) `conversation-thread.md §9` 서두 또는 §9.1 표 상단에 "본 절의 강제 시각 매핑은 에디터 run-results 패널 기준이며, 채널 위젯(channel-web-chat) 등 별도 UI 는 자체 렌더 규약을 따를 수 있다"는 1줄 스코프 문구를 추가하거나, (b) `1-widget-app.md` §2 해당 행에 "본 위젯은 §9.1 아이콘/chip 체계를 그대로 따르지 않고 임베드 제약상 2-way 로 축약함(의도적 이탈)"이라는 짧은 근거를 명문화. 기능 결함은 아니므로 비차단.

## 확인했으나 문제 없음 (참고용 — cross-spec 정합 확인 근거)

- `end_conversation` 조건("awaiting_user_message + ai_conversation, waiting nodeId 확정")은 `spec/5-system/14-external-interaction-api.md` §5.1 표(`end_conversation` → `nodeId` 필수, "AI Agent / Information Extractor (multi turn)" 한정)와 정합.
- `409 STATE_MISMATCH` / `410 Gone`(EIA-IN-12) 참조는 EIA 표와 일치.
- "새 대화" 시 이전 execution 이 서버에서 `waiting_for_input` 로 **무기한 보존**된다는 서술은 `spec/5-system/4-execution-engine.md` §7.4 ("`status='waiting_for_input'` 은 무기한 보존")과 일치(인용 섹션 번호도 정확).
- 새로고침 복원 시 durable `conversationThread` 를 REST(`getStatus`) 로 노출한다는 서술은 `14-external-interaction-api.md` §5.3/§R17, `conventions/conversation-thread.md` "소비처 갱신(2026-07-09)", 실제 코드(`execution.entity.ts`, `interaction.service.ts`) 3자가 모두 동일 서술로 동기화됨.
- presentation 복원 shape 불일치(라이브 `{config,output}` vs durable turn 의 `PresentationPayload{type,toolCallId,renderedAt,payload}`) 서술은 EIA §5.2(라인 407-409)·`conversation-thread.md` §1.2 정의와 일치.
- 신규 요구사항 ID·엔티티·RBAC 변경 없음 — `NAV-WC-01..06`, `5-admin-console.md` §7 RBAC 표는 diff 범위 밖이며 target 신규 내용(위젯 헤더 세션 컨트롤)은 공개 무인증 위젯 종단 사용자 동작이라 RBAC 모델과 무관.
- Data model(`Execution.conversation_thread`, V084) 필드 정의·타입은 `spec/1-data-model.md §2.13` 과 diff 내용이 정합(신규 컬럼 없음, 기존 컬럼 소비처만 확장).

## 요약

이번 diff(웹챗 새로고침 세션 히스토리 복원 + 헤더 세션 컨트롤)는 `spec/7-channel-web-chat/*` 단독이 아니라 `spec/5-system/14-external-interaction-api.md`(§5.3/§R17)와 `spec/conventions/conversation-thread.md` 를 동일 계열로 동반 갱신했고, 특히 EIA §R17 Rationale 이 "위젯 §3.1 의 기존 전제와 REST 생략이 모순이었다"를 스스로 인정·해소하는 방식으로 작성돼 있어 오히려 기존 latent 불일치를 없앤 사례로 보인다. `end_conversation`/`cancel`/`STATE_MISMATCH`/무기한 보존 불변식 등 새로 추가된 헤더 세션 컨트롤 서술은 EIA·execution-engine spec 의 기존 정의와 정확히 부합했다. 유일하게 발견한 사항은 `conversation-thread.md §9.1` 의 "강제" 시각 매핑 문구가 위젯의 의도적 2-way 축약 렌더에 대한 명시적 스코프 예외를 두지 않는다는 점으로, 기능적 모순이 아닌 문서 명확성 차원의 INFO다. CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

LOW
