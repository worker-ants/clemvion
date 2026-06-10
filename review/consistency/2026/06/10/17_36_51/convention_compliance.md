# Convention Compliance Review

**Target**: `plan/in-progress/spec-update-trigger-schedule-sync.md`
**Mode**: spec draft 검토 (--spec)
**Date**: 2026-06-10

---

## 발견사항

### [WARNING] plan frontmatter 에 `spec_impact` 필드 누락

- **target 위치**: frontmatter (lines 1–5)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` (Gate C) + `.claude/docs/plan-lifecycle.md §5 Gate C`
- **상세**: Gate C 규약은 `started ≥ 2026-06-04` 인 plan 이 `complete/` 로 이동할 때 `spec_impact` 필드를 frontmatter 에 선언하도록 강제한다. 본 plan 은 `started: 2026-06-10` 으로 cutoff 이후 시작이므로 완료 시점에 `spec_impact` 가 필수다. 현재 in-progress 단계이므로 build guard (`spec-plan-completion.test.ts`) 가 즉시 차단하지는 않지만, 완료 이동 전 추가하지 않으면 게이트에서 실패한다. 이 plan 이 다루는 spec 파일은 명확히 식별되어 있으므로 (`spec/1-data-model.md`, `spec/data-flow/10-triggers.md`, `spec/2-navigation/3-schedule.md`) 미리 선언해 두는 것이 권장된다.
- **제안**: 완료 이동 시 또는 미리 아래 내용을 frontmatter 에 추가한다.
  ```yaml
  spec_impact:
    - spec/1-data-model.md
    - spec/data-flow/10-triggers.md
    - spec/2-navigation/3-schedule.md
  ```

---

### [WARNING] `spec/data-flow/10-triggers.md` 는 spec-impl-evidence frontmatter 적용 대상이 아님 — 해당 파일에 `id`/`status` 가 없어도 가드 통과이나 plan 이 변경을 지시함

- **target 위치**: 섹션 "갱신 대상 4곳" §2 및 §4 (`spec/data-flow/10-triggers.md` 변경 지시)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` (적용 대상 목록)
- **상세**: `spec-impl-evidence.md §1` 의 frontmatter 의무 inclusive list 는 `spec/2-navigation/**`, `spec/3-workflow-editor/**`, `spec/4-nodes/**`, `spec/5-system/**`, `spec/7-channel-web-chat/**`, `spec/conventions/**` 이다. `spec/data-flow/` 는 이 목록에 포함되지 않는다. 실제로 확인 결과 `spec/data-flow/10-triggers.md` 에는 frontmatter(`id`/`status`)가 없으며 `1-data-model.md` 도 동일하게 면제 basename 이다. 따라서 plan 이 이 파일들을 갱신해도 frontmatter 가드 위반이 발생하지 않는다는 점에서 plan 내용 자체는 안전하다. 단, plan 검토자 입장에서 `spec/data-flow/10-triggers.md` 에 대한 `spec_impact` 선언이 Gate C 검증 대상인지 혼동될 수 있으므로 명시적으로 나쁘지 않다. **규약 위반 아님 — 참고 수준**.
- **제안**: 해당 파일들이 frontmatter 의무에서 제외된 파일임을 확인. plan `spec_impact` 에는 경로를 포함시켜도 Gate C guard 가 "실존 path" 만 검사하므로 선언 가능하다.

---

### [INFO] 문서 구조 — Overview / 본문 / Rationale 3섹션 권장 미적용

- **target 위치**: 문서 전체 구조
- **위반 규약**: CLAUDE.md §정보 저장 위치 (spec 문서 3섹션 구성 권장), 각 SKILL.md 참고
- **상세**: 본 target 은 plan 문서(`plan/in-progress/`)로, spec 문서가 아니다. 3섹션 권장은 spec 파일에 적용되며 plan 문서에는 적용되지 않는다. plan 형식은 `.claude/docs/plan-lifecycle.md §4` 의 frontmatter 스키마 + 체크리스트 본문이 기준이다. 현재 plan 은 frontmatter(worktree/started/owner) 3필드를 모두 갖추고 있어 plan 형식 의무는 충족된다.
- **제안**: 별도 조치 불필요. 참고 정보.

---

### [INFO] `관련 plan` 참조 파일 실존 여부 미확인

- **target 위치**: `## 추가 정보` 섹션 — `plan/in-progress/trigger-schedule-reverse-sync.md`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` (spec-link-integrity — plan 링크는 plan-coherence 담당이므로 링크 무결성 가드 대상은 아님)
- **상세**: 본 plan 이 참조하는 `plan/in-progress/trigger-schedule-reverse-sync.md` 가 실제로 존재하는지 확인 결과 해당 파일이 현재 `plan/in-progress/` 에 없다 (검색 결과 미발견). `spec-link-integrity.test.ts` 는 `plan/` 링크를 검증하지 않으므로 build 차단은 발생하지 않지만, plan 문서 내 dead link 는 일관성을 저해한다. 해당 plan 이 이미 `plan/complete/` 로 이동했거나 다른 이름으로 존재할 수 있다.
- **제안**: `plan/in-progress/trigger-schedule-reverse-sync.md` 의 실제 경로를 확인하고 링크를 정확한 경로로 갱신한다.

---

## 요약

`plan/in-progress/spec-update-trigger-schedule-sync.md` 는 plan-lifecycle 규약의 필수 frontmatter 3필드(worktree/started/owner)를 모두 충족하고, 갱신 대상 spec 파일과 before/after 변경 내용을 명확히 서술한 잘 구조화된 plan 문서다. 가장 주의할 사항은 Gate C(`spec_impact`) 필드로, `started: 2026-06-10` 이므로 완료(`complete/`) 이동 시 `spec-plan-completion.test.ts` 가 이 필드를 강제한다 — 미리 선언해 두거나 완료 이동 커밋에 반드시 포함해야 한다. `plan/in-progress/trigger-schedule-reverse-sync.md` 참조 링크의 실존 여부도 확인이 필요하다. 나머지 발견 사항은 모두 INFO 수준이다.

---

## 위험도

LOW
