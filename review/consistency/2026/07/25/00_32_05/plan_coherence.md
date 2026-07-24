# Plan 정합성 검토 — spec/7-channel-web-chat (impl-done)

## 검토 방법 메모

`_prompts/plan_coherence.md` 는 컨텍스트 예산 초과로 `plan/in-progress/webchat-usewidget-extraction.md`
(본 diff 가 실행하는 바로 그 티켓)를 포함해 40개 plan 파일 본문을 생략했다. 이 파일이 diff 와
1:1 로 대응하는 가장 중요한 근거이므로, target worktree
(`/Volumes/project/private/clemvion/.claude/worktrees/webchat-session-generations-ca88ae`)에서
직접 열어 대조했다. 함께 `webchat-command-failure-is-not-termination.md`·
`webchat-spec-rationale-followup.md`·`webchat-boot-apibase-scheme-validation.md`(모두 webchat 계열
형제 이월 티켓)도 직접 열어 diff 와의 충돌 여부를 확인했다.

## 발견사항

- **[INFO]** 체크리스트 항목이 본문 서술의 해소 결론과 어긋난 상태로 남아있음
  - target 위치: 코드 diff — `codebase/channel-web-chat/src/widget/use-session-generations.ts`
    (JSDoc 인접성 취약성 해소 부분)
  - 관련 plan: `plan/in-progress/webchat-usewidget-extraction.md` 체크리스트
    `- [ ] JSDoc 인접성 구조적 가드 검토(경고 주석 → lint/test)` (원 체크리스트, 상단)
  - 상세: 같은 문서 하단 "1차 slice — staleness 축 분리" 섹션의
    "### 부수 효과 — JSDoc 인접성 위험이 구조적으로 해소됐다" 가 이 항목의 결론을 이미
    내렸다 — "가드를 만들 필요 없이 해소됐다 ... 전용 파일로 옮기면 끼어들 것이 구조적으로
    없다. lint 가드보다 나은 해법이라 별도 가드는 만들지 않는다." 즉 체크리스트가 요구한
    "검토"는 끝났고 결론은 "가드 불필요"인데, 체크박스는 여전히 미체크(`[ ]`)로 남아 다음
    세션이 이 항목을 아직 열린 작업으로 오인할 수 있다(`feedback_stale_plan_claims_and_checklist_sync`
    교훈과 동일 클래스 — 서술은 해소를 말하는데 체크박스만 안 따라간 경우).
  - 제안: 체크박스를 `[x]`(가드 불필요로 검토 완료, 사유는 본문 참조) 로 정리하거나, 최소한
    체크리스트 항목 문구 옆에 "→ §1차 slice 참고, 가드 불필요로 결론" 각주를 붙여 두 서술이
    한 눈에 일치하도록 갱신 권장. 코드 자체를 바꿀 필요는 없음(WARNING 이 아니라 INFO — plan
    문서 갱신만).

- **[INFO]** "곧 `complete/` 이동" 표현이 이미 이동 완료된 상태를 가리킴(경미한 문구 stale)
  - target 위치: 해당 없음(코드 변경 없음, plan 문서 자체 내부 서술)
  - 관련 plan: `plan/in-progress/webchat-usewidget-extraction.md` 상단
    "이 항목은 `webchat-boot-single-flight.md`(곧 `complete/` 이동)의 산문 이월에서 분리했다"
  - 상세: 실측 결과 `plan/complete/webchat-boot-single-flight.md` 는 이미 존재한다(이동 완료).
    형제 티켓 `webchat-spec-rationale-followup.md` 는 이미 `../complete/webchat-boot-single-flight.md`
    로 갱신된 링크를 쓰는데, 이 문서만 "곧 이동" 현재형으로 남아 있어 두 형제 문서 간 서술이
    어긋난다. 실질적 영향은 없음(포인터가 깨지진 않음 — 상대경로 `./webchat-boot-single-flight.md`
    링크(§선행/참조 절)는 이 파일에는 없음).
  - 제안: "(곧 `complete/` 이동)" → "(`complete/` 로 이동됨)" 로 문구만 정정 권장. 비차단.

## 정합성 확인된 항목 (긍정 근거 — 충돌 없음)

- **BootAttempt 공개 계약 결정**: 티켓의 "선행 판단" 절은 "분리 시 이 토큰 타입을 훅 경계의
  공개 계약으로 삼을지 결정 필요"라고 미해결로 남겨뒀었다. diff 는 `BootAttempt` 인터페이스를
  `export` 했는데, 이는 plan 문서 자체가 "남은 slice" 절에서 "1차 slice 가 `BootAttempt` 를
  export 했으므로 그 결정의 일부는 이미 내려졌다"고 투명하게 사후 기록했다 — 미해결 결정을
  숨어서 우회한 것이 아니라 plan 문서와 diff 가 동기화된 정상적인 처분이다. CRITICAL 아님.
