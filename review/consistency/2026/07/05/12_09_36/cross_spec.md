# Cross-Spec 일관성 검토 — spec-draft-ai-context-memory-close (재검증)

검토 대상: `plan/in-progress/spec-draft-ai-context-memory-close.md` (개정판 — rationale 이 `spec/3-workflow-editor/3-execution.md §6` 을 명시 인용하고, 변경 7 `webchat spec_impact []→none` 추가)

## 재검증 범위

이전 라운드 이후 바뀐 두 지점을 중심으로 재확인했다:
1. rationale 의 `3-execution.md §6` 명시 인용이 실제로 그 문서의 그 절과 정확히 대응하는가 (선례로서 유효한가).
2. 변경 7 (webchat `spec_impact: []` → `none`) 이 다른 영역과 충돌 없이 안전한가.
그리고 핵심 결론 — 0-common.md·17-agent-memory.md 의 `partial → implemented` 승격 — 이 여전히 정합적인지 원 소스를 직접 열어 재확인했다.

## 발견사항

### 검증됨 — 문제 없음

- **[INFO]** 선례 인용 정확성 확인 — `spec/3-workflow-editor/3-execution.md`
  - target 위치: draft `## Rationale` "미래-로드맵 vs partial" 문단
  - 대상: `spec/3-workflow-editor/3-execution.md` frontmatter(`status: implemented`) + `## 6. 브레이크포인트 (향후 로드맵 — 미구현)`
  - 상세: 실제로 `3-execution.md` 는 frontmatter `status: implemented` 이면서 §6 을 "> **상태: 미구현 (로드맵).**" 로 명시하고 있다 — draft 가 주장하는 "frontmatter implemented + 본문 로드맵 표기 공존" 패턴과 정확히 일치한다. §6 은 `pending_plans` 대상이 아니며(활성 tracking plan 없음), 향후 별도 plan·spec 개정으로 재도입한다고 명시한다. `17-agent-memory.md §7` "남은 로드맵"(사용자 식별자 연동, 조건부 미래 항목) 과 구조적으로 동형이다.
  - 결론: 인용은 정확하고 선례로서 유효하다. Cross-spec 충돌 없음.

- **[INFO]** 승격 가드(spec-impl-evidence 컨벤션)와의 정합 확인 — `spec/conventions/spec-impl-evidence.md`, `codebase/frontend/src/lib/docs/__tests__/spec-status-lifecycle.test.ts`
  - 상세: `spec-impl-evidence.md` R-5/§3 이 `partial → implemented` 승격을 "마지막 pending_plans 가 complete/ 로 이동한 commit 안에서 승격 (가드)" 로 **의무화**하고 있고, `spec-status-lifecycle.test.ts` guard (b)/(c) 는 `status: partial` 인데 `pending_plans` 가 비어 있거나 전부 complete 로 이동한 경우를 CI 에서 fail 시킨다. `0-common.md`/`17-agent-memory.md` 는 `pending_plans` 항목이 `ai-context-memory-followup-v2.md` **단 하나**뿐이고, 본 draft 가 그 plan 을 `complete/` 로 옮기므로, 승격하지 않고 `partial` 로 남기는 쪽이 오히려 이 가드를 위반(BLOCK)한다. 반대로 `1-ai-agent.md`(잔존 2개: `ai-agent-tool-connection-rewrite.md`, `exec-park-durable-resume.md` — 둘 다 `plan/in-progress/` 실존 확인)와 `conversation-thread.md`(잔존 1개: `exec-park-durable-resume.md`)는 여전히 미완료 plan 이 남아 `partial` 유지가 가드와 일치한다.
  - 결론: draft 의 4개 spec 처리(2개 승격 + 2개 partial 유지)는 project 의 공식 spec-impl-evidence 가드 규칙과 완전히 일치하며, 다른 방식(예: 4개 모두 partial 유지)을 택했다면 오히려 가드 위반이 된다.

- **[INFO]** `conversation-thread.md` 자체의 실질 미구현 v2 로드맵 확인
  - 상세: `spec/conventions/conversation-thread.md §7 v2 로드맵` 에는 provider tokenizer-exact 토큰 카운트, 실행 이력 화면 cross-node thread view, 시각 회귀 인프라 등 **아직 구현되지 않은 실질 항목**이 열거돼 있다 — `17-agent-memory.md §7` 의 "미래 조건부 1건"과 달리 진짜 활성 백로그다. `conversation-thread.md` 는 draft 에서 status 변경 대상이 아니고(partial 유지, pending_plans 1개 잔존) 이 확인은 그 판단이 옳음을 뒷받침한다.

