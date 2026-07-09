# 문서화(Documentation) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + `getStatus` durable `conversationThread` 새로고침 히스토리
> 복원. 본 회차(19_26_15)는 라운드1(`18_44_10`)·라운드2(`19_06_55`) 의 문서화 WARNING/INFO 를 모두 반영한
> 이후의 fresh 상태를 diff 원본(spec 3건·plan·코드 JSDoc·주석·CHANGELOG·README)까지 직접 grep/diff 로
> 재확인한 결과다.

## 이전 라운드 문서화 지적사항 — 재검증 결과

모두 실제로 해소됨을 코드 레벨에서 확인했다(재발 없음):

- `CHANGELOG.md` — `## Unreleased — 웹채팅 위젯 세션 컨트롤...` 항목이 다른 최근 항목과 동일한 상세도로 존재.
- `codebase/channel-web-chat/README.md` "상태" 섹션 — 5-source→role 매핑·durable 복원·헤더 세션 컨트롤이
  모두 "구현됨" 목록에 반영됨.
- `codebase/channel-web-chat/src/lib/eia-types.ts:33-34` `TurnSource` JSDoc 의 spec 상대경로 링크 —
  `../../../../spec/...`(4단계)로 정정되어 실제로 `spec/conventions/conversation-thread.md` /
  `spec/7-channel-web-chat/1-widget-app.md` 를 정확히 가리킴(직접 확인).
- 프로덕션 코드 주석의 "WARNING #N" 리뷰 라운드 참조 — `grep -rn "WARNING #" codebase/channel-web-chat/src
  codebase/backend/src/modules/external-interaction` 결과 0건, 전량 제거/안정 표현으로 대체됨.
- `codebase/channel-web-chat/src/lib/conversation.ts` 파일 헤더 주석 — `roleOf`(5-source→role 축약) 요약으로
  갱신됨(더 이상 `live`/`injected` 2값만 언급하는 stale 문구 없음).
- `spec/7-channel-web-chat/1-widget-app.md` §3 다이어그램 하단 "헤더 세션 컨트롤(§3.1)" bullet —
  "대화가 확립된(streaming/awaiting_user_message) 뒤 ... '대화 종료'로 `[ended]` 전이, '새 대화'로 ...
  `[booting]` 재시작" 로 두 컨트롤 모두 streaming/awaiting 기원임을 명문화(다이어그램 자체는 여전히
  `awaiting_user_message→ended` 화살표만 그리지만, 산문이 정확히 보완).
- `use-widget.ts` `endConversation` JSDoc — `nodeId` 미확정 시 동일 phase 라도 `cancel` 로 폴백하는 조건이
  명시됨("ai_conversation 이라도 nodeId 미확정이면 cancel").
- spec 3건(`14-external-interaction-api.md` §5.3/R17, `1-widget-app.md` §2/§3.1, `3-auth-session.md` §3.1)의
  "TTL/idle" 표현·"waiting_for_input 상태일 때" 한정어 — cross_spec WARNING/INFO 대로 정정 확인
  (`1-widget-app.md` §3.1 "새 대화" 행 = "**토큰만** TTL/idle 만료" + execution row 는 무기한 잔존 병기,
  "페이지 새로고침/이동" 행 = "`waiting_for_input` 상태면" 한정어 추가).

## 신규 발견사항 (본 라운드)

- **[INFO]** 신규 plan 파일의 frontmatter `status: in-progress` 가 `plan/complete/` 위치와 불일치
  - 위치: `plan/complete/webchat-session-controls-history-restore.md` (frontmatter 5번째 줄 `status: in-progress`)
  - 상세: 이 plan 은 본 PR 로 `plan/in-progress/` → `plan/complete/` 로 이동됐고(커밋 `160840462`
    `chore(plan): mark webchat-session-controls-history-restore complete`, `git show --name-status` 로
    rename 확인), 본문 검증 체크박스도 4/5 가 `[x]`(나머지 1개는 `[~]` 정당 스킵)로 완료 상태다. 그런데
    frontmatter 의 `status: in-progress` 필드는 갱신되지 않아 파일 위치·체크박스와 모순된 값으로 남아있다.
    `status` 는 `plan-lifecycle.md` §4 가 build guard 강제 대상이 아닌 "허용된 추가 필드"로 분류해 실패를
    유발하진 않지만, 향후 `status:` 필드로 grep/필터링하는 도구·사람에게는 오도될 수 있다. 참고로
    `plan/complete/*.md` 전수 검사 결과 동일 패턴(`status: in-progress` 인 채 `complete/` 에 위치)이
    `backend-msg-i18n-impl.md`/`eia-strip-llmcalls.md`/`refactor-cron-to-bullmq.md`/`system-status-page.md`
    4건 더 있어, 이 PR 이 새로 만든 문제라기보다 기존에도 존재하던 낮은 우선순위 패턴을 답습한 것이다.
  - 제안: `status: in-progress` 줄을 제거하거나 `status: complete` 로 갱신할 것. 필수 차단 사유는 아님
    (기존 저장소 관례상 이미 4건의 선례가 있는 저위험 패턴).

