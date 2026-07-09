# 신규 식별자 충돌 검토 — webchat 세션 컨트롤 + 새로고침 히스토리 복원 (impl-done, 최종 재확인 라운드)

검토 모드: --impl-done, scope=`spec/7-channel-web-chat/`, diff-base=`origin/main`, SoT=HEAD 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/webchat-session-history-0e9639`).

본 라운드는 직전 검토(`review/consistency/2026/07/09/20_19_59/naming_collision.md`, `20_32_24/SUMMARY.md`)가
지적한 항목들의 반영 상태(커밋 `e3357d518`, `382e3a89d`)를 재확인하는 최종 라운드다. 두 커밋의 실질 diff는
spec 산문 보강(1-widget-app.md §2/§3.1 "알려진 제약(Planned)" 명문화, dangling 링크 정정)과
`styles.ts`/`conversation-thread.md` 주석·문단 추가뿐이며, 신규 요구사항 ID·엔티티·API endpoint·이벤트명·
ENV/config 키·spec 파일 경로는 추가되지 않았다.

## 발견사항

- **[WARNING]** 신규 CSS 클래스 `.wc-panel-action` 이 기존 `.wc-action` 과 시각 스타일이 거의 동일 → **직전 라운드에서 이미 지적, 본 라운드 확인 결과 해소됨**
  - target 신규 식별자: `.wc-panel-action`/`.wc-panel-actions` (`codebase/channel-web-chat/src/widget/styles.ts:14-18`)
  - 기존 사용처: `.wc-action` (동 파일, 퀵 액션 버튼 — `waiting_for_input.buttonConfig` 탭 시 `click_button`)
  - 상세: 커밋 `e3357d518` 가 `.wc-panel-action` 정의부 바로 위에 "`.wc-action`(퀵 액션, `click_button` 발사)과는 별개
    클래스/역할(서버 명령 아님, 로컬 세션 제어). 통합 금지." 주석을 추가해 향후 유지보수자의 혼동/오통합 시도를 예방했다.
    코드 실사(git show `e3357d518` -- styles.ts)로 반영을 직접 확인함.
  - 제안: 조치 완료 — 추가 조치 불필요.

- **[INFO]** `user_ended` 리터럴이 두 계층에서 각자 독립적으로 재사용됨 (직전 라운드 `20_32_24` SUMMARY 에서 이미 저우선 defer로 기록된 항목의 재확인)
  - target 신규 식별자: `"user_ended"` (`codebase/channel-web-chat/src/widget/use-widget.ts` `endConversation()` 의 `reason` 상수, `spec/7-channel-web-chat/2-sdk.md` §3 `wc:event conversationEnded.data.reason` 열린 문자열 예시값 — 헤더 "대화 종료" 클릭 시)
  - 기존 사용처: `user_ended` 포트/`endReason` (`spec/4-nodes/3-ai/1-ai-agent.md:210,443,817-853,1125` — AI Agent **Multi Turn** 노드의 예약 시스템 출력 포트 ID이자 `output.result.endReason` 값. `execution.end_conversation` 명령 수신 시 `buildMultiTurnFinalOutput(..., 'user_ended')` 로 워크플로우 그래프 상의 고정 포트로 분기)
  - 상세: 완전히 다른 두 표면 — 하나는 워크플로우 **그래프 정의**(포트 ID, `conditions[i].id` 예약어 충돌 검사 대상, 워크플로우 편집기에 노출)이고 다른 하나는 임베드 위젯이 host 페이지로 보내는 **postMessage 이벤트의 열린 문자열 payload**(`wc:event` `conversationEnded.data.reason`)다. import/네임스페이스/런타임 충돌은 없으며, 의미도 "사용자가 대화를 명시 종료했다"로 실질적으로 정합적이라 우연한 오타가 아니라 자연스러운 어휘 수렴으로 보인다(직전 `endConversation` 명명 정합 사례와 같은 패턴). 다만 repo 전역 `user_ended` grep 시 워크플로우 그래프 계층과 위젯 UI 이벤트 계층의 결과가 섞여 나와, 두 계층을 모르는 신규 기여자가 순간적으로 "위젯 종료 사유가 AI Agent 포트로 라우팅되는가?"라고 오인할 소지가 있다(둘은 인과관계 없음 — 위젯 쪽 `cancel`/`end_conversation` 커맨드가 서버에서 실제로 `user_ended` 포트로 분기되는 것은 AI Agent Multi Turn 특유의 내부 동작일 뿐, 위젯이 이 리터럴을 그 포트에 "전달"하지 않는다. 위젯 `reason` 은 host 통지용 로컬 문자열).
  - 제안: 기능적 충돌이 아니므로 코드/spec 변경 불요(직전 라운드 결정 유지). 원한다면 `use-widget.ts` `endConversation()` 의 `reason = "user_ended"` 옆에 "AI Agent Multi Turn `user_ended` 포트(1-ai-agent.md §7.7)와 리터럴만 우연 일치 — 위젯→서버 전달 값 아님, host 통지 전용" 한 줄 주석을 남기면 향후 grep 혼동을 예방할 수 있다(선택적, 저우선).

### 확인했으나 충돌 아님으로 판단한 항목 (재확인)

- `.wc-confirm`/`.wc-confirm-actions`/`.wc-confirm-yes`/`.wc-confirm-no` (`styles.ts:21-24`, `panel.tsx` 세션 컨트롤 2단계 확인바) — repo 전체(`codebase/channel-web-chat/src/`, `codebase/frontend/src/`)에 동명 클래스나 `role="alertdialog"` 선례가 없어 완전 신규이며 충돌 없음.
- `resetSessionRefs`/`startGenRef`/`CONFIRM_COPY`/`ConfirmKind` (`use-widget.ts`/`panel.tsx` 모듈 스코프 전용) — 외부 노출 없는 지역 식별자, 충돌 없음.
- EIA `§R17` 제목 갱신("... `conversationThread` reload 노출 재조정 2026-07-09" 부기) — 문서 내 유일한 `### R17.` 항목이며 번호 재사용·중복 없음(`grep "^### R17\."` 결과 1건).
- `spec/conventions/conversation-thread.md` "소비처 갱신 (2026-07-09)" 신규 문단 — 신규 섹션 번호 도입 없이 기존 §8.4 안에 문단만 추가, 헤더/앵커 충돌 없음.
- `1-widget-app.md` §2/§3.1 의 "알려진 제약(Planned)" 문구 2건(presentation shape 매핑, host `resetSession`-during-booting) — 신규 요구사항 ID 부여 없이 기존 표 셀에 산문으로 삽입, ID 충돌 대상 아님.
- 신규 ENV var·config key·API endpoint·spec 파일 경로 — 이번 라운드 diff(`e3357d518`..`382e3a89d`)에 없음(grep 확인: `process.env.`/`NEXT_PUBLIC_`/`WEB_CHAT_` 신규 추가 0건, `git diff --diff-filter=A -- spec/` 결과 0건).
- 직전 라운드(`20_19_59`)가 이미 "충돌 아님"으로 결론낸 `context.conversationThread`(REST 필드 재사용)·`TurnSource` 5값 확장·`isActiveConversationPhase` 는 본 라운드 diff 에서 재변경되지 않아 재검토 대상 아님(코드 실사로 값 변경 없음 확인).

## 요약

이번 최종 라운드가 검토한 diff(`e3357d518`, `382e3a89d`)는 순수 문서 보강·주석 추가이며 신규 요구사항 ID·엔티티/타입명·
API endpoint·이벤트명·ENV/config 키·spec 파일 경로 중 어느 것도 새로 도입하지 않았다. 직전 라운드가 지적한 유일한
WARNING(`.wc-panel-action` vs `.wc-action` 명명 유사)은 구분 주석 추가로 코드 실사 확인상 해소됐다. 남은 유일한 참고
사항은 `user_ended` 리터럴이 워크플로우 그래프 계층(AI Agent Multi Turn 포트)과 위젯 UI 이벤트 계층에서 각자 독립
재사용된다는 INFO 급 관찰(직전 라운드에서 이미 저우선 defer로 기록)뿐이며, 두 표면은 런타임 결합이 없고 의미도
자연스럽게 정합적이라 이 PR 을 차단할 사유가 아니다.

## 위험도
NONE
