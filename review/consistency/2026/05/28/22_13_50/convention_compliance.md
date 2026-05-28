# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-cafe24-nonce-key-design.md`

검토 모드: spec draft (--spec)  
검토 일시: 2026-05-28  
검토 대상: `.claude/worktrees/cleanup-followups/plan/in-progress/spec-draft-cafe24-nonce-key-design.md`

---

## 발견사항

### [WARNING] plan frontmatter 에 `draft_for` 필드 누락 — 다른 spec-draft plan 과 구조 불일치

- target 위치: `plan/in-progress/spec-draft-cafe24-nonce-key-design.md` frontmatter (lines 1-5)
- 위반 규약: `plan/in-progress/spec-draft-chat-channel-error-notify.md` 가 정착시킨 실질적 관행 (같은 디렉토리 내 유일한 `spec-draft-*` 선례). `.claude/docs/plan-lifecycle.md §4` 의 frontmatter 스키마는 `worktree` / `started` / `owner` 세 필드만 의무로 명시하고 있어 규약 문서 자체의 직접 위반은 아님.
- 상세: 다른 spec-draft plan(`spec-draft-chat-channel-error-notify.md`)은 `draft_for`, `status: draft (consistency-check pending)`, `target_specs:` 필드를 포함해 draft 가 어느 spec 파일을 목표로 하는지를 frontmatter 에서 명시한다. 검토 대상 문서에는 이 세 필드가 없어, consistency-checker 등의 도구가 plan 종류를 자동으로 식별하거나 대상 spec 을 파악하기 어렵다.
- 제안: frontmatter 에 다음을 추가해 선례와 통일한다.
  ```yaml
  draft_for: spec-draft-cafe24-nonce-key-design.md
  status: draft (consistency-check pending)
  target_specs:
    - spec/4-nodes/4-integration/4-cafe24.md
  ```
  또는 `plan-lifecycle.md §4` 에 `spec-draft-*` 파일의 추가 frontmatter 필드를 공식 스키마로 등재해 규약화한다.

---

### [INFO] 문서 구조 — Overview 섹션이 "배경" 헤더로 대체됨

- target 위치: `plan/in-progress/spec-draft-cafe24-nonce-key-design.md` `## 배경` 섹션
- 위반 규약: `CLAUDE.md §정보 저장 위치` 및 각 SKILL.md 가 권장하는 "Overview / 본문 / Rationale 3섹션" 구성 (`CLAUDE.md` 본문 인용: "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale): 각 SKILL.md 참고"). 단, 이 3섹션 권장은 `spec/` 문서에 주로 적용되는 지침이며, plan 문서에 동일하게 강제되는 규약 문서 (`plan-lifecycle.md`) 는 별도 구조를 명시하지 않음.
- 상세: 첫 번째 섹션이 `## Overview` 대신 `## 배경` 으로 기재됐다. spec-draft plan 특성상 "배경" 이 의미적으로 더 정확할 수 있으나, 권장 패턴과의 의도적 이탈인지 단순 표기 차이인지 불분명하다. 선례인 `spec-draft-chat-channel-error-notify.md` 도 `## Change 1 ...` 형식으로 Overview 섹션을 두지 않아 일관성은 있다.
- 제안: spec-draft plan 에 대한 구조 패턴을 SKILL.md 또는 plan-lifecycle.md 에 명시해 명확화하거나, 현행 관행("배경 / 변경안 / 영향 범위 / Rationale" 구조)을 spec-draft plan 표준으로 등재하면 충분하다. 현재 상태로도 가독성·추적성 문제는 없다.

---

### [INFO] 변경 이력 표 (§C) 에 날짜 구분자 형식이 spec 규약과 별도 점검 필요

- target 위치: `plan/in-progress/spec-draft-cafe24-nonce-key-design.md` `### C. 변경 이력 행 추가` 섹션
- 위반 규약: 해당 없음 (본 plan 문서가 변경하려는 대상 `spec/4-nodes/4-integration/4-cafe24.md §변경 이력` 의 표 형식 규약이 본 규약 파일(`spec/conventions/**`)에 직접 기재된 바 없음).
- 상세: 변경 이력 표에 추가하려는 행의 날짜 컬럼 값이 `2026-05-28 (nonce-key-doc)` 형식인데, 이는 `spec/conventions/cafe24-api-catalog/_overview.md §7 CHANGELOG` 에서 사용하는 패턴(`2026-05-28 (nonce-key-doc)`)과 표기상 동일하다. 다만 target spec(`4-cafe24.md`) 의 변경 이력 표가 실제로 동일 형식을 쓰는지는 직접 확인 대상이다. 형식이 다를 경우 spec 에 반영 시 불일치가 발생한다.
- 제안: `spec/4-nodes/4-integration/4-cafe24.md` 의 기존 변경 이력 행 형식을 확인한 뒤 일치시킨다. 본 plan 단계에서는 INFO 수준.

---

## 발견되지 않은 항목 (규약 준수 확인)

1. **파일 명명 규약**: `plan/in-progress/spec-draft-cafe24-nonce-key-design.md` — kebab-case, `spec-draft-` prefix 로 선례(`spec-draft-chat-channel-error-notify.md`)와 동일 패턴. 규약 준수.
2. **frontmatter 의무 필드**: `worktree: cleanup-followups`, `started: 2026-05-28`, `owner: project-planner` 모두 존재. `plan-lifecycle.md §4` 스키마 준수.
3. **Rationale 섹션**: `## Rationale` 헤더로 문서 끝에 존재. 권장 구성 준수.
4. **대상 spec 경로 형식**: `spec/4-nodes/4-integration/4-cafe24.md §9.8` — 레포 루트 기준 상대경로, 기존 spec 경로 체계와 일치.
5. **API 문서 규약 적용 불필요**: 본 plan 은 OpenAPI/Swagger 데코레이터·DTO 를 다루지 않음. 해당 없음.
6. **금지 항목**: conventions 에서 금지한 패턴 (예: `status: deprecated` 를 spec frontmatter 에 사용하는 것, plan 최상위 `plan/*.md` 배치 등) 없음.
7. **`spec-impl-evidence.md` 의무 대상 확인**: 본 파일은 `plan/in-progress/` 에 위치하므로 spec frontmatter 의무(`§1 적용 대상: spec/2-*/spec/3-*/spec/4-*/spec/5-*/spec/conventions/**`)에서 제외. 해당 없음.

---

## 요약

정식 규약(`spec/conventions/**`, `plan-lifecycle.md`) 의 명시적 항목은 대부분 준수한다. 파일 명명(kebab-case, `spec-draft-` prefix), 필수 frontmatter 3필드(`worktree`/`started`/`owner`), `Rationale` 섹션 존재 등 핵심 구조는 규약에 맞다. 다만 같은 디렉토리 내 유일한 선례인 `spec-draft-chat-channel-error-notify.md` 와 비교할 때 `draft_for`, `status`, `target_specs` 필드가 누락되어 있어, 이 사실상의 관행이 규약으로 정착된 경우 WARNING 수준의 불일치가 된다. 현재 `plan-lifecycle.md` 는 spec-draft 특화 frontmatter 를 공식 스키마로 규정하지 않으므로 CRITICAL 위반은 없다.

---

## 위험도

LOW
