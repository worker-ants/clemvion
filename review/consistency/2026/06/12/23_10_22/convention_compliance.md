# 정식 규약 준수 검토 결과

**검토 모드**: spec draft (--spec)
**Target**: `plan/in-progress/spec-draft-audit-workspace-scope.md`

---

## 발견사항

### INFO: plan frontmatter 필수 3필드 완전 충족 (확인)
- **target 위치**: frontmatter (lines 1-5)
- **위반 규약**: 없음. `.claude/docs/plan-lifecycle.md §4` 기준 완전 충족.
- **상세**: `worktree: refactor-04-followups2-1de843`, `started: 2026-06-12`, `owner: project-planner` 모두 존재하고 형식 적합.
- **제안**: 변경 불요.

---

### INFO: spec 3섹션 구조(Overview / 본문 / Rationale) — plan 문서 비강제, 유사 패턴 준수
- **target 위치**: 문서 전체 구조
- **위반 규약**: 없음. CLAUDE.md 3섹션 구조 권장은 `spec/` 파일 대상이며 `plan/in-progress/` 파일에는 강제되지 않음.
- **상세**: `## 결정 1`, `## 결정 2`, `## Rationale 연속성` 구성이 결정 근거를 명시하는 유사 패턴을 따름. spec draft plan 형식으로 적절.
- **제안**: 변경 불요.

---

### INFO: spec-impl-evidence frontmatter(id/status/code) 비대상 — 정상
- **target 위치**: frontmatter 전체
- **위반 규약**: 없음. `spec/conventions/spec-impl-evidence.md §1` 적용 대상 목록(`spec/2-navigation/**.md` 등)에 `plan/in-progress/` 포함되지 않음.
- **상세**: `id`·`status`·`code:` 필드 부재는 규약 위반이 아님. plan frontmatter 가드(`plan-frontmatter.test.ts`)는 3필드만 요구.
- **제안**: 변경 불요.

---

### INFO: `complete/` 이동 시 Gate C(`spec_impact`) 선언 필요
- **target 위치**: 문서 전체 (미래 완료 시점)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2 Gate C` + `.claude/docs/plan-lifecycle.md §5 Gate C` — `started ≥ 2026-06-04` 인 완료 plan 은 `spec_impact` 선언 의무.
- **상세**: 본 문서 `started: 2026-06-12` 는 cutoff `2026-06-04` 이후이므로 `complete/` 이동 시 Gate C 적용. 결정 1 반영 위치(`1-auth §4.1`, `data-flow/1-audit.md §1.1`)와 결정 2 반영 위치(`§Rationale 2.3.B`)는 실존 spec 파일 경로가 아닌 섹션 참조 메모. 이동 시 frontmatter `spec_impact:` 에 실존 파일 경로 등재 필요. 코드 변경 없는 spec-only 갱신이므로 실제로 spec 파일만 수정된다면 해당 파일 목록을, 미수정이라면 `spec_impact: none` sentinel 사용.
- **제안**: `complete/` 이동 commit 시 frontmatter 에 다음 형식으로 추가:
  ```yaml
  spec_impact:
    - spec/1-auth.md          # §4.1 + Rationale 4.1.B 반영 위치
    - spec/data-flow/1-audit.md  # §1.1 반영 위치
  ```
  또는 spec 변경이 없는 경우 `spec_impact: none`. 실제 파일 경로는 존재 여부 확인 후 확정.

---

## 요약

`plan/in-progress/spec-draft-audit-workspace-scope.md` 는 정식 규약 준수 관점에서 현재 단계 기준 위반 사항이 없다. plan frontmatter 필수 3필드가 완전히 충족되고, spec-impl-evidence 의무가 적용되지 않는 경로이며, plan 문서 특성상 spec 3섹션 구조 강제 대상도 아니다. 결정 근거(`## Rationale 연속성`)가 명시되어 있어 결정 추적성도 유지된다. 유일한 후속 주의 사항은 `complete/` 이동 시 Gate C(`spec_impact` frontmatter 선언)를 충족해야 한다는 점이며, `started: 2026-06-12` 로 cutoff 이후이므로 의무가 발생한다. CRITICAL·WARNING 등급 위반 사항은 없다.

## 위험도

NONE
