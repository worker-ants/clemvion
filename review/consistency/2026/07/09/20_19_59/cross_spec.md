# Cross-Spec 일관성 검토 — webchat-session-history (impl-done)

검토 범위: `spec/7-channel-web-chat/**` (target) vs `spec/**` 전역. diff-base `origin/main`.
실제 변경 파일 4개: `spec/5-system/14-external-interaction-api.md`(§5.3·R17) · `spec/7-channel-web-chat/1-widget-app.md`(§2·§3·§3.1) ·
`spec/7-channel-web-chat/2-sdk.md`(§3 wc:event) · `spec/7-channel-web-chat/3-auth-session.md`(§3.1).

핵심 변경: (1) EIA `GET /api/external/executions/:id`(getStatus) 가 `waiting_for_input` 시 durable
`conversationThread` 스냅샷을 REST 응답에도 동봉해 새로고침 히스토리 복원을 5분 SSE buffer 무관하게 지원, (2) 위젯
헤더에 "새 대화"/"대화 종료" 세션 컨트롤 추가(가벼운 확인 2단계), (3) turn `source`(백엔드 5값)→말풍선 role 매핑 명문화,
(4) `wc:event conversationEnded.data.reason` 을 열린 문자열로 명시.

## 발견사항

관련 spec 영역(`5-system/4-execution-engine.md`, `conventions/conversation-thread.md`, `5-system/6-websocket-protocol.md`,
`1-data-model.md`, `7-channel-web-chat/{0-architecture,4-security,5-admin-console}.md`)을 대조한 결과 CRITICAL/WARNING 급
직접 모순은 발견되지 않았다. 세부 대조 근거:

- **데이터 모델**: `Execution.conversation_thread`(V084) 필드 정의 자체는 무변경. 코드 주석(`execution.entity.ts`)만
  "API 응답 DTO 미포함"→"단 EIA getStatus 는 read-only 노출"로 갱신했고, `spec/1-data-model.md` §2.13 해당 행은 애초에
  "API 응답 DTO 미포함"을 주장한 적이 없어(그 문구는 코드 주석에만 있었음) 모순 없음.
- **API 계약**: EIA §5.3 jsonc 예시는 이미 `origin/main` 시점부터 `"conversationThread": { ... }` 필드를 보여주고
  있었고(코멘트만 "SSE 전용, REST 는 생략"이라 서술 — 예시와 산문이 이미 drift 상태였음), 이번 변경은 산문을 예시와
  일치시키는 **정합화**다. `spec/5-system/6-websocket-protocol.md` §4.4.5 의 "conversationThread 는 모든 interactionType
  (form/buttons/ai_conversation) 에 선택적으로 동봉" 규칙과도 정합 — REST 신규 로직(`interaction.service.ts` `base`
  객체)도 3개 interactionType 분기 모두에 조건부로 동일 적용.
- **요구사항 ID**: 신규 ID 미도입. 기존 `R17`(문서-로컬 rationale 번호)의 프로즈만 확장. ID 충돌 없음.
- **상태 전이**: 위젯 헤더의 "대화 종료"(`end_conversation` graceful vs `cancel` 범용) 분기는
  `spec/5-system/14-external-interaction-api.md` EIA-IN-02(`end_conversation`은 nodeId 필요, AI Agent/Information
  Extractor multi-turn 한정)·`spec/5-system/4-execution-engine.md`(§7.5 계열 cancel/rehydration 상태 전이)와 정합 —
  위젯 코드(`use-widget.ts endConversation`)도 `state.pending?.nodeId` 확정 시에만 `end_conversation`, 그 외 `cancel` 로
  분기해 EIA 계약을 그대로 반영.
- **turn source 매핑**: `1-widget-app.md` §2 / `channel-web-chat` 코드(`conversation.ts` `roleOf`, `eia-types.ts`
  `TurnSource`)가 선언한 5값(`presentation_user`/`ai_user`/`ai_assistant`/`ai_tool`/`system`)→user/assistant 축약은
  `spec/conventions/conversation-thread.md` §1.1 의 backend `ConversationTurnSource` 5값 정의와 정확히 일치.
- **RBAC/권한**: 변경 없음. EIA `getStatus`/`interact`는 워크스페이스 RBAC 이 아닌 execution-scope 토큰(`iext_*`) 인가라
  `5-admin-console.md` §7 RBAC 표(viewer+/editor+)와 별개 축이며 상충 없음.
- **계층 책임**: `interaction.service.ts` 가 `Execution.conversationThread` 컬럼을 직접 read 하는 것은 기존에도
  `NodeExecution.outputData` 를 직접 read 하던 패턴과 동일 축(EIA 서비스가 실행 엔진을 거치지 않고 read-only 상태
  조회) — `0-architecture.md` §R2("EIA 핵심 표면 변경 없음, facade 미신설")과 충돌 없음(신규 endpoint/facade 아님,
  기존 표면의 필드 확장).

## 요약

이번 diff(EIA getStatus 의 durable `conversationThread` REST 노출 + 위젯 헤더 세션 컨트롤 + turn source role 매핑 +
`wc:event` reason 필드 개방)는 `conversation-thread.md`/`6-websocket-protocol.md`/`14-external-interaction-api.md` 등
관련 영역의 기존 계약과 정합하며, 오히려 기존에 존재하던 (EIA §5.3 산문 vs jsonc 예시 간) 사소한 drift 를 해소하는
방향이다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 전부에서 CRITICAL/WARNING 급 모순은
발견되지 않았다.

## 위험도

NONE
