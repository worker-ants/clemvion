# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** plan frontmatter `worktree` 값 동기화는 이번 작업(chat-channel 반증)과 직접 관련 없는 housekeeping
  - 위치: `plan/in-progress/node-cancellation-residual-signal-propagation.md:3`
  - 상세: `worktree: node-cancel-signal-b4d1` → `worktree: node-cancel-chat-9f3e` 로 바뀌었다. 이는 이번 세션이 실제로 사용 중인 worktree(`git worktree list` 로 확인 — 현재 브랜치 `claude/node-cancel-chat-9f3e`)와 frontmatter 를 일치시키는 것으로, `.claude/docs/plan-lifecycle.md` frontmatter 규약을 지키기 위한 정당한 동기화다. 이번 diff 의 핵심 변경(“chat-channel 노드는 존재하지 않는다” 반증 → won't-do 처리)과는 별개의 관심사이지만 실질적 부작용이 없고 규모도 1줄이라 범위 이탈로 보기 어렵다.
  - 제안: 조치 불요.

- **[INFO]** 리뷰/일관성 검토 산출물(21개 파일) 이 코드 diff 에 함께 포함됨
  - 위치: `review/code/2026/07/25/23_37_31/**`, `review/code/2026/07/25/23_52_56/**`, `review/consistency/2026/07/25/23_37_31/**`
  - 상세: 전체 24개 변경 파일 중 21개가 이전 라운드(`/ai-review`, `/consistency-check`)의 산출물(SUMMARY.md, RESOLUTION.md, 각 reviewer 리포트, `_retry_state.json`, `meta.json` 등)이다. 이는 CLAUDE.md 가 명시한 저장 위치(`review/code/<...>/`, `review/consistency/<...>/`) 규약에 따른 정상적인 프로세스 산출물이며, `review/` 는 gitignore 대상이 아니므로(저장소 확립 관례) 커밋에 포함되는 것이 기대된 동작이다. 실제 "작업 범위"에 해당하는 파일은 3개(`node-handler.interface.ts`, 두 plan `.md`)뿐이고 나머지는 그 3개 파일에 대한 리뷰 과정의 부산물이다.
  - 제안: 조치 불요 — 다만 향후 diff 크기 검토 시 이 21개 파일이 "실질 변경"이 아니라 "회의록"이라는 점을 감안해 판단할 것.

- **[INFO]** JSDoc 신규 근거 문단이 코드(`node-handler.interface.ts`)와 두 plan 문서에 유사 문구로 3중 반복 기재
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts:238`-`244`, `plan/in-progress/node-cancellation-residual-signal-propagation.md:35`-`45`, `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:192`-`211`
  - 상세: "chat-channel 은 노드가 아니라 webhook 트리거의 config.chatChannel 변형/구현은 modules/chat-channel/**/outbound 방향(CCH-AD-05)/abortSignal 참조 0건" 근거가 세 곳에 표현만 바꿔 반복된다. 코드 JSDoc(살아있는 소스) 대 plan 문서(시점-고정 의사결정 기록)라는 서로 다른 성격의 문서이므로 중복 자체는 이 저장소 관례상 허용 범위 안이나, 유지보수 시 세 곳을 사람이 직접 동기화해야 하는 부담은 남는다.
  - 제안: 필수 아님. 조치 불요.

## 요약

이번 diff 의 실질 변경은 3개 파일(`node-handler.interface.ts` JSDoc 2건 정정, plan 잔여 항목 체크리스트 갱신, spec-update plan 위임 섹션 추가)에 한정되며, 셋 모두 "chat-channel 노드는 실제로 존재하지 않는다(범주 오류)"는 단일 착수-전 프로브 발견에서 직접 파생된 변경이다. `abortSignal` 필드 JSDoc 요약·소비자 목록·신규 설명 문단은 모두 같은 필드의 같은 docblock 안에서 일관되게 갱신되었고, 코드가 아닌 `spec/` 표(§1/§6) 정정은 developer 권한 밖이라 project-planner 에게 명시적으로 위임했다(역할 분리 규약 준수, spec/ 직접 수정 없음). MakeShop/Cafe24 signal cascade 자체의 구현 코드는 이 diff 에 포함돼 있지 않다(이전에 이미 별도 커밋으로 완료됨) — 즉 이번 diff 는 문서/주석 정정에 국한되어 요청 범위(“chat-channel 항목 처분”)를 벗어나지 않는다. 24개 변경 파일 중 21개는 저장소 확립 관례에 따라 커밋되는 리뷰/일관성 산출물이라 스코프 크립이 아니다. 유일한 관심 대상은 plan frontmatter `worktree` 필드 1줄 동기화(INFO)와 3중 근거 반복(INFO)이며, 둘 다 조치를 요하지 않는다. 범위 이탈·불필요한 리팩토링·의도치 않은 기능 확장은 관측되지 않았다.

## 위험도

NONE
