# 요구사항(Requirement) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + 새로고침 히스토리 복원.
> 핵심 변경: `InteractionService.getStatus()` 가 `waiting_for_input` 시 durable `Execution.conversation_thread`
> 를 `context.conversationThread` 로 REST 응답에 동봉(EIA §R17 재조정) + 위젯 헤더 세션 컨트롤(새 대화/대화 종료,
> 가벼운 확인) + `conversation.roleOf` 의 wire 5-source→role 매핑. 본 changeset 에는 앞선 2 라운드
> `/ai-review`(18_44_10, 19_06_55)와 `consistency-check --spec`(18_27_06) 산출물도 함께 커밋되어 있어, 그 결과가
> 반영된 최종 코드/spec 상태를 기준으로 독립 재검증했다.

## 발견사항

- **[INFO]** `execution.entity.ts` 의 기존(비변경) 주석이 이번 노출과 문면상 긴장 관계
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts:160` (`conversation_thread`
    컬럼 JSDoc — `"API 응답 DTO 미포함 — 내부 rehydration 전용 (execution-response.dto.ts 에 노출 없음)"`)
  - 상세: 이 주석은 워크스페이스 인증 내부 실행 API(`execution-response.dto.ts`, `/api/executions/:id`)
    기준으로는 여전히 사실이다(grep 결과 해당 DTO 에 `conversationThread` 없음). 하지만 이번 diff 로
    **다른 API 표면**(`external-interaction` 모듈의 `ExecutionStatusDto`, `/api/external/executions/:id`)은
    동일 컬럼을 `context.conversationThread` 로 REST 노출하게 됐다. 두 DTO/엔드포인트가 별개이므로 실제
    모순은 아니지만, 엔티티 주석만 읽는 개발자는 "이 컬럼은 어떤 API 로도 나가지 않는다"로 오해할 수 있다.
    이 파일은 이번 diff 대상이 아니라 코드 결함은 아니다.
  - 제안: 필수 아님. 후속으로 엔티티 주석에 "단, external-interaction `ExecutionStatusDto.context.conversationThread`
    는 read-only 로 노출(EIA §R17)"라는 한 줄 교차 참조를 추가하면 혼선을 줄일 수 있다.

- **[INFO]** 신규 plan 파일이 `plan/complete/`에 위치하면서 frontmatter `status: in-progress`
  - 위치: `plan/complete/webchat-session-controls-history-restore.md` frontmatter (`status: in-progress`)
  - 상세: `.claude/docs/plan-lifecycle.md` 에 따르면 `status` 필드는 필수도 build-guard 강제 대상도 아니며
    (필수 3필드는 `worktree`/`started`/`owner`), 실제로 `plan/complete/` 하위 대다수 파일은 `status` 필드
    자체가 없다. 다만 존재하는 경우 "complete 폴더 = 완료" 라는 폴더 시맨틱과 "in-progress" 값이 시각적으로
    어긋난다. 기능/구현 완전성과는 무관한 문서 위생 이슈.
  - 제안: 선택 사항 — `status` 필드를 제거하거나 `status: complete` 로 정정.

## 검증한 요구사항 충족 지점 (문제 없음 확인)

- **명령 라우팅(graceful vs cancel)**: `endConversation()` 의 `graceful = phase==='awaiting_user_message' &&
  pending?.type==='ai_conversation' && !!pending?.nodeId` 조건이 EIA §5.1 표(`end_conversation` requires
  `nodeId`)·`1-widget-app.md §3.1` 표·CHANGELOG 서술과 line-level 로 일치. `use-widget-eager-start.test.ts`
  가 4가지 조합(대기 ai_conversation+nodeId / streaming / buttons 대기 / ai_conversation+nodeId 미확정)을
  모두 실측 검증.
- **중복 종료 경합 방지**: `endConversation()` 이 `resetSessionRefs()`(SSE 선차단) → `dispatch(ENDED)` →
  `sendEvent` → best-effort 명령 순서로 실행되고, 진입부에 `if (state.phase === 'ended') return` 가드가
  있어 명령이 유발하는 terminal SSE 이벤트가 도착해도 `handleEiaEvent` 가 이미 닫힌 스트림에서 발화하지
  않는다 — CHANGELOG·plan RESOLUTION 서술과 일치(1라운드 WARNING #1 반영 확인).
- **`isActiveConversationPhase`**: `streaming`/`awaiting_user_message` 만 true, `booting`/`collapsed`/`panel`/
  `ended`/`blocked` 는 false — `1-widget-app.md §2` 헤더 행·`panel.test.tsx` 8개 케이스와 일치.
- **`roleOf` 매핑**: `presentation_user`·`ai_user` → user, 그 외(`ai_assistant`/`ai_tool`/`system`/미상) →
  assistant, 명시 `role` 우선 — `spec/conventions/conversation-thread.md §1.1`(backend 5-source 정의)·
  `1-widget-app.md §2`(위젯 UI 매핑 문구)와 정확히 일치. `conversation.test.ts` 3케이스로 검증.
- **`getStatus` durable thread 동봉 조건**: `execution.status === WAITING_FOR_INPUT` 한정, `conversationThread`
  는 `null` 이면 **키 자체 생략**(형제 필드 `null` 관례와 의도적으로 다름) — `interaction.service.ts`,
  `spec/5-system/14-external-interaction-api.md §5.3/§R17`(2026-07-09 갱신분), `interaction.service.spec.ts`
  4개 신규 테스트(ai_conversation/buttons/COMPLETED 회귀가드/null) 가 모두 일치. `parseWaitingForInput`
  (`eia-events.ts`)이 이미 제네릭하게 `conversationThread` 필드를 읽던 기존 코드라 프런트 소비 경로에
  별도 수정이 필요 없었던 점도 실제 코드로 확인.
- **`ExecutionStatusDto.context` Swagger 설명**과의 정합: `responses.dto.ts:98` 의 기존(비변경) 설명이
  이미 "conversationThread snapshot" 을 언급하고 있었음 — 이번 구현이 기존에 미이행 상태였던 Swagger 약속을
  뒤늦게 충족시키는 방향이라 CRITICAL 급 계약 위반 없음.
- **spec cross-consistency**: 앞선 `consistency-check --spec`(18_27_06) 이 지적한 WARNING("TTL/idle 만료"
  문구가 실행엔진 무기한 보존 불변식과 충돌)과 INFO("waiting_for_input 한정 조건 누락")는 최종 diff의
  `1-widget-app.md §3.1` 표에 각각 "**토큰만** TTL/idle 로 만료" + "**`waiting_for_input` 상태면** durable
  conversationThread 동봉" 문구로 반영되어 해소된 상태를 직접 확인.
- **TODO/FIXME/HACK/XXX**: 변경분 전체(`git diff origin/main -- codebase/`)에 해당 마커 없음.

## 요약

이번 changeset(백엔드 `getStatus` durable thread REST 노출 + 프런트 헤더 세션 컨트롤/role 매핑)은 CHANGELOG·
plan·spec(EIA §R17, 1-widget-app §2/§3.1, 3-auth-session §3.1) 서술과 실제 구현이 함수 시그니처·필드명·기본값
(키 생략 vs null)·상태 전이(graceful/cancel 라우팅, phase 게이팅)까지 line-level 로 일치한다. 이미 2 라운드의
`/ai-review`(Critical 0, WARNING 8건 전량 반영)와 `consistency-check --spec`(WARNING 1 + INFO 2 전량 반영)이
선행되어 있었고, 독립적으로 재검증한 결과 새로운 CRITICAL/WARNING 급 요구사항 미충족·엣지케이스 누락·에러
시나리오 미정의는 발견되지 않았다. 잔여 발견사항 2건은 모두 이번 diff 파일 밖(엔티티 기존 주석) 또는 순수
문서 위생(plan status 필드) 수준의 INFO 로, 기능 완전성·spec fidelity 를 저해하지 않는다.

## 위험도
NONE
