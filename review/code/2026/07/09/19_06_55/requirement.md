# 요구사항(Requirement) Review

## 발견사항

- **[INFO]** 확인바(`confirming`)가 외부 SSE terminal 이벤트로 인한 `[ended]` 전이와 독립적으로 관리됨
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` (`confirming` state, `showSessionControls`)
  - 상세: 헤더의 "새 대화"/"대화 종료" 버튼 노출은 `showSessionControls = isActiveConversationPhase(phase)` 로 게이팅되지만, 이미 열린 확인바(`confirming !== null`)는 `phase` 변화와 무관하게 별도 로컬 state 라 유지된다. 사용자가 확인바를 띄운 채로 있는 사이 외부 SSE terminal 이벤트(예: 워크플로우가 자연 `completed`)로 `phase` 가 `ended` 로 바뀌면, 확인바는 여전히 표시된 채 남는다. `endConversation()` 은 `state.phase === "ended"` 가드로 안전하지만, `newChat()` 에는 그런 가드가 없다(다만 `newChat()` 을 ended 상태에서 호출하는 것 자체는 정상 CTA 동작과 동일해 실질적 위험은 낮음).
  - 제안: 필수 수정은 아님 — 정상 CTA 와 결과가 동일해 기능적 결함은 아니다. 원한다면 phase 가 `showSessionControls=false` 로 바뀔 때 `confirming` 을 자동 닫는 `useEffect` 를 추가해 UX 를 다듬을 수 있다.

- **[INFO]** spec fidelity 검증 결과 — line-level 일치 확인됨
  - 위치: `spec/5-system/14-external-interaction-api.md` §5.3/§R17 ↔ `codebase/backend/.../interaction.service.ts` `getStatus()`; `spec/7-channel-web-chat/1-widget-app.md` §2/§3.1 ↔ `panel.tsx`/`use-widget.ts`/`widget-state.ts`; `spec/conventions/conversation-thread.md` §1.1(5-source enum) ↔ `conversation.ts` `USER_TURN_SOURCES`/`roleOf`
  - 상세: (1) `getStatus()` 는 `WAITING_FOR_INPUT` 시에만 durable `execution.conversationThread ?? undefined` 를 `base` 에 조건부 spread 해 키를 생략하는데, spec §R17 재조정 문단이 명시한 "부재 시 키 생략(null 관례와 달리)" 과 정확히 일치. `COMPLETED` 등 비-waiting 상태는 `context` 자체가 `null` 로 유지되어 spec 의 "waiting_for_input 상태에서만" 과 일치. (2) 5-source(`presentation_user`/`ai_user`→user, `ai_assistant`/`ai_tool`/`system`→assistant) 매핑이 `spec/conventions/conversation-thread.md` §1.1 표와 정확히 동수·동값으로 일치. (3) `end_conversation` graceful 조건(`awaiting_user_message` + `pending.type==='ai_conversation'` + `nodeId` 확정)은 backend `assertNodeId`/`assertWaiting` 요구사항과 부합(backend 는 `end_conversation` 에 `nodeId` 필수 — FE 가 이를 만족할 때만 이 커맨드를 선택). (4) `1-widget-app.md` §3.1 표의 새 대화·대화 종료 행이 실제 `use-widget.ts` `endConversation`/`newChat` 구현과 트리거·EIA 처리·위젯 상태 열 모두 일치. Overview 가 아닌 본문 표·필드 정의 대상 대조 결과 CRITICAL 급 불일치 없음.
  - 제안: 없음(정보성).

- **[INFO]** 관련 spec 문서(`1-widget-app.md`, `3-auth-session.md`, `14-external-interaction-api.md`)가 동일 PR 에서 코드와 함께 갱신됨 — SPEC-DRIFT 아님
  - 상세: plan(`plan/in-progress/webchat-session-controls-history-restore.md`)의 "A. 스펙 재조정(planner)" 항목이 이번 diff 에 포함되어 spec 자체가 의도적으로 함께 변경된 원자적 PR 이다. 따라서 코드-spec 간 불일치를 "코드가 옳고 spec 이 낡음" 으로 판정할 대상이 없다(둘 다 같은 커밋에서 갱신).

## 검증

- `pnpm vitest run` (codebase/channel-web-chat): **268 passed / 268** (19 test files) — 신규 endConversation·roleOf·헤더 컨트롤 테스트 포함.
- `npx jest src/modules/external-interaction/` (codebase/backend): **200 passed / 200** (15 suites) — 신규 `getStatus` durable thread 4건 포함.
- TODO/FIXME/HACK/XXX: 변경 파일 전체에서 검색 결과 없음.
- 엣지 케이스 확인: durable thread `null`(배포 이전 row) → 키 생략, `COMPLETED` 상태 → context null(nodeRepo 조회 안 함, `not.toHaveBeenCalled()` 로 회귀 가드), 410/네트워크 실패 시 optimistic 종료 유지, booting 중 종료로 인한 in-flight `start()` 무효화(gen guard, 4건 시나리오 테스트) 모두 커버.
- 반환값: `getStatus()` 모든 상태 분기(`WAITING_FOR_INPUT`/그 외)에서 `ExecutionStatusDto` 형태를 일관 반환. `endConversation()` 은 `Promise<void>` 로 모든 경로(성공/410/기타 오류)에서 정상 resolve(예외 미전파) — UI 를 블로킹하지 않는 설계와 일치.
- 에러 시나리오: `interact()` 410 은 `EiaError`, 그 외는 일반 오류로 구분되나 `endConversation()` 은 이미 optimistic 종료 이후라 두 경우 모두 `console.warn` 만 남기고 삼킴 — spec §3.1 "명령 실패/거부해도 로컬은 이미 종료 상태 유지" 요구와 일치.

## 요약
웹채팅 위젯 세션 컨트롤(새 대화/대화 종료)과 새로고침 히스토리 복원 기능이 의도한 대로 완전히 구현되어 있다. 백엔드 `getStatus()` 의 durable `conversationThread` 동봉은 waiting 상태 한정·null 시 키 생략·COMPLETED 시 context null 유지라는 세 가지 핵심 규칙을 정확히 지키며, 프런트 `roleOf` 의 5-source→역할 매핑은 `spec/conventions/conversation-thread.md` §1.1 의 backend enum 과 정확히 대응한다. `end_conversation`(graceful) vs `cancel`(범용) 라우팅 조건, SSE 선차단 후 optimistic 종료라는 부작용 순서, `startGenRef` 세대 토큰을 통한 booting/streaming 중 race 차단까지 모두 spec 서술과 테스트로 뒷받침된다. 관련 spec 세 문서(EIA §5.3/§R17, widget-app §2/§3.1, auth-session §3.1)가 동일 PR 에서 코드와 함께 갱신되어 spec-code 불일치(SPEC-DRIFT 포함)가 발견되지 않았다. TODO/FIXME 등 미완성 표식 없음, 프런트 268/백엔드 200 테스트 전량 통과. 발견된 두 항목은 모두 INFO(정보성)이며 기능적 결함이나 spec 위반이 아니다.

## 위험도
NONE
