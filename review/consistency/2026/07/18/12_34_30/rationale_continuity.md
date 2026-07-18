# Rationale 연속성 검토

## 사전 메모 — prompt 번들 오염 (known harness 결함, 우회함)

`prompt_file` 이 지시한 target 문서(`spec/conventions/`)는 실제로는 `spec/conventions/cafe24-api-catalog/**`
(entity field-level 파일 222개 중 다수)로 **거의 전량 치환**된 상태였고, 이 task 의 실제 diff-base(`origin/main`)
대비 변경 파일과는 무관한 내용이었다. 이는 이 저장소의 기존 known failure pattern 이며, 바로 이 작업의
`plan/in-progress/interaction-type-guard-comment-false-negative.md` 자체에 "harness, 비차단" 항목으로
**이미 기록·추적 중**이다 (직전 회차 `review/consistency/2026/07/18/12_04_53/` 에서 재현된 것과 동일 결함이
이번 회차에도 재현). 해당 plan 은 checker 가 "worktree 파일 직접 조사로 우회" 하는 것을 유효한 대응으로 명시한다.

따라서 본 검토는 prompt 번들 내용을 신뢰하지 않고, 아래를 **직접** 근거로 사용했다:
- `git -C <워킹트리> diff origin/main --name-status` (실제 변경 파일 목록)
- `Read` 로 워킹트리의 `spec/conventions/interaction-type-registry.md` 직접 확인
- `git diff origin/main -- <실제 변경 파일>` (코드·plan diff)

실제 diff-base 대비 이 task 가 만든 변경은 다음으로 확인됨 (spec/conventions/ 자체는 이 task 의 diff 에 없음):
- `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` (주석 "grep 가드"→"AST 가드" 표현 정정, 동작 무변경)
- `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` (self-test fixture 보강: union 타입 선언·객체 프로퍼티 값 형태, 정규식 리터럴 비오염 단언)
- `plan/in-progress/interaction-type-guard-comment-false-negative.md` (체크리스트 갱신 — 해소 기록 + harness 결함 재현 기록)
- (branch staleness 로 diff 에 잡히지만 이 task 가 만든 변경이 아닌 파일: `node-handler.interface.ts` / `information-extractor.handler.ts` / `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` — 아래 참고 항목 참조)

## 발견사항

