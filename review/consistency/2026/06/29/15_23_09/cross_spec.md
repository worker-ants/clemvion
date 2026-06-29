# Cross-Spec 일관성 검토 결과

대상: `spec/conventions/user-guide-evidence.md`
검토 기준: 6개 관점 (데이터 모델 / API 계약 / 요구사항 ID / 상태 전이 / RBAC / 계층 책임)

---

## 발견사항

### [INFO] `i18n-userguide.md §Principle 7` 의 GUI 강조패턴 표현이 target 보다 제한적

- **target 위치**: `spec/conventions/user-guide-evidence.md §2` — `integrations-coverage.test.ts` 가드 설명
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/spec-userguide-evidence-sync-cc513c/spec/conventions/i18n-userguide.md` §Principle 7 (line 172)
- **상세**:
  - target: 절 본문에 `GUI` 를 포함한 bold strong(`**…GUI…**` / `__…GUI…__`) 이 **어느 위치에든** 존재하면 GUI flow 절로 판정 (`findGuiFlowSections()` OR 조건 2)
  - i18n-userguide §Principle 7: `**GUI ...**` strong 패턴으로 **시작하거나** heading 에 `GUI` 키워드를 가진 절이라고 기술 — "시작" 이라는 더 좁은 위치 제약을 암시
  - i18n-userguide 가 target 을 SoT 로 명시(`SoT: spec/conventions/user-guide-evidence.md`)하므로 구현 상 불일치는 target 정의가 우선한다. 그러나 i18n-userguide 의 2차 기술이 target 보다 협소해 독자가 혼동할 수 있다.
- **제안**: i18n-userguide §Principle 7 의 `**GUI ...**` 패턴 설명을 "절 본문 어디에든 bold/strong 으로 GUI 를 포함" 표현으로 동기화. target 변경 불필요.

### [INFO] target §5 "후속으로 명시한다" 표현이 이미 반영된 상태

- **target 위치**: `spec/conventions/user-guide-evidence.md §5` — "후속으로 `i18n-userguide.md §Principle 7` 본문에 본 가드의 부분 커버 범위를 명시한다"
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/spec-userguide-evidence-sync-cc513c/spec/conventions/i18n-userguide.md` §Principle 7 (line 170–173)
- **상세**: i18n-userguide §Principle 7 은 이미 "GUI 흐름 절은 `<ImplAnchor kind="ui-entry">` 동반 의무 … SoT: spec/conventions/user-guide-evidence.md … 가이드가 약속한 UI entry symbol 이 코드에서 사라지면 build 시점에 차단"을 포함해 부분 커버 범위를 명시하고 있다. target 의 "후속으로 명시한다" 는 이미 완료된 상태이므로 해당 문구가 stale 하다.
- **제안**: target §5 의 "후속으로 … 명시한다" 문구를 "본 컨벤션 도입 시 `i18n-userguide.md §Principle 7` 에 부분 커버 범위를 반영했다" 식으로 현재 시제로 갱신. CRITICAL·WARNING 수준 충돌은 아님.

### [INFO] `spec-impl-evidence.md §4.1` 관계 기술 — `nodes-coverage` 방향 표현 차이

- **target 위치**: `spec/conventions/user-guide-evidence.md §2.1` — `nodes-coverage.test.ts` 와의 관계
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/spec-userguide-evidence-sync-cc513c/spec/conventions/spec-impl-evidence.md` §4.1 (line 119)
- **상세**:
  - target §2.1: "`nodes-coverage` = backend 노드 등록부 → 가이드에 항목 등장" (동일 방향으로 기술)
  - spec-impl-evidence §4.1: "`nodes-coverage.test.ts` (backend 노드 → 가이드 본문 등장) 와는 **방향이 직교**" — 본 컨벤션(spec→구현)과 nodes-coverage(등록부→가이드)가 직교라고 표현
  - 두 문서 모두 nodes-coverage 방향을 "등록부→가이드 본문 등장"으로 일치해 설명하나, target 이 `integrations-coverage`/`triggers-coverage` 와 nodes-coverage 를 "방향이 동일"하다고 기술한 부분(target §2.1: "방향이 동일(가이드 ← 등록부) 하나 enumeration vs free-form 으로 보완")은 spec-impl-evidence §4.1 과의 직접 충돌 아님 — target 이 비교하는 pair 가 다르기 때문 (`integrations-coverage` vs `nodes-coverage`, spec-impl-evidence 는 `spec-code-paths.test.ts` vs `nodes-coverage`).
- **제안**: 이슈 없음. 기술 대상 pair 가 달라 모순이 아님. 단 독자가 두 문서를 교차 읽을 때 혼동할 수 있으므로 target §2.1 에 "spec-impl-evidence 의 §4.1 에서 nodes-coverage 를 '직교'라 표현한 것은 spec→구현 가드와의 관계이며, 본 가드(가이드→구현)와는 방향이 동일"이라는 clarification 을 추가하면 명확해진다. 선택 사항.

---

## 요약

`spec/conventions/user-guide-evidence.md` 는 기존 `spec/conventions/spec-impl-evidence.md`, `spec/conventions/i18n-userguide.md`, `spec/2-navigation/13-user-guide.md`, `PROJECT.md`, `.claude/agents/user-guide-writer.md` 와 전반적으로 정합한다. `<ImplAnchor>` props 정의(kind/file/symbol/describes), 4가지 kind enum 값, 3개 build-time 가드(impl-anchor-existence / integrations-coverage / triggers-coverage), spec-impl-evidence 와의 관계(직교 검증 대상), PROJECT.md 유저 가이드 파일 컨벤션 인덱스 등재(결정 E-5) 모두 일관하다. 발견된 사항은 INFO 3건으로, i18n-userguide §Principle 7 의 GUI 강조패턴 기술이 target 보다 제한적으로 서술된 동기화 권장 사항과, target §5 의 "후속으로 명시한다" 표현이 이미 완료된 상태의 stale 문구임에 그친다. CRITICAL·WARNING 충돌은 없다.

---

## 위험도

LOW
