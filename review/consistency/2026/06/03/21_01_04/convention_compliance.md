# 정식 규약 준수 검토 결과

**대상 문서**: `plan/in-progress/ai-context-memory-auto.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-06-03

---

## 발견사항

### **[WARNING]** plan frontmatter `owner` 전환 표기 패턴이 규약 명시 형식 외
- **target 위치**: frontmatter `owner: planner → developer`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` Frontmatter 스키마 — `owner: <역할/이름>` 단일 값 예시 (`planner / developer / 사용자 본인 등`)
- **상세**: 규약 §4는 `owner` 필드를 단일 문자열로 정의하고 예시에 `planner / developer / 사용자 본인 등` 만 제시한다. `planner → developer` 처럼 화살표로 전환 순서를 표기하는 패턴은 규약에 없다. 명시 금지는 아니지만 규약 예시와 거리가 있다.
- **제안**: `owner: developer` (현재 작업 주체 단일 표기)로 통일하거나, 전환 표기를 관용 패턴으로 수용한다면 `.claude/docs/plan-lifecycle.md §4` 예시에 해당 형식을 추가.

---

### **[WARNING]** Phase A 완료 조건에 갱신 spec 파일의 `spec-impl-evidence` frontmatter 전환이 미포함
- **target 위치**: §3 영향 문서 목록, §4 Phase A 항목
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3.1` 전이 규칙 — `implemented` 인 spec 에 미구현 surface 가 추가되면 `partial` + `pending_plans` 등록 의무. `spec-status-lifecycle.test.ts` 가드(§4) 가 이를 build-time 강제.
- **상세**: `spec/conventions/conversation-thread.md`(현재 `status: implemented`)에 `runningSummary?`, `summarizedUpToSeq?` 필드가 추가되고, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/0-common.md` 등 `implemented` spec 에 신규 surface(`memoryStrategy` 외 4필드, 실행 로직, meta echo)가 추가된다. Phase A 완료 후 Phase C/D/E 구현이 이후에 진행되므로 spec 갱신 시 해당 파일 frontmatter 를 `status: partial` + `pending_plans: [plan/in-progress/ai-context-memory-auto.md]` 로 전환해야 한다. 이 작업이 Phase A 체크리스트에 없으면 build-time 가드(`spec-status-lifecycle.test.ts`)가 실패한다.
- **제안**: Phase A 항목에 "갱신 spec 파일(`conversation-thread.md`, `1-ai-agent.md`, `0-common.md` 등) frontmatter 를 `status: partial` + `pending_plans: [plan/in-progress/ai-context-memory-auto.md]` 로 전환" 을 명시. Phase G 완료 시 `implemented` 로 재승격.

---

### **[WARNING]** 신규 spec 파일 `spec/5-system/<N>-agent-memory.md` 생성 시 frontmatter 의무가 Phase 계획에 미명시
- **target 위치**: §3 "신규 `spec/5-system/<N>-agent-memory.md`", §5 "신규 system spec 문서 번호 — Phase A 에서 채번"
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1·§2·§5.1` — `spec/5-system/**.md` 는 frontmatter 의무 대상(`id`, `status`, `code:` 필드 필수). 신규 spec 작성 시 `status: spec-only`, `code: []` 로 시작.
- **상세**: `<N>` 플레이스홀더로 Phase A 에서 실제 파일이 생성될 때, `spec-frontmatter.test.ts` 가드가 즉시 frontmatter 유무를 검증한다. Phase A 항목에 frontmatter 초기화 스텝이 없어 가드 실패 위험이 있다.
- **제안**: Phase A 항목에 "신규 `spec/5-system/<N>-agent-memory.md` 에 `id`, `status: spec-only`, `code: []` frontmatter 추가" 스텝 명시.

---

### **[INFO]** `spec/1-data-model.md` 갱신 시 frontmatter 처리 주의 불필요(제외 대상)
- **target 위치**: §3 "`spec/1-data-model.md` — `agent_memory` 엔티티 추가"
- **위반 규약**: 해당 없음 — `spec/conventions/spec-impl-evidence.md §1` 이 `spec/1-data-model.md` 를 명시적 제외(`단순 overview 성격`)로 분류
- **상세**: `spec/1-data-model.md` 는 frontmatter 의무 대상이 아니므로 갱신 시 frontmatter 추가 불필요. 다만 plan 에서 이 파일을 갱신하는 개발자가 "왜 frontmatter 가 없는가"를 오해할 수 있다. 실질적 규약 위반 없음.
- **제안**: Phase A 메모에 "1-data-model.md 는 spec-impl-evidence frontmatter 제외 대상(§1)" 한 줄 추가 시 혼선 방지.

---

### **[INFO]** 요구사항 ID `ND-AG-*`, `SYS-MEM-*` 체계의 정식 규약이 conventions 에 부재
- **target 위치**: §3 "요구사항 ID: `ND-AG-*` 신규(설정/실행), 메모리 저장소는 `SYS-MEM-*` 신설 검토"
- **위반 규약**: `spec/conventions/` 에 요구사항 ID 명명 규약 파일이 존재하지 않음
- **상세**: `ND-AG-*`, `SYS-MEM-*` ID 패턴이 기존 다른 spec 에서 사용된다면 암묵적 규약이 있는 것이나, conventions 에 정의되지 않아 타 문서와의 일관성 강제가 불가능하다.
- **제안**: 이 ID 체계를 프로젝트 전반에서 사용할 계획이라면 `spec/conventions/` 에 요구사항 ID 규약을 신설하거나 `spec/0-overview.md` 에 정의 추가. plan 로컬 메모용이라면 현행 유지 가능.

---

## 요약

`plan/in-progress/ai-context-memory-auto.md` 는 plan frontmatter 필수 필드(`worktree`, `started`, `owner`)를 모두 갖추고 `plan/in-progress/` 경로에 올바르게 배치되었다. 가장 실질적 위험은 Phase A spec 갱신 시 `spec-impl-evidence` 규약의 build-time 가드(`spec-status-lifecycle.test.ts`, `spec-frontmatter.test.ts`) 실패다. `status: implemented` 인 기존 spec 파일에 미구현 surface 를 추가하면 `partial` 전환 + `pending_plans` 등록이 의무이며, 신규 `spec/5-system/<N>-agent-memory.md` 생성 시 frontmatter 초기화가 필요하다. 이 두 가지 전환 스텝을 Phase A 완료 조건(DoD)에 명시하지 않으면 합병 시 CI 가드가 차단된다.

## 위험도

MEDIUM
