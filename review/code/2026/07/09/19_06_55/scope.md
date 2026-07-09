# 변경 범위(Scope) 리뷰 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + 새로고침 히스토리 복원
> (`plan/in-progress/webchat-session-controls-history-restore.md`) — 35개 변경 파일.
> 본 회차는 이전 리뷰(`review/code/2026/07/09/18_44_10/`) 의 WARNING 8건 + INFO 다수를
> 반영한 **fresh review** 대상 diff.

## 발견사항

- **[INFO]** 이전 리뷰·consistency-check 산출물(19개 파일) 이 이번 diff 에 신규 포함됨
  - 위치: `review/code/2026/07/09/18_44_10/**`(RESOLUTION.md·SUMMARY.md·9개 관점 리포트·meta.json·_retry_state.json),
    `review/consistency/2026/07/09/18_27_06/**`(SUMMARY.md·cross_spec.md·plan_coherence.md·meta.json·_retry_state.json)
  - 상세: 코드 변경 파일(14개) 대비 프로세스 산출물 파일 수가 더 많다. 다만 `CLAUDE.md` "정보 저장 위치" 표가
    `review/code/**`·`review/consistency/**` 를 정식 커밋 대상으로 명시하고 있고, 실제 내용도 이번 작업 자체를
    검토한 이전 라운드의 산출물이라 무관한 파일이 아니다. "리뷰가 자기 자신의 이전 라운드 산출물을 포함한 diff 를
    다시 리뷰하는" 재귀적 구조가 다소 이례적으로 보일 수 있으나, 이는 `feedback_fresh_review_after_resolution`
    관례(RESOLUTION 후 fresh review 1회)가 정상 작동한 결과이며 스코프 위반은 아니다.
  - 제안: 조치 불필요(참고 기록).

- **[INFO]** 리팩터(4건) 전부가 직전 리뷰 라운드의 WARNING 항목에 1:1 대응 — 임의 리팩토링 아님
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts`(`isActiveConversationPhase` 추출, 아키텍처 WARNING
    대응) · `codebase/channel-web-chat/src/widget/use-widget.ts`(`resetSessionRefs()` 추출, 유지보수성 WARNING
    대응 + `endConversation` teardown 순서 재배치, 부작용 WARNING 대응) · `codebase/channel-web-chat/src/widget/components/panel.tsx`
    (`CONFIRM_COPY` 조회 테이블, 유지보수성 WARNING 대응 + confirm 버튼 `aria-label` 분리, 유지보수성 WARNING 대응)
    · `codebase/backend/src/modules/external-interaction/interaction.service.ts`(`base` 공통 필드 선조립, 아키텍처
    INFO 대응)
  - 상세: 각 리팩터는 `review/code/2026/07/09/18_44_10/{architecture,maintainability,side_effect}.md` 의 구체
    항목·`RESOLUTION.md` 매핑 표와 정확히 짝을 이룬다. "현재 작업과 관련 없는 코드 정리"가 아니라 같은 기능(세션
    컨트롤/`endConversation`)의 직전 리뷰 피드백을 같은 파일 내에서 좁게 반영한 것이라 범위 이탈이 아니다.
  - 제안: 조치 불필요(양호 사례로 기록).

- **[INFO]** `USER_TURN_SOURCES` 의 미문서화 `"user"` 여분 리터럴 — 이전 라운드 지적대로 제거 확인
  - 위치: `codebase/channel-web-chat/src/lib/conversation.ts` (`const USER_TURN_SOURCES = new Set<string>(["presentation_user", "ai_user"]);`)
  - 상세: 이전 라운드 `scope.md`/`requirement.md`/`testing.md`/`maintainability.md` 가 공통 지적했던 `TurnSource`
    유니온에 없는 `"user"` 리터럴이 이번 diff 에서 제거돼 타입·JSDoc·구현 3자가 일치한다(`RESOLUTION.md` INFO#2).
    회귀·잔존 dead literal 없음.
  - 제안: 조치 불필요.

- **[INFO]** `use-widget.ts` `startGenRef`(세대 토큰) — 이전 scope 리뷰가 "diff 스냅샷 밖" 이라 지적했던 항목이
  이번엔 정상 포함
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (`startGenRef`, `teardownSession` 내 `startGenRef.current++`,
    `start()` 내 `gen` 캡처 + 2곳의 `if (startGenRef.current !== gen) return;` 가드)
  - 상세: 이전 라운드 `scope.md` INFO#2 가 "이 변경(race guard) 은 이번 작업(새 헤더 컨트롤이 유발하는 race)과 직접
    연관되지만 리뷰 payload 에 미포함됐다"고 지적했고, `RESOLUTION.md` INFO#1 이 "동일 PR 포함"으로 처리를
    명시했다. 이번 diff 에 실제로 포함돼 있어 후속 조치가 정확히 이행됐다. 기능적으로도 `newChat`/`endConversation`
    이 유발하는 teardown-vs-in-flight-start race 방지라는 이번 작업 범위 내 로직이라 스코프 이탈이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** spec 3건(`14-external-interaction-api.md`/`1-widget-app.md`/`3-auth-session.md`) 수정분이 plan
  §작업 A + consistency-check 결과와 1:1 대응
  - 위치: `spec/5-system/14-external-interaction-api.md`(§5.3 콜아웃 + R17 재조정·기각 대안 bullet),
    `spec/7-channel-web-chat/1-widget-app.md`(헤더 세션 컨트롤 표·§3.1 3개 행·TTL/idle 문구를 "토큰만"으로 정정),
    `spec/7-channel-web-chat/3-auth-session.md`(§3.1 재로드 시퀀스에 durable thread 언급 추가)
  - 상세: TTL/idle 문구 정정은 `review/consistency/.../cross_spec.md` WARNING#1, 재로드 문구 스코프 한정은
    INFO#1, R17 "기각 대안" bullet 은 `rationale_continuity` INFO#2 에 대응 — 모두 이번 작업이 재조정한 R17/§3.1
    범위 내 문구 수정이며, 무관한 절 수정은 없음.
  - 제안: 조치 불필요.

## 요약

35개 변경 파일 전부가 구동 plan(`plan/in-progress/webchat-session-controls-history-restore.md`) §작업 A(spec
3건)·B(백엔드 `interaction.service.ts`+spec)·C(프런트 `conversation.ts`/`eia-types.ts`/`use-widget.ts`/`panel.tsx`/
`styles.ts`+테스트) 와 정확히 대응하거나, 프로젝트 컨벤션상 커밋 대상인 프로세스 산출물(`plan/in-progress/*.md`,
`review/code/**`, `review/consistency/**`)이다. 이번 회차는 직전 리뷰(18_44_10)의 WARNING 8건 전량 + INFO 다수를
반영한 fresh review 대상인데, 검토 결과 신규 리팩터(`resetSessionRefs`·`CONFIRM_COPY`·`isActiveConversationPhase`
추출·getStatus `base` 조립)와 순서 재배치(`endConversation` teardown 선행)가 전부 직전 라운드의 구체 WARNING/INFO
항목에 좁게 대응하며, 관련 없는 코드 정리나 요청 밖 기능 확장은 없다. `"user"` dead literal 제거·`startGenRef`
race guard 포함 등 이전 scope 리뷰가 남긴 후속 조치도 정확히 이행됐다. 무관한 파일·불필요한 리팩토링·포맷팅
전용 변경·미사용 임포트(`fireEvent` 는 신규 테스트에서 실제 사용)·의도치 않은 설정 변경은 발견되지 않았다.

## 위험도
LOW
