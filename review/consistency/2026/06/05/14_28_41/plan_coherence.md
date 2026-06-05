---
target: plan/in-progress/memory-autoinject-extend.md
worktree: memory-autoinject-extend-e102af
branch: claude/memory-autoinject-extend-e102af
reviewed_at: 2026-06-05T14:28:41
reviewer: plan-coherence-agent
---

# Plan 정합성 검토 — memory-autoinject-extend.md

`plan/in-progress/memory-autoinject-extend.md` 가 다른 in-progress plan, 특히
`ai-context-memory-followup-v2.md` 와 정합하는지 분석한다.

---

## 발견사항

### [WARNING] followup-v2 항목 체크 미갱신 — 완료 표시 누락

- **target 위치**: `plan/in-progress/memory-autoinject-extend.md` 전체
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` 42~44행
  ```
  - [ ] text_classifier / information_extractor 자동 주입(contextScope/memoryStrategy) 확장:
        현재 자동 주입은 ai_agent 한정 (push 는 세 노드 모두 출하). 0-common.md §10,
        conversation-thread.md §2.3 로드맵.
  ```
- **상세**: `memory-autoinject-extend.md` 는 이 항목의 `contextScope` 축(stateless
  thread 주입)을 완전히 구현·검증 완료 상태다 (commit 8f4e7517/1ef61b09/38c99b99/
  32a3a8a3, e2e 173 PASS). 그러나 `followup-v2.md` 의 해당 행이 여전히 `- [ ]`
  미완료 상태로 남아 있다. 두 plan 이 동일 backlog 항목을 참조하면서 완료 여부가
  불일치한다.

  해당 항목은 `contextScope/memoryStrategy 확장` 을 한 묶음으로 기술하고 있으나,
  본 plan 이 명시적으로 범위를 `contextScope(stateless)` 만으로 한정하고 `memoryStrategy`
  는 미구현으로 남긴 점도 followup-v2 항목에 반영이 필요하다.

- **제안**: `followup-v2.md` 의 해당 `- [ ]` 항목을 아래와 같이 분리 갱신.
  ```
  - [x] text_classifier / information_extractor contextScope 자동 주입 확장:
        stateless thread inject 를 두 노드로 확장 완료
        (plan/in-progress/memory-autoinject-extend.md, 2026-06-05).
  - [ ] text_classifier / information_extractor memoryStrategy(summary_buffer/persistent)
        자동메모리 주입 확장: 상태누적 메모리는 ai_agent 전용 유지 (v2 로드맵).
  ```

---

### [WARNING] spec 파일 pending_plans — memory-autoinject-extend 참조 누락

- **target 위치**: `plan/in-progress/memory-autoinject-extend.md` Phase A (spec 변경 완료)
- **관련 spec 파일**:
  - `spec/4-nodes/3-ai/0-common.md` frontmatter
  - `spec/conventions/conversation-thread.md` frontmatter
- **상세**: 두 spec 파일의 `pending_plans:` 에 `plan/in-progress/ai-context-memory-followup-v2.md`
  만 등재돼 있다. `memory-autoinject-extend.md` 가 두 spec 파일을 직접 갱신(§10 inject
  범위 문구, §2.3 적용 범위 기술 변경)하는 plan 임에도 `pending_plans` 에 나타나지 않는다.

  `plan-lifecycle.md` 규약상 spec 파일을 수정하는 in-progress plan 은 해당 spec 의
  `pending_plans:` 에 등재해 spec 의 partial 상태가 어떤 plan 에 의해 해소될지 추적해야
  한다. worktree 커밋(38c99b99 기준)에서 spec 변경이 이미 완료됐으므로 PR 머지 후 spec
  상태가 갱신되는 시점과 일치시키려면 현 worktree 의 spec frontmatter 에도
  `memory-autoinject-extend.md` 참조가 있어야 한다.

- **제안**: PR 머지 직전 spec frontmatter 정비.
  - `spec/4-nodes/3-ai/0-common.md` `pending_plans` 에 `plan/in-progress/memory-autoinject-extend.md` 추가.
  - `spec/conventions/conversation-thread.md` `pending_plans` 에 동일 추가.

---

### [WARNING] followup-v2 후속 착수 시 동일 spec 파일 재접촉 가능성

- **target 위치**: `plan/in-progress/memory-autoinject-extend.md` frontmatter `spec:` 목록
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` 미완료 항목
- **상세**: `followup-v2.md` 의 남은 미완료 항목(메모리 가시화 UI, provider
  tokenizer-exact, 요약/추출 전용 모델, v2 코드리뷰 백로그)이 후속 작업에서 새 worktree
  를 열면 `0-common.md` 와 `conversation-thread.md` 를 다시 손댈 가능성이 있다. 현재는
  active worktree 경합이 없으나(ai-context-memory-9c7e6e 는 stale), 본 plan PR 미머지
  상태에서 followup-v2 후속 worktree 가 열리면 동일 spec 파일 충돌이 발생한다.
