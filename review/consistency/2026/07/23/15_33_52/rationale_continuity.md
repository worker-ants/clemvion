# Rationale 연속성 검토 — spec/4-nodes/6-presentation (--impl-done)

## 검토 절차 요약

1. prompt_file 에 첨부된 target 문서 전문(`0-common.md`/`1-carousel.md`/`2-table.md` 일부 + "관련 Rationale 발췌")을 정독.
2. 실제 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/resumable-handler-generic-typing-3918dd`)에서
   `git diff origin/main -- spec/4-nodes/6-presentation/` 실행 → **0 라인** (완전 무변경) 확인.
3. `git diff origin/main --name-only` 전체 조회 → 이번 diff-base 대비 실제 변경분은
   `codebase/frontend/src/components/editor/run-results/output-shape.ts` (+ 그 테스트) 와
   `plan/complete/output-shape-comment-followups.md`, `review/code/**` 산출물뿐. 이 파일들이 presentation 노드
   spec 의 code-link (`0-common.md` frontmatter `code:`) 대상이라 impl-done 스코프에 걸린 것으로 판단.
4. `output-shape.ts` 의 실제 diff 를 라인 단위로 확인 — **함수 바디(로직) 변경 0줄**, JSDoc 주석의
   영→한 재작성 + 서술 보강뿐임을 확인 (`isConversationOutput`, `endReason` 2단 조회 우선순위 서술 추가).
5. 이 변경의 근거인 완료 plan 두 건을 직접 읽음: `plan/complete/is-conversation-output-restructure.md`
   (endReason 패키지 SoT화, 2026-07-17 완료), `plan/complete/output-shape-comment-followups.md`
   (#983 후속 주석/테스트 정리, 2026-07-23 완료, `spec_impact: none`).
6. spec 상의 `endReason` SoT 서술(`spec/4-nodes/3-ai/1-ai-agent.md`, `spec/conventions/interaction-type-registry.md §4`)과
   교차 확인 — `output.result.endReason` 이 정본, 레거시 `output.endReason` 은 방어적 fallback이라는 서술과
   신규 JSDoc 이 일치함을 확인.

## 발견사항

이번 diff-base(`origin/main`) 대비 스코프 안에서 **Rationale 연속성 위반을 발견하지 못했다.**

- **spec 문서 자체가 무변경** — `spec/4-nodes/6-presentation/{0-common,1-carousel,2-table,3-chart,4-form,5-template}.md`
  전부 origin/main 과 동일. target 문서가 새로 도입한 결정이 없으므로 "기각된 대안 재도입"·
  "합의 원칙 위반"·"무근거 번복"이 성립할 대상 자체가 없다.
- **코드 diff 는 주석·테스트 전용** — `output-shape.ts` 의 `isConversationOutput` 판정 로직(OR-체인,
  `result?.endReason ?? output.endReason` 2단 조회, `CONVERSATION_END_REASONS` 화이트리스트)은
  한 줄도 바뀌지 않았다. 바뀐 것은 JSDoc 서술(한국어 통일 + "왜 이 분기가 존재하는가"의 SoT 위임 명문화)과
  mutation 고립 fixture(테스트) 추가뿐이다.
- **완료 plan 과의 정합** — `output-shape-comment-followups.md` 는 4개 이월 항목(①OR-체인→discriminated
  union 재설계, ②`endReason` 키 부재 테스트, ③주석 정리 3건, ④`it.each` 전환) 을 실측 근거와 함께
  각각 GO/NO-GO 로 명시 판정했다. 특히 ①("OR-체인을 discriminated union 으로 재설계")은 **NO-GO** 로
  명시 기각됐는데, 이는 `is-conversation-output-restructure.md`(선행 완료 plan, 백로그 E) 가 "OR-체인
  구조 자체는 건드리지 않고 화이트리스트 drift 축만 해소한다"고 이미 정한 스코프 경계와 정합한다 —
  두 plan 이 서로 다른 시점에 독립적으로 같은 경계에 도달했고, 번복이 아니라 **동일 결정의 재확인**이다.
- **endReason SoT 서술과의 정합** — 신규 JSDoc 이 명문화한 "`result.endReason` 우선, 동시 존재 시
  `result` 쪽이 정본" 은 `spec/4-nodes/3-ai/1-ai-agent.md` §7 / `spec/4-nodes/3-ai/3-information-extractor.md`
  §5.6 이 `output.result.endReason` 을 종결 사유의 정식 위치로 서술하는 것과 어긋나지 않는다. 코드
  로직 자체(우선순위)는 이번 diff 이전부터 동일했으므로 이는 기존 동작을 정확히 문서화한 것이지 새 결정이 아니다.
- **spec_impact 선언 정합** — `output-shape-comment-followups.md` 의 frontmatter `spec_impact: none` 은
  실제로 spec 무변경(§검토 절차 2) 과 일치한다. Gate C 관례(spec_impact 는 리스트 또는 `none`) 위반 없음.

INFO 로 남길 만한 항목도 diff 스코프 밖(사전 존재 갭)으로 plan 자체가 이미 "후속 이월" 절에
명시(§`result.endReason: null` 미고립·최상위 타입가드 테스트 부재·`Array.isArray` truthy-but-not-array
미고립·파일 내 JSDoc 언어 혼재 잔여 3곳)해 두었으므로 본 checker 가 별도로 새로 제기할 사항이 없다.

## 요약

diff-base(`origin/main`) 기준으로 `spec/4-nodes/6-presentation/**` 는 이번 세션에서 전혀 수정되지
않았고, code-link 로 스코프에 걸린 유일한 실 변경(`output-shape.ts`)도 로직 변경이 없는 JSDoc/테스트
전용 diff다. 그 변경의 근거가 된 두 완료 plan(`is-conversation-output-restructure.md`,
`output-shape-comment-followups.md`)을 직접 읽은 결과, 과거 결정(OR-체인 구조 유지, endReason 패키지
SoT화, `result.endReason` 우선순위)을 뒤집거나 명시 기각된 대안(discriminated union 재설계)을
재도입하는 정황이 없으며, 오히려 두 plan 이 독립적으로 동일 결론에 도달해 Rationale 연속성이
강화된 사례로 보인다. Rationale 연속성 관점에서 이번 diff 는 무해하다.

## 위험도

NONE
