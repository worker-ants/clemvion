# 정식 규약 준수 Check — data-flow §1.1 mermaid 다이어그램 3-way 반영

## 검토 대상 정정 메모

Orchestrator payload 의 "Target 문서" 는 `plan/in-progress/spec-draft-dataflow-exec-seq-3way.md` (spec_impact: `spec/data-flow/3-execution.md`) 였다. `git diff origin/main` 은 비어 있었다 (해당 plan 파일이 아직 커밋되지 않은 untracked 상태이며, 대상 `spec/data-flow/3-execution.md` 자체는 이번 세션에서 아직 실제로 수정되지 않았다 — 이 검토는 spec-draft 단계(`--spec` 모드)의 **제안된 변경안**에 대한 사전 검토임). payload 에 첨부된 plan draft 원문과 실제 `spec/data-flow/3-execution.md` 파일 원문을 직접 대조해 분석했다.

**핵심 확인 사실**: 실제 `spec/data-flow/3-execution.md` §1.1 은 현재 다음과 같은 **내부 모순**을 갖고 있다.
- mermaid 다이어그램 (line 38-61): 여전히 2-way (`alt status !== pending` / `else pending`) — PR1~PR3 시절 표현.
- 바로 아래 산문 bullet (line 65): 이미 PR4 3-way(`RUNNING 분기가 §7.5 case B 로 재구동`)를 정확히 서술.
- §3.3 표 (line 293) 도 이미 3-way(RUNNING stalled 재배달 arm)를 반영.

즉 draft 가 지적한 "다이어그램만 잔여 drift" 진단은 실제 파일과 정확히 일치하며, 제안된 변경은 **문서 내부 정합성 복구**(신규 설계 아님)다.

---

## 발견사항

- **[INFO]** 코드 레벨 조건 표기의 문서 관례 일치 확인
  - target 위치: draft "after" 블록 `alt status == 'running' (...)` / `else status ∉ {pending, running} (...)`
  - 위반 규약: 없음 (준수 확인)
  - 상세: `∉`/`∈` 표기는 이 프로젝트 spec 전반( `spec/data-flow/12-workspace.md:146` `alt role ∉ {owner, admin}`, `spec/data-flow/11-workflow.md:76` `container.type ∈ {loop, foreach, map}` 등)에서 alt 조건문에 이미 쓰이는 확립된 표기 스타일이다. draft 의 `status ∉ {pending, running}` 은 이 관례와 정확히 일치한다.
  - 제안: 그대로 채택 가능. 규약 갱신 불필요.

- **[INFO]** 3-arm `alt/else/else` mermaid 구조의 문서 내 선례 일치
  - target 위치: draft "after" 블록 전체 (`alt ... else ... else ... end`)
  - 위반 규약: 없음 (준수 확인)
  - 상세: `spec/data-flow/3-execution.md` §1.2 (line 88-99) 가 이미 동일 파일 안에서 `alt / else / else / else` 4-arm 구조를 쓰고 있다 (`alt blocking` / `else background dispatch` / `else completed` / `else failed`). draft 가 §1.1 에 도입하는 3-arm 구조는 형식상 이 문서 내 기존 패턴을 그대로 재사용한 것이며 신규 표기 규약을 만들지 않는다.
  - 제안: 그대로 채택 가능.

- **[INFO]** 코드 심벌명 정확성
  - target 위치: draft "after" 블록 `Eng->>Eng: recordRunningSegmentStart + redriveStuckExecution(executionId)`
  - 위반 규약: 없음 (준수 확인) — 참고: 명명 규약(`spec/conventions/audit-actions.md` 류)은 감사 액션 명명에 한정되며 코드 심벌 표기 자체에 대한 정식 규약은 없다. 다만 정확성 관점에서 실제 코드와 대조.
  - 상세: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 3149-3158 을 확인한 결과, `runExecutionFromQueue` 의 `execution.status === ExecutionStatus.RUNNING` 분기가 정확히 `this.recordRunningSegmentStart(executionId); await this.redriveStuckExecution(executionId);` 순서로 호출한다. draft 의 다이어그램·주석이 실제 구현과 1:1 일치한다.
  - 제안: 그대로 채택 가능.

- **[INFO]** plan 파일명·frontmatter 컨벤션 준수
  - target 위치: `plan/in-progress/spec-draft-dataflow-exec-seq-3way.md` frontmatter
  - 위반 규약: 없음 (준수 확인) — `.claude/docs/plan-lifecycle.md §4`
  - 상세: `spec-draft-*` 파일명 패턴은 이 프로젝트에 이미 여러 선례가 있다 (`spec-draft-c2-atomic-claim.md`, `spec-draft-c3-context-drift.md`, `spec-draft-crash-running-redrive.md`). frontmatter 는 `worktree`/`started`/`owner` 세 필수 필드를 모두 갖췄고 `worktree: dataflow-exec-seq-338f46` 는 실제 이 세션의 worktree 디렉토리명과 일치한다. `spec_impact` 는 완료 시점(Gate C) 필드라 in-progress 단계에 없는 것이 규약대로 정상이다.
  - 제안: 없음.

