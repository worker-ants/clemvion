# 요구사항(Requirement) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + 새로고침 히스토리 복원 changeset 의 4번째(최종 수렴) 리뷰 라운드.
> 이번 라운드에 전달된 payload(14개 파일)는 실질적으로 (1) 앞선 3라운드 `/ai-review`(19_26_15) 산출물 5개
> (`requirement.md`/`scope.md`/`security.md`/`side_effect.md`/`testing.md`) + (2) `consistency-check --spec`(18_27_06)
> 산출물 5개(`SUMMARY.md`/`_retry_state.json`/`cross_spec.md`/`meta.json`/`plan_coherence.md`) + (3) 실제 spec 본문
> 변경 4개(`14-external-interaction-api.md`/`1-widget-app.md`/`2-sdk.md`/`3-auth-session.md`)로 구성 — **애플리케이션
> 코드(`interaction.service.ts`/`use-widget.ts`/`panel.tsx`/`conversation.ts` 등) 자체의 diff 는 이번 payload 에
> 포함돼 있지 않다.**

## 발견사항

- **[INFO]** 이번 라운드 payload 에 직전 WARNING 을 해소한 fix 커밋(`47311f164`)의 실제 코드 diff 가 누락됨
  - 위치: (payload 범위 밖) `git log` 상 `47311f164 test(web-chat): ai-review R3 반영 — isActiveConversationPhase
    진리표·재진입 가드 테스트 + 문서/정리` — `codebase/channel-web-chat/src/lib/widget-state.test.ts`,
    `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`,
    `codebase/channel-web-chat/src/widget/use-widget.ts`,
    `codebase/backend/src/modules/executions/entities/execution.entity.ts`,
    `review/code/2026/07/09/19_26_15/{RESOLUTION.md,SUMMARY.md,meta.json,api_contract.md,architecture.md,documentation.md,maintainability.md}`
  - 상세: 이번 requirement 리뷰어에게 전달된 diff 14개 파일 중 `review/code/2026/07/09/19_26_15/testing.md`(파일 5)는
    `isActiveConversationPhase` 에 직접 단위 테스트가 없다는 WARNING 을 담고 있는데, 정작 그 WARNING 을 해소한 fix
    커밋(`47311f164`, `widget-state.test.ts` 에 `WidgetPhase` 7값 진리표 `it.each` 추가)의 diff 자체는 이번 payload
    범위 밖이었다. 마찬가지로 `RESOLUTION.md`(해당 WARNING/INFO 처리 내역 요약)도 누락됐다. `git log`/`git show` 로
    직접 확인한 결과 해당 fix 는 실제로 존재하고(`widget-state.test.ts:29-41` 에 `describe("isActiveConversationPhase
    — 세션 컨트롤 노출 게이트")` + 7-phase truth table 확인), `execution.entity.ts` 주석 교차참조·
    `state.pending?.nodeId` 옵셔널 체이닝·plan frontmatter `status: complete` 갱신도 모두 같은 커밋에 함께 반영돼
    있어 **기능적으로는 미해결 항목이 없다.** 다만 이 확인은 payload 만으로는 불가능했고 `git log`/`git show` 로
    별도 보완했다는 점은 기록해 둔다 — 알려진 "리뷰 changeset 이 직전 검토 코드 제외" 패턴과 일치하는 라우팅
    현상으로, 코드 결함이 아니라 프로세스 관찰이다.
  - 제안: 조치 불필요(기능 검증은 완료). 후속 라운드에서도 동일 패턴이 반복되면 라우터의 diff 베이스 산정 로직을
    project-planner/merge-coordinator 쪽에서 점검할 가치가 있다.