- **[INFO]** 변경 7 (webchat `spec_impact: []` → `none`) — Gate C 단위테스트 로직과 정확히 일치
  - 상세: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` 의 `hasValidSpecImpact()` 는 `[]`(빈 배열, `length>0` 실패) 를 무효로, `"none"`/`"없음"` 문자열을 유효로 판정한다(직접 코드 확인: `NONE_VALUES = new Set(["none", "없음", "n/a", "na"])`, 배열은 `length > 0` 조건). `plan/in-progress/webchat-widget-refactor.md` 의 `started: 2026-06-27` 은 Gate C cutoff(`2026-06-04T00:00:00Z`, `GATE_C_CUTOFF`)보다 뒤이므로 grandfather 미적용 — enforcement 대상이 맞다. `.claude/docs/plan-lifecycle.md` §5(line 87-88 부근)의 "흔한 실패형" 문단이 정확히 이 패턴(`spec_impact: []`)을 실패 사례로 지목하고 `none` 을 처방한다. draft 의 인용·처방 모두 원문과 정확히 일치한다.
  - 결론: 이 변경은 다른 spec 영역과 충돌하지 않는 순수 plan-frontmatter 정정이며, cross-spec 관점에서 리스크 없음.

- **[INFO]** pending_plans 참조 현황표의 완전성 확인
  - 상세: `spec/**` 전체를 grep 한 결과 `ai-context-memory-followup-v2.md` 를 `pending_plans:` 로 참조하는 spec 파일은 정확히 draft 표에 열거된 4개(`0-common.md`, `1-ai-agent.md`, `17-agent-memory.md`, `conversation-thread.md`) 뿐이다. 누락된 참조처는 없다.
  - 추가 확인: `plan/in-progress/rag-dynamic-cut.md` 가 (과거 작업의 잔재로) `spec_impact:` 목록에 `0-common.md`/`17-agent-memory.md` 를 포함하지만, 이 두 spec 의 `pending_plans:` 프론트매터에는 등재돼 있지 않다(오직 `ai-context-memory-followup-v2` 만 등재) — 따라서 이 draft 의 승격 판단에 영향을 주는 활성 blocking plan 이 아니다. `rag-dynamic-cut.md` 자체가 이미 완료(같은 저장소의 `rag-quality-improvement.md:99` 가 "consistency --spec BLOCK:NO" 로 완료 기록)됐는데 `plan/complete/` 로 미이동된 상태로 보이나, 이는 본 draft 와 무관한 별도 stale-plan 이슈다(교정 대상 아님, 별도 트랙 권고 — INFO 수준).

## 요약

재검증 대상인 두 지점(§6 명시 인용, webchat 변경 7)을 원본 spec/코드에서 직접 대조한 결과 모두 정확했다. 특히 이번 라운드에서 draft 의 핵심 rationale 이 기댄 선례(`3-execution.md §6` "implemented + 로드맵 절 병기")는 실제로 정확히 그 구조를 가지고 있어 인용이 유효했고, `17-agent-memory.md §7` 의 "남은 로드맵"(사용자 식별자 연동, 인프라 전제조건부 미래 항목)과 구조적으로 동형이다. 더 나아가 `spec/conventions/spec-impl-evidence.md` 의 공식 가드 규칙(마지막 `pending_plans` 완료 시 `partial → implemented` 승격 의무)을 직접 대조한 결과, 이번 두 승격은 단순히 "허용"되는 수준이 아니라 **가드가 요구하는 필수 조치**이며 승격하지 않는 쪽이 오히려 CI 가드 위반이 된다는 점을 확인했다(`1-ai-agent.md`/`conversation-thread.md` 를 partial 로 유지하는 판단도 잔존 활성 plan 존재로 동일 가드와 정합). webchat `spec_impact: []→none` 변경도 Gate C 단위테스트 소스코드와 `plan-lifecycle.md` 문서를 직접 대조해 정확함을 확인했다. Cross-spec 관점에서 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

NONE