- **제안**: 본 plan PR 머지 완료 후 followup-v2 후속 작업 착수. 순서 의존성을 followup-v2
  plan 본문에 명시하면 충돌 방지.

---

### [INFO] information-extractor spec — 존재하지 않는 plan 참조 (dangling reference)

- **target 위치**: worktree `spec/4-nodes/3-ai/3-information-extractor.md` frontmatter
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md` (파일 없음)
- **상세**: worktree 의 `3-information-extractor.md` frontmatter 가
  `plan/in-progress/exec-park-durable-resume.md` 를 참조하나 해당 파일이 존재하지 않는다.
  본 target plan 이 직접 생성한 문제는 아니나 worktree 내 spec 파일에 포함돼 있으므로
  기록한다.
- **제안**: `3-information-extractor.md` `pending_plans` 에서 해당 항목 제거 또는 실제
  plan 파일 생성. 본 plan 범위 외, 낮은 우선순위.

---

### [INFO] ai-review 미실행 — 후속 턴 필요

- **target 위치**: `plan/in-progress/memory-autoinject-extend.md` §상태 마지막 줄
- **상세**: plan 상태 섹션에 "Workflow/Agent tool 미가용 — sub-agent fan-out 미실행.
  후속 턴/환경에서 `/ai-review --range origin/main..HEAD` 재개 필요" 로 명시돼 있다.
  CLAUDE.md 규약(구현 완료 후 `/ai-review` 는 상시 강제 의무)에 따라 이 단계가 보류 중.
- **제안**: 현 worktree 에서 Agent/Workflow tool 이 가용한 환경으로 전환 후
  `/ai-review --range origin/main..HEAD` 실행 필수.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보:

- `ai-context-memory-9c7e6e` (branch `claude/ai-context-memory-9c7e6e`) — Step 1
  ancestor 검사: ACTIVE (exit 1, squash merge 로 hash 변경됨). Step 2 PR state:
  **MERGED** → stale 판정. §5번 worktree 경합 검토에서 제외.

해당 worktree 가 로컬에 남아있다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`memory-autoinject-extend.md` 는 `ai-context-memory-followup-v2.md` 가 백로그로 들고
있던 "text_classifier / information_extractor 자동 주입 확장" 의 `contextScope` 축을
정확히 실현하는 plan 으로, 설계 방향과 범위 경계(contextScope 만, memoryStrategy 는
ai_agent 전용 유지)가 명확하다. 미해결 결정 우회나 active worktree 경합은 없다. worktree
충돌 후보 1건 중 stale 1건 skip, active 0건. 발견된 주요 이슈는 WARNING 3건: (1) followup-v2
체크리스트가 완료 표시 없이 불일치 상태이며 항목 분리가 필요하고, (2) 0-common.md /
conversation-thread.md spec frontmatter `pending_plans` 에 본 plan 참조가 누락돼 추적
공백이 생기며, (3) followup-v2 후속 착수 시 동일 spec 파일 재접촉 순서 의존성이 있다.
세 이슈 모두 PR 머지 직전 또는 착수 순서 조정으로 해소 가능한 수준이며, 작업 직렬화나
결정 합의가 선행될 필요는 없다.

---

## 위험도

**LOW**

---

BLOCK: NO