- **[INFO]** cross_spec WARNING("TTL/idle 만료" 표현)의 해소는 표현 정밀도 수정일 뿐, 기저의 "새 대화 반복 시
  `waiting_for_input` orphan Execution 축적" 트레이드오프 자체는 그대로 유지(의도된 설계)
  - 위치: `spec/7-channel-web-chat/1-widget-app.md` §3.1 "새 대화 (restart)" 행(파일 12 diff, "이전 execution 은
    **명시 종료 명령을 보내지 않으므로** 서버에선 `waiting_for_input` 로 잔존하며 ... 무기한 보존 불변식 ...
    위젯 측 **토큰만** TTL/idle 로 만료된다")
  - 상세: `consistency-check`(18_27_06) WARNING #1 이 지적한 "TTL/idle 만료" 문구의 실행 엔진 불변식과의 문면 충돌은
    이번 diff 로 정확히 해소됐다(토큰 vs execution row 구분 명시). 다만 그 문구가 가리키던 실제 동작 —"헤더 새 대화"를
    반복 사용하면 서버측 `waiting_for_input` Execution row 가 명시 종료 없이 계속 쌓인다(자동 GC 없음) — 은 spec 이
    이번에 **문서화만 하고 완화하지 않은 채** 채택했다. 이는 스펙/코드가 서로 어긋난 게 아니라 spec 이 정직하게
    반영한 의도된 트레이드오프이며, `spec/5-system/4-execution-engine.md` §7.4/§7.5 의 "waiting Execution 무기한 보존"
    불변식과도 정합한다. 기능 요구사항 미충족은 아니다.
  - 제안: 조치 불필요(spec 이 이미 트레이드오프를 명문화). 다만 이 orphan 축적이 실제 운영 이슈로 확인되면 별도
    GC/아카이브 정책 plan 을 project-planner 에 위임할 사안 — 이번 PR 범위 밖.

## 검증한 요구사항 충족 지점 (독립 재확인, 문제 없음)

- **`getStatus()` durable thread 동봉 로직** (`codebase/backend/src/modules/external-interaction/interaction.service.ts:238-306`):
  `execution.status === WAITING_FOR_INPUT` 한정, `conversationThread`는 `execution.conversationThread ?? undefined`
  → `...(conversationThread ? { conversationThread } : {})` 스프레드로 **null 이면 키 자체 생략** —
  `spec/5-system/14-external-interaction-api.md` §5.3/§R17(파일 11 diff, "durable thread 가 없는 경우...
  키를 생략한다")과 line-level 로 일치. `interaction.service.spec.ts:564-646` 4개 테스트(ai_conversation 동봉·
  buttons 동봉·COMPLETED 시 미노출·null thread 시 `not.toHaveProperty('conversationThread')`)가 이를 고정.
- **대기 NodeExecution 없음 → context 전체 null(durable thread 조용히 드롭)**: 코드상 `context` 조립이
  `if (nodeExec?.node)` 블록 내부에서만 발생 — durable thread 존재 여부와 무관하게 대기 노드가 없으면 `context`가
  `null`로 남는다. 이는 testing.md INFO#3 이 이미 정확히 지적한 미검증 극단 케이스(low-priority defer)이며, 신규
  회귀는 아니다.
- **`isActiveConversationPhase`**(`codebase/channel-web-chat/src/lib/widget-state.ts:43-45`): `streaming`/
  `awaiting_user_message` 만 true — `spec/7-channel-web-chat/1-widget-app.md` §2 헤더 행(파일 12 diff, "세션
  컨트롤은 대화가 확립된(streaming/awaiting_user_message) 뒤에만 노출...booting...에서는 미노출")과 정확히 일치.
  `git show 47311f164`로 직접 확인한 `widget-state.test.ts` 신규 `it.each` 7-phase 진리표(collapsed/panel/booting=
  false, streaming/awaiting=true, ended/blocked=false)가 이를 고정 — round 3 testing WARNING 이 실제로 해소됨을
  코드 레벨에서 재확인.
- **`endConversation` graceful/cancel 라우팅**(`use-widget.ts:416-444`): `graceful = phase==='awaiting_user_message'
  && pending?.type==='ai_conversation' && !!pending?.nodeId` — spec §3.1 "대화 종료(end)" 행(파일 12 diff)의
  서술과 정확히 일치. 종료 순서(SSE 선차단→optimistic ended→best-effort 명령)와 `phase==='ended'` 재진입 가드도
  동일 파일에서 확인.
- **`roleOf` 매핑**(`codebase/channel-web-chat/src/lib/conversation.ts:34-46`): `USER_TURN_SOURCES =
  {presentation_user, ai_user}` 외 전부 assistant, 명시 `role` 우선 — `1-widget-app.md` §2 메시지 리스트 행(파일 12
  diff)의 문구와 line-level 일치.
- **`ExecutionStatusDto.context` Swagger**(`responses.dto.ts:96-102`): `Record<string, unknown> | null` 로 이미
  개방형이라 `conversationThread` 필드 추가에 DTO 시그니처 파괴 없음 — security.md/side_effect.md 주장과 일치.
- **spec cross-consistency 수정 반영**: `consistency-check`(18_27_06) WARNING("TTL/idle" 표현)·INFO 2건(재로드
  히스토리 과잉일반화·R17 기각 대안 누락) 모두 `spec/7-channel-web-chat/1-widget-app.md`(파일 12)·
  `spec/5-system/14-external-interaction-api.md`(파일 11) diff 에서 정확한 수정 문구로 직접 확인.
- **TODO/FIXME/HACK/XXX**: 이번 payload 14개 파일 자체에는 신규 마커 없음. `1-widget-app.md` 본문에 있는 기존
  "EIA-NF-03 연계 TODO"(`replay_unavailable` 소비 미배선)는 diff hunk 밖(비변경) 기존 서술로, 이번 changeset 이
  신설한 미완성 작업이 아니다.

## 요약

이번 라운드(19_40_53) payload 자체는 앞선 3라운드 리뷰·consistency-check 산출물의 커밋 + spec 본문 미세조정으로
구성돼 실질 애플리케이션 코드 diff 를 포함하지 않았으나, `git log`/`git show`/소스 직접 열람으로 보완 검증한 결과
직전 라운드(19_26_15)의 유일한 WARNING(`isActiveConversationPhase` 테스트 부재)과 부수 INFO 5건 전부가 후속 커밋
(`47311f164`)에서 실제로 해소돼 있음을 확인했다. spec 재조정 4개 파일(EIA §R17, widget-app §2/§3.1, sdk §3,
auth-session §3.1)은 durable `conversationThread` 노출 조건(waiting_for_input 한정)·키 생략 규칙·명령 라우팅
(graceful/cancel)·role 매핑까지 실제 구현과 함수 시그니처·필드명·기본값 레벨로 정확히 일치한다. 새로운
CRITICAL/WARNING 급 요구사항 미충족·엣지케이스 누락·에러 시나리오 미정의는 발견되지 않았다. 유일한 특이사항은
이번 reviewer payload 가 그 해소 커밋의 diff 자체를 담지 못한 라우팅 관찰(INFO, 기능엔 영향 없음)뿐이다.

## 위험도
NONE
