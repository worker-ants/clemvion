# Convention Compliance Review

**검토 모드**: spec draft 검토 (--spec)
**Target 문서**: `plan/in-progress/spec-fix-isactive-drawer-toggle.md`
**검토 기준**: `spec/conventions/**`

> 참고: prompt 에 임베드된 target 내용(결정 2026-05-29 포함 갱신 버전)과 디스크의 실제 파일 내용이 상이하다. 본 검토는 prompt 에 제시된 임베드 버전(갱신 완료 상태)을 분석 대상으로 삼는다.

---

## 발견사항

### [WARNING] frontmatter 에 비표준 필드 `source` 포함

- **target 위치**: frontmatter 5번째 행 — `source: ai-review INFO-7 / review/code/2026/05/22/15_08_07/requirement.md`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`
  - 정의된 의무 필드: `worktree`, `started`, `owner`
  - 추가 허용 필드에 대한 명시적 언급 없음
- **상세**: `plan-lifecycle.md §4` 가 정의하는 frontmatter 스키마에는 `source` 필드가 없다. 비표준 필드 추가는 `plan_coherence` checker 및 기타 자동화 도구가 이 키를 인식하지 못해 무시하거나, 향후 스키마 정합성 가드가 추가될 때 fail 유발 가능성이 있다.
- **제안**: `source` 정보를 frontmatter 밖 본문 첫 절(`## 원본 발견사항`)에서 이미 서술하고 있으므로 frontmatter 의 `source` 행을 제거하는 것이 권장된다. 프로젝트 차원에서 `source` 를 표준 필드로 채택할 의도라면 `.claude/docs/plan-lifecycle.md §4` 스키마를 갱신해야 한다.

---

### [WARNING] 결정 확정 후에도 plan 이 `in-progress/` 에 남아있고 완료 실행 단계가 체크박스 없이 서술됨

- **target 위치**: 문서 전체 구조 — `## 결정 (2026-05-29): Option B 채택` + `### 적용 변경 (spec/2-navigation/2-trigger-list.md)` 절
- **위반 규약**: `.claude/docs/plan-lifecycle.md §2 분류 기준` + `§5 이동 commit 자가 점검`
  - "미체크 체크박스(`[ ]`), `TODO`, `남은 작업`, `다음 단계`, `결정 필요`, 미해결 follow-up 이 **하나라도** 있으면 `in-progress/`"
  - 완료 조건: 모든 체크박스 `[x]` + 미해결 follow-up 0건
- **상세**: `### 적용 변경` 절은 실제 spec 파일 편집 작업(§2.3.1 행 변경, Rationale R-16 신설) 2건을 번호 목록으로 나열한다. 그러나 이 작업이 완료됐는지 여부를 체크박스 없이 산문으로만 서술하여 `plan_coherence` checker 가 잔여 작업 유무를 자동 추적할 수 없다. spec 편집이 아직 실행되지 않았다면 해당 작업을 `- [ ]` 체크박스로 전환해야 plan-lifecycle 규약에 맞다. 이미 실행 완료됐다면 `- [x]` 로 표시하고 `plan/complete/` 로 `git mv` 이동해야 한다.
- **제안**:
  - 미완료 시: `### 적용 변경` 하위 항목을 체크박스로 전환:
    ```
    - [ ] spec/2-navigation/2-trigger-list.md §2.3.1 isActive 행 변경
    - [ ] Rationale R-16 신설
    ```
  - 완료 시: 모든 항목 `[x]` + `plan-lifecycle.md §5` 자가 점검 후 `plan/complete/` 이동 commit.

---

### [INFO] 제목에 `Draft` 표현이 결정 확정 후에도 잔류

- **target 위치**: H1 제목 — `# Spec Fix Draft — isActive drawer 내 편집 여부 명확화`
- **위반 규약**: 명시적 강제 규약 없음 (INFO 수준)
- **상세**: 제목에 `Draft` 라는 단어가 포함되어 있으나 문서 내 결정은 2026-05-29 기준으로 이미 확정됐다. 제목이 문서 현재 상태를 오독하게 할 수 있다.
- **제안**: 결정 완료 후 제목에서 `Draft` 를 제거하거나 완료 시점에 제목을 갱신한다. 강제 규약은 아님.

---

### [INFO] `## 영향 범위` 내 기각된 Option A 조건부 항목 잔류

- **target 위치**: `## 영향 범위` — `(Option A 선택 시) 신규 plan + codebase 구현`
- **위반 규약**: 특정 conventions 위반이 아닌 문서 내 일관성 문제 (INFO 수준)
- **상세**: Option B 채택 확정 후에도 `(Option A 선택 시)` 항목이 영향 범위 목록에 남아 있어 독자가 현재 영향 범위를 오독할 수 있다. 기각 옵션의 내용은 이미 `## 기존 옵션 (참고용 보존)` 절에 별도 보존되어 있어 영향 범위 절 내 중복이다.
- **제안**: `## 영향 범위` 항목에서 `(Option A 선택 시)` 행을 삭제하고, 확정된 변경 항목만 남긴다.

---

## 요약

`plan/in-progress/spec-fix-isactive-drawer-toggle.md` 는 `plan-lifecycle.md §4` 가 정의하는 frontmatter 스키마에 비표준 필드(`source`)를 포함하고 있어 향후 스키마 가드 확장 시 문제가 될 수 있다. 더 실질적인 우려는 결정이 이미 확정된 상태에서 실행 단계(spec 편집 2건) 완료 여부가 체크박스 없이 산문으로만 서술되어 있어, plan-lifecycle 이 요구하는 자동화 추적이 불가능하다는 점이다. spec 편집이 완료됐다면 `plan/complete/` 이동 조건 점검이 필요하고, 아직 반영 전이라면 체크박스로 잔여 작업을 명시해야 한다. 나머지 사항은 제목의 `Draft` 잔류 및 영향 범위 불일치로 INFO 수준이다.

## 위험도

LOW
