# 변경 범위(Scope) 리뷰 결과

> 대상: `plan/in-progress/webchat-session-controls-history-restore.md` 가 정의한 작업 A(spec 재조정)/B(백엔드
> `getStatus` durable thread 동봉)/C(프런트 role 매핑 + 세션 컨트롤) — 19개 변경 파일.

## 발견사항

- **[INFO]** `USER_TURN_SOURCES` 에 `TurnSource` 타입에 없는 `"user"` 리터럴이 포함됨
  - 위치: `codebase/channel-web-chat/src/lib/conversation.ts:19` (`const USER_TURN_SOURCES = new Set<string>(["presentation_user", "ai_user", "user"]);`)
  - 상세: 같은 diff 의 `eia-types.ts` `TurnSource` union 은 `"live" | "injected" | "presentation_user" | "ai_user" | "ai_assistant" | "ai_tool" | "system"` 7값만 정의하며 `"user"` 는 포함되지 않는다. JSDoc 도 "사용자 발화 = `presentation_user`/`ai_user`" 두 값만 설명해, `"user"` 는 문서화되지 않은 채 추가된 방어적 여분 값이다(런타임 `Set<string>` 이라 타입체커는 못 잡음). 요청 범위(백엔드 5-source→role 매핑)를 벗어나진 않지만, 어디서도 근거가 설명되지 않는 사족 값이라 스코프 경계가 살짝 흐려진다.
  - 제안: 실제로 필요 없다면 제거해 문서·타입·구현을 정확히 3중 일치시키고, 필요하다면(예: 레거시 fixture 호환) 그 이유를 주석에 1줄 명시.

- **[INFO]** 리뷰 payload(diff) 에 포함되지 않은 `use-widget.ts` 추가 미커밋 변경 존재
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (working tree, `git status`상 `M`이나 이번 scope.md 프롬프트의 file 10 diff 에는 미포함)
  - 상세: 현재 워크트리에는 이번 리뷰 payload 가 보여준 `endConversation` 액션 추가 외에, `startGenRef`(start 세대 토큰) 를 도입해 "booting 중 새 대화/종료가 in-flight `start()` 를 무효화하지 못해 옛 execution 을 되살리는 race" 를 막는 추가 수정이 존재한다. 주제상으로는 이번 작업(새로 추가된 `endConversation`/`newChat` 헤더 컨트롤이 유발하는 race)과 직접 연관돼 스코프 이탈로 보이진 않으나, **이번 scope 리뷰가 검토한 diff 스냅샷에는 반영돼 있지 않다** — 즉 이 변경은 별도로 커밋·재검토(fresh review) 대상이 되어야 한다.
  - 제안: 이 추가 수정도 같은 PR/커밋에 포함할 계획이면 review payload 를 최신 diff 로 재생성해 재검토하거나, RESOLUTION 기록에 별도 언급할 것. (자체 검토는 아니므로 등급을 올리지 않음 — 정보 제공 목적.)

## 요약

19개 변경 파일 전부가 구동 plan(`plan/in-progress/webchat-session-controls-history-restore.md`) §작업 A(spec 3건: `14-external-interaction-api.md`/`1-widget-app.md`/`3-auth-session.md`)·B(백엔드 `interaction.service.ts`+spec 테스트)·C(프런트 `conversation.ts`/`eia-types.ts`/`use-widget.ts`/`panel.tsx`/`styles.ts`+대응 테스트)와 1:1로 대응한다. `review/consistency/2026/07/09/18_27_06/**` 와 `plan/in-progress/*.md` 신설은 프로젝트 컨벤션상 커밋되는 프로세스 산출물로 스코프 위반이 아니다. 무관한 파일·불필요한 리팩토링·포맷팅 전용 변경·미사용 임포트·설정 파일 변경은 발견되지 않았다. `panel.tsx`/`styles.ts` 의 세션 컨트롤 UI 와 확인 다이얼로그는 "사용자 결정(2026-07-09): 새 대화+대화 종료 둘 다 노출, 가벼운 확인" 을 그대로 구현한 것으로 over-engineering 이 아니다. `eia-types.ts` 의 `TurnSource` 값 확장(5개 추가)도 새 role 매핑 요건에 필요한 최소 확장이다. 유일한 경미한 관찰은 (1) 문서화되지 않은 `"user"` 여분 값 1개, (2) 이번 payload 에 포함되지 않은 관련 후속 uncommitted 수정(`use-widget.ts` race guard) 존재 — 둘 다 차단 사유는 아니다.

## 위험도
LOW
