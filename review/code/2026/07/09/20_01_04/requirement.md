# 요구사항(Requirement) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + 새로고침 히스토리 복원 changeset 의 5번째(최종 수렴) 리뷰 라운드.
> 이번 라운드 payload(26개 파일)는 실질적으로 이전 3라운드 `/ai-review`(19_26_15) 산출물 + `consistency-check --spec`
> (18_27_06) 산출물 + 4라운드째(19_40_53) 산출물(RESOLUTION/SUMMARY 포함) + spec 본문 diff 4건으로만 구성되고,
> **애플리케이션 코드(`interaction.service.ts`/`use-widget.ts`/`panel.tsx`/`conversation.ts` 등) 자체의 diff 는
> 이번 payload 에 포함돼 있지 않다.** 이는 알려진 "다회 리뷰 후속 세션 changeset 이 직전 반영 코드를 제외" 패턴과
> 일치한다. 이에 따라 payload 인용만으로 결론 내리지 않고, `git log`/`git show`/`git diff origin/main...HEAD`/실제
> 테스트 실행(`vitest run`, `jest`)으로 현재 HEAD(커밋 `008d71cfa`)의 실제 코드 상태를 직접 재검증했다.

## 발견사항

- **[INFO]** 4라운드(19_40_53) RESOLUTION.md 가 "반영 완료"로 기록한 WARNING 2건(concurrency `start()` catch
  gen 검사 누락, documentation `"gone"` reason 미통지)이 실제 코드에 반영됐는지 payload 만으로는 검증 불가 —
  `git show 008d71cfa` 로 직접 확인 필요했음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:304-307`(`start()` catch, 신규
    `if (startGenRef.current !== gen) return;`), `:320-327`(`sendCommand` 410 catch, 신규
    `bridgeRef.current?.sendEvent("conversationEnded", { reason: "gone" })`)
  - 상세: 두 수정 모두 커밋 `008d71cfa`(`fix(web-chat): ai-review R4 반영`)에 실제로 존재하며, `try` 블록의 두
    기존 gen 검사(`:289`,`:299`)와 정확히 대칭을 이룬다. 회귀 테스트도 같은 커밋의
    `use-widget-eager-start.test.ts`에 2건 추가돼 있다: "booting 중 종료 후 옛 webhook 이 뒤늦게 실패(reject)해도
    stale start catch 가 상태를 덮지 않음"(phase/error 불변 단언), "submit_message 명령이 410(Gone) → phase
    ended". 웹챗 전체 279/279, 백엔드 `interaction.service.spec.ts` 32/32 통과를 직접 실행해 재확인했다. 기능적
    미해결 항목은 없다 — 이는 코드 결함이 아니라 리뷰 라우팅(diff base 산정)의 프로세스 관찰이다.
  - 제안: 조치 불필요(기능 검증 완료). 참고로, 두 번째 회귀 테스트("410→ended")는 `phase` 전이만 단언하고
    `bridgeRef`/`postMessage`/`sendEvent` 자체가 `{reason:"gone"}` 으로 실제 호출됐는지는 spy 로 직접 확인하지
    않는다 — 다만 이는 이 코드베이스 테스트 스위트 전반의 기존 관례(이전 라운드 testing.md 가 이미 지적·수용한
    한계)이지 이번 fix 만의 신규 결함은 아니므로 별도 조치를 요구하지 않는다.

- **[INFO]** plan frontmatter `spec_impact` 리스트가 실제 변경된 spec 파일 4건 중 1건(`2-sdk.md`) 누락
  - 위치: `plan/complete/webchat-session-controls-history-restore.md` frontmatter `spec_impact:`
    (`14-external-interaction-api.md`/`1-widget-app.md`/`3-auth-session.md` 3건만 등재)
  - 상세: `git diff origin/main...HEAD -- spec/` 결과 실제로는 `spec/7-channel-web-chat/2-sdk.md`
    (`conversationEnded.data.reason` 을 열린 문자열로 명문화)도 함께 변경됐으나 frontmatter `spec_impact`
    리스트에는 없다. 기능 요구사항 충족 여부에는 영향 없는 plan 메타데이터 완전성 이슈다.
  - 제안: 선택 사항 — `spec_impact` 에 `spec/7-channel-web-chat/2-sdk.md` 추가.

## 검증한 요구사항 충족 지점 (현재 HEAD 기준 독립 재확인, 문제 없음)

- **`getStatus()` durable thread 동봉**(`interaction.service.ts:238-306`): `execution.status ===
  WAITING_FOR_INPUT` 한정, `conversationThread`는 `execution.conversationThread ?? undefined` →
  `...(conversationThread ? { conversationThread } : {})` 스프레드로 null 이면 **키 생략** —
  `spec/5-system/14-external-interaction-api.md` §5.3/§R17 문구와 line-level 일치. 백엔드 32개 테스트 통과.
- **`endConversation` graceful/cancel 라우팅**(`use-widget.ts:429-435`): `graceful = phase==='awaiting_user_message'
  && pending?.type==='ai_conversation' && !!pending?.nodeId` — `1-widget-app.md` §3.1 "대화 종료" 행 서술과 정확히
  일치. 종료 순서(SSE 선차단→optimistic ended→best-effort 명령)·`phase==='ended'` 재진입 가드 모두 구현·주석·spec
  삼자 일치.
- **`isActiveConversationPhase`**(`widget-state.ts:43-45`): `streaming`/`awaiting_user_message` 만 true —
  `1-widget-app.md` §2 헤더 행("세션 컨트롤은 대화가 확립된(streaming/awaiting_user_message) 뒤에만 노출")과 일치.
  `widget-state.test.ts` `it.each` 7-phase 진리표(collapsed/panel/booting/streaming/awaiting/ended/blocked)로
  함수 자체가 직접 고정돼 있음을 확인(3라운드 WARNING 이 실제로 해소).
- **`roleOf` 매핑**(`conversation.ts:34-46`): `USER_TURN_SOURCES={presentation_user, ai_user}` 외 전부
  assistant, 명시 `role` 우선 — `1-widget-app.md` §2 메시지 리스트 행·`spec/conventions/conversation-thread.md`
  §1.1(backend 5-source 정의)과 일치.
- **`execution.entity.ts` JSDoc 교차참조**(round1 INFO #4 처리 확인): `conversation_thread` 컬럼 주석에 "단 EIA
  `getStatus`(...) 는 waiting_for_input 시 이 스냅샷을 read-only 로 노출한다" 문구가 실제로 추가돼 있어, 이전
  라운드가 지적한 "엔티티 주석만 읽으면 오해 가능" 긴장이 해소돼 있다.
- **plan frontmatter**: `status: complete`(이전 라운드 INFO 였던 `in-progress` 잔존 해소 확인).
- **TODO/FIXME/HACK/XXX**: `git diff origin/main...HEAD -- codebase/` 전체에 해당 마커 없음(재확인).
- **테스트 실행**: `codebase/channel-web-chat` 279/279, `interaction.service.spec.ts` 32/32 — 두 스위트 모두
  현재 세션에서 직접 실행해 통과 확인(RESOLUTION.md 의 "279 passed" 서술과 일치).

## 요약

이번 5라운드 payload 자체(review 산출물 26개 + spec 문서 diff)에는 애플리케이션 코드 diff 가 없어 독립적인
기능 검증을 위해 `git show`/`git diff`/테스트 실행으로 현재 HEAD(`008d71cfa`)를 직접 재확인했다. 그 결과 4라운드
(19_40_53)에서 발견·"반영"으로 기록된 WARNING 2건(concurrency `start()` catch gen 검사 누락, `"gone"` reason
host 미통지)이 실제로 코드에 반영되어 있고 회귀 테스트로 고정돼 있으며, 웹챗 279/백엔드 32 테스트가 모두
통과함을 확인했다. 앞선 라운드들이 검증한 spec 본문-구현 line-level 일치(durable thread 노출 조건·키 생략
규칙, `endConversation` graceful/cancel 라우팅, `isActiveConversationPhase` 진리표, `roleOf` 매핑)도 현재 HEAD
기준 모두 유지된다. 새로운 CRITICAL/WARNING 급 요구사항 미충족·엣지케이스 누락·에러 시나리오 미정의는 발견되지
않았다. 유일한 잔여 사항은 plan frontmatter `spec_impact` 리스트에 실제 변경 파일 1건(`2-sdk.md`)이 누락된
메타데이터 완전성 이슈(INFO)뿐이며, 기능·spec fidelity 를 저해하지 않는다.

## 위험도
NONE
