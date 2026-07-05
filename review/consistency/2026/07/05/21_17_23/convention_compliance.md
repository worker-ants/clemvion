# 정식 규약 준수 검토 — convention_compliance

- 검토 모드: `--impl-done` (구현 완료 후, diff-base=`origin/main`)
- Target: `spec/conventions/interaction-type-registry.md`
- 대조 코드: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`,
  `codebase/frontend/src/components/editor/run-results/use-result-detail-waiting.ts`,
  `codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx`,
  `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx`,
  `codebase/frontend/src/components/editor/run-results/result-detail.tsx`

## 검토 방법

프롬프트 payload(`_prompts/convention_compliance.md`)에 `interaction-type-registry.md` 본문이 포함되어 있지 않아(cafe24-api-catalog 계열 문서만 인라인 수록), 사용자 지시에 따라 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/result-detail-props-hook-94eca4`)의 실제 파일을 절대경로로 직접 Read/git diff 하여 검토했다. `git diff origin/main -- spec/conventions/interaction-type-registry.md` 로 변경분을 특정하고, `git -C <worktree>` 로 관련 코드(hook·drawer·test)의 HEAD 상태를 확인했다.

## 발견사항

- **[INFO]** §1.2 매트릭스 "(e) 동등" 표현이 파일 다름에도 letter 를 재사용해 다소 모호
  - target 위치: `spec/conventions/interaction-type-registry.md` §1.2 표, `buttons`/`ai_conversation` 행
  - 위반 규약: 명시적 규약 위반은 아님 — `spec/conventions/interaction-type-registry.md` 자체의 표기 명료성 이슈
  - 상세: `form` 행의 letter (e) 는 `result-detail.tsx formPreview` 를 가리킨다. `buttons` 행은 "(a)~(d) 동등"(letter (e) 미포함, 정확 — `buttonsPreview` 는 별도 산출물), `ai_conversation` 행은 "(a)~(d) 동등 (`deriveFlags` 의 `isWaitingConversation`) + (e) 동등"이라고 쓰는데, 실제 `result-detail.tsx` 코드는 `ai_conversation` 을 `formPreview`(letter e)가 아니라 `conversationPreview`(별도 분기, `isWaitingConversation` 기반)로 렌더한다(`result-detail.tsx:1061` `conversationPreview`). 즉 "letter (e) 동등"이 실제로는 "letter (e) 와 유사한 위치의 별개 분기(conversationPreview)가 있다"는 뜻으로 쓰이고 있어, letter 표기만 보면 `ai_conversation` 도 `formPreview` 를 탄다고 오독할 수 있다. 단, 이 표현 스타일은 `origin/main` 버전에도 동일하게 존재했다("(a)~(f) 동등" — 옛 (f)=`result-detail.tsx formPreview`) — 이번 리팩터가 새로 만든 부정확함이 아니라 letter 재넘버링 과정에서 그대로 이월된 pre-existing 모호함이다.
  - 제안: 필수 수정 아님(리팩터 스코프 밖). 후속 편집 시 `ai_conversation`/`ai_form_render` 행의 "(e) 동등"을 "`result-detail.tsx` `conversationPreview` (isWaitingConversation 분기, letter (e) 의 formPreview 와는 별개 산출물)"처럼 명시하면 letter 재사용으로 인한 오독 여지를 없앨 수 있다.

## 규약 준수 검증 결과 (위반 없음 확인 항목)

1. **rule 3 프로즈 ↔ `REGISTRY_SITES` 일치**: 문서 §1.2 규칙3 은 "현재 `REGISTRY_SITES` 는 3개 파일 — `use-execution-events.ts` (위 (a)·(b)), `apply-execution-snapshot.ts` ((c)), `use-result-detail-waiting.ts` ((d) — 에디터 drawer·실행 상세 page 가 공유하는 `deriveFlags` 단일 파생 site)" 라고 서술한다. 실제 `interaction-type-exhaustiveness.test.ts` 의 `REGISTRY_SITES` 배열은:
   ```
   const REGISTRY_SITES = [
     "codebase/frontend/src/lib/websocket/use-execution-events.ts",
     "codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts",
     "codebase/frontend/src/components/editor/run-results/use-result-detail-waiting.ts",
   ];
   ```
   3개 파일·순서·이름 모두 문서 프로즈와 정확히 일치. 3개 파일 전부 워킹트리에 실존 확인.

2. **letters 재넘버링 contiguous 여부**: `origin/main` 대비 diff 확인 결과, `form` 행은 (a)(b)(c)(d)(e) 5-letter(옛 6-letter 에서 옛 (d) `run-results-drawer.tsx isWaitingForm`·(e) `executions/page.tsx isWaitingForm` 이 새 (d) `use-result-detail-waiting.ts deriveFlags` 로 병합), `ai_form_render` 행은 (a)~(f) 6-letter(옛 7-letter 에서 옛 (d)·(e) 가 새 (d) 로 병합, 옛 (f)→새 (e), 옛 (g) `resumeFromAiRenderForm`→새 (f)). 문서 §1.2 아래 "재개(resume) turn 라우팅" 노트의 교차 참조도 "`ai_form_render` 행 (g)"→"행 (f)" 로 함께 정정되어 있어 letter 번호 참조 전체가 일관됨. gap 없음.