- **[INFO]** `spec/data-flow/**` frontmatter 면제 규약과의 정합
  - target 위치: `spec/data-flow/3-execution.md` (frontmatter 없음)
  - 위반 규약: 없음 (준수 확인) — `spec/conventions/spec-impl-evidence.md §1`
  - 상세: 동 규약은 `spec/data-flow/**` 를 frontmatter(`id`/`status`/`code`) 의무 대상에서 명시적으로 제외한다("데이터 흐름 다이어그램·엔티티↔플로우 매핑 문서로... 해당 파일들은 frontmatter 자체가 없다"). draft 변경은 diagram 본문만 건드리고 frontmatter 를 추가/변경하지 않으므로 이 규약과 충돌하지 않는다. 단, §4.2 의 링크 무결성·area-index 가드는 `spec/data-flow/` 에도 적용되는데, draft 변경은 헤더 구조(`## 1. Source → Sink` → `### 1.1 실행 시작`)를 바꾸지 않고 코드 블록 내부·직후 bullet 만 수정하므로 anchor/link 무결성에 영향 없다.
  - 제안: 없음.

- **[INFO]** 문서 3섹션 구조(Overview/본문/Rationale) 유지
  - target 위치: `spec/data-flow/3-execution.md` 전체 구조
  - 위반 규약: 없음 (준수 확인) — CLAUDE.md "Spec 문서 3섹션 구성"
  - 상세: 대상 파일은 이미 `## Overview` → `## 1~4` 본문 → `## Rationale` 구조를 갖고 있다 (grep 확인: line 7 Overview, line 312 Rationale). draft 변경은 §1.1 본문 내부 코드블록 + bullet 1줄 추가에 그쳐 이 구조를 훼손하지 않는다.
  - 제안: 없음.

- **[WARNING]** draft 본문의 "before" 코드가 실제 라인과 100% 동일하지 않을 가능성 — 공백/줄바꿈 재현성 주의
  - target 위치: draft "before" 코드 블록 (`alt status !== pending (큐 대기 중 cancel 등)` 등)
  - 위반 규약: 정식 규약 위반은 아니나 실제 patch 적용 시 문자열 매칭 정확도에 영향
  - 상세: draft 의 "before" 텍스트는 실제 `spec/data-flow/3-execution.md` line 55-60 과 대조 시 내용은 일치하나, 향후 `developer`/`project-planner` 가 이 draft 를 그대로 diff/patch 로 적용할 때 실제 파일의 정확한 들여쓰기(2-space)·줄 순서와 재대조가 필요하다. 지금 검토 시점엔 내용 일치를 확인했으나, 이는 conventions 위반이 아니라 patch-apply 단계의 실무 주의사항이다.
  - 제안: spec 반영 PR 작성 시 `spec/data-flow/3-execution.md` line 38-61 블록을 직접 Edit 로 치환(문자열 정확 매칭)할 것을 권장. 규약 갱신 불필요.

---

## 요약

이번 검토의 실제 대상은 `plan/in-progress/spec-draft-dataflow-exec-seq-3way.md` (spec-draft 단계, `spec/data-flow/3-execution.md` §1.1 mermaid `alt` 블록을 2-way→3-way 로 갱신하는 제안)이다. `spec/data-flow/3-execution.md` 자체는 아직 수정되지 않았고 (`git diff origin/main` 비어있음), draft 는 실제 파일의 진짜 drift(다이어그램은 2-way 잔류, 바로 아래 산문·§3.3 표는 이미 3-way 반영 완료 — 문서 내부 모순)를 정확히 진단했다. 제안된 "after" mermaid 블록은 (1) 이 문서에 이미 쓰이는 `alt/else/else` 다중 분기 관례, (2) `∉`/`∈` 조건 표기 관례, (3) 실제 코드(`execution-engine.service.ts` `runExecutionFromQueue` RUNNING 분기의 `recordRunningSegmentStart`+`redriveStuckExecution` 호출)와 정확히 부합한다. plan 파일명·frontmatter 도 기존 `spec-draft-*` 컨벤션과 `.claude/docs/plan-lifecycle.md §4` 스키마를 모두 준수하며, `spec/data-flow/**` 의 frontmatter 면제·3섹션 구조 규약과도 충돌이 없다. CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다 — 유일한 WARNING 은 규약 위반이 아니라 patch-apply 단계의 실무 주의(문자열 정확 매칭)에 관한 것이다.

## 위험도

NONE

---

BLOCK: NO

- Critical: 없음
- Warning: 없음 (patch-apply 시 문자열 정확 매칭 주의 — 정식 규약 위반 아님, 실무 참고사항 1건)
- Info: 6건 (조건 표기 관례 일치, 3-arm alt 구조 선례 일치, 코드 심벌 정확성, plan 파일명/frontmatter 준수, data-flow frontmatter 면제 규약 정합, 3섹션 구조 유지 — 모두 규약 준수 확인)

STATUS: SUCCESS