- **축 개수 전제**: "`webchat-boot-single-flight.md:129` 의 '가드가 하나로 정리된 지금이 적기'
  전제가 `bootGenRef` 신설로 되돌려졌다(축 2개)"는 선행 판단이 있었으나, plan 상단에 "사용자
  결정으로 staleness 축만 먼저 분리했다"는 명시적 합의 기록이 있어 결정 절차가 지켜졌다.
  다음 slice(`establishConfig`/`applyConfig`/... 추출)에서 이 판단을 다시 하기로 명시돼 있고
  본 diff 는 그 범위를 침범하지 않는다.
- **쓰기측 캡슐화 defer**: diff 는 `worldGenRef`/`unmountedRef` 를 여전히 raw ref 로 노출하고
  `use-widget.ts` 가 `.current` 를 직접 mutate 하는데, 이는 plan 문서 "리뷰 후속 — 쓰기 측
  캡슐화는 다음 slice 로" 절에서 의도적으로 defer 한 것과 정확히 일치(다음 slice 체크리스트
  `invalidateWorld()`/`markUnmounted()` 항목 존재).
- **테스트 수량**: plan 은 "착수 시점 400 → 409(신규 훅 단위 8 + 구성 지점 참조 안정성 1)"라고
  기록했고, diff 의 `use-session-generations.test.ts` 는 정확히 8개 `it(...)`, `use-widget-commands.test.ts`
  추가분은 1개 — 서술과 diff 가 수치까지 일치한다.
- **인접 형제 티켓과 충돌 없음**: `webchat-command-failure-is-not-termination.md`(비-410 실패
  종료 여부 결정 미착수, planner 트랙)와 `webchat-boot-apibase-scheme-validation.md`(apiBase
  스킴 검증 판정 미착수)는 모두 `sendCommand`/`applyConfig` 의 **로직**(에러 분기·apiBase 검증)에
  관한 열린 결정인데, 본 diff 는 두 함수의 `useCallback` deps 배열에 `worldGenRef` 를 추가하는
  기계적 리팩토링만 수행했을 뿐 그 로직 자체(에러→ended 전이, apiBase 스킴 검증 유무)를
  건드리지 않았다 — 열린 결정을 일방적으로 선취하지 않았다.
  `webchat-spec-rationale-followup.md`(문서화 전용, P3, 코드 영향 없음)도 본 diff 와 무관.
- **spec 미변경**: 본 diff 는 `spec/` 를 전혀 수정하지 않는다(developer read-only 원칙 위반 없음).
  `spec/7-channel-web-chat/2-sdk.md §3(재전송)` 참조는 코드 JSDoc 인용일 뿐 spec 본문 변경이
  아니다.
- **무관 plan 확인**: `chat-channel-visual-ssr-png.md` 는 `codebase/backend/.../chat-channel`
  (Telegram 등 outbound 메시지 렌더링) 모듈로, 이름이 비슷하지만 `channel-web-chat`(위젯 SPA)와
  무관함을 본문 확인으로 배제했다. Discord/Slack 게이트웨이·marketplace SDK·node-output-redesign·
  spec-sync-*-gaps·migration-tooling 등 나머지 in-progress plan 은 도메인이 전혀 달라 본 diff 와
  교차점 없음.

## 요약

본 diff(`useSessionGenerations` 훅 추출, "1차 slice")는 실행 대상 티켓
`plan/in-progress/webchat-usewidget-extraction.md` 의 범위·전제·체크리스트와 세부 수치(테스트
개수)까지 정확히 일치하며, 미해결로 남은 형제 결정(비-410 실패 종료 여부, apiBase 스킴 검증)을
침범하지 않았고 spec 변경도 없다. 유일한 흠은 plan 문서 자체의 사소한 위생 문제 — 이미 서술로
해소된 체크리스트 항목이 미체크로 남아 있는 것과 "곧 이동" 문구가 실제로는 이미 이동 완료된
상태를 반영하지 못하는 것 — 뿐이며 둘 다 비차단 문서 정리 사안이다. 프롬프트 자체가 이 티켓
파일을 컨텍스트 예산으로 생략했다는 점은 harness 프로세스 개선 여지로 별도 기록할 만하다(다음
`plan_coherence` 실행 시 diff-scoped 로 언급된 plan 파일을 우선순위로 포함하는 편이 안전).

## 위험도

LOW