3. **hook `deriveFlags` 실제 구현과 문서 서술 일치**: `use-result-detail-waiting.ts` 의 `deriveFlags(isSelectedWaiting)` 는 `isWaitingForm`(`'form'`)·`isWaitingButtons`(`'buttons'`)·`isWaitingConversation`(`'ai_conversation' || 'ai_form_render'`) 3개 플래그를 반환하며, 두 소비처(`run-results-drawer.tsx`·`executions/[executionId]/page.tsx`) 가 모두 이 hook 을 import 해 사용한다. 문서가 "(d) `use-result-detail-waiting.ts` `deriveFlags` … (에디터 drawer·실행 상세 page 공용 — 두 소비처가 hook 에 위임)"이라 서술한 것과 정확히 일치.

4. **drawer 잔여 `isLiveConversation` = subset consumer 서술 검증**: `run-results-drawer.tsx:312-315` 의 `isLiveConversation` 은 `status === "waiting_for_input" && (waitingInteractionType === "ai_conversation" || waitingInteractionType === "ai_form_render")` 로, `deriveFlags` 의 exhaustive 분기(switch/`assertNever`)가 아니라 plain `||` 비교다. 문서 rule 3 의 "drawer 의 잔여 `isLiveConversation`(ai_conversation·ai_form_render 2값만 구분) 은 exhaustive 분기가 아닌 subset 소비처(plain `||` 비교, switch·`assertNever` 아님)라 두 가드(grep·TS exhaustive) 어느 쪽도 아니며…" 서술과 코드가 정확히 부합. test 파일 헤더 주석("The drawer's residual `isLiveConversation` … subset consumer, not an exhaustive branch")도 spec 과 동일 취지로 co-updated 되어 있어 spec↔test 간 서술 불일치 없음.

5. **frontmatter `code:` 리스트**: 이번 diff 는 frontmatter 를 변경하지 않았다(diff 는 §1.2 표 6줄만 수정). `use-result-detail-waiting.ts` 가 frontmatter `code:` 목록에 없는 것은 이 문서의 기존 관례(구체 프론트 렌더/hook 파일을 전부 나열하지 않고 대표 test·backend 서비스 위주로 등록, `run-results-drawer.tsx`/`executions/page.tsx`/`result-detail.tsx` 도 원래부터 미등재)와 일치 — 이번 diff 로 새로 생긴 결락이 아니다.

6. **문서 구조 규약(Overview/본문/Rationale)**: 본 문서는 `## Overview` 없이 도입 문단 + `## 1./2./3.` + `## 4. Rationale` 구조다. CLAUDE.md 는 3섹션 구성을 "권장"으로 명시(SKILL.md 참고, 강제 아님)하며, 이 구조는 diff 이전부터의 pre-existing 스타일(같은 conventions 폴더의 `conversation-thread.md` 도 동일 패턴)이라 이번 리팩터 반영 범위 밖. 위반으로 보지 않음.

## 요약

`spec/conventions/interaction-type-registry.md` 의 이번 리팩터(§1.2 매트릭스 (d) 브랜치 사이트를 `run-results-drawer.tsx`/`executions/page.tsx` 개별 서술에서 공용 hook `use-result-detail-waiting.ts` `deriveFlags` 참조로 교체, letters contiguous 재넘버링, rule 3 프로즈 갱신, `isLiveConversation` subset-consumer 명시)은 실제 코드(hook 구현·drawer 리팩터·`REGISTRY_SITES` test 배열)와 완전히 부합한다. rule 3 프로즈가 test 의 `REGISTRY_SITES` 3-파일 배열과 정확히 일치하고, letter 재부여도 교차 참조(§1.2 아래 resume 노트의 "행 (f)")까지 포함해 gap·중복 없이 일관됐다. CLAUDE.md 의 문서 구조 권장(Overview/본문/Rationale)은 본 문서가 Overview 섹션 없이 원래부터 유지해온 pre-existing 스타일이라 이번 변경 범위 밖으로 판단했다. 유일한 지적 사항은 §1.2 표에서 `ai_conversation`/`ai_form_render` 행이 `form` 행의 letter (e)(`formPreview`)를 "동등"으로 재사용해 실제로는 다른 산출물(`conversationPreview`)을 가리키는 표기 모호함인데, 이는 `origin/main` 시점부터 존재하던 표현이라 이번 리팩터의 신규 위반이 아니며 INFO 등급의 후속 명료화 제안에 그친다. 정식 규약 위반(CRITICAL/WARNING)은 발견되지 않았다.

## 위험도

NONE
