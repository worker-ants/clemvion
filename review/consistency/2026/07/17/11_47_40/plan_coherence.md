# Plan 정합성 검토 (2회차) — `rag-tool-row-distinct-ui.md`

## 검증 방법

1회차(`review/consistency/2026/07/17/11_32_25/plan_coherence.md`)의 WARNING 1 + INFO 2 처분(Slice B 문구 정정, `ai-node-failed-conversation-preview.md` → `plan/complete/` 이동)이 규약대로 적용됐는지, 그리고 CRITICAL 해소로 Phase 1 이 3개 spec(`conversation-thread.md`/`6-websocket-protocol.md`/`9-rag-search.md`)로 확장되며 다른 `plan/in-progress/**` 와 새 충돌이 없는지를 코드/파일 직접 대조로 검증했다. `plan/in-progress/` 20개 전수(`node-output-redesign/` 하위 포함) 대상으로 `conversation-thread.md`/`6-websocket-protocol.md`/`9-rag-search.md`/`turnDebug`/`RagSource`/`result-detail.tsx`/`conversation-inspector.tsx` 를 grep 했고, 특히 orchestrator 가 지목한 `rag-quality-improvement.md`(9-rag-search.md 담당)와 `spec-sync-websocket-protocol-gaps.md`(6-websocket-protocol.md `pending_plans` 소유)를 전문 확인했다. Gate C(`spec-plan-completion.test.ts`)·`plan-frontmatter.test.ts` 를 직접 실행해 726/726 통과를 재확인했다.

## 발견사항

### [WARNING] I1 처분(plan 이동)이 다른 in-progress plan 의 상대경로 링크를 끊어놓음 — 후속 갱신 누락

- target 위치: 해당 없음(target 자체는 무관 — I1 처분(plan/complete 이동)의 collateral 문제)
- 관련 plan: `plan/in-progress/node-output-redesign/ai-agent.md:213`
- 상세: `ai-node-failed-conversation-preview.md` 를 `plan/in-progress/` → `plan/complete/` 로 이동한 것은 규약(frontmatter `spec_impact`+`completed`, Gate C 726/726 통과)대로지만, `node-output-redesign/ai-agent.md:213` 의 교차 참조 링크 `[ai-node-failed-conversation-preview.md](../ai-node-failed-conversation-preview.md)` 는 여전히 옛 위치(`plan/in-progress/ai-node-failed-conversation-preview.md`)를 가리킨다. 실제로 그 경로엔 파일이 없다(`ls` 로 확인: `No such file or directory`) — dangling link. `.claude/docs/plan-lifecycle.md §3` "**인입 참조**: `review/**` 같은 시점 기록 문서는 옛 경로 유지. **`spec/` 등 살아있는 문서의 plan 링크는 이동과 동시에 갱신**" 규칙상, `node-output-redesign/ai-agent.md` 는 review 스냅샷이 아니라 살아있는 in-progress plan 이므로 이동과 동시에 갱신 대상이었다. (참고: `review/consistency/2026/07/17/00_57_13/cross_spec.md:44` 가 이미 이 역참조의 존재를 "의무 이행 완료"로 확인한 바 있어, 완료 이동 시 놓치기 쉬운 위치였다.)
- 제안: `node-output-redesign/ai-agent.md:213` 의 링크를 `[ai-node-failed-conversation-preview.md](../complete/ai-node-failed-conversation-preview.md)` 로 정정. spec-link-integrity 가드는 `spec/` 링크만 검사해 plan-to-plan 링크는 자동 검출되지 않으므로 수기 확인 필요.

### [INFO] `rag-quality-improvement.md` 도 `9-rag-search.md` 를 편집 예정 — 현재는 섹션 비중첩, 향후(P3) 잠재 접점만 존재

