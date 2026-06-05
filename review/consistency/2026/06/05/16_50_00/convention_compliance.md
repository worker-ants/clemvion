# Convention Compliance Review — memory-strategy-extend-ad5987

**범위**: `git diff 21fa8194..HEAD` (본 PR diff 만)
**검토일**: 2026-06-05
**검토자**: consistency-checker (convention 준수)
**위험도**: MEDIUM

---

## CRITICAL

없음.

---

## WARNING

### [WARNING] `3-information-extractor.md` — `status: implemented` 인데 `pending_plans` 등재

- **target 위치**: `spec/4-nodes/3-ai/3-information-extractor.md` frontmatter (line 3–9)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` 라이프사이클 표 — `implemented` 행: `pending_plans: 없음`
- **상세**:
  - 규약 정의: `implemented` = "모든 약속 구현 완료". `pending_plans` 는 `partial` 에만 의무·유효.
  - PR 이전(21fa8194)에도 `exec-park-durable-resume.md` 가 이미 등재돼 있어 **사전 위반** 상태였다. 본 PR 은 `memory-strategy-extend-ie.md` 를 추가해 같은 위반을 심화시켰다.
  - `spec-status-lifecycle.test.ts` 가드는 `implemented` 에 대해 idle(`lifecycle guard idle for this status` — 라인 76–79) 이므로 **build-gate 는 차단하지 않는다**. 단 `spec-pending-plan-existence.test.ts` 는 `pending_plans` 경로가 존재하는지 검증하며, 두 파일 모두 `plan/in-progress/` 에 실존하므로 해당 가드도 통과한다.
  - 규약 semantic 위반: IE spec 은 미완 surface(`pending_plans`)가 있으므로 `status: partial` 이 맞다.
- **제안**: `spec/4-nodes/3-ai/3-information-extractor.md` frontmatter 를 `status: partial` 로 갱신한다. 이는 `exec-park-durable-resume.md` 가 등재된 시점부터 필요했던 수정이며, 본 PR 이 `memory-strategy-extend-ie.md` 를 추가하는 commit 에 포함시켜 처리하는 것이 가장 자연스럽다.

---

### [WARNING] `0-common.md` §10 `memoryStrategy` 필드 — Type 셀에 노드별 열거를 인라인 기술, 공통 spec 표 일관성 벗어남

- **target 위치**: `spec/4-nodes/3-ai/0-common.md` 라인 155 `memoryStrategy` 행 Type 컬럼
- **위반 규약**: `spec/conventions/node-output.md §Principle 0` — 공통 spec 표의 타입 셀은 단일 타입 또는 간결한 enum으로 기술하는 규범적 패턴. 본 PR 에서 `ai_agent`: `manual` / `summary_buffer` / `persistent` · `information_extractor`: `manual` / `persistent` 형식(노드 이름과 값을 `·` 구분)을 도입했는데, 같은 표의 다른 필드들은 단일 enum 형식을 쓴다.
- **상세**:
  - 변경 전: `manual` / `summary_buffer` / `persistent` (단일 enum, ai_agent 한정 설명은 description 셀에 있었음)
  - 변경 후: Type 셀에 `ai_agent:` / `information_extractor:` 라는 노드 이름 prefix 가 도입됨
  - `0-common.md` 는 세 노드 공통 표인데 필드가 노드마다 다른 타입을 가진다는 사실을 Type 셀에 표현하려 한 것은 이해할 수 있으나, 공통 규약 내 다른 어떤 필드도 이 방식을 쓰지 않아 새 패턴 도입이 된다.
  - build-gate 차단 위험 없음. 설명 셀(description)에 기술하면 같은 정보가 더 자연스럽게 전달된다.
- **제안**: Type 셀을 `manual` / `summary_buffer` / `persistent` (또는 `manual` / `persistent`) 로 되돌리고 노드별 제한(`information_extractor` 는 2값, `text_classifier` 는 없음)을 description 셀에 기술하는 기존 패턴을 유지한다. 또는 규약 문서에 "공통 표에서 노드별 타입 분기를 Type 셀에 표현하는 방법"을 명시해 신규 패턴을 정식화한다.

---

## INFO

### [INFO] `§4.1` 단계 번호 `2.5` → `2.6` — 소수점 단계 번호 일관성

- **target 위치**: `spec/4-nodes/3-ai/3-information-extractor.md` §4.1 단계 목록 (라인 147–155)
- **위반 규약**: 명시적 규약은 없음. 동일 문서 기존 관행 참고.
- **상세**: 기존 단계 `0.5`, `2.5` (소수점 번호로 기존 단계 사이 삽입 표현) 패턴은 이미 사전 커밋에서 도입됐다. 본 PR 이 `2.6` 을 추가한 것은 같은 패턴을 따른 것으로 일관성 있다.
- **제안**: 변경 없이도 무방. 다만 향후 단계가 더 많아지면 `2.5` / `2.6` 처럼 소수점 번호 연속이 늘어나므로, 최종 구현이 안정되는 시점에 정수 번호로 재정렬하는 것을 권장한다.

### [INFO] `plan/in-progress/memory-strategy-extend-ie.md` — `status: in-progress` 필드는 비표준이나 허용 범위

- **target 위치**: `plan/in-progress/memory-strategy-extend-ie.md` frontmatter line 3
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — 필수 3 필드: `worktree`, `started`, `owner`. 추가 필드는 허용(`priority`/`status`/`title` 등 추가 필드는 허용`).
- **상세**: `status: in-progress` 와 `branch: ...` 는 규약 상 필수는 아니지만 금지도 아님. `title:` 필드도 동일. 필수 3필드(`worktree`, `started`, `owner`) 모두 정확히 존재한다. `plan-frontmatter.test.ts` 가드 통과 예상.
- **제안**: 변경 없이 무방.

