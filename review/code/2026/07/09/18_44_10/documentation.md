# 문서화(Documentation) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + `getStatus` durable `conversationThread` 새로고침 히스토리 복원
> (`interaction.service.ts`, `conversation.ts`, `eia-types.ts`, `panel.tsx`, `use-widget.ts`, 관련 spec 3건 + plan)

## 발견사항

- **[WARNING]** `CHANGELOG.md` 미갱신
  - 위치: `CHANGELOG.md` (diff 대상 파일 목록에 없음)
  - 상세: 본 저장소는 사용자에게 보이는 기능 변경마다 `CHANGELOG.md` 최상단에 `## Unreleased — <제목>` 항목을
    추가하는 관례를 거의 예외 없이 지켜왔다(`git log --oneline -- CHANGELOG.md` 최근 20건이 최근 20개 feat/fix
    PR 과 1:1 대응 — #869/#868/#865/#856/#846/#845 등). 이번 PR 은 (1) 웹채팅 위젯 헤더에 **"새 대화"·"대화 종료"**
    세션 컨트롤 + 가벼운 확인 UI 신설, (2) `InteractionService.getStatus()` 가 durable `conversationThread` 를
    동봉해 새로고침 시 히스토리를 복원하도록 하는 동작 변경(EIA §R17 재조정) — 둘 다 사용자에게 보이는 신규
    동작이며 기존 관례상 CHANGELOG 항목 대상이다. 그러나 diff 에 `CHANGELOG.md` 변경이 없다.
  - 제안: `## Unreleased — 웹채팅 세션 컨트롤(새 대화/종료) + 새로고침 히스토리 복원` 항목을 다른 최근 항목과
    동일한 상세도(무엇을·왜·SoT 링크)로 추가할 것.

- **[INFO]** `codebase/channel-web-chat/README.md` "상태" 섹션이 `conversation` 모듈 설명과 기능 목록이 stale
  - 위치: `codebase/channel-web-chat/README.md` 64~65행 — `conversation 렌더 규약(src/lib/conversation — [user-input] strip·live/injected)`
  - 상세: 이번 diff 로 `conversation.ts` `roleOf`/`TurnSource` 가 `live`/`injected` 2값 외에 백엔드 wire 5-source
    (`presentation_user`/`ai_user`/`ai_assistant`/`ai_tool`/`system`)를 user/assistant 로 매핑하는 로직을 새로
    갖게 됐다(새로고침 복원의 핵심 경로). README 의 해당 문장은 여전히 `live`/`injected` 만 언급해 모듈 책임
    범위를 실제보다 좁게 서술한다. 또한 같은 섹션(구현됨 기능 목록)에 이번에 추가된 헤더 **세션 컨트롤(새
    대화/대화 종료)** 기능이 없어 README 상으로는 이 UI 가 존재하는지 알 수 없다.
  - 제안: "conversation 렌더 규약" 문구에 wire 5-source→role 매핑을 병기하고, 구현됨 목록에 헤더 세션 컨트롤
    항목을 추가.

- **[INFO]** ASCII 상태기계 다이어그램이 신규 "대화 종료" 전이 경로를 시각적으로 반영하지 않음
  - 위치: `spec/7-channel-web-chat/1-widget-app.md` §3 다이어그램(`[booting] ──...──▶ [streaming] ──...──▶ [awaiting_user_message]` 블록)
  - 상세: 다이어그램은 `[awaiting_user_message]` 아래로만 `[ended]` 화살표를 그리고, `new chat` 화살표만
    `[ended]→[booting]` 로 표기한다. 이번 diff 로 "대화 종료"는 `booting`/`streaming`/`awaiting_user_message`
    **세 phase 모두**에서 헤더 컨트롤로 즉시 트리거 가능해졌지만(§2 표·§3.1 표), 다이어그램에는 `booting`/
    `streaming`→`[ended]` 화살표가 없다. 바로 아래 산문("다이어그램의 `new chat` 화살표는 … 헤더 컨트롤에서도
    발생한다")이 `new chat` 경로는 명시적으로 보완했으나 "대화 종료" 경로에 대한 동일한 보완 문구는 없다.
  - 제안: 다이어그램에 `booting`/`streaming`→`[ended]` 점선 화살표를 추가하거나, `new chat` 문구 옆에 "대화
    종료도 동일하게 booting/streaming/awaiting_user_message 어디서나 `[ended]` 로 직행한다"는 한 문장을 병기.

- **[INFO]** `endConversation` JSDoc 이 `graceful` 분기의 `nodeId` 존재 조건을 명시하지 않음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `endConversation` 위 JSDoc (diff 1660~1666행)
  - 상세: 코드는 `graceful = phase==='awaiting_user_message' && pending?.type==='ai_conversation' && !!pending?.nodeId`
    로 `nodeId` 부재 시에도 `cancel` 로 폴백하지만, JSDoc 은 "대기 중 AI 대화(`awaiting_user_message` +
    `ai_conversation`)면 graceful … 그 외 phase 면 범용 cancel" 이라고만 서술해 "같은 조건이라도 `nodeId` 가
    없으면 cancel" 이라는 엣지 케이스가 문서에서 빠져 있다. 실무 영향은 미미(로직 자체는 정확)하나 문서만 보고
    분기 조건을 재구성하려는 사람은 이 케이스를 놓칠 수 있다.
  - 제안: JSDoc 에 "(`nodeId` 미확정이면 동일 phase 라도 `cancel` 로 폴백)" 한 구절 추가.

## 긍정적 관찰 (참고)

- `interaction.service.ts` JSDoc·인라인 주석이 `conversationThread` 신규 동봉의 보안 근거("이미 SSE 로 공개
  중인 데이터라 신규 민감 표면 아님")·wire shape 근거(`cloneThread`/`stageDurableResumeSnapshot` 실제 식별자
  참조, grep 으로 정확성 확인함)까지 상세히 남겨 코드 리뷰어가 스펙을 다시 찾아볼 필요가 없는 수준.
- `conversation.ts`/`eia-types.ts` 의 `TurnSource`/`roleOf` JSDoc 이 "왜"(새로고침 복원 thread 는 `role` 없이
  `source` 만 옴 → 매핑 없으면 전부 assistant 로 뒤집힘)를 정확히 설명하고, spec SoT 링크(`1-widget-app §2`)까지
  병기.
- spec 3건(`14-external-interaction-api.md` R17, `1-widget-app.md` §2/§3.1, `3-auth-session.md` §3.1)이 코드와
  같은 PR 로 함께 갱신됐고, R17 addendum 에 "기각 대안" 두 개까지 rationale-continuity 관례대로 기록.
  `plan/in-progress/webchat-session-controls-history-restore.md` 도 문제·결정·작업·검증·잔여를 표준 구조로
  기록. `review/consistency/2026/07/09/18_27_06/` 결과 WARNING(1건)·INFO(2건)를 이미 spec 본문에 반영해 재검증
  완료 상태.
- 테스트 파일들(`interaction.service.spec.ts`/`conversation.test.ts`/`panel.test.tsx`/`use-widget-eager-start.test.ts`)
  모두 신규 케이스 위에 "왜 이 케이스가 필요한가"를 한 줄 주석으로 남겨 회귀 방지 의도가 분명함.

## 요약

전반적으로 문서화 수준이 매우 높다 — 코드 JSDoc·인라인 주석·spec 3건 동시 갱신·plan rationale·consistency-check
사전 처리까지 이 PR 하나로 완결된 문서 사이클을 보여준다. 다만 (1) 이 저장소가 거의 예외 없이 지켜온 관례인
`CHANGELOG.md` 항목 추가가 누락됐고, (2) `channel-web-chat/README.md` "상태" 섹션이 이번 변경(5-source 매핑,
헤더 세션 컨트롤)을 반영하지 못해 stale해졌다. 나머지는 사소한 정밀도 보완 사항(INFO)이다.

## 위험도
LOW