## 긍정적 관찰 (참고)

- `interaction.service.ts` `getStatus()` JSDoc·인라인 주석이 `conversationThread` 신규 동봉의 보안 근거
  ("이미 SSE 로 공개 중인 데이터라 신규 민감 표면 아님")·wire shape 근거(`cloneThread`/
  `stageDurableResumeSnapshot` 실제 식별자, grep 으로 실존 확인)까지 상세히 남아 리뷰어가 스펙을 재확인할
  필요가 없는 수준.
- `conversation.ts`/`eia-types.ts` 의 `TurnSource`/`roleOf` JSDoc 이 "왜"(새로고침 복원 thread 는 `role`
  없이 `source` 만 옴 → 매핑 없으면 전부 assistant 로 뒤집힘)를 정확히 설명하고, `spec/conventions/
  conversation-thread.md §1.1` 의 backend 5값 enum(`presentation_user`/`ai_user`/`ai_assistant`/`ai_tool`/
  `system`)과 grep 으로 대조해 정확히 일치함을 확인했다.
- spec 3건이 코드와 같은 PR 로 함께 갱신됐고, R17 addendum 에 "기각 대안" 두 개(SSE 전용 유지+재조회 순환,
  NodeExecution.output_data 분산 재구성 무손실 불가)까지 rationale-continuity 관례대로 기록.
  `plan/complete/webchat-session-controls-history-restore.md` 도 문제·결정·작업·검증·잔여를 표준 구조로
  기록하고 3라운드 리뷰 이력까지 검증 절에 남겨 추적 가능성이 높다.
- `use-widget.ts` `startGenRef`(세대 토큰)·`endConversation`·`resetSessionRefs` 모두 "왜"(booting/streaming
  중 종료·새 대화가 in-flight `start()` 를 무효화하는 race, SSE 선차단으로 중복 `conversationEnded` 방지)를
  함수 단위 JSDoc/인라인 주석으로 정확히 설명하며, 실제 구현과 대조해도 진술이 사실과 일치한다.
- 테스트 파일들(`interaction.service.spec.ts`/`conversation.test.ts`/`panel.test.tsx`/
  `use-widget-eager-start.test.ts`) 모두 신규 케이스 위에 "왜 이 케이스가 필요한가"를 한 줄 주석으로 남겨
  회귀 방지 의도가 분명하다.
- 신규 REST 응답 필드(`context.conversationThread`)·환경변수 등 별도 설정 문서화가 필요한 신규 config 는
  없다(순수 additive read-only 필드, 신규 env var 없음).

## 요약

라운드1·라운드2 에서 지적된 문서화 WARNING(CHANGELOG 누락)·INFO(README stale·JSDoc 링크 off-by-one·
review-round 번호 잔존 주석·conversation.ts 헤더 주석 staleness·endConversation JSDoc 엣지 케이스)가 모두
실제 코드/문서에 반영돼 있음을 diff 와 grep 으로 직접 재확인했다 — 재발이나 미반영 항목은 없다. spec 3건·
plan·JSDoc·인라인 주석·CHANGELOG·README 가 하나의 일관된 서사로 동기화된 모범 사례에 가깝다. 이번 라운드
에서 새로 발견한 것은 신규 `plan/complete/` 파일의 frontmatter `status: in-progress` 값이 폴더 위치·완료
체크박스와 모순된다는 점(INFO) 뿐이며, 이는 저장소에 이미 4건의 선례가 있는 저위험·비차단 패턴이다.

## 위험도
NONE
