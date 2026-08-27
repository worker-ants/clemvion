### 발견사항

- **[WARNING]** plan 체크박스가 실제 완료 상태를 반영하지 않는다 (6곳)
  - 위치: `plan/in-progress/masking-expression-egress-split.md:105`, `:106`, `:108`, `:109`, `:110`, `:111`
  - 상세: 이 5개 체크박스는 모두 `[ ]`(미완료)로 표시돼 있지만, 같은 diff 세트와 git 로그로 대조하면 전부 실제로는 완료됐다.
    - `:105` "어댑터에서 `maskSensitiveFields(config)` 제거 + JSDoc" → 커밋 `348c2b3ca` 에서 완료(파일 4 diff 자체가 그 증거).
    - `:106` "캐너리 — 표현식 원문 / WS·REST 마스킹 / DB 원문" → 같은 커밋에서 캐너리 3종 추가(파일 1·3 diff).
    - `:108` "(planner 턴) 6개 spec" → 별도 커밋 `57fb83592` (`docs(spec): 마스킹 시점을 storage→egress 로 — 보안 Rationale 6곳 정정`)가 정확히 파일 16~21의 spec 6건을 정정 완료.
    - `:109` "자매 트래커 항목 종결 동기화" → 파일 6(`spec-sync-external-interaction-api-gaps.md`)에서 해당 두 항목이 이미 `[x]`로 닫힘.
    - `:110` "`chatChannel` 라우팅 전용 로컬 마스커 — 별건 등재" → 같은 파일 6 diff 에 이미 신규 항목으로 등재됨(515~518줄).
    - `:111` "TEST WORKFLOW 4단계 + ratchet" → 커밋 `126609555` 메시지에 "TEST WORKFLOW 4단계 PASS — lint 49s · unit 83s(9,018 passed) · build 163s · e2e 224s(285 passed) · ratchet 199/38 일치" 로 명시.
    - 오직 `:112` (`/ai-review`, 현재 진행 중인 이 리뷰)만 미체크가 정확하다.
  - 이 저장소가 반복적으로 지적받아 온 "plan 체크박스 = 실제 상태" 규약(체크와 완료는 같은 동작이어야 함) 위반이며, 이 plan 파일 자체가 이번 diff 에 포함돼 있으므로 이 세션의 마지막 커밋에서 바로잡을 수 있었던 항목이다.
  - 제안: `git commit` 전 마지막 정리 커밋에서 위 6개 항목을 `[x]` 로 갱신한다(`/ai-review` 만 남기고).

- **[INFO]** 이 PR 이 다른 3곳에서 정정한 "`maskSensitiveFields` boundary strip" 서술이 같은 클래스의 코드 주석 2곳에는 미반영
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3280`, `:3351` (함수/블록: `buildMultiTurnFinalOutput`의 `_retryState` 주석, `buildRetryState` JSDoc)
  - 상세: 이번 PR 의 별도 "planner 턴" 커밋(`57fb83592`)이 `spec/4-nodes/3-ai/1-ai-agent.md` 세 자리(754행·978행·1114행 부근)에서 `_resumeState`/`_retryState` credential 미동봉의 근거를 "~~`maskSensitiveFields` boundary strip~~ → egress 마스킹" 으로 정정했다. 그런데 정확히 같은 주장을 하는 코드 주석 두 곳(`ai-turn-executor.ts:3280` "`maskSensitiveFields` boundary 와 동일 정책", `:3351` "same masking policy as `_resumeState` (`maskSensitiveFields` boundary strip)")은 이번 diff 에 포함되지 않아 정정 전 표현 그대로 남아 있다. RESOLUTION.md 는 "미러 스윕이 게이트보다 많이 찾았다 … 이번엔 게이트 목록을 그대로 집행하지 않고 다시 셌다" 고 스스로 철저성을 주장하는데, 그 스윕이 spec 문서 8곳은 훑었지만 같은 주장을 반복하는 코드 주석은 대상에 넣지 않은 것으로 보인다. scope 관점에서 이것은 "과잉 변경"이 아니라 "동일 정정의 불완전한 전파"이므로 CRITICAL/WARNING 급 스코프 위반은 아니지만, 이 PR 이 정정하겠다고 선언한 바로 그 문구가 코드에 남아 다음 사람이 "`_retryState` 제외도 `maskSensitiveFields` 가 한다"고 다시 오해할 소지가 있다.
  - 제안: 같은 커밋 계열에서 두 주석도 "egress 마스킹" 또는 "allowlist 로 애초에 미포함(마스킹이 아님)"으로 정정 대상에 포함시킬 것. 다만 이는 rationale-continuity/naming-collision 계열 checker 의 소관에 더 가까워 이번 스코프 리뷰의 필수 차단 사유는 아니다.

### 요약
핵심 코드 변경(`handler-output.adapter.ts` 에서 `maskSensitiveFields` 제거)과 그에 수반된 테스트(캐너리 3종 + 포함관계 캐너리), 주석 정정, 뒤이은 타입 단언 정리(lint 가 요구한 기계적 후속)까지 모두 "config echo 마스킹을 어댑터 boundary 에서 egress-only 로 옮긴다"는 단일 목적에 정확히 귀속된다. spec/ 6개 파일 수정은 developer 권한 밖 CRITICAL 을 자체 인지해 별도 "planner 턴" 커밋(`57fb83592`)으로 분리 처리했고 그 근거(RESOLUTION.md)도 diff 안에 함께 있어 절차적으로 정당하다. `review/consistency/**` 아티팩트들은 `--impl-prep` 게이트가 강제하는 표준 산출물로 스코프 이탈이 아니다. 드리프트 형태의 리팩토링·무관한 파일 수정·불필요한 임포트/설정 변경은 발견되지 않았다. 유일한 실질 결함은 이번 diff 에 포함된 plan 파일(`masking-expression-egress-split.md`) 자체의 체크박스가 실제 완료 상태(같은 diff·git 로그로 확인 가능)를 반영하지 못하는 것으로, 기능적 스코프 위반이 아니라 이 작업의 진행상황 기록 정확성 문제다.

### 위험도
LOW
