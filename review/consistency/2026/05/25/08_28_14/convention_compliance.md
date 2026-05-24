# 정식 규약 준수 검토 결과

- **검토 대상**: `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md`
- **검토 모드**: spec draft 검토 (--spec)
- **검토 일시**: 2026-05-25

---

## 발견사항

### [WARNING] Frontmatter 에 비표준 `status` 필드 사용

- **target 위치**: 문서 상단 frontmatter (라인 4)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`
- **상세**: plan-lifecycle.md §4 의 공식 plan frontmatter 스키마는 `worktree` / `started` / `owner` 3개 키만 정의한다. 대상 문서는 `status: pending` 을 추가로 선언하고 있으나, 이 필드는 plan frontmatter 스키마에 등재되지 않은 비표준 키다. `spec-impl-evidence.md` 의 `status` (implemented / partial / spec-only 등) 는 **spec 문서 frontmatter** 전용이며, plan 문서의 `status` 로 재사용하는 것은 두 도메인의 `status` 의미를 혼동할 위험이 있다 (spec-impl-evidence.md §2.2 "의미 도메인 구분" 패턴 참조).
- **제안**: `status: pending` 키를 frontmatter 에서 제거한다. plan 의 진행 여부는 파일이 `plan/in-progress/` 에 위치함으로써 이미 표현된다. 만약 plan 에 진행 상태 추적이 필요하다면 plan-lifecycle.md 를 갱신해 공식 키로 등재해야 한다.

---

### [WARNING] 제안된 spec 변경(변경 2.1)에 `## Rationale` 섹션 부재

- **target 위치**: "변경 2 — `INVALID_EXECUTION_STATE` 코드 spec 등재" 전반 (특히 변경 2.1, 2.2)
- **위반 규약**: `CLAUDE.md §정보 저장 위치` ("결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"), `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)`
- **상세**: 본 plan 이 제안하는 `spec/5-system/4-execution-engine.md §7.5.1` 신규 sub-section 초안(변경 2.1)에는 `## Rationale` 이 포함되어 있지 않다. spec 문서 3섹션 규약(Overview / 본문 / Rationale)에 따르면 결정 배경과 근거는 해당 spec 파일 끝의 `## Rationale` 에 기술해야 한다. plan 본문에 동기·배경이 서술되어 있지만, 실제 spec 에 반영 시 `## Rationale` 섹션에도 동등한 내용이 이전되어야 한다.
- **제안**: project-planner 가 spec 반영 시 `spec/5-system/4-execution-engine.md` 의 기존 `## Rationale` (또는 없다면 새로 추가)에 "WS 전용 `INVALID_EXECUTION_STATE` vs REST 공용 `INVALID_STATE` 분리 결정, historical artifact 의 배경" 을 추가하도록 본 plan 에 명시적 지시를 포함할 것을 권고.

---

### [INFO] `## 동기` 섹션의 상대 경로 링크

- **target 위치**: "## 동기" 섹션 첫 번째 줄 — `(workflow-resumable-execution.md)`
- **위반 규약**: CLAUDE.md 및 spec-impl-evidence.md 에서 경로는 레포 루트 기준 상대경로(예: `plan/in-progress/workflow-resumable-execution.md`) 또는 절대 경로를 사용하는 패턴을 권장
- **상세**: `(workflow-resumable-execution.md)` 는 동일 폴더 내 상대 경로로서 렌더링 환경에 따라 깨질 수 있다. 특히 `review/**` 의 일관성 검토 결과나 spec 에서 cross-link 할 때 이 링크가 복사되면 올바르게 동작하지 않는다.
- **제안**: `[plan/in-progress/workflow-resumable-execution.md](../../../plan/in-progress/workflow-resumable-execution.md)` 또는 단순히 파일 경로 텍스트 `plan/in-progress/workflow-resumable-execution.md` 로 표기.

---

### [INFO] 변경 2.2 제안 인라인 블록쿼트가 `## Rationale` 이 아닌 본문에 포함

- **target 위치**: "변경 2.2 — `spec/5-system/6-websocket-protocol.md §4.2` 에러 코드 표 주석 추가" 의 blockquote 텍스트
- **위반 규약**: CLAUDE.md ("결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`")
- **상세**: "WS 전용 코드 — REST 공용 422 `INVALID_STATE` 와 별개… historical artifact 이며…" 는 결정 근거(Rationale)에 해당하는 내용이다. 이를 spec 본문 표의 `비고` 컬럼 인라인이나 blockquote 로 넣는 것은 기술 명세 본문에 의사결정 근거를 혼재시키는 패턴이다. spec 문서 구조 규약상 결정 근거는 `## Rationale` 에 별도 기술하는 것이 권장된다.
- **제안**: `spec/5-system/6-websocket-protocol.md` 의 `## Rationale` 에 해당 내용을 기술하도록 변경하거나, 표 비고 컬럼은 간결한 사실 설명만 유지하고 배경은 Rationale 로 이동.

---

## 요약

대상 plan 문서는 정식 규약을 전반적으로 준수하고 있으며, plan 파일로서의 구조(frontmatter + 섹션 분리 + 변경 상세)도 명확하다. 다만 두 가지 주의가 필요하다. 첫째, frontmatter 에 비표준 `status: pending` 필드가 추가되어 있어 plan-lifecycle.md 공식 스키마와 불일치하며, spec 문서의 `status` 의미 도메인과 충돌 위험이 있다. 둘째, 실제 spec 에 반영될 내용(특히 변경 2.1, 2.2)이 `## Rationale` 섹션 구조를 명시하지 않아 project-planner 가 spec 반영 단계에서 누락할 가능성이 있다. 두 항목 모두 WARNING 수준이며 채택 차단 수준은 아니나, plan 이 그대로 실행될 경우 spec 문서에 Rationale 누락이 발생할 수 있다.

## 위험도

MEDIUM
