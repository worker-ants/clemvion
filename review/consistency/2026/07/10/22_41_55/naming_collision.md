# 신규 식별자 충돌 검토 결과

## 검토 범위 확인

payload 의 "Target 문서" 는 `spec/7-channel-web-chat/` 전체(6개 파일, 모두 `status: implemented`)를 컨텍스트로
포함하고 있으나, 실제 이번 작업(`widget-presentation-restore`)에서 **새로 도입/수정된 내용**은 최신 커밋
(`28a358375 docs(spec): 웹채팅 위젯 presentation 복원 제약 정정`)의 diff 로 한정된다:

- `spec/7-channel-web-chat/1-widget-app.md` §2 "presentation inline" 행, §3.1 "페이지 새로고침/이동" 행 — 문구 정정
- `spec/7-channel-web-chat/_product-overview.md` "비목표" 목록에 항목 1개 추가

나머지 5개 파일(`0-architecture.md`/`2-sdk.md`/`3-auth-session.md`/`4-security.md`/`5-admin-console.md`)은 이번
diff 에서 변경되지 않은 기존 확정 spec(참고 컨텍스트)이라 "신규 식별자" 후보가 없다. 따라서 본 검토는 실제 diff 가
도입/재사용하는 식별자를 중심으로 수행했다.

## 발견사항

이번 diff 는 **신규 식별자를 도입하지 않는다** — 모두 기존에 이미 정의된 식별자를 재참조/재사용하는 문구 정정이다.
교차 검증 결과:

- `execution.message` — 신규 아님. 기존 [`5-system/14-external-interaction-api.md` R18](../../../../../../spec/5-system/14-external-interaction-api.md)·[`6-websocket-protocol.md:192`](../../../../../../spec/5-system/6-websocket-protocol.md) 에 이미 정의된 SSE 이벤트(표시-전용 presentation 노드 자동 진행 메시지)와 동일 의미로 사용. 충돌 없음.
- `PresentationPayload` / `PresentationPayload.truncation` — 신규 아님. 단일 진실은 [`4-nodes/3-ai/1-ai-agent.md §7.10`](../../../../../../spec/4-nodes/3-ai/1-ai-agent.md)(`type PresentationPayload = {...}`, `truncation?` 필드 포함)이며, target 은 이를 그대로 재인용. `formDataTruncation`(별개 키, 동 spec §12.7 인접부)과도 이미 명시적으로 구분돼 있어 혼동 소지 없음.
- `turn.presentations[]` (ConversationTurn top-level `presentations[]`) — 신규 아님. [`conventions/conversation-thread.md §1.2·§2.1`](../../../../../../spec/conventions/conversation-thread.md)에 `source: 'ai_assistant'` 한정 필드로 이미 정의. target 의 "durable thread 의 turn.presentations[] 는 ai_assistant 한정" 서술도 이 정의와 정합.
- 앵커 참조 무결성 — target 이 새로 추가한 링크 `[Presentation 공통 §10.6](../4-nodes/6-presentation/0-common.md#106-blocking-vs-display-only)`, `[공통 §10.4](../4-nodes/6-presentation/0-common.md#104-1mb-cap)`, `[AI Agent §7.10]`, `[conversation-thread §2.1]` 모두 대상 파일에 실제 앵커가 존재함을 확인(`grep` 으로 §10.4/§10.6/§7.10/§2.1 섹션 헤더 실재 확인). 댕글링 참조 없음.
- `_product-overview.md` 비목표 항목 추가 — 새 요구사항 ID·엔티티명·엔드포인트·이벤트명·ENV 키를 도입하지 않는 순수 서술(scope 명확화). "backend 5-source enum" 참조도 기존 `conversation-thread.md §1.1` 표현 그대로.
- 파일 경로 — 이번 diff 는 기존 파일 2개만 편집했고 신규 spec 파일을 생성하지 않았다. 파일 경로 충돌 해당 없음.

CRITICAL/WARNING 등급 발견사항 없음.

### INFO — 참고 (충돌 아님)

- **[INFO]** 용어 표기 일관성 참고
  - target 신규 식별자: 해당 없음(신규 식별자 없음)
  - 기존 사용처: `spec/4-nodes/6-presentation/0-common.md §10.6`("Blocking vs Display-only") vs target 의 "표시-전용 presentation 노드"/"AI `render_*`" 이분 표현
  - 상세: 두 문서가 같은 이분법(노드 blocking-vs-display-only ↔ AI tool render_*)을 다른 한글 표현으로 서술하나 의미는 정합적이며 상호 링크로 명확히 연결되어 있어 혼동 위험은 낮음.
  - 제안: 조치 불요(이미 상호 참조 존재). 추후 용어집(`conventions/`) 정리 시 참고.

## 요약

이번 target 변경분(`1-widget-app.md` 2곳 문구 정정 + `_product-overview.md` 비목표 항목 1개 추가)은 신규
요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·설정키·파일 경로를 전혀 새로 도입하지 않는다. 언급되는
모든 식별자(`execution.message`, `PresentationPayload`, `PresentationPayload.truncation`, `turn.presentations[]`,
conversation-thread 5-source enum)는 `5-system/14-external-interaction-api.md`, `5-system/6-websocket-protocol.md`,
`4-nodes/3-ai/1-ai-agent.md §7.10`, `conventions/conversation-thread.md` 에 이미 확립된 정의를 그대로 재인용하며,
새로 추가된 섹션 앵커 링크도 전부 실재를 확인했다. 신규 식별자 충돌 관점에서 이번 변경은 안전하다.

## 위험도

NONE
