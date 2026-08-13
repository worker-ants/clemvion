# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[WARNING]** `update-returning-tuple-shape.md` 의 `[planner 위임]` 항목이 방금 전(직전) 커밋이 뒤집은 결론을 그대로 되풀이한다 — `spec_impact` 가 `none` 이라는, 같은 파일 상단 배너가 이미 명시적으로 정정한 옛 판단이 §후속 체크리스트 안에 원문 그대로 남아 있다.
  - 위치: `plan/in-progress/update-returning-tuple-shape.md:228-230` (`` `developer` 는 `spec/` 쓰기 권한이 없어 이번 PR 로는 못 넣는다. 그래서 frontmatter 는 `spec_impact: none` 을 유지한다 — 이 PR 이 실제로 바꾸는 spec 은 0건이고, 리스트에 적으면 "이 PR 이 그 파일을 고쳤다" 는 거짓이 된다. ``) vs 같은 파일 `:8-13`(frontmatter, 현재 5개 spec 파일 리스트) 및 `:16-24`(상단 배너 — "처음엔 `none` 으로 두고 … 적었는데, 이 필드는 **PR 이 아니라 plan 의 라이프사이클**을 가리킨다 — `23_27_49` WARNING 3")
  - 상세: `git blame` 확인 결과 `:228-230` 문장은 20:49:25 커밋(`8c0d66e08`)에 쓰였고, 이후 23:45:50 커밋(`d8ac4cb07`)이 이 plan 의 frontmatter 를 `spec_impact: none` → 5개 spec 파일 리스트로 바꾸면서 정확히 같은 논리("이 PR 자체는 spec 을 안 바꾸니 `none` 이 맞다")를 **정면으로 폐기**하고 상단에 반박 배너까지 새로 달았다. 그런데 그 커밋은 `:228-230` 을 건드리지 않아, 지금 이 파일은 같은 섹션(`[planner 위임]` 블록) 안에서 "frontmatter 는 `none` 을 유지한다"(옛 문장, 거짓)와 "그럼에도 `none` 이 아닌 이유는…"(새 배너, 참)가 동시에 존재한다. 이 커밋 메시지 자체가 "부수: retry-turn 배너의 제목이 여전히 옛 주장을 유지하고 있었다 — 본문만 고치고 제목을 안 봤다" 라고 **같은 종류의 결함을 다른 파일에서 잡아 놓고**, 정작 자기 파일 안의 이 문단은 못 봤다.
  - 제안: `:228-230` 세 줄을 삭제하거나 상단 배너(`:16-24`)를 가리키는 한 줄("→ frontmatter 실제 값·근거는 위 `spec_impact` 주의 참조")로 축약한다.

- **[WARNING]** 같은 `[planner 위임]` 블록 도입부의 숫자가 뒤이은 목록 항목 수와 어긋난다 — "넷이다" 라고 쓴 뒤 다섯 항목이 나열된다.
  - 위치: `plan/in-progress/update-returning-tuple-shape.md:215`(`이 PR 이 고친 것들이 실제로 어겼던 spec 서술을 전부 세면 넷이다:`) vs `:216-225`(다섯 개 bullet — `4-execution-engine.md`/`8-embedding-pipeline.md`/`10-graph-rag.md`/`data-flow/2-auth.md`/`conventions/node-cancellation.md`)
  - 상세: `git blame` 확인 결과 `:215`(`넷이다`)와 처음 네 bullet(`:216-220`)은 23:06:52 커밋(`443dd91a6`)에서 함께 쓰였는데, 다섯 번째 bullet(`node-cancellation.md`, `:221-225`)은 23:44:24 커밋(`739272702`)이 나중에 끼워 넣은 것이다 — 도입 숫자 문구는 그때 갱신되지 않았다. 실제로 `plan/in-progress/retry-turn-terminal-guard.md:47-48` 은 이 다섯 번째 항목을 "**[planner 위임] 소급 각주 5번째 항목**" 이라고 정확히 부르고 있어, 이 문단 자체가 이미 "다섯"이 맞다는 것을 다른 파일에서 스스로 증언하고 있다. `:8-13` frontmatter 의 `spec_impact` 리스트도 5개 항목으로, 다섯이 맞다.
  - 제안: `:215` 의 "넷이다" 를 "다섯이다" 로 정정한다.

## 요약

핵심 신규 코드(`update-returning-rows.ts`, 헬퍼 JSDoc·spec 회귀 가드·`auth-oauth`/`execution-engine`/`knowledge-base` 호출부 주석)는 문서화 품질이 높다 — 실측 근거, 실패 모드, 타 관용구 대비표, "왜 지금까지 아무도 못 봤나" 까지 각 지점에 남아 있고, 이전 세 라운드(`20_36_35`/`22_45_24`/`23_07_11`/`23_27_48`)가 지적한 stale 주석(`execution-engine.service.ts:2931` "위 제네릭은" 죽은 참조)·`EXPECTED` 3-tuple/2-tuple 불일치·`retry-turn-terminal-guard.md` 의 존재하지 않는 등재 참조는 모두 이번 상태에서 실제로 정정돼 있음을 직접 확인했다. 다만 이번 리뷰에서 새로 발견한 것은, 그 정정 작업 자체를 수행한 마지막 두 커밋(`739272702`, `d8ac4cb07`, 브랜치의 최종 커밋들)이 **자신이 편집한 문단 바로 옆**에 두 개의 신선한 불일치를 남겼다는 점이다 — 둘 다 `plan/in-progress/update-returning-tuple-shape.md` 의 같은 `[planner 위임]` 블록 안에 있다: (1) 상단 배너가 이미 뒤집은 "`spec_impact: none` 유지" 논리가 §후속에 원문 그대로 남아 자기모순을 이루고, (2) 목록에 다섯 번째 항목을 추가하면서 "넷이다" 라는 도입 숫자를 갱신하지 않았다. 둘 다 Gate C 등 자동 게이트는 실제 frontmatter 값만 읽으므로 기능적으로 차단되지 않지만, 이 PR이 반복해 스스로 진단한 "본문 일부만 고치고 인접 텍스트를 안 본다" 패턴이 그 진단을 적은 바로 그 문서에서 한 번 더 재현된 것이라 정정을 권한다. README·API 문서·CHANGELOG·설정 문서 관점에서는 이 diff가 순수 내부 버그 수정이라 갱신 대상이 없고, CHANGELOG 보류는 plan에 배포 시점 판단 근거와 함께 명시적으로 기록돼 있어 문제 없다.

## 위험도

LOW