- target 위치: `## Phase 1 — spec 개정` C. `spec/5-system/9-rag-search.md` §4.1 (target #14)
- 관련 plan: `plan/in-progress/rag-quality-improvement.md` (frontmatter `pending_plans: rag-quality-improvement.md` 가 `9-rag-search.md` 에 등록돼 있어 그 spec 의 `status: partial` 을 승계 책임짐)
- 상세: `rag-quality-improvement.md` 는 P0(완료)·P1(완료, §3.1/§3.3/§3.4/§4.2/§6/Rationale)·P2(하이브리드 검색, 미착수)·P3(parent-document, 미착수 — "spec 갱신: … `9-rag-search.md` parent 주입")·P5(contextual, 미착수) 로 같은 spec 파일을 편집해왔고 앞으로도 편집할 예정이다. target 의 §4.1 편집("Preview UI = chip-only" → 🔎 행 반영)은 현재 P1~P6 어느 계획 항목과도 섹션이 겹치지 않는다(§4.1 은 UI 출력 메타데이터 서술, 기존/예정 편집은 §3.x 검색 로직·§6 에러처리 위주). 다만 P3 의 "인용: matched=child(`uri, heading, char_start..end`), context=parent, UI 하이라이트" 항목은 착수 시 `RagSource`/`ragSources` UI 노출 스키마를 확장할 가능성이 있어, target 이 신설하는 🔎 행·`Inv-9`(References 탭과 동일 `sources[]`)와 미래 시점에 같은 타입·같은 spec 절을 다시 건드릴 수 있다. 현재는 P3 가 미착수(A/B 결정 자체가 P0 골든셋 확보 후)라 실질 충돌 없음 — 추적 메모로만 남긴다.
- 제안: 처분 불요. `rag-quality-improvement.md` P3 착수 시점에 `RagSource` 스키마 변경이 §4.1/`Inv-9` 와 정합하는지 그 때의 plan_coherence 가 재확인하면 충분.

### [INFO] `6-websocket-protocol.md §4.4` 편집도 해당 spec 의 `pending_plans` 소유 plan 과 섹션 비중첩 확인

- target 위치: `## Phase 1 — spec 개정` B. `spec/5-system/6-websocket-protocol.md` §4.4 (target #12-13)
- 관련 plan: `plan/in-progress/spec-sync-websocket-protocol-gaps.md` (frontmatter `pending_plans` 로 `6-websocket-protocol.md` 의 `status: partial` 을 소유)
- 상세: 그 plan 의 잔여 항목은 `auth.token_expired` emit(§4.5)·`system.maintenance` emit(§4.5)·서버발신 app ping(§5) 3건뿐이며 target 이 편집하는 §4.4(`waiting_for_input` payload 의 `turnDebug` 필드 문서화)와 섹션이 겹치지 않는다. 실 충돌 없음 — 기록용 INFO.

## 검토 결과 요약 (점검 관점별)

**(a) plan 이동의 규약 준수** — frontmatter(`worktree`/`started`/`completed`/`owner`/`spec_impact` 4개 실존 spec 경로) 스키마 정확, Gate C(`spec-plan-completion.test.ts`)·`plan-frontmatter.test.ts` 직접 실행 재확인 결과 726/726 pass, 완료 blockquote(PR #959·리뷰 산출물·후속 이관) 정확. 이동 방식은 PR #959 squash merge 커밋 안에 포함(별도 PR 분리 아님, 규약 §3 "이동은 마지막 작업 PR 안에서" 충족). 단 하나의 흠 — 그 plan 을 참조하던 다른 살아있는 plan(`node-output-redesign/ai-agent.md:213`)의 상대경로 링크가 갱신되지 않아 dangling. 위 WARNING 참조.

**(b) Slice B 문구 정정 충분성** — 충분함. "PR #959 가 남긴 저비용 후속"으로 스코프 표제를 정정했고, blockquote 로 #7(Slice A 와 동일 파일 `conversation-inspector.test.tsx`) / #1(별개 파일 `use-execution-events.ts`, 같은 조사 세션에서 발견) 을 명확히 구분했다. Phase 2 편집 파일 목록(`conversation-utils.ts`/`execution-store.ts`/`conversation-inspector.tsx`/`result-detail.tsx`/`result-timeline.tsx`)에 `use-execution-events.ts` 가 없다는 1회차 지적과도 정합 — #1 을 "동일 파일"이 아니라 "별개 파일의 회귀 갭"으로 정확히 재서술했다.

**(c) Phase 1 확장(3개 spec) 이 다른 in-progress plan 과 새 충돌을 만드는가** — 없음. `rag-quality-improvement.md` 가 `9-rag-search.md` 의 `pending_plans` 소유 plan 으로서 그 spec 을 계속 편집할 예정이지만(P2/P3/P5 미착수), target 의 §4.1 편집과는 현재 섹션이 겹치지 않는다(위 INFO). `spec-sync-websocket-protocol-gaps.md` 가 `6-websocket-protocol.md` 의 `pending_plans` 소유 plan 이지만 잔여 항목(§4.5·§5)이 target 의 §4.4 편집과 겹치지 않는다(위 INFO). `conversation-thread.md`(`status: implemented`, `pending_plans` 없음)를 참조하는 다른 in-progress plan(`eia-context-schema-followups.md`·`ai-agent-tool-connection-rewrite.md`·`node-output-redesign/ai-agent.md`)도 각각 이미 완료됐거나(`eia-context-schema-followups.md` 해당 항목 `[x]`) target 이 확장하는 `ConversationTurnSource`/§9.3/§8.1 D4 와 무관한 영역(도구 연결 모델 TBD 결정, single-turn 백엔드 에러 라우팅)이라 충돌 없음.

## 요약

2회차 처분은 대체로 규약을 정확히 따랐다 — Slice B 문구 정정은 1회차 WARNING 을 완전히 해소했고, `ai-node-failed-conversation-preview.md` 의 `plan/complete/` 이동은 frontmatter 스키마·Gate C(726/726 실측)·완료 blockquote 요건을 모두 충족한다. Phase 1 이 3개 spec 문서로 확장된 것도 각 spec 의 `pending_plans` 소유 plan(`rag-quality-improvement.md`→9-rag-search.md, `spec-sync-websocket-protocol-gaps.md`→6-websocket-protocol.md)과 섹션 단위로 비중첩임을 확인해 새 충돌은 없다. 유일한 흠은 이번 이동의 부수 효과 — `node-output-redesign/ai-agent.md:213` 이 옛 경로로 걸어둔 교차 참조가 이동과 함께 갱신되지 않아 dangling link 가 됐다(plan-lifecycle.md §3 "살아있는 문서의 plan 링크는 이동과 동시에 갱신" 위반). CRITICAL 급 결정 충돌은 없다.

## 위험도

LOW
