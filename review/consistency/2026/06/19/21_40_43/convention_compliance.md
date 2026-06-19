# 정식 규약 준수 검토 결과

**Target**: `plan/in-progress/spec-draft-c1-spec-drift.md`
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-06-19

---

## 발견사항

### [WARNING] plan frontmatter 에 필수 필드 누락 (`started`, `owner`)

- **target 위치**: 파일 상단 frontmatter (L1-6)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — top-level `plan/in-progress/*.md` 에는 `worktree`·`started`·`owner` 3필드 필수. build guard `plan-frontmatter.test.ts` 가 강제.
- **상세**: 현재 frontmatter 에는 `status: draft`·`parent_plan`·`worktree`·`created` 가 있으나, 필수 필드 `started`(ISO 날짜)와 `owner`(역할/이름)가 없다. `created`는 spec-impl-evidence 규약의 키가 아니며 plan-lifecycle §4 에도 없는 비표준 키다. `worktree` 값은 `.claude/worktrees/spec-drift-c1-ea8bcb` 로 절대경로 형식인데 규약은 `<task_name>-<slug>` 형태(디렉토리 이름만)를 규정한다.
- **제안**:
  1. `started: 2026-06-19` 추가 (ISO 날짜).
  2. `owner: project-planner` (또는 실제 역할) 추가.
  3. `worktree: spec-drift-c1-ea8bcb` 로 변경(전체 경로 아닌 디렉토리명만).
  4. 비표준 `created:` 키는 제거하거나 `started:` 로 통일.

---

### [WARNING] `WORKFLOW_FORBIDDEN_WORKSPACE` 에러코드 — enum 미등재 상태를 spec 에 기술할 때 처리 방식 모호

- **target 위치**: 변경 2 (§6 에러코드 표 주석), 변경 3 §1.4 / §3.2
- **위반 규약**: `spec/conventions/error-codes.md §1` — 에러 코드는 의미 기반 명명 + `UPPER_SNAKE_CASE`. 카탈로그 SoT 는 `3-error-handling.md §1`. 인라인 문자열 inline guard 는 규약 밖 패턴.
- **상세**: target draft 는 `WORKFLOW_FORBIDDEN_WORKSPACE` 가 "enum 미등재 inline guard" 임을 정확히 기술하고 "dev 후속으로 enum 등재 예정" 을 명시한다. 이 기술 방식 자체는 정확성 우선 원칙에 부합하나, spec 에 "enum 미등재 코드" 를 정식 에러코드처럼 명시하면 독자가 해당 코드를 `error-codes.ts` 에서 찾을 것으로 기대하게 된다. error-codes 규약은 "새 코드는 반드시 ErrorCode enum 에 추가한 뒤 사용한다" 는 원칙을 갖는다.
- **제안**: spec 본문에 `WORKFLOW_FORBIDDEN_WORKSPACE` 를 기술할 때 "현재 inline throw — `SUB_WORKFLOW_FAILED` 로 surface, enum 등재는 후속 dev 작업" 이라는 주석을 명확히 병기하는 것은 적절하다. 단, 에러코드 카탈로그(`3-error-handling.md §1.4·§3.2`)의 표 본문 셀에 미등재 코드를 정식 항목처럼 넣는 것은 지양하고, 표 아래 note/callout 으로 처리하는 방식을 권장. target draft 가 "W-6 guard note" 형식을 취하고 있으므로 실제 spec 편집 시 이 패턴 유지.

---

### [INFO] `status: draft` — 비표준 frontmatter status 값

- **target 위치**: frontmatter `status: draft` (L1)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — spec 문서의 `status` 는 5값(`backlog`·`spec-only`·`partial`·`implemented`·`archived`) 중 하나.
- **상세**: `draft` 는 spec-impl-evidence 규약에 없는 값이다. 단, 본 파일은 consistency-check 입력용 임시 draft 로 적용 후 삭제 예정이라 일반 plan 과 성격이 다르다. 본 파일이 `plan/in-progress/` top-level 에 위치하므로 `plan-frontmatter.test.ts` 가 `worktree`·`started`·`owner` 를 강제하지만 `status` 값 자체는 plan frontmatter 가드 검증 대상이 아니다. spec-impl-evidence 가드는 `spec/` 폴더 내 파일에만 적용되므로 `plan/` 파일인 본 target 에는 미적용. 실질적 build 차단은 없음.
- **제안**: 삭제 예정 임시 파일이므로 현 상태 유지 가능. 필요 시 본문 상단 callout 에 "임시 draft — 적용 후 삭제" 를 명시하는 것으로 충분.

---

### [INFO] `parent_plan` frontmatter 키 — plan-lifecycle §4 비정의 키

- **target 위치**: frontmatter `parent_plan: plan/in-progress/refactor/c1-engine-split.md` (L3)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — frontmatter 스키마에 `parent_plan` 키는 정의되지 않음. (단, "추가 필드는 허용".)
- **상세**: plan-lifecycle §4 의 명시 필드는 `worktree`·`started`·`owner`·`spec_impact`(완료 시)뿐이다. `parent_plan` 은 규약에 정의되지 않아 툴링이 인식하지 않는 비공식 메타다. 규약 위반은 아니나 정의되지 않은 키임을 인지.
- **제안**: 현 상태 유지 가능. 향후 parent plan 계층 참조가 필요하면 plan-lifecycle §4 에 선택 필드로 등재 제안.

---

### [INFO] `worktree` 값 형식 — 경로 전체 vs 디렉토리명만

- **target 위치**: frontmatter `worktree: .claude/worktrees/spec-drift-c1-ea8bcb` (L4)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — worktree 값 예시는 `<task_name>-<slug>` (디렉토리 이름만) 형태.
- **상세**: 규약 예시는 디렉토리명만이나 현재 `.claude/worktrees/` prefix 까지 포함한 경로다. `plan-stale-audit.sh` 등 도구가 이 값으로 worktree 존재 여부를 확인할 때 파싱 방식에 따라 오작동 가능성이 있다.
- **제안**: `worktree: spec-drift-c1-ea8bcb` 로 디렉토리명만 기재하도록 정정. 단, WARNING 등급으로 상향되는 첫 번째 발견사항(필수 필드 누락)의 수정 시 함께 처리.

---

## 요약

target 문서 `plan/in-progress/spec-draft-c1-spec-drift.md` 는 consistency-check 입력용 임시 spec-draft 로 적용 후 삭제 예정이라는 맥락이 있다. 정식 규약 준수 관점에서 가장 실질적인 문제는 **plan frontmatter 필수 필드(`started`·`owner`) 누락**과 **`worktree` 값에 경로 전체 포함** 이다 — build guard `plan-frontmatter.test.ts` 가 이를 강제하므로 WARNING 등급이다. 에러코드 기술은 "enum 미등재 사실 명시 + 후속 등재 예정" 으로 정확성 우선 원칙에 부합하나, 실제 spec 편집 시 정식 에러코드 표 셀에 미등재 코드를 넣는 것을 피하고 note/callout 형식으로 처리해야 한다. 문서 구조(Overview/본문/Rationale 3섹션)·API 문서 데코레이터 규약·Cafe24 카탈로그 규약·audit-actions 명명 규약은 본 target 문서의 직접 관련 범위 밖이다. 변경 제안별 OLD/NEW 형식은 명확하고 규약에 부합한다. 발견된 2건 WARNING 은 plan frontmatter 가드에 의해 CI 차단 가능한 항목이므로 적용 전 수정을 권장한다.

---

## 위험도

LOW