### [INFO] `conversation-thread.md` §2.3 표 내 블록인용 삽입 — 표 뒤 prose 블록인용 패턴과 일관

- **target 위치**: `spec/conventions/conversation-thread.md` §2.3 표 내 `> **information_extractor` 인용 블록 (라인 +147–+148)
- **위반 규약**: 명시적 규약 없음.
- **상세**: 표 바로 뒤에 `>` blockquote 를 삽입하는 패턴은 같은 파일의 기존 관행(직후 `> **ai_user push 시점 불변...` 인용)과 일관됨. 단 표 셀 안에 blockquote 를 삽입하지 않고 표 *뒤* 에 위치해 렌더링 문제 없음.
- **제안**: 변경 없이 무방.

---

## 요약

본 PR diff 의 정식 규약 준수 상태를 평가했다. 핵심 건: `spec/4-nodes/3-ai/3-information-extractor.md` 가 `status: implemented` 를 유지하면서 `pending_plans` 에 `memory-strategy-extend-ie.md` 를 추가한 것은 `spec/conventions/spec-impl-evidence.md §3` 의 라이프사이클 정의에 반한다(`implemented` = pending_plans 없음). 이 위반은 본 PR 이전(`exec-park-durable-resume.md`) 부터 존재했고 본 PR 이 심화시켰다. build-gate(`spec-status-lifecycle.test.ts`)는 `implemented` 상태에서 idle이라 CI 차단은 없지만, 규약 semantic 상 `status: partial` 로 갱신해야 한다. `0-common.md` §10 `memoryStrategy` Type 셀에 도입된 `노드명: 타입` 인라인 형식은 기존 공통 표 패턴에 없던 새 표현 방식으로 WARNING 수준이나, 설명 셀로 이전하면 해소 가능하다. 나머지 항목(단계 번호 소수점, plan 추가 필드, §2.3 blockquote)은 INFO 수준으로 동작에 영향 없다. 링크 앵커(`#7-persistent-메모리-recall--extraction`)는 github-slugger 슬러그와 일치하고, 신규 plan 의 필수 frontmatter 3 필드(worktree/started/owner)는 모두 정상 존재하며, 변경된 4개 spec(3-information-extractor, 0-common, conversation-thread, 17-agent-memory) 모두 `memory-strategy-extend-ie.md` 를 `pending_plans` 에 등재해 cross-reference 일관성은 유지됐다.

## 위험도

MEDIUM

## BLOCK: NO

(build-gate 차단 위험 없음. `status: implemented` → `partial` 갱신은 규약 정합성 권고이며 빌드를 막지는 않는다.)
