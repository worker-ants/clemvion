# 변경 범위(Scope) 리뷰 결과

**리뷰 대상 PR**: exec-park-pr-b2 (PR-B2a) — top-level 멀티턴 AI turn-park (exec-park D4)
**실제 머지베이스 기준 변경 파일 수**: 6개 코드 파일 + plan/review 산출물

---

## 사전 확인: 머지베이스 vs origin/main 불일치

`git diff origin/main` 은 이 worktree 에 존재하는 다른 작업 결과물(rag-eval, channel-web-chat, eval-scripts 등)을 포함한다. 그러나 `git merge-base origin/main HEAD` 기준의 실제 이 브랜치 변경 파일은 다음과 같다:

```
codebase/backend/migrations/V087__execution_resume_call_stack.sql
codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts
codebase/backend/src/modules/execution-engine/execution-engine.service.ts
codebase/backend/src/modules/executions/entities/execution.entity.ts
codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts
spec/1-data-model.md
spec/5-system/4-execution-engine.md
plan/in-progress/exec-park-durable-resume.md
plan/in-progress/exec-intake-queue-impl.md
plan/in-progress/spec-draft-exec-park-b2-durable.md
review/code/2026/06/06/03_03_22/ (review 산출물)
review/consistency/2026/06/06/0{2_22,2_33,2_43,3_22,3_34,3_49}*/ (consistency 산출물)
```

`codebase/backend/src/modules/knowledge-base/eval/`, `codebase/channel-web-chat/`, `codebase/backend/src/scripts/`, `codebase/backend/eval/`, `spec/5-system/9-rag-search.md`, `spec/7-channel-web-chat/` 등은 이 브랜치의 변경이 아니라 워크트리 선행 커밋에서 이미 존재한 파일이다 — 본 PR 의 범위 이탈이 아니다.

이하 분석은 머지베이스 기준 실제 변경 파일만 대상으로 한다.

---

## 발견사항

### [INFO] spec/5-system/4-execution-engine.md — D6 중첩 sub-workflow 절(§7.5) 추가가 PR-B2a 범위를 일부 초과

- **위치**: `spec/5-system/4-execution-engine.md` §7.5 신규 절 "중첩 sub-workflow 재개 — resume_call_stack 재귀 재진입 (exec-park D6 — 설계 확정, PR-B2 구현 예정)", §Rationale exec-park D6 4개 bullet
- **상세**: PR-B2a 의 코드 범위는 "top-level 멀티턴 AI turn-park(processAiResumeTurn + reparkAiResumeTurn + waitForAiConversation parkMode 파라미터)" 이며, 중첩 sub-workflow 의 D6(resume_call_stack stage + 재귀 재진입)는 plan 에서 명시적으로 PR-B2b 로 분리됐다. 그런데 spec 에 D6 의 상세 재귀 재진입 절차(3단계: 버전 가드 → 재귀 재진입 → 최내층 payload 전달)가 기술됐다. 단, 본문 내 "구현 상태(2026-06-06): ... park stage·§7.5 재귀 rehydration·... PR-B2 후속 커밋에서 구현 — 미구현" 표식이 명확히 달려 있어 **미구현 설계 문서화**로 의도가 분명하고, V087 컬럼·타입(`resume-call-stack.types.ts`)은 이 PR 에서 실제로 추가됐으므로 D6 기반 인프라의 spec 선행 기재는 합리적이다.
- **판정**: 코드 범위(PR-B2a)와 spec 선행 기재(D6 설계 확정)의 분리는 plan 의 "8(a~c durable 인프라) 먼저" 결정과 일치한다. 미구현 표식이 정확히 달려 있어 오해 위험도 낮다. 범위 초과보다는 "PR-B2b 를 위한 사전 설계 문서화"로 간주 가능.
- **제안**: 변경 불필요. 다만 D6 절이 PR-B2b 에서 미완성 그대로 남지 않도록 PR-B2b 착수 시 이 절의 "구현 예정" 표식을 완료형으로 전환하는 것을 PR-B2b checklist 에 명기해두면 추적이 쉬워진다.

---

### [INFO] execution-engine.service.spec.ts — button_click/unknown type 테스트가 runAiConversationLoop 직접 구동으로 분기

- **위치**: spec 파일 내 `driveLoopButtonClick` helper — `runAiConversationLoop` 를 직접 invoke 해 loop 동작 검증
- **상세**: 본 PR 은 top-level AI turn-park 를 `processAiResumeTurn` 으로 전환하면서 button_click/unknown 분기를 그 단발 처리기로 이관했다. 그런데 buttonId 슬라이싱(64자 초과·null·숫자) 테스트는 여전히 `runAiConversationLoop` 를 직접 구동하는 헬퍼(`driveLoopButtonClick`)를 통해 검증한다. 이는 "loop 의 buttonId 방어 코드가 살아있음"을 가드하는 의도인데, processAiResumeTurn 에서도 동일 warn log 경로(`reparkAiResumeTurn`)를 거친다. 중첩 `executeInline`(await mode)에서 loop 가 잔존하므로 loop 의 buttonId 방어를 별도로 가드하는 것은 불필요한 중복은 아니다.
- **판정**: 현재 구조에서 루프가 잔존하는 한 loop-level 테스트가 있어도 범위 이탈이 아니다. INFO 수준.

---

### [INFO] spec/1-data-model.md — resume_call_stack 행의 링크 텍스트 소문자 변경 (`D6` → `exec-park D6`)

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/1-data-model.md` line 467
- **상세**: `(D6)` → `(exec-park D6)` 로 링크 텍스트만 변경. D6 레이블 충돌 해소(AI 노드 spec 의 동명 D6와 혼동 방지)를 위한 의도된 수정이며, consistency 리뷰(C1 해소)의 결과다.
- **판정**: 범위 내 수정.

---

## 요약

실제 머지베이스(`79b66ce5`) 기준으로 이 PR-B2a 는 목적에 집중된 변경을 포함한다: `waitForAiConversation` 에 `parkMode` 파라미터 추가, `processAiResumeTurn`/`reparkAiResumeTurn` 신규 메서드, `driveResumeDetached` 의 payload 전달, `finalizeAiNode` 의 RUNNING→RUNNING 전이 방어 — 모두 top-level 멀티턴 AI turn-park(exec-park D4)의 직접 구현이다. spec 에 D6 절이 추가됐으나 "구현 예정·미구현" 표식이 명확해 over-claim 이 없고, V087 컬럼/타입 추가가 이 PR 에 포함됐으므로 기반 선행 기재로 타당하다. review/consistency/plan 산출물은 프로젝트 규약상 구현 완료 후 의무적으로 생성되는 파일들이다. 불필요한 리팩토링, 관련 없는 파일 수정, 포맷팅 혼입, 불필요한 임포트 정리 등 범위 이탈 징후는 없다.

## 위험도

NONE

STATUS: OK