- **[INFO]** 실제 target 변경은 기존 spec Rationale 을 강화하는 방향 — 위반 없음
  - target 위치: `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` 주석, `interaction-type-exhaustiveness.test.ts` self-test fixture, `plan/in-progress/interaction-type-guard-comment-false-negative.md` 체크리스트
  - 과거 결정 출처: `spec/conventions/interaction-type-registry.md §5 Rationale` — "가드는 '있다' 가 아니라 **'깨뜨려 봤다'** 로만 신뢰할 수 있다" (mutation-tested guard 원칙). 그리고 저장소 전역 원칙(메모 `feedback_regex_vs_parser_guard_boundary`) — TS 소스 대상 가드는 정규식이 아니라 **정본 파서(AST)** 를 쓴다 (PR #971/#972 로 이미 확정).
  - 상세: (1) "grep 가드"→"AST 가드" 주석 정정은 §5 가 이미 확정한 AST 우선 결정을 재확인·정합화하는 것이지 새 대안이 아니다. (2) self-test fixture 보강(union 타입 선언·object property value·정규식 리터럴 비오염)은 plan 문서에 "양방향 mutation 프로브로 실효 실증"이라고 명시돼 §5 원칙("깨뜨려 봤다로만 신뢰")을 그대로 준수한다. (3) plan 이 명시적으로 **철회**한 `.tsx`/`ts.ScriptKind` 분기 항목은 "TS/TSX 두 모드가 문자열 리터럴을 동일 수집함을 프로브 6종으로 실측 → 어떤 fixture 로도 red 를 못 만드는 vacuous 가드"라는 근거를 달아 §5 원칙에 정확히 따라 미추가를 결정했다 — 이는 "결정의 무근거 번복"이 아니라 **근거를 명시한 정당한 범위 축소**다.
  - 제안: 조치 불필요. 단, 향후 `.tsx` 등록 사이트가 실제로 생기면 이 철회 근거를 spec §5 또는 별도 각주로 승격해두면 재논의 비용을 줄일 수 있다 (선택적).

- **[INFO]** branch staleness — `node-handler.interface.ts`/`information-extractor.handler.ts` 가 origin/main 에 이미 병합된 Rationale(PR #978)보다 뒤처져 있음, 단 이 task 의 diff 아님
  - target 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` (`endMultiTurnConversation` docblock), `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts`
  - 과거 결정 출처: `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` (완료, PR #978 `d25f552b2`) — "AiAgentHandler 는 errorPayload verbatim relay, IE 는 §5.3 code-기반 invariant 를 지키기 위해 의도적으로 self-fill" 이라는 divergence 를 interface docblock 에 명시하기로 한 결정.
  - 상세: `git diff origin/main` 로 두 파일을 보면 이 divergence 설명이 빠진, 더 단순한(범용처럼 읽히는) 이전 버전이 현재 HEAD 워킹트리에 있다. 그러나 `git merge-base HEAD origin/main` = `22cc48ef3` 이고 PR #978(`d25f552b2`)은 이 merge-base **이후** origin/main 에만 병합된 커밋이다. 즉 이 branch(`interaction-type-guard-followup-bd683a`)는 애초에 이 파일들을 건드리지 않았고(이 task 의 유일한 자체 커밋은 `465abf334`, interaction-type-registry 관련 파일만 수정), 단순히 origin/main 이 병렬로 더 앞서 나간 것 — "병렬 세션 머지 충돌" 패턴(과거 기록: `feedback_parallel_session_backlog_collision`)과 동일 성격이다.
  - 제안: 이 task 자체의 fix 는 불필요 — 이 branch 가 최종 PR 로 origin/main 에 병합될 때 표준 3-way merge/rebase 를 거치면 HEAD 쪽에 해당 파일 자체 변경이 없으므로 origin/main 의 #978 내용이 충돌 없이 그대로 유지된다(텍스트 충돌 리스크 낮음). 다만 merge/rebase 를 생략하고 이 워킹트리 상태를 그대로 별도 경로로 배포·스냅샷하는 경우에는 #978 의 Rationale 이 유실되므로, PR 병합 전 `origin/main` rebase/merge 를 권장.

## 요약

이 task(`interaction-type-guard-followup`)가 실제로 만든 변경(주석 용어 정정 + self-test fixture mutation-testing 보강 + plan 체크리스트 갱신)은 `spec/conventions/interaction-type-registry.md §5 Rationale`("가드는 깨뜨려 봤다로만 신뢰") 과 저장소 전역 "TS 소스는 AST, 셸은 정규식" 원칙을 위반하지 않고 오히려 강화한다 — 기각된 대안의 재도입, 원칙 위반, 무근거 번복 사례는 발견되지 않았다. `.tsx`/`ts.ScriptKind` 분기를 추가하지 않기로 한 결정도 실측 기반 근거가 plan 에 명시돼 있어 정당하다. 다만 prompt 번들이 무관한 `cafe24-api-catalog/**` 내용으로 치환되는 기존 known 결함이 이번 회차에도 재현됐고(이미 별 harness task 로 분기 예정, 조치 불요), 또한 diff-base(`origin/main`) 대비 `node-handler.interface.ts`/`information-extractor.handler.ts` 에서 이 task 와 무관한 branch staleness(병렬 PR #978 미반영)가 관찰됐다 — 둘 다 이 task 의 target 문서 자체의 결함은 아니며 별도 트랙에서 이미 인지·추적 중이다.

## 위험도

NONE
